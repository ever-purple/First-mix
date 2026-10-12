# FIRST MIX A+C unified design baseline

Status: approved 2026-10-10. This document and `ac-unified.css` override the older generated `MASTER.md` wherever they conflict.

The visual reference is `concepts/font-comparison.html`, scheme 1.

## Direction

- C is the site-wide soft environment: blue-green, mist blue, lavender, and warm pink light.
- A is the focused content layer: clear warm-white surfaces, calm hierarchy, and one obvious next action.
- Learning controls keep their functional equipment identity. Do not recolor state, warning, or audio controls merely to decorate the page.

## Fonts

- Chinese UI: Noto Sans SC, weights 400 / 500 / 600 / 700.
- Latin and numbers: Inter, weights 400 / 600 / 700.
- FIRST MIX wordmark only: Gochi Hand.
- BPM, dB, beat count, timers, and measurements only: Cubic 11 or a tabular monospace fallback.
- Never use a display font for paragraphs, buttons, helper text, or control labels.

CSS UI stack:

```css
font-family: Inter, "Noto Sans SC", "PingFang SC", "Microsoft YaHei UI", sans-serif;
```

## Type ladder

| Role | Size | Weight | Line height | Notes |
| --- | ---: | ---: | ---: | --- |
| Page title | 32px | 700 | 1.08 | letter-spacing -0.035em |
| Section/component title | 20px | 700 | 1.25 | letter-spacing -0.01em maximum |
| Body | 16px | 400 | 1.55 | primary explanatory copy |
| Helper | 14px | 400 | 1.50 | secondary guidance |
| Label | 13px | 600–700 | 1.35 | tabs, states, field labels |
| Metadata | 12px | 400–600 | 1.35 | never smaller than 12px |

Use size to create hierarchy before changing color. Do not create page-specific intermediate sizes.

## Spacing

Base rhythm: 4px. Preferred steps: 4, 8, 12, 16, 20, 24, 32.

- Compact phone gutter: 16px.
- Standard phone gutter: 20px.
- Tablet gutter: 24px.
- Desktop gutter: 32–40px.
- Standard panel padding: 20px.
- Related controls: 8–12px gap.
- Copy groups: 12–16px gap.
- Major sections: 24–32px gap.

## Component geometry

- Primary and secondary buttons: 48px minimum height; 13px radius.
- Icon-only targets: 44 × 44px minimum; 14px radius.
- Tabs and segmented controls: 48px height.
- Standard list row: 72px minimum height.
- Artwork and compact media: 16px radius.
- Standard panel: 24px radius.
- Main page/course shell: 28px radius.
- Pills are reserved for state labels and compact filters, not large containers.

## Color

| Role | Value |
| --- | --- |
| Ink | `#1d1922` |
| Muted text | `#625a67` |
| Quiet metadata | `#756d7a` |
| Current/action state | `#7952cf` |
| Current soft surface | `#eee7fa` |
| Primary CTA / correct cue | `#baff2e` |
| Standard surface | `rgba(255,255,255,.88)` |
| Strong surface | `rgba(255,255,255,.94)` |
| Divider | `rgba(42,34,48,.12)` |
| Equipment surface | `#211d27` |

Environment gradient:

```css
linear-gradient(150deg, #d8ece9 0%, #e7edf2 42%, #ddd4ee 75%, #efdeda 100%)
```

Standard elevated shadow:

```css
0 20px 52px rgba(56,44,68,.12)
```

## Navigation

- Final direction: **scheme A colors + scheme B structure**.
- Three destinations only: 学习, 打碟台, 我的.
- Use a solid white floating pill with no backdrop blur, quiet grey inactive items, and a raised circular violet-soft active control. Do not use the dark background or lime active disc from the original B study.
- Keep text labels visible below every icon; the raised circle, violet color, and label together identify the current destination.
- Touch targets remain at least 44px even when the visual icon is smaller.

## Brand placement

- Use one `FIRST MIX` wordmark per page. Never stack the global masthead wordmark with a page-specific wordmark.
- Main app pages place the wordmark at the upper-left, matching the mixer page: 20px left inset, 64px brand row, Gochi Hand at 1.62rem.
- Do not center the learning or My wordmark. The sound control, when present, stays at the upper-right of the same row.

## Learning course shell

Every playable course uses the same order:

1. 72px top bar with back, wordmark, reset.
2. Step progress.
3. Page title and count.
4. Instruction row with 48px violet mode marker.
5. Equipment/operation surface.
6. Feedback strip with one primary action and optional secondary action.

The controller geometry and verified audio logic remain course-specific. Typography, outer surface, instruction language, feedback state, and touch sizes do not.

## Responsive and clarity rules

- Design from 320px upward with no horizontal scrolling for required actions.
- Do not apply `transform: scale()` or CSS `zoom` to the page shell or text container.
- Judge font clarity at browser preview scale 100%. Fit-to-window device emulation may resample text at a fractional scale.
- Do not place text inside a blurred or filtered ancestor. Ambient blur stays on a separate non-interactive layer.
- Do not translate, scale, animate, or set `will-change: transform` on cards containing readable text, including hover states and open menus. Animate an isolated icon, waveform, or illustration instead; use border and shadow for card hover feedback.
- Verify text clarity at rest, on hover, while its menu is open, and after the transition finishes. A crisp idle screenshot alone is not sufficient.
- Respect safe-area insets and keep fixed navigation from covering the final row.
- At 430 × 932, the page must remain usable with normal vertical scrolling and 48px actions.

## Accessibility

- Text contrast target: WCAG AA, 4.5:1 for normal text.
- Keyboard focus: 3px lime outline with 3px offset.
- Reduced motion removes non-essential translation and pulse without hiding state.
- Every icon button has an accessible name.
- All success/error judgments are shown in text as well as color.

## Prohibited drift

- No text below 12px.
- No arbitrary page-specific font stacks, radii, shadows, or opacity values.
- No grid of generic equal cards when a route, list, or sequence expresses the content better.
- No decorative blur over interactive content.
- No behavior, scoring, timing, or audio changes as a side effect of visual standardization.
