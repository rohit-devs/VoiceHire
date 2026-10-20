# VoiceHire Design System

## Direction

VoiceHire should feel like a focused, calm interview workspace: editorial typography,
quiet neutral surfaces, precise data, and a restrained red accent. Avoid decorative
gradients, glowing effects, and large areas of pure white. The interface must remain
legible and usable under pressure, especially during a live interview.

## Color tokens

Use these tokens as the source of truth for CSS variables and Tailwind colors:

| Token | Value | Use |
| --- | --- | --- |
| Canvas | `#10100f` | App background |
| Surface | `#181817` | Cards, menus, and raised regions |
| Surface raised | `#20201e` | Hovered or nested surfaces |
| Border | `#343431` | Dividers and control outlines |
| Text primary | `#e7e5e0` | Headlines and primary body copy |
| Text secondary | `#aaa8a1` | Supporting copy |
| Text muted | `#85837d` | Hints and disabled labels |
| Accent | `#e8321e` | Primary actions and key metrics only |
| Accent hover | `#f04430` | Hovered primary actions |
| Accent subtle | `#3a1b17` | Selected/active accent backgrounds |
| Success | `#75c79a` | Confirmed completion and positive status |
| Warning | `#e6b86a` | Caution and connectivity status |
| Error | `#f0786d` | Errors and destructive actions |

Use the accent sparingly. Do not use it for entire panels, decorative rules, or ordinary
links. Use text and icons as well as color to communicate status. Large text must use
the primary text token rather than pure white (`#fff`).

## Typography

Use the configured display face for page and section headlines only. Keep body text,
controls, and navigation in the interface sans-serif face. Use the label style for
short uppercase metadata labels, not full sentences. Reserve monospace for measured
values, timestamps, and code-like content.

| Role | Treatment |
| --- | --- |
| Page headline | Display face, 36–56 px, tight leading, text primary |
| Section headline | Display face, 24–32 px, text primary |
| Card headline | Interface sans, 16–20 px, semibold |
| Body | Interface sans, 14–16 px, 1.5 leading |
| Supporting copy | Interface sans, 13–14 px, text secondary |
| Label | Interface sans, 11–12 px, medium, uppercase, letter spacing `0.08em` |
| Metric | Interface sans or monospace, 24–40 px, semibold |

Avoid setting long blocks in all caps. Keep line lengths comfortable (roughly 65
characters for prose) and preserve a visible hierarchy without relying on color alone.

## Buttons

- Primary buttons use the accent fill and a high-contrast dark label. Reserve this
  treatment for the main action in a view.
- Secondary buttons use a surface fill, neutral border, and primary text.
- Tertiary actions are quiet text buttons with a visible hover and focus treatment.
- Destructive actions use the error token and must not resemble the primary CTA.
- All buttons have at least a 44 px target height, clear disabled styling, and a
  non-color-only focus indicator. Keep labels concise and use sentence case.
- Button links and buttons share sizing, variants, and interaction states.

## Cards and surfaces

- Cards use the surface token, a one-pixel neutral border, and a 12–16 px radius.
- Use spacing and typography for hierarchy; avoid excessive shadows and blur.
- Raised surfaces are for menus, dialogs, and explicit interactive emphasis only.
- Interactive cards must expose hover, focus, and selected states and remain keyboard
  reachable. Static cards should not imitate clickable controls.
- Group related information into a small number of clear sections rather than nesting
  multiple card borders.

## Inputs

- Inputs use a dark surface, neutral border, primary text, and secondary placeholder.
- Labels remain visible when a field contains a value; placeholder text is not a label.
- Error messages appear next to the related field and are programmatically associated.
- Focus uses a clearly visible two-pixel outline with offset; do not remove the browser
  focus indicator without replacing it.
- Disabled and read-only fields must be distinguishable from editable fields. Keep
  controls at least 44 px high where practical and preserve visible text-entry fallback.

## Spacing and layout

Use a 4 px base unit and favor increments of 4 or 8 px. Typical spacing is 8 px within
compact controls, 16 px between related elements, 24 px between card sections, and
32–48 px between page sections. Use consistent page gutters that adapt to viewport size:
16 px on narrow screens, 24 px at tablet widths, and 32–48 px on desktop. Constrain
long-form content to a readable width and allow dashboard grids to collapse cleanly.

## Focus, contrast, and accessibility

- Every interactive element has a visible `:focus-visible` indicator with sufficient
  contrast against its adjacent surface.
- Normal text and controls target WCAG 2.2 AA contrast; do not rely on accent color
  alone to identify a state.
- Preserve semantic headings, form labels, button names, and keyboard operation.
- Live transcripts use a polite live region and avoid announcing every interim token
  excessively; announce finalized turns.
- Honor reduced-motion preferences and never use motion as the only status signal.

## Motion

Keep transitions short and purposeful: 120–200 ms for hover/focus, up to 300 ms for
small state changes. Use opacity and modest transforms rather than springy movement.
Avoid continuously moving decorative elements. Under `prefers-reduced-motion: reduce`,
remove nonessential animation and transition duration.

## Voice-orb states

The voice orb is a status indicator, not a control by itself. Provide a nearby text
label and expose state to assistive technology.

| State | Visual treatment | Accessible label |
| --- | --- | --- |
| Idle / ready | Quiet neutral ring and stable center | Ready |
| Listening | Accent outline with a restrained audio-reactive scale | Listening |
| Thinking | Muted neutral pulse, without implying speech | Preparing response |
| Speaking | Accent center with subtle, bounded waveform movement | Interviewer speaking |
| Muted | Neutral ring with a visible muted icon | Microphone muted |
| Error / unavailable | Error-colored static marker and recovery guidance | Voice unavailable |

Keep the orb's size stable between states to avoid layout shifts. Do not use a glow or
color change as the sole indication of microphone permission, network status, or errors.
When voice is unavailable, retain the text interview path and explain how to continue.