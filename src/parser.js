(function (root) {
  'use strict';

  const MAX_SOURCE_BYTES = 5 * 1024 * 1024;
  const LEVELS = Object.freeze(['TRACE', 'DEBUG', 'INFO', 'WARN', 'ERROR', 'FATAL', 'UNKNOWN']);
  const ISO_TIMESTAMP = /^(\s*)((\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.(\d{3}))?(Z|[+-]\d{2}:\d{2}))(?=\s|$)/;
  const LOCAL_TIMESTAMP = /^(\s*)((\d{4})-(\d{2})-(\d{2}) (\d{2}):(\d{2}):(\d{2})(?:\.(\d{3}))?)(?=\s|$)/;
  const LEVEL_PATTERN = /\b(TRACE|DEBUG|INFO|WARN(?:ING)?|ERROR|FATAL)\b/i;
  const OFFSET_ERROR = 'UTC offset must use ±HH:mm and stay between -14:00 and +14:00.';

  function parseOffset(value) {
    const match = /^([+-])(\d{2}):(\d{2})$/.exec(value);
    if (!match) throw new RangeError(OFFSET_ERROR);

    const hours = Number(match[2]);
    const minutes = Number(match[3]);
    if (hours > 14 || minutes > 59 || (hours === 14 && minutes !== 0)) {
      throw new RangeError(OFFSET_ERROR);
    }

    return (match[1] === '-' ? -1 : 1) * (hours * 60 + minutes);
  }

  function daysInMonth(year, month) {
    if (month === 2) return year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0) ? 29 : 28;
    return [4, 6, 9, 11].includes(month) ? 30 : 31;
  }

  function timestampEpoch(match, offsetMinutes) {
    const year = Number(match[3]);
    const month = Number(match[4]);
    const day = Number(match[5]);
    const hour = Number(match[6]);
    const minute = Number(match[7]);
    const second = Number(match[8]);
    const millisecond = Number(match[9] || 0);

    if (
      month < 1 || month > 12 || day < 1 || day > daysInMonth(year, month) ||
      hour > 23 || minute > 59 || second > 59
    ) return null;

    const date = new Date(0);
    date.setUTCFullYear(year, month - 1, day);
    date.setUTCHours(hour, minute, second, millisecond);
    return date.getTime() - offsetMinutes * 60_000;
  }

  function eventLevel(message) {
    const match = LEVEL_PATTERN.exec(message);
    if (!match) return 'UNKNOWN';
    const level = match[1].toUpperCase();
    return level === 'WARNING' ? 'WARN' : level;
  }

  function parseSources(sources, utcOffset = '') {
    if (!Array.isArray(sources)) throw new TypeError('sources must be an array.');
    const localOffset = utcOffset === '' ? null : parseOffset(utcOffset);
    const events = [];
    let sequence = 0;

    for (const source of sources) {
      if (!source || typeof source.name !== 'string' || source.name.trim() === '') {
        throw new TypeError('Source name is required.');
      }
      if (typeof source.text !== 'string') throw new TypeError('Source text must be a string.');

      const sourceName = source.name.trim();
      if (new TextEncoder().encode(source.text).length > MAX_SOURCE_BYTES) {
        throw new RangeError(`Source "${sourceName}" exceeds the 5 MiB limit.`);
      }
      if (source.text === '') continue;

      let current = null;
      const finish = () => {
        if (!current) return;
        const raw = current.lines.join('\n');
        const message = current.timestamp === null
          ? raw
          : [current.firstMessage, ...current.lines.slice(1)].join('\n');
        events.push({
          timestamp: current.timestamp,
          epochMs: current.epochMs,
          source: sourceName,
          level: eventLevel(message),
          message,
          raw,
          sequence: sequence++
        });
      };

      for (const line of source.text.split(/\r\n|\n|\r/)) {
        const iso = ISO_TIMESTAMP.exec(line);
        const local = iso ? null : LOCAL_TIMESTAMP.exec(line);
        const match = iso || local;

        if (!match) {
          if (!current) current = { timestamp: null, epochMs: null, lines: [], firstMessage: '' };
          current.lines.push(line);
          continue;
        }

        finish();
        let offsetMinutes;
        if (iso) {
          const zone = match[10];
          if (zone === 'Z') {
            offsetMinutes = 0;
          } else {
            try {
              offsetMinutes = parseOffset(zone);
            } catch {
              throw new RangeError(`Invalid timestamp: ${match[2]}`);
            }
          }
        } else {
          if (localOffset === null) {
            throw new RangeError('Select a UTC offset before parsing timestamps without a zone.');
          }
          offsetMinutes = localOffset;
        }

        const epochMs = timestampEpoch(match, offsetMinutes);
        if (epochMs === null) throw new RangeError(`Invalid timestamp: ${match[2]}`);
        current = {
          timestamp: new Date(epochMs).toISOString(),
          epochMs,
          lines: [line],
          firstMessage: line.slice(match[0].length).trim()
        };
      }
      finish();
    }

    return events.sort((left, right) => {
      if (left.epochMs === null) return right.epochMs === null ? left.sequence - right.sequence : 1;
      if (right.epochMs === null) return -1;
      return left.epochMs - right.epochMs || left.sequence - right.sequence;
    });
  }

  function filterEvents(events, filters = {}) {
    const sources = filters.sources || [];
    const levels = filters.levels || [];
    const query = (filters.query || '').trim().toLowerCase();

    return events.filter((event) => {
      if (sources.length && !sources.includes(event.source)) return false;
      if (levels.length && !levels.includes(event.level)) return false;
      if (!query) return true;
      return [event.source, event.timestamp || '', event.message, event.raw]
        .join('\n')
        .toLowerCase()
        .includes(query);
    });
  }

  const api = root.LogLoom || {};
  Object.assign(api, { MAX_SOURCE_BYTES, LEVELS, parseSources, filterEvents });
  root.LogLoom = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(globalThis);
