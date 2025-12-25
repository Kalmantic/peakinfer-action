# PeakInfer GitHub Action

> Catch LLM inference issues before they hit production. Analyzes cost, latency, throughput, and reliability.

## Quickstart (2 minutes)

**Step 1:** Get your token at [peakinfer.com/dashboard](https://peakinfer.com/dashboard) (50 free credits, no card needed)

**Step 2:** Add secret to your repo: Settings → Secrets → Actions → `PEAKINFER_TOKEN`

**Step 3:** Create `.github/workflows/peakinfer.yml`:

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

Done. Open a PR and see the analysis.

---

## What You'll See

PeakInfer posts a comment on every PR with LLM inference points:

```
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
    # Required
    token: ${{ secrets.PEAKINFER_TOKEN }}

    # Optional
    path: ./src              # Directory to analyze (default: ./src)
    fail-on-critical: true   # Block PR if critical issues found
```

### All Options

| Input | Default | Description |
|-------|---------|-------------|
| `token` | — | **Required.** API token from [dashboard](https://peakinfer.com/dashboard) |
| `path` | `./src` | Path to analyze |
| `fail-on-critical` | `false` | Fail the check if critical issues found |
| `inline-comments` | `true` | Post inline comments on specific lines |
| `compare-baseline` | `false` | Compare to previous analysis |
| `events` | — | Path to runtime events JSONL for drift detection |

### Outputs

```yaml
- uses: kalmantic/peakinfer-action@v1
  id: peakinfer
  with:
    token: ${{ secrets.PEAKINFER_TOKEN }}

- run: echo "Found ${{ steps.peakinfer.outputs.inference-points }} inference points"
```

| Output | Description |
|--------|-------------|
| `status` | `pass`, `warning`, or `fail` |
| `inference-points` | Number of LLM calls detected |
| `issues` | Number of issues found |
| `summary` | Full JSON results |

---

## What It Catches

| Dimension | Examples |
|-----------|----------|
| **Cost** | GPT-4 for simple tasks, over-tokenized prompts |
| **Latency** | Missing streaming, blocking calls in hot paths |
| **Throughput** | Sequential calls that could be parallel |
| **Reliability** | No retries, missing timeouts, no fallbacks |

---

## Advanced: Runtime Drift Detection

Compare your code against actual runtime behavior:

```yaml
- uses: kalmantic/peakinfer-action@v1
  with:
    token: ${{ secrets.PEAKINFER_TOKEN }}
    events: ./logs/inference-events.jsonl
```

Detects when code says streaming but runtime shows batch, or when fallback models are being used more than expected.

---

## Troubleshooting

<details>
<summary><strong>Invalid or missing token</strong></summary>

1. Verify secret name is exactly `PEAKINFER_TOKEN` (case-sensitive)
2. Check token at [peakinfer.com/dashboard](https://peakinfer.com/dashboard)
3. Regenerate if needed

</details>

<details>
<summary><strong>Insufficient credits</strong></summary>

1. Check balance at [peakinfer.com/dashboard](https://peakinfer.com/dashboard)
2. Buy more at [peakinfer.com/pricing](https://peakinfer.com/pricing)

</details>

<details>
<summary><strong>Action not running</strong></summary>

1. File must be in `.github/workflows/`
2. Check Actions are enabled: Settings → Actions → General
3. Trigger must match (e.g., `pull_request`)

</details>

<details>
<summary><strong>Organization repos</strong></summary>

Add secret at org level: Org Settings → Secrets → Actions → Add `PEAKINFER_TOKEN` → Grant repo access

</details>

---

## Links

- [Dashboard](https://peakinfer.com/dashboard) — Manage tokens, view credits
- [Pricing](https://peakinfer.com/pricing) — Credit packs
- [CLI](https://github.com/kalmantic/peakinfer) — Local analysis with your own API key

---

MIT License
