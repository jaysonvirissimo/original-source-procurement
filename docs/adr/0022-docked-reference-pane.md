# ADR 0022: Docked reference pane

Status: Accepted

## Context

Hint, Manual, Scan, and History opened as panels positioned over the right half of the workspace. At 1280 × 720 they covered most of the target listing, so a hint that pointed at highlighted rows hid those rows. They also covered the mission-complete actions. Nothing moved focus into a panel or back out, so a reveal button that became disabled dropped focus to the page, and Escape stopped closing the panel. Explanatory paragraphs used the condensed display face at the dense label size, which is hard to read at length. Later panels, such as a view of a real mission's headers, need the same place to open.

## Decision

- **A column, not an overlay.** An open help panel is the last column of the workspace split: editor, handle, listing, handle, pane. Nothing is positioned over the editor, the listing, or the completion panel. With no panel open the split has its original two columns.
- **One panel at a time.** The footer controls still toggle panels, and opening another replaces the current one. The pane is a labelled region, not a dialog, and has no focus trap, so the editor and Compile stay usable beside it.
- **Width is a player setting.** The pane is 300–640 CSS pixels wide, 420 by default, and never more than 45% of the split, so the listing keeps its width at the 1024 × 700 minimum. Its handle works with arrow keys, Home, End, and dragging. The width is saved as an optional setting once a drag ends or a key moves it, so older saves stay valid without a migration. A narrow listing scrolls inside its own column.
- **Focus follows the pane.** Opening a panel focuses its heading. Closing it with Close or Escape returns focus to the control that opened it. Revealing a hint focuses the new stage, so focus never falls back to the page.
- **Prose has its own type.** Explanations in hints, the manual, Scan notes, walkthrough steps, and mismatch evidence use IBM Plex Sans at 16 pixels, with a line height of 1.6 and a 66-character measure, bundled like the other fonts. Labels, listings, and code keep their faces and sizes.

## Consequences

- A hint can point at target rows that stay visible while it is open, at every supported viewport.
- ADR 0013's presentation rules still hold. Scan shows one layer at a time, and diagrams never replace the listing. They now sit beside it rather than over it.
- This resolves the docking that ADR 0020 left as a separate change.
- The editor and listing are narrower while a panel is open. Players who want them wider can narrow the pane or close it.
- The distributed site carries one more font package, listed in the generated third-party notices.
