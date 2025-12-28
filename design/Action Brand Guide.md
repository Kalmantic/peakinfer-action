# PeakInfer Action Brand Guide

**Parent Document:** `peakinfer-overall/design/PeakInfer Brand Design System v1.0.md`

This guide extends the main brand system for the GitHub Action context.

---

## Voice & Tone

### Core Principle

> *"Code says X. Runtime shows Y."*

Factual. Specific. No hype.

### Copy Rules

| Do | Don't |
|----|-------|
| "3 inference points found" | "We found issues!" |
| "$4,200/month wasted" | "Save money!" |
| "2 minutes. No signup." | "Quick and easy!" |
| "Analysis complete" | "Success! All done!" |
| Sentence case | Title Case |
| Periods | Exclamation marks |

### Forbidden Language

Never use:
- "Easy", "simple", "seamless"
- "Best-in-class", "powerful", "robust"
- "Get Started" (use "Try Free Demo" or specific action)
- "Upgrade" (use "Add credits")
- Exclamation marks in body copy

---

## Terminology

| Internal | User-Facing |
|----------|-------------|
| Callsite | inference point |
| Callsites | inference points |

Always say **"inference point"** in README, comments, error messages.

---

## GitHub Action Context

### README Structure

```
1. Badges (Marketplace + Get Token)
2. One-liner description
3. How It Works (visual diagram)
4. Quickstart (numbered steps)
5. What You'll See (example output)
6. Configuration
7. Troubleshooting (collapsible)
8. Links
```

### PR Comment Format

```markdown
## PeakInfer Analysis

Found **N inference points** across M files

### Issues

| Location | Severity | Issue |
|----------|----------|-------|
| `file:line` | 🔴 critical | Headline |

---
*Credits remaining: X • [PeakInfer](https://peakinfer.com)*
```

### Severity Icons

| Severity | Icon | Color |
|----------|------|-------|
| Critical | 🔴 | Red |
| Warning | 🟡 | Yellow |
| Info | 🔵 | Blue |

---

## Links

All links should point to peakinfer.com:

| Context | URL |
|---------|-----|
| Get Token | `peakinfer.com/dashboard` |
| Buy Credits | `peakinfer.com/pricing` |
| Documentation | GitHub README (this repo) |

---

## Alignment with Website

The GitHub Action and peakinfer.com must use consistent:

1. **Value proposition**: "Catch LLM inference issues before they hit production"
2. **Setup framing**: "2 minutes" (not "quick" or "easy")
3. **Credit language**: "50 free credits" (not "free tier")
4. **CTA language**: "Get Started" on website, specific action verbs in README

---

*Reference: PeakInfer Brand Design System v1.0, Website PRD v1.9.3*
