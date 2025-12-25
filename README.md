# PeakInfer GitHub Action

[![GitHub Marketplace](https://img.shields.io/badge/Marketplace-PeakInfer-blue?logo=github)](https://github.com/marketplace/actions/peakinfer)
[![Get Token](https://img.shields.io/badge/Get%20Token-peakinfer.com-purple)](https://peakinfer.com/dashboard)

> Catch LLM inference issues before they hit production. Analyzes cost, latency, throughput, and reliability.

## How It Works

```
┌─────────────────┐      ┌─────────────────┐      ┌─────────────────┐
│   Your Repo     │      │  GitHub Action  │      │  peakinfer.com  │
│                 │      │                 │      │                 │
│  PR opened ────────────► Analyzes code ─────────► Returns issues  │
│                 │      │                 │      │                 │
│  ◄──────────────────── Posts comment ◄─────────                   │
└─────────────────┘      └─────────────────┘      └─────────────────┘
```

**You need a token from [peakinfer.com](https://peakinfer.com/dashboard)** — sign in with GitHub, generate token, add to repo secrets.

---

## Quickstart (2 minutes)

### 1. Get Token → [peakinfer.com/dashboard](https://peakinfer.com/dashboard)

Sign in with GitHub → Click "Generate Token" → Copy it (shown once)

*50 free credits included, no credit card needed*

### 2. Add to Repo Secrets

Your repo → **Settings** → **Secrets and variables** → **Actions** → **New secret**

- Name: `PEAKINFER_TOKEN`
- Value: *paste your token*

### 3. Create Workflow

Create `.github/workflows/peakinfer.yml`:

```yaml
name: PeakInfer
on: [pull_request]

jobs:
  analyze:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: kalmantic/peakinfer-action@v1
        with:
          token: ${{ secrets.PEAKINFER_TOKEN }}
```

**Done!** Open a PR to see the analysis.

---

## What You'll See

PeakInfer posts a comment on every PR:

```markdown
## PeakInfer Analysis

Found **3 inference points** across 2 files

### Issues

| Location | Severity | Issue |
|----------|----------|-------|
| `src/chat.ts:42` | 🔴 critical | GPT-4 used for simple classification task |
| `src/api.ts:89` | 🟡 warning | No retry logic on API call |
| `src/api.ts:156` | 🟡 warning | Streaming enabled but not consumed |

---
*Credits remaining: 47 • [PeakInfer](https://peakinfer.com)*
```

---

## Configuration

```yaml
- uses: kalmantic/peakinfer-action@v1
  with:
    token: ${{ secrets.PEAKINFER_TOKEN }}  # Required
    path: ./src                             # Directory to analyze
    fail-on-critical: true                  # Block PR on critical issues
```

### All Options

| Input | Default | Description |
|-------|---------|-------------|
| `token` | — | **Required.** Get at [peakinfer.com/dashboard](https://peakinfer.com/dashboard) |
| `path` | `./src` | Directory to analyze |
| `fail-on-critical` | `false` | Fail check if critical issues found |
| `inline-comments` | `true` | Post inline PR comments |
| `compare-baseline` | `false` | Compare to previous analysis |

### Outputs

```yaml
- uses: kalmantic/peakinfer-action@v1
  id: peakinfer
  with:
    token: ${{ secrets.PEAKINFER_TOKEN }}

- run: echo "Found ${{ steps.peakinfer.outputs.issues }} issues"
```

| Output | Description |
|--------|-------------|
| `status` | `pass`, `warning`, or `fail` |
| `inference-points` | Number of LLM calls detected |
| `issues` | Number of issues found |

---

## What It Catches

| Dimension | Examples |
|-----------|----------|
| **Cost** | GPT-4 for simple tasks, over-tokenized prompts |
| **Latency** | Missing streaming, blocking calls |
| **Throughput** | Sequential calls that could be parallel |
| **Reliability** | No retries, missing timeouts, no fallbacks |

---

## Troubleshooting

<details>
<summary><strong>Invalid token</strong></summary>

- Check secret name is exactly `PEAKINFER_TOKEN`
- Verify token at [peakinfer.com/dashboard](https://peakinfer.com/dashboard)
- Generate a new token if needed

</details>

<details>
<summary><strong>Insufficient credits</strong></summary>

- Check balance at [peakinfer.com/dashboard](https://peakinfer.com/dashboard)
- Buy credits at [peakinfer.com/pricing](https://peakinfer.com/pricing)

</details>

<details>
<summary><strong>Action not running</strong></summary>

- File must be in `.github/workflows/`
- Actions must be enabled: Settings → Actions → General
- Trigger must be `pull_request`

</details>

---

## Links

| | |
|---|---|
| **Get Token** | [peakinfer.com/dashboard](https://peakinfer.com/dashboard) |
| **Buy Credits** | [peakinfer.com/pricing](https://peakinfer.com/pricing) |
| **CLI (BYOK)** | [github.com/kalmantic/peakinfer](https://github.com/kalmantic/peakinfer) |

---

MIT License
