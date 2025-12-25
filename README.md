# PeakInfer GitHub Action

Analyze LLM inference points in your pull requests for cost, latency, throughput, and reliability issues.

## Setup

### 1. Get Your API Token

1. Go to [peakinfer.com](https://peakinfer.com)
2. Sign in with GitHub
3. Navigate to **Settings** → **API Tokens**
4. Click **Generate Token**
5. Copy the token (you won't see it again)

New accounts get **50 free credits** (no credit card required).

### 2. Add Token to Repository Secrets

1. Go to your GitHub repository
2. Navigate to **Settings** → **Secrets and variables** → **Actions**
3. Click **New repository secret**
4. Name: `PEAKINFER_TOKEN`
5. Value: Paste your token from step 1
6. Click **Add secret**

### 3. Create Workflow File

Create `.github/workflows/peakinfer.yml` in your repository:

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

That's it! PeakInfer will now analyze every PR for LLM inference issues.

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

## Troubleshooting

### "Invalid or missing token"

- Verify the secret name is exactly `PEAKINFER_TOKEN` (case-sensitive)
- Check the token hasn't expired at [peakinfer.com/settings](https://peakinfer.com/settings)
- Regenerate the token if needed

### "Insufficient credits"

- Check your balance at [peakinfer.com/settings](https://peakinfer.com/settings)
- Purchase credits at [peakinfer.com/pricing](https://peakinfer.com/pricing)

### Action not running

- Ensure the workflow file is in `.github/workflows/`
- Check the `on:` trigger matches your use case (e.g., `pull_request`)
- Verify the repository has Actions enabled (Settings → Actions → General)

### For organization repositories

Add the secret at the organization level:
1. Go to **Organization Settings** → **Secrets and variables** → **Actions**
2. Add `PEAKINFER_TOKEN` as an organization secret
3. Grant access to specific repositories

## CLI

For local analysis with your own API key (BYOK), use the [PeakInfer CLI](https://github.com/kalmantic/peakinfer).

## License

MIT
