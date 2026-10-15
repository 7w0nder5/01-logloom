'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const parserApi = require('../src/parser.js');
const exportApi = require('../src/export.js');

test('both scripts share the same API object', () => {
  assert.equal(exportApi, parserApi);
  assert.equal(globalThis.LogLoom, parserApi);
});

test('JSON includes only the five export fields in fixed order', () => {
  const event = {
    timestamp: '2026-10-15T08:00:00.000Z',
    epochMs: 1792051200000,
    source: 'api',
    level: 'INFO',
    message: 'ready',
    raw: '2026-10-15T08:00:00Z INFO ready',
    sequence: 0
  };

  assert.equal(exportApi.toJson([event]), `${JSON.stringify([{
    timestamp: event.timestamp,
    source: event.source,
    level: event.level,
    message: event.message,
    raw: event.raw
  }], null, 2)}\n`);
});

test('Markdown emits escaped headings and indented multiline messages', () => {
  const events = [
    {
      timestamp: '2026-10-15T08:00:00.000Z',
      source: 'api\\#*[x]<y>_`',
      level: 'INFO',
      message: 'first\nsecond',
      raw: 'unused'
    },
    { timestamp: null, source: 'worker', level: 'UNKNOWN', message: 'plain', raw: 'plain' }
  ];

  assert.equal(
    exportApi.toMarkdown(events),
    '# LogLoom timeline\n\n' +
      '## 2026-10-15T08:00:00.000Z — api\\\\\\#\\*\\[x\\]\\<y\\>\\_\\` — INFO\n\n' +
      '    first\n    second\n\n' +
      '## Unparsed — worker — UNKNOWN\n\n' +
      '    plain\n'
  );
});

test('Markdown reports an empty filtered result', () => {
  assert.equal(
    exportApi.toMarkdown([]),
    '# LogLoom timeline\n\nNo events match the current filters.\n'
  );
});
