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

## 3. Spacing

Use the Tailwind spacing scale exclusively. Do not use arbitrary pixel values.

| Token | Tailwind | Use |
|---|---|---|
| `--space-xs` | `space-x-1` / `gap-1` | tight groupings within controls |
| `--space-sm` | `space-x-2` / `gap-2` | button internal gap |
| `--space-md` | `space-x-4` / `gap-4` | section components |
| `--space-lg` | `space-x-6` / `gap-6` | page-level sections |
| `--space-xl` | `space-x-8` / `gap-8` | major page landmarks |
| `--space-2xl` | `space-x-12` / `gap-12` | outer page gutters |

Page containers use `max-w-7xl mx-auto` with `px-4` on mobile, `px-6` at `md`, `px-8` at `lg`.

## 4. Buttons

Only the `primary` variant uses accent red (`#e8321e`). All other variants use border/subtle backgrounds.

| Variant | Background | Border | Text | Hover |
|---|---|---|---|---|
| `primary` | `#e8321e` | none | `#050505` | `#ff3b2d` |
| `secondary` | transparent | `border-border` | `text-card-foreground` | `bg-surface-raised` |
| `danger` | `bg-error/10` | `border border-error/30` | `text-error` | `hover:bg-error/20` |

- Minimum height: `min-h-11` (44px) for touch accessibility
- Rounded: `rounded-lg`
- Focus: `focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring`
- Disabled: `disabled:cursor-not-allowed disabled:opacity-60`
- Red accent is reserved for primary CTAs, key metrics, and brand moments — never for secondary or decorative use.

## 5. Cards

| Property | Value |
|---|---|
| Background | `--bg-elevated` (`#0d0d0d`) |
| Border | `1px solid --border` (`#262626`) |
| Radius | `rounded-xl` |
| Shadow | none (borders define elevation) |

Cards never use pure white backgrounds or decorative gradients.

## 6. Inputs

| Property | Value |
|---|---|
| Background | `--bg-input` (`#141414`) |
| Border | `1px solid --border` (`#262626`) |
| Text | `--text-primary` (`#e5e5e5`) |
| Placeholder | `--text-muted` (`#737373`) |
| Focus | `focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring` |

Inputs are `min-h-11` (44px) with `px-3 py-2.5` padding. All inputs must have visible labels and `aria-label` or `aria-labelledby`.

## 7. Focus

- Visible focus indicators are required on every interactive element.
- Focus ring uses `--ring` (accent red `#e8321e`), 2px, offset 2px.
- Never remove outlines via `outline: none` or `focus-visible:hidden`.

## 8. Motion

Follow `prefers-reduced-motion`. When reduced motion is requested, all animations and transitions are set to `0.01ms` duration and `iteration-count: 1`.

Voice Orb states use subtle scale/opacity pulses only — no shimmering or flashing gradients.

| State | Animation | Description |
|---|---|---|
| `idle` | static or slow float | ready to listen |
| `listening` | `animate-waveform` | mic active, processing audio |
| `speaking` | `animate-pulse-glow` | AI talking |
| `thinking` | subtle pulse | generating response |

## 9. Voice Orb States

The Voice Orb is the primary affordance for interview voice state. It must be obvious at a glance.

| State | Visual | Meaning |
|---|---|---|
| `idle` | dim orb, static | ready; not listening |
| `listening` | waveform animation | microphone active |
| `speaking` | pulse-glow | AI is talking |
| `thinking` | subtle pulse | generating response |

The Voice Orb is accompanied by live, auto-scrolling transcript with `aria-live="polite"` and readable metrics on mobile. A visible text-input fallback must always be present.

## 10. Accessibility

- AA contrast minimum for all text (never pure white on dark for large areas)
- Visible focus states on all interactive elements
- Labelled inputs (`aria-label`, `aria-labelledby`, or visible `<label>`)
- `aria-live` on the live transcript region
- Keyboard-reachable controls
- Verify at 375px, 768px, and 1440px viewport widths
