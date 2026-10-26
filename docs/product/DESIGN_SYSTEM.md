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

### Usage Rules
- Body uses the system UI font stack.
- Display font (Impact stack, uppercase, tight leading) for headlines only.
- Label style (0.28em tracking, uppercase, 12px, bold) for small labels.

---

## 3. Spacing

| Token | Value | Use |
|---|---|---|
| `--space-xs` | `0.25rem` (4px) | tight inline gaps |
| `--space-sm` | `0.5rem` (8px) | component internal padding |
| `--space-md` | `1rem` (16px) | default component padding |
| `--space-lg` | `1.5rem` (24px) | section spacing |
| `--space-xl` | `2rem` (32px) | page section margins |
| `--space-2xl` | `3rem` (48px) | major page sections |

- Use Tailwind `space-*`, `gap-*`, `p-*`, `m-*` utilities that map to these values.
- Never invent arbitrary spacing values outside this scale.

---

## 4. Borders

| Token | Hex | Use |
|---|---|---|
| `--border` | `#262626` | default borders |
| `--border-hover` | `#e8321e` | interactive hover border |
| `--ring` | `#e8321e` | focus ring |

- Borders stay subtle unless interactive.
- Interactive hover border uses the accent color.
- Default border width is 1px.

---

## 5. Buttons

### Variants

| Variant | Background | Text | Hover | Use |
|---|---|---|---|---|
| primary | `--accent` `#e8321e` | `#050505` | `--accent-hover` `#ff3b2d` | primary CTAs, key metrics, brand moments |
| secondary | transparent / `--border` | `--text-primary` | `--surface-raised` | tertiary actions |
| danger | `--border` with `--error` text | `--error` `#f87171` | `--error` hover | destructive actions |

### Rules
- Accent red is reserved for primary CTAs, key metrics, and brand moments. Never use it for borders or secondary text.
- All buttons: `min-h-11`, `rounded-lg`, `px-4 py-2`, `text-sm font-semibold`, visible focus ring.
- Focus state: `outline-2 outline-offset-2 outline-ring` (accent color).

---

## 6. Cards

| Token | Hex | Use |
|---|---|---|---|
| `--bg-elevated` | `#0d0d0d` | cards, modals, elevated surfaces |
| `--bg-input` | `#141414` | inputs, selects, textareas |

- Cards: `rounded-xl`, `border border-border`, `bg-card`, `text-card-foreground`.
- Card padding: `p-6` default, `p-4` compact.
- Cards never use pure white backgrounds.

---

## 7. Inputs

| Token | Hex | Use |
|---|---|---|---|
| `--bg-input` | `#141414` | inputs, selects, textareas |
| `--border` | `#262626` | input borders |
| `--ring` | `#e8321e` | input focus ring |

- Inputs: `min-h-11`, `w-full`, `rounded-lg`, `border border-input`, `bg-background`, `px-3 py-2.5`, `text-foreground`, `placeholder:text-muted-foreground`.
- Focus state: `outline-2 outline-offset-2 outline-ring`.
- Labelled inputs required: every input has an associated `<label>` or `aria-label`.

---

## 8. Focus States

- Visible focus states on all interactive elements.
- Focus ring: `outline-2 outline-offset-2` using `--ring` color (`#e8321e`).
- AA contrast required for all text.
- `aria-live` on the live transcript region.
- Keyboard-reachable controls.

---

## 9. Motion

| Token | Value | Use |
|---|---|---|---|
| `--duration-fast` | `150ms` | hover, focus |
| `--duration-base` | `300ms` | transitions, modals |
| `--duration-slow` | `500ms` | page entries, metric bars |

- `prefers-reduced-motion: reduce` must disable animations and transitions.
- No decorative gradients. Animations are functional only (voice-orb states, metric fills).

---

## 10. Voice Orb States

| State | Color | Animation | Meaning |
|---|---|---|---|
| idle | `--text-muted` `#737373` | static | AI not speaking, not listening |
| listening | `--accent` `#e8321e` | `pulse-glow` 3s | mic active, capturing audio |
| speaking | `--success` `#34d399` | `float` 4s | AI is talking |

- VoiceOrb: circular, high contrast, `aria-label` indicating current state.
- Never use pure white for the orb.
- State transitions are instant (no cross-fade) to keep the interface serious and focused.

---

## 11. Screen Requirements

### Landing
- One value proposition, one primary CTA ("Try demo interview"), short how-it-works.

### Interview Live
- Obvious VoiceOrb states (AI speaking / listening / idle).
- Live auto-scrolling transcript with `aria-live`.
- Readable metrics on mobile.
- Visible text-input fallback.

### Report
- Score summary, strengths, weaknesses, 7-day coaching plan, retry button.
- Empty plan days labelled empty for real sessions.
- Demo sessions show a clearly labelled simulated plan.

### Demo Banner
- Visible, not intrusive.

---

## 12. Verification

- Verify layouts at **375, 768 and 1440 px**.
- Store screenshots in `docs/screenshots/`.
- AA contrast on all text.