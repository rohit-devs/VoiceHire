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
```

### Type Scale
| Token | Size | Weight | Line-height | Use |
|-------|------|--------|-------------|-----|
| `--text-xs` | 0.75rem | 400 | 1.0 | captions, helper text |
| `--text-sm` | 0.875rem | 400 | 1.25 | secondary labels, metadata |
| `--text-base` | 1rem | 400 | 1.5 | body text |
| `--text-lg` | 1.125rem | 400 | 1.5 | lead copy |
| `--text-xl` | 1.25rem | 600 | 1.25 | section headings |
| `--text-2xl` | 1.5rem | 600 | 1.2 | page headings |
| `--text-display` | 2.5rem+ | 400 | 0.88 | display headlines (Impact stack) |

---

## 3. Spacing

| Token | Value | Use |
|-------|-------|-----|
| `--space-1` | 0.25rem | tight inline gaps |
| `--space-2` | 0.5rem | element padding |
| `--space-3` | 0.75rem | component gaps |
| `--space-4` | 1rem | section padding |
| `--space-6` | 1.5rem | card padding |
| `--space-8` | 2rem | page sections |
| `--space-12` | 3rem | large page margins |

Use Tailwind `space-*`, `gap-*`, `p-*`, `px-*`, `py-*` utilities mapped to these tokens. Never use arbitrary `px`/`rem` values inline.

---

## 4. Buttons

| Variant | Background | Text | Border | Hover | Use |
|---------|-----------|------|--------|-------|-----|
| primary | `--accent` (`#e8321e`) | `#050505` | none | `brightness-110` | primary CTAs ("Try demo interview", "Start interview") |
| secondary | transparent | `--text-primary` | `--border` | `--bg-elevated` | tertiary actions |
| danger | transparent | `--error` | `--error` | `--error/10` | destructive actions |

Rules:
- Accent red is reserved for primary CTAs, key metrics, and brand moments. Never use it for secondary text or decorative borders.
- Minimum touch target: 44x44px (`min-h-11`, `px-4`, `py-2` on mobile).
- Visible focus state: `focus-visible:outline-2 focus-visible:outline-ring`.
- Disabled state: `disabled:cursor-not-allowed disabled:opacity-60`.

---

## 5. Cards

| Token | Value | Use |
|-------|-------|-----|
| `--bg-elevated` | `#0d0d0d` | card surface |
| `--border` | `#262626` | card border |
| `--radius` | 0.75rem | card border-radius |

Rules:
- Card: `rounded-xl border border-border bg-elevated text-text-primary`, padding `p-6`.
- No decorative gradients on cards.
- Interactive cards get `hover:border-accent/50` on hover.

---

## 6. Inputs

| Token | Value | Use |
|-------|-------|-----|
| `--bg-input` | `#141414` | input background |
| `--border` | `#262626` | input border |
| `--ring` | `--accent` | focus ring |

Rules:
- Input: `w-full rounded-lg border border-border bg-input px-3 py-2.5 text-text-primary placeholder:text-text-muted focus-visible:outline-2 focus-visible:outline-ring`.
- Label above input using `.vh-label` style.
- Helper text below input using `--text-muted`, 0.75rem.
- All inputs must be labelled (`htmlFor`/`id` pairing) and have visible focus states.

---

## 7. Focus

| Token | Value | Use |
|-------|-------|-----|
| `--ring` | `--accent` (`#e8321e`) | focus ring color |
| `--ring-width` | 2px | focus ring width |
| `--ring-offset` | 2px | focus ring offset |

Rules:
- Every interactive element must have a visible focus state.
- `focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring`.
- Never remove focus outlines with `outline-none` without a visible replacement.
- Keyboard-reachable controls: all buttons/inputs reachable via Tab, no custom focus traps without a clear exit.

---

## 8. Motion

| Token | Value | Use |
|-------|-------|-----|
| `--duration-fast` | 150ms | micro-interactions |
| `--duration-base` | 300ms | state transitions |
| `--duration-slow` | 500ms | page-level motion |
| `--ease-standard` | cubic-bezier(0.4, 0, 0.2, 1) | standard easing |

Rules:
- Respect `prefers-reduced-motion: reduce` — disable all animations when set.
- VoiceOrb states use `animate-pulse-glow` / `animate-waveform` (defined in globals.css).
- No decorative gradients or looping motion that serves no purpose.
- Transitions: `transition-colors duration-300` for hover states.

---

## 9. VoiceOrb States

| State | Visual | Animation | Use |
|-------|--------|-----------|-----|
| idle | soft circle, `--border` outline | none | waiting for input |
| listening | ring expands, `--accent` glow | `animate-pulse-glow` | mic active, STT listening |
| speaking | inner pulse, `--accent` fill | `animate-waveform` | AI speaking via TTS |
| thinking | subtle shimmer | `animate-shimmer` | LLM generating response |
| error | `--error` border, shake | none | STT/TTS failure |
| disabled | `--text-muted` opacity | none | voice not available |

Rules:
- VoiceOrb must be obvious at a glance — the user should know whether the system is listening or speaking without reading text.
- VoiceOrb states are controlled by the interview WebSocket/STT/TTS layer, not CSS alone.
- Minimum size: 64x64px on mobile, 80x80px on desktop.

---

## 10. Screen Requirements

### Landing
- One value proposition, one primary CTA ("Try demo interview"), short how-it-works (3 steps).
- Demo banner visible but not intrusive.

### Interview Live
- Obvious VoiceOrb states (AI speaking / listening / idle).
- Live auto-scrolling transcript with `aria-live="polite"`.
- Readable metrics on mobile.
- Visible text-input fallback (for insecure contexts or STT failure).

### Report
- Score summary, strengths, weaknesses, 7-day coaching plan.
- Empty plan days labelled "empty" for real sessions; demo sessions show a clearly labelled simulated plan.
- Retry button.

### Demo Banner
- Visible, not intrusive. Stated clearly that data is simulated.

---

## 11. Accessibility

- Visible focus states on all interactive elements.
- AA contrast ratio minimum (4.5:1 for normal text, 3:1 for large).
- All inputs labelled with `htmlFor`/`id`.
- `aria-live` on the live transcript region.
- Keyboard-reachable controls (Tab order logical, no focus traps without exit).
- `prefers-reduced-motion` respected.
- Layouts verified at 375px, 768px, and 1440px widths.
