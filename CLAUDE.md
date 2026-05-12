# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**减肥助手 (Weight Loss Tracker)** — A mobile-first, single-page web application for tracking calorie deficits to achieve weight loss. No build tools, no backend, no framework — pure HTML/CSS/JS with localStorage persistence and Claude AI integration.

## Architecture

### Stack
- **Frontend only**: Plain HTML + CSS + vanilla JS (ES modules or IIFE)
- **Storage**: `localStorage` for all user data (no server required)
- **AI**: Claude API (Anthropic) called directly from the browser or via a minimal proxy
- **No bundler**: Files are served as-is; open `index.html` directly or via any static file server

### Core Logic — Calorie Deficit Model
1. **TDEE calculation**: Harris-Benedict BMR × activity multiplier
2. **Daily target**: TDEE minus user-chosen deficit (e.g. −500 kcal/day ≈ −0.5 kg/week)
3. **Tracking loop**: log food intake + exercise → remaining calories today → cumulative deficit → projected weight loss

### File Layout (planned)
```
index.html       # Single entry point, all screens rendered via JS
style.css        # Mobile-first styles (375 px base, no framework)
app.js           # App shell, routing between views, localStorage helpers
calculator.js    # TDEE / BMR / deficit math (pure functions)
logger.js        # Food & exercise log CRUD against localStorage
ai.js            # Claude API calls (food lookup, advice, meal suggestions)
charts.js        # Lightweight progress charts (Canvas API or SVG)
```

## Running Locally

```bash
# Any static server works — no build step
python3 -m http.server 8080
# then open http://localhost:8080
```

Or just open `index.html` directly in a browser (file:// works for everything except Claude API calls, which need CORS headers — use the dev server for AI features).

## AI Integration

- Model: `claude-haiku-4-5-20251001` (fast, cheap) for food lookups; `claude-sonnet-4-6` for diet advice
- API key is stored in `localStorage` under `cc_api_key` and entered by the user on first run — never hardcoded
- All AI calls live in `ai.js`; other modules import helper functions from it

## Data Schema (localStorage keys)

| Key | Value |
|-----|-------|
| `cc_profile` | `{ name, age, gender, height_cm, weight_kg, activity, goal_deficit_kcal }` |
| `cc_logs` | Array of `{ date, food: [{name, kcal}], exercise: [{name, kcal}] }` |
| `cc_api_key` | Claude API key string |

## Design Constraints
- Target viewport: 375 px wide (iPhone SE baseline), scales up gracefully
- No external CSS frameworks or JS libraries — keep it zero-dependency
- All text labels are in Chinese (Simplified)
