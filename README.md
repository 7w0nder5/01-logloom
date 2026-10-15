# LogLoom

LogLoom turns logs from several systems into one readable incident timeline. It runs entirely in the browser, needs no server or build step, and sends nothing over the network.

## Why it exists

During an incident, API, worker, proxy, and database logs often arrive as separate snippets. Their events are interleaved, stack traces span several lines, and timestamps without a zone are ambiguous. LogLoom gives those snippets a shared clock, keeps multiline events together, and exports the filtered result for a report or handoff.

## Use it

1. Download this repository and open `index.html` in a modern browser.
2. Name each source, paste its log text, and enter the UTC offset used by timestamps without a zone (for example, `+08:00`).
3. Select **解析并合并**, filter the merged events, then export Markdown or JSON.

No installation and no network connection are required.

## Supported input

Each event must begin with one of these timestamp forms:

```text
2026-10-15T08:41:03Z
2026-10-15T08:41:03.005+08:00
2026-10-15 16:41:03
2026-10-15 16:41:03.005
```

The first two forms include a zone. The space-separated forms do not, so LogLoom requires the UTC offset field before parsing them. Fractional seconds, when present, use exactly three digits.

Lines without a timestamp continue the preceding event. Text before the first timestamp is retained as an `UNKNOWN`, unparsed event instead of being discarded. Log levels are detected from `TRACE`, `DEBUG`, `INFO`, `WARN`, `WARNING`, `ERROR`, and `FATAL`; `WARNING` is normalized to `WARN`.

Try the files in [`examples`](examples): paste `api.log` and `worker.log` as two sources, use `+08:00`, and build the timeline.

## Output

The timeline is sorted by instant while preserving input order for equal timestamps. Source, level, and keyword filters affect both the screen and exports. JSON exports use only these fields:

```json
{
  "timestamp": "2026-10-15T08:41:03.005Z",
  "source": "API",
  "level": "ERROR",
  "message": "ERROR upstream timeout id=req-1042\n    at fetchProfile (profile.js:42:11)",
  "raw": "2026-10-15T08:41:03.005Z ERROR upstream timeout id=req-1042\n    at fetchProfile (profile.js:42:11)"
}
```

## Privacy and limits

- Log text stays in the current browser tab. LogLoom has no backend, analytics, cookies, or remote assets.
- Each source is limited to 5 MiB so one accidental paste cannot freeze the page indefinitely.
- Exported files contain the original log text. Review them for secrets before sharing.
- Version 0.1 recognizes the two timestamp families above. It does not infer time zones or accept custom parsing rules.

## Development

The application uses plain HTML, CSS, and JavaScript. Node.js 20 or newer is needed only to run the tests:

```sh
node --test
```

Continuous integration runs the same tests on Linux and Windows with Node.js 24. No package installation is needed.

## Contributing

Keep changes focused on reliable local timeline building. Include a test for parser, filtering, or export behavior changes, and avoid dependencies unless the platform cannot solve the problem clearly.

## License

[MIT](LICENSE)
