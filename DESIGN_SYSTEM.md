# VoiceHire Design System

> Deliberate practice. Honest feedback.  
> Dark, focused, high-contrast interface built for serious interview preparation.

---

## 1. Brand Colors

| Token              | Hex       | Usage                                      |
|--------------------|-----------|--------------------------------------------|
| `--bg-base`        | `#0a0a0a` | Page background                            |
| `--bg-elevated`    | `#0d0d0d` | Cards, modals, elevated surfaces           |
| `--bg-input`       | `#141414` | Inputs, selects, textareas                 |
| `--border`         | `#262626` | `neutral-800` – default borders            |
| `--border-hover`   | `#e8321e` | Hover / active border accent               |
| `--accent`         | `#e8321e` | Primary actions, highlights, brand red     |
| `--accent-hover`   | `#ff3b2d` | Hover state for primary buttons            |
| `--text-primary`   | `#e5e5e5` | Main body text (`neutral-200`)             |
| `--text-secondary` | `#a3a3a3` | Secondary text (`neutral-400`)             |
| `--text-muted`     | `#737373` | Muted / helper text (`neutral-500`)        |
| `--success`        | `#34d399` | Success states (emerald-400)               |
| `--error`          | `#f87171` | Error / alert text (rose-300/400)          |
| `--warning`        | `#fbbf24` | Warning text                               |

### Usage Rules
- Never use pure white (`#ffffff`) for large text areas.
- Accent red (`#e8321e`) is reserved for primary CTAs, key metrics, and brand moments.
- Borders should stay subtle (`neutral-800`) unless interactive.

---

## 2. Typography

### Font Stack
```css
/* Display (headlines only) */
.vh-display {
  font-family: Impact, "Haettenschweiler", "Arial Narrow Bold", "Arial Narrow", sans-serif;
  text-transform: uppercase;
  letter-spacing: 0.01em;
  line-height: 0.88;
  font-weight: 400;
}

/* Labels / small uppercase */
.vh-label {
  letter-spacing: 0.28em;
  text-transform: uppercase;
  font-size: 0.75rem; /* 12px */
  font-weight: 700;
}

/* Body */
font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;