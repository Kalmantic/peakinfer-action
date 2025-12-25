# PeakInfer Action - Design Documents

## Brand Design System

The **PeakInfer Brand Design System** is maintained at the parent level for consistency across all surfaces (CLI, Website, GitHub Action).

**Location:** `../../design/PeakInfer Brand Design System v1.0.md`

## Architecture

This action is a **thin API client**:

```
┌─────────────────────────────────────────────────────────────────┐
│                    GitHub Action (this repo)                     │
│                                                                  │
│  1. Collect files from repository                               │
│  2. Call peakinfer.com/api/analyze                              │
│  3. Post PR comment with results                                │
│                                                                  │
│  NO analysis code - all intelligence is server-side             │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                    peakinfer.com API                             │
│                                                                  │
│  - Runs analysis using Claude Agent SDK                         │
│  - Tracks credits                                                │
│  - Returns structured results                                    │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

## Why Thin Client?

1. **No secrets in public repo** - Analysis logic stays private
2. **Simpler maintenance** - Action just does HTTP calls
3. **Centralized updates** - Fix analysis once, all users benefit
4. **Credit control** - All usage goes through API

## PR Comment Styling

Follow the Brand Design System for:
- Severity icons and colors
- Table formatting
- Voice and tone ("Drift detected" not "Warning!")

## Related Repos

| Repo | Purpose |
|------|---------|
| `peakinfer` | CLI (BYOK, public) |
| `peakinfer-site` | Website + API (private) |
| `peakinfer-action` | This repo (thin client) |
