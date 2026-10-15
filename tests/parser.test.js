'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { MAX_SOURCE_BYTES, LEVELS, parseSources, filterEvents } = require('../src/parser.js');

test('exports the frozen public constants', () => {
  assert.equal(MAX_SOURCE_BYTES, 5 * 1024 * 1024);
  assert.deepEqual(LEVELS, ['TRACE', 'DEBUG', 'INFO', 'WARN', 'ERROR', 'FATAL', 'UNKNOWN']);
  assert.equal(Object.isFrozen(LEVELS), true);
});

test('parses, merges, normalizes levels, and sorts multiple sources', () => {
  const events = parseSources([
    { name: ' api ', text: 'preface\n2026-10-15T10:00:00+02:00 INFO started\ndetail\n2026-10-15T08:00:00.000Z warning tied' },
    { name: 'worker', text: '2026-10-15 07:30:00 ERROR failed\ntrace' }
  ], '+01:00');

  assert.deepEqual(events.map(({ timestamp, source, level, message, sequence }) => ({ timestamp, source, level, message, sequence })), [
    { timestamp: '2026-10-15T06:30:00.000Z', source: 'worker', level: 'ERROR', message: 'ERROR failed\ntrace', sequence: 3 },
    { timestamp: '2026-10-15T08:00:00.000Z', source: 'api', level: 'INFO', message: 'INFO started\ndetail', sequence: 1 },
    { timestamp: '2026-10-15T08:00:00.000Z', source: 'api', level: 'WARN', message: 'warning tied', sequence: 2 },
    { timestamp: null, source: 'api', level: 'UNKNOWN', message: 'preface', sequence: 0 }
  ]);
  assert.equal(events[1].raw, '2026-10-15T10:00:00+02:00 INFO started\ndetail');
  assert.equal(events[0].epochMs, Date.parse('2026-10-15T06:30:00.000Z'));
});

test('keeps a whole timestamp-free source as one unparsed event', () => {
  const [event] = parseSources([{ name: 'plain', text: 'first\r\nsecond' }]);
  assert.equal(event.timestamp, null);
  assert.equal(event.raw, 'first\nsecond');
  assert.equal(event.message, event.raw);
});

test('recognizes every level token and preserves Unicode in a long line', () => {
  const longMessage = `未知 ${'界'.repeat(20_000)}`;
  const text = [
    '2026-10-15T08:00:00Z trace one',
    '2026-10-15T08:00:01Z DEBUG two',
    '2026-10-15T08:00:02Z INFO three',
    '2026-10-15T08:00:03Z WARN four',
    '2026-10-15T08:00:04Z warning five',
    '2026-10-15T08:00:05Z ERROR six',
    '2026-10-15T08:00:06Z FATAL seven',
    `2026-10-15T08:00:07Z ${longMessage}`
  ].join('\n');
  const events = parseSources([{ name: ' 日志 ', text }]);

  assert.deepEqual(events.map((event) => event.level), [
    'TRACE', 'DEBUG', 'INFO', 'WARN', 'WARN', 'ERROR', 'FATAL', 'UNKNOWN'
  ]);
  assert.equal(events[7].source, '日志');
  assert.equal(events[7].message, longMessage);
});

test('rejects invalid inputs, offsets, calendar dates, and oversized sources', () => {
  assert.throws(() => parseSources({}), { name: 'TypeError', message: 'sources must be an array.' });
  assert.throws(() => parseSources([{ name: ' ', text: '' }]), { name: 'TypeError', message: 'Source name is required.' });
  assert.throws(() => parseSources([{ name: 'x', text: null }]), { name: 'TypeError', message: 'Source text must be a string.' });
  assert.throws(() => parseSources([], '+14:01'), { name: 'RangeError', message: 'UTC offset must use ±HH:mm and stay between -14:00 and +14:00.' });
  assert.throws(
    () => parseSources([{ name: 'x', text: '2026-10-15 12:00:00 INFO' }]),
    { name: 'RangeError', message: 'Select a UTC offset before parsing timestamps without a zone.' }
  );
  assert.throws(
    () => parseSources([{ name: 'x', text: '2025-02-29T12:00:00Z INFO' }]),
    { name: 'RangeError', message: 'Invalid timestamp: 2025-02-29T12:00:00Z' }
  );
  assert.throws(
    () => parseSources([{ name: ' big ', text: 'a'.repeat(MAX_SOURCE_BYTES + 1) }]),
    { name: 'RangeError', message: 'Source "big" exceeds the 5 MiB limit.' }
  );
  assert.equal(parseSources([{ name: 'limit', text: 'a'.repeat(MAX_SOURCE_BYTES) }])[0].raw.length, MAX_SOURCE_BYTES);
});

test('filters without mutating order and returns a new array', () => {
  const events = parseSources([
    { name: 'api', text: '2026-10-15T08:00:00Z INFO Alpha' },
    { name: 'db', text: '2026-10-15T08:01:00Z ERROR Beta' }
  ]);
  const filtered = filterEvents(events, { sources: ['db'], levels: ['ERROR'], query: 'beta' });

  assert.notEqual(filtered, events);
  assert.equal(filtered.length, 1);
  assert.equal(filtered[0], events[1]);
  assert.deepEqual(filterEvents(events), events);
});
