(function (root) {
  'use strict';

  function exportedEvents(events) {
    return events.map(({ timestamp, source, level, message, raw }) => ({
      timestamp,
      source,
      level,
      message,
      raw
    }));
  }

  function toJson(events) {
    return `${JSON.stringify(exportedEvents(events), null, 2)}\n`;
  }

  function escapeHeading(value) {
    return String(value)
      .replace(/\\/g, '\\\\')
      .replace(/([*_`\[\]<>#])/g, '\\$1');
  }

  function toMarkdown(events) {
    if (events.length === 0) {
      return '# LogLoom timeline\n\nNo events match the current filters.\n';
    }

    const sections = events.map((event) => {
      const heading = [event.timestamp ?? 'Unparsed', event.source, event.level]
        .map(escapeHeading)
        .join(' — ');
      const body = event.message.split('\n').map((line) => `    ${line}`).join('\n');
      return `## ${heading}\n\n${body}`;
    });
    return `# LogLoom timeline\n\n${sections.join('\n\n')}\n`;
  }

  const api = root.LogLoom || {};
  Object.assign(api, { toMarkdown, toJson });
  root.LogLoom = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(globalThis);
