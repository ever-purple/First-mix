# FIRST MIX Design

> **Current authority (2026-10-10):** use `design-system/first-mix/AC-UNIFIED.md` and `ac-unified.css`. The older generated `design-system/first-mix/MASTER.md` is retained only as historical output and must not be used for new work.

## Direction

FIRST MIX pairs a calm, rounded mobile product shell with the spatial logic of a real two-channel DJ controller. The experience has three primary screens: a product-first home, a focused course screen, and a full DJ console. The home uses one imperfect hand-drawn DJ character to establish a defiant, independent personality; the playable area becomes a dark equipment surface with two platters, a central mixer, channel controls, and meters.

### Current A + C visual architecture

- **C is the site-wide environment layer.** Learning, mixing, and “My” live in one soft blue-purple atmosphere with generous air and music-first calm. This layer is built with color and light, not the retired learning background images.
- **A is the focused learning layer.** Learning content sits in a clear, warm-white rounded panel with explicit progress, one primary action, and immediate feedback.
- Entering a lesson is a natural tightening of C into A, not a theme switch. Course controls retain their functional equipment colors and feedback surfaces rather than being recolored to match the outer panel.

## Why this world fits

The product teaches timing through action. Rehearsal notation belongs to the cultural world of learning rhythm without copying the appearance of a professional DJ console. It can scale from the phase-two audio bench to tutorial sessions, results, and later portfolio documentation.

## Raises retained from the direction review

- Crouwel grid discipline: controls and timing share one visible eight-column rhythm.
- Warm consumer app clarity: muted powder blue is reserved for current actions and comfortable targets.
- Rebelliousness comes from the character's expression, posture, and wavering ink line—not from visual noise or a rainbow palette.
- Interface palette stays limited to warm off-white, charcoal, neutral grey, and powder periwinkle. Red is not paired with dusty blue in functional UI.
- Data-sublime precision: live values use tabular numerals and react directly to audio state, without strobing or intimidation.
- Lexicon restraint: explanations stay short, typographic, and outside control surfaces.

## Tokens

- Paper: `#F2EEDF`
- Ink: `#151713`
- Muted ink: `#555A50`
- Rule: `#C9C5B7`
- Action: `#C8FF32`
- Action ink: `#11140B`
- Cobalt information: `#2457E6`
- Error: `#B42318`
- Display face: Gochi Hand for the Latin FIRST MIX wordmark only (SIL OFL 1.1).
- Interface face: the platform UI sans stack with Microsoft YaHei UI for Chinese controls and explanations.
- Data face: Cubic 11 only for beat counts and measurements.

## Composition

- The page separates learning navigation from the equipment surface without turning either into a dashboard of cards.
- A horizontal eight-count rail anchors the page.
- Two tactile decks flank a narrower central mixer, matching the spatial model users will later encounter on real equipment.
- Borders are thin ink rules; shadow is reserved for the current tutorial sheet.
- Radius is restrained at 12 to 16 pixels. Pills are used only for compact status labels.

## Interaction

- The muted action color marks only the next usable action, focus, and active transport.
- Keep illustration to the home hero. Do not decorate every card; preserve generous negative space and quiet rounded surfaces.
- Every drag control has keyboard support and plus or minus buttons where precision matters.
- Motion is functional: beat pulses, playheads, and tutorial-sheet changes. Reduced motion removes pulse and translation while preserving state.
- Audio activation, loading, success, and recovery states are explicit in text.

## Responsive behavior

- Desktop shows both decks side by side with the crossfader spanning them.
- Narrow screens stack the decks but keep the crossfader and current instruction visible.
- No horizontal scrolling is required to operate the prototype.

## Chinese line composition

- A single Chinese character or one punctuation mark must never occupy the final line of a heading, paragraph, button, tab, helper message, empty state, or sheet copy.
- Headings use balanced wrapping; paragraphs and helper copy use pretty wrapping with strict Chinese line-breaking rules.
- Keep the final two Han characters and their trailing punctuation together. Dynamic copy applies the same orphan guard after rendering.
- Do not solve orphan lines with blanket `white-space: nowrap`; shorten the copy, widen the measure, or intentionally create a balanced two-line label.
- Buttons should prefer 2–6 Chinese characters. When a control must wrap, it wraps as a meaningful phrase rather than leaving one character alone.

## Learning lesson 00

- Lesson 00 is an operational walkthrough, not a tour or a concept quiz.
- The learner completes one audible workflow: play A → pause at a chosen start → save Deck Cue A → play away from it → return to Cue → Play B → Sync B → exchange low frequencies → physically drag Crossfader to B → confirm B is playing alone.
- The active physical control is highlighted at its actual location. The explanation always describes the currently highlighted control, never the previous action.
- Introduce Cue as a plain-language “start marker” before using DJ terminology. In lesson 00, teach only the essential cycle: pause at the intended start, press Cue to save it, play away, then press Cue to return and stop. Hold-to-preview is advanced behavior and stays out of the first lesson.
- Cue must be demonstrated on music with an audible structure, not a bare drum loop. Lesson 00 uses an in-app synthesized, public-domain “Ode to Joy” arrangement with a short intro and a clear melody entrance; the pause step unlocks only after the intro so the return has an obvious musical result.
- This product is for personal practice and creation rather than live performance. Do not add headphone PFL/monitoring controls or lessons unless the product scope changes.
- Lesson 00 occupies one fixed viewport. Its stage does not gain an internal scrollbar; instruction chips stay compact so the controller and current explanation remain visible together.
- Knowledge checks unlock from completed audio/control state; a generic Continue button cannot advance an unfinished action.
- Drag steps advance only after the physical control crosses its required threshold. Tapping an instruction card never substitutes for operating the control.
- Technique examples use original, rights-clear training loops with exaggerated before/after contrast. Commercial recordings are never bundled without an explicit license.

## Completion sheet

- Course completion appears as a bottom sheet over the lesson, not as a new full-screen composition.
- The sheet uses a 30px top radius, a drag-handle-ready top edge, a lightly dimmed backdrop, and one primary next action.
- The character is a compact upper-body cutout behind the sheet, visibly leaning on its top edge; it may not cover the completion title, explanation, or action.

## “My” information architecture

The bottom navigation label is **My** (`我的`). It contains two sibling views with one shared tab bar: DJ archive and saved works. One page-level recording action serves both views; child cards and empty states do not repeat it.

### DJ archive

- The archive must not repeat the lesson route or course completion UI from Learning.
- It summarizes actual practice behavior as a mutable Sound DNA, three plain stats, and a controller heat map. Empty accounts say that the profile is still forming instead of fabricating a style.
- An AI weekly learning-direction card may run once per local calendar week. It uses only recordings made while both Deck A and Deck B contain device-imported personal music; bundled lesson and practice tracks are always excluded. When no eligible work exists, the card explains the requirement without adding another recording action.
- The AI card returns one concrete learning direction for the week and preserves it until the next Monday. It is guidance, not a score.

### My works

- Works appear as a waveform shelf with local-storage notice, download, delete, and an instructive empty state.
- Opening a work launches Mix Story: Intro, Deck A, Blend, Handoff, Deck B, and Outro are clickable generated chapters across the recording duration.
- Each chapter can store one local note. The expanded player also carries a transition-moment card, signal-derived mood tags, chapter-responsive character expression, and a locally generated share poster.
- Page style: the work leads. The expanded story player is dark, focused, scroll-safe on small phones, and collapses back to a persistent mini player.
- Keep the local-only persistence warning visible without presenting it as an error.

### Future “My” needs

- Search and tags across saved works.
- BPM and musical-key metadata for each song, with confidence labels for automatically estimated values.
- Export/backup for local works before clearing browser storage or moving devices.
- Version notes for a Mix so users can remember what changed between attempts.
- Favorites and set-list grouping once a user has enough material; do not add these to an empty first-run account.

## App spacing and type scale

- App content uses a `20px` minimum side gutter, increasing fluidly to `40px` on wide screens. Full-bleed learning backgrounds are the only exception; their interactive content still respects the gutter.
- App content is capped at `1000px` and centered. Child screens use `width: 100%` rather than subtracting a second gutter.
- Page title: fluid `36–52px`, tight `1.02` line-height.
- Section title: `22px`; body and button text: `14px`; labels: `12px`; metadata: `11px`.
- The bottom navigation uses the same page gutter. Compact floating controls may use smaller internal padding but never reduce the page gutter.

## Course audio loudness

- Every course source clip is prepared to the same perceived-loudness target before it is added to a page: `-16 LUFS-I` integrated loudness, `-1 dBTP` maximum true peak, and no clipped samples.
- A solo deck plays at `0.90` element/gain level. A two-deck comparison or overlap uses `0.84` per deck as the shared ceiling; crossfades use equal-power curves under that ceiling. Do not compensate for a quiet source by inventing page-specific gains.
- Very short scrub or Cue previews use `0.28`, then restore the solo level of `0.90` immediately. Muted and fade endpoints may use `0` as required by the interaction.
- Course pages must not silently change operating-system volume or add a visible master-volume task. Before delivery, compare every lesson at the same system volume and verify that instructions, single-deck playback, and two-deck comparisons remain clearly audible without a sudden loudness jump between lessons.
- When synthesized training audio has a high peak-to-average ratio, apply gentle dynamics control during asset generation and normalize the rendered asset to the shared target. Do not solve low perceived loudness by pushing runtime volume above the shared ceiling.

## Course sequence navigation

- Completed playable lessons form one continuous route. As soon as a new playable lesson is finished, connect the previous lesson's completion-sheet primary action directly to it.
- The sequence currently runs `00 → 01 → 02 → 03`. “再做一次” always restarts the current lesson at its first operation and never repeats the opening question.
- A lesson that has not been built must not receive a live route. Its next-course control is shown as unavailable until that playable page exists, preventing empty pages and broken links.

## Avoid

- No nightclub decoration, chrome, waveform wallpaper, or glass panels. Equipment details must map to a real control or audio state rather than imitate complexity for its own sake.
- No generic equal cards, emoji icons, hidden labels, or color-only status.
- No decorative animation that competes with the beat.
