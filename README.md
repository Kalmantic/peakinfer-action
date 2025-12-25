# PeakInfer GitHub Action

Analyze LLM inference points in your pull requests for cost, latency, throughput, and reliability issues.

## Usage

```yaml
name: PeakInfer
on:
  pull_request:
    branches: [main]

jobs:
  analyze:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: kalmantic/peakinfer-action@v1
        with:
          token: ${{ secrets.PEAKINFER_TOKEN }}
          path: ./src
```

## Inputs

| Input | Required | Default | Description |
|-------|----------|---------|-------------|
| `token` | Yes | — | PeakInfer API token ([get one](https://peakinfer.com)) |
| `path` | No | `./src` | Path to analyze |
| `github-token` | No | `${{ github.token }}` | GitHub token for PR comments |
| `events` | No | — | Path to runtime events file (JSONL) |
| `events-map` | No | — | Field mappings for non-standard formats |
| `inline-comments` | No | `true` | Post inline comments on specific lines |
| `fail-on-critical` | No | `false` | Fail if critical issues found |
| `compare-baseline` | No | `false` | Compare to previous analysis |

## Outputs

| Output | Description |
|--------|-------------|
| `status` | Analysis status (`pass`, `warning`, `fail`) |
| `inference-points` | Number of inference points found |
| `issues` | Number of issues found |
| `summary` | JSON summary of results |

## What It Analyzes

PeakInfer detects issues across 4 dimensions:

- **Cost** — Wrong model selection, overpowered usage
- **Latency** — Missing streaming, blocking calls
- **Throughput** — Sequential vs parallel opportunities
- **Reliability** — Missing retries, timeouts, fallbacks

## Runtime Drift Detection

Provide runtime events to detect drift between code and actual behavior:

```yaml
- uses: kalmantic/peakinfer-action@v1
  with:
    token: ${{ secrets.PEAKINFER_TOKEN }}
    path: ./src
    events: ./events.jsonl
```

## Pricing

See [peakinfer.com/pricing](https://peakinfer.com/pricing) for credit packs.

## CLI

For local analysis with your own API key (BYOK), use the [PeakInfer CLI](https://github.com/kalmantic/peakinfer).

## License

MIT
