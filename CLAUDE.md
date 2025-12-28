# PeakInfer Action - Project Overview

This is the **peakinfer-action** (GitHub Action) public repository.

## Key Information

- **Type:** Thin API client (~200 lines)
- **No analysis code:** All intelligence is server-side in peakinfer-site
- **Calls:** `peakinfer.com/api/analyze`

---

## Architecture

### What This Repo Does

1. Receives PR trigger from GitHub
2. Gets changed files
3. Calls `peakinfer.com/api/analyze` with files
4. Posts PR comment with results
5. Sets verdict output (PASS, OK, REVIEW, BLOCK, PAUSED, SKIP, ERROR)

### What This Repo Does NOT Do

- No LLM calls
- No analysis logic
- No template processing
- No drift detection

All of that is in `peakinfer-site` (private).

---

## Key Files

| File | Purpose |
|------|---------|
| `action.yml` | Action definition, inputs, outputs |
| `src/index.ts` | Main logic: fetch + PR comment |
| `design/README.md` | Points to parent brand |
| `design/Action Brand Guide.md` | Voice, tone, PR comment format |

---

## Terminology

**IMPORTANT:** This is NOT true BYOK mode.

| Term | Meaning |
|------|---------|
| "Free mode" | User provides Anthropic key, passed to server |
| "Paid mode" | User provides PeakInfer token, uses credits |
| "True BYOK" | CLI only - all analysis runs locally |

When user provides `anthropic-api-key`, it's passed to peakinfer.com server for Claude API calls. Code still leaves user's machine.

---

## Verdict States (7 total)

| Verdict | Condition |
|---------|-----------|
| `PASS` | 0 issues |
| `OK` | 1-5 warnings |
| `REVIEW` | 1 critical OR >5 warnings |
| `BLOCK` | >=2 critical |
| `PAUSED` | Credits exhausted |
| `SKIP` | No LLM code in changed files |
| `ERROR` | Analysis failed |

---

## Session Memory (Last Updated: December 28, 2025)

### Current State

**v1.9.5 Status:** ✅ 100% Complete - Ready for Release

### Work Completed This Session

**Files Modified:**
- `action.yml` - Fixed BYOK → "free mode" terminology
- `src/index.ts` - Added `fetchOrgStats()` for real statistics in credit exhaustion message

**Key Changes:**
- Credit exhaustion now shows real stats from `/api/stats` endpoint
- Clarified that "free mode" is NOT true BYOK

### Cross-Repo Context

| Repository | Role | Status |
|------------|------|--------|
| `peakinfer/` (CLI) | Public, True BYOK | ✅ Complete |
| `peakinfer-mcp/` | MCP Server (separate) | ✅ Complete |
| `peakinfer-action/` (this repo) | Public, API client | ✅ Complete |
| `peakinfer-site/` | Private, API + Website | ✅ Complete |
| `peakinfer-vscode/` | VS Code Extension | ✅ Complete |
| `peakinfer_templates/` | Community templates | ✅ Complete |

### Important Context

1. **Thin client only** - no analysis code here
2. **Calls peakinfer.com** - all intelligence server-side
3. **7 verdict states** - PASS, OK, REVIEW, BLOCK, PAUSED, SKIP, ERROR
4. **fetchOrgStats()** - gets real stats from `/api/stats`

### Reference Documents

| Document | Location |
|----------|----------|
| Implementation Guide | `peakinfer/design/PeakInfer Implementation v1.9.5.md` |
| Main CLAUDE.md | `peakinfer/CLAUDE.md` |
| Action Brand Guide | `design/Action Brand Guide.md` |
