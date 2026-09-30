# MCP Capability Diff

Detect capability changes in MCP server snapshots and assess their security risk.

## Features

- Snapshot validation
- Capability/tool diffing
- Risk classification
- Rule evidence
- Text, JSON, and SARIF output
- CI-friendly exit codes
- GitHub Action support

## CLI

```bash
mcp-capability-diff <old-snapshot> <new-snapshot>
```

Options:

- `--format text|json|sarif`
- `--fail-on safe|low|medium|high|critical`
- `--explain`
- `--quiet`

## Development

```bash
npm install
npm test
npm run build
npm run build:action
```

## License

MIT
