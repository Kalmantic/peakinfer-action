# PeakInfer GitHub Action

[![GitHub Marketplace](https://img.shields.io/badge/Marketplace-PeakInfer-blue?logo=github)](https://github.com/marketplace/actions/peakinfer)
[![Get Token](https://img.shields.io/badge/Get%20Token-peakinfer.com-purple)](https://peakinfer.com/dashboard)

**Achieve peak inference performance in every PR.**

Analyze LLM inference points for latency, throughput, reliability, and cost issues—automatically on every pull request.

## The Problem

Your code says `streaming: true`. Production shows 0% streams. That's **drift**—and you won't catch it until it's too late.

**Peak Inference Performance means:** Improving latency, throughput, reliability, and cost *without changing evaluated behavior*.

---

## How It Works

```
┌─────────────────┐      ┌─────────────────┐      ┌─────────────────┐
│   Your Repo     │      │  GitHub Action  │      │  peakinfer.com  │
│                 │      │                 │      │                 │
│  PR opened ────────────► Sends code ─────────────► Analyzes       │
│                 │      │                 │      │                 │
│  ◄──────────────────── Posts comment ◄─────────── Returns issues  │
└─────────────────┘      └─────────────────┘      └─────────────────┘
```

**Get your token at [peakinfer.com](https://peakinfer.com/dashboard)** — sign in with GitHub, generate token, add to repo secrets.

---

## Quickstart (2 minutes)

### 1. Get token → [peakinfer.com/dashboard](https://peakinfer.com/dashboard)

Sign in with GitHub → Click "Generate Token" → Copy it (shown once)

*50 free credits included. No credit card.*

### 2. Add to repo secrets

Your repo → **Settings** → **Secrets and variables** → **Actions** → **New secret**

- Name: `PEAKINFER_TOKEN`
- Value: *paste your token*

### 3. Create workflow

Create `.github/workflows/peakinfer.yml`:

```yaml
name: PeakInfer
on: [pull_request]

permissions:
  contents: read
  pull-requests: write

jobs:
  analyze:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: kalmantic/peakinfer-action@v1
        with:
          token: ${{ secrets.PEAKINFER_TOKEN }}
          github-token: ${{ github.token }}
```

Open a PR to see the analysis.

---

## What You'll See

PeakInfer posts a comment on every PR with inference points:

```markdown
## PeakInfer Analysis

Found **3 inference points** across 2 files

### Issues

| Location | Severity | Issue |
|----------|----------|-------|
| `src/chat.ts:42` | 🔴 critical | Streaming enabled but not consumed — 6x latency penalty |
| `src/api.ts:89` | 🟡 warning | No retry logic — reliability at risk |
| `src/api.ts:156` | 🟡 warning | Sequential calls — batch for 10x throughput |

---
*Credits remaining: 47 • [PeakInfer](https://peakinfer.com)*
```

---

## The Four Dimensions

| Dimension | What We Find |
|-----------|--------------|
| **Latency** | Missing streaming, blocking calls, p95 gaps vs benchmarks |
| **Throughput** | Sequential loops, batch opportunities |
| **Reliability** | No retries, missing timeouts, no fallbacks |
| **Cost** | Right-sized model selection |

---

## Configuration

```yaml
- uses: kalmantic/peakinfer-action@v1
  with:
    token: ${{ secrets.PEAKINFER_TOKEN }}  # Required
    github-token: ${{ github.token }}      # For PR comments
    path: ./src                             # Directory to analyze
    fail-on-critical: true                  # Block PR on critical issues
```

### Options

| Input | Default | Description |
|-------|---------|-------------|
| `token` | — | **Required.** Get at [peakinfer.com/dashboard](https://peakinfer.com/dashboard) |
| `github-token` | — | **Required.** Use `${{ github.token }}` for PR comments |
| `path` | `./src` | Directory to analyze |
| `fail-on-critical` | `false` | Fail check if critical issues found |
| `inline-comments` | `true` | Post inline PR comments |

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
| `inference-points` | Number of inference points found |
| `issues` | Number of issues found |

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
- Add credits at [peakinfer.com/pricing](https://peakinfer.com/pricing)

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
| **Get token** | [peakinfer.com/dashboard](https://peakinfer.com/dashboard) |
| **Add credits** | [peakinfer.com/pricing](https://peakinfer.com/pricing) |
| **CLI (BYOK)** | [github.com/kalmantic/peakinfer](https://github.com/kalmantic/peakinfer) |
| **VS Code Extension** | [github.com/kalmantic/peakinfer-vscode](https://github.com/kalmantic/peakinfer-vscode) |
| **MCP Server** | [github.com/kalmantic/peakinfer-mcp](https://github.com/kalmantic/peakinfer-mcp) |

---

Apache-2.0 License
