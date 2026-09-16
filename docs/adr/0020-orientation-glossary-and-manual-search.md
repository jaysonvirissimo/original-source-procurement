# ADR 0020: Orientation, glossary, and manual search

Status: Accepted

## Context

A walkthrough from the point of view of a web developer new to C and assembly found that mission 001 uses registers, `$v0`, `jr`, `addiu`, `0x2A`, the Word column, and the delay slot without introducing any of them. The landing page opened straight onto the mission map, with no account of what matching decompilation is or what Compile does. The workspace Manual showed only entries linked to the open mission, so a definition met in one mission was hard to find again in a later one. `#/manual/:entryId` was a placeholder.

Mission text is plain strings, shown by the briefing, hints, annotations, and evidence and prediction prompts. Real-mission text must also pass the clean-room text rules.

## Decision

- **Manual sections.** The manual gains ORIENTATION, TOOLS, and GLOSSARY sections. `MANUAL_SECTIONS` also sets the order the manual lists sections in: ORIENTATION and TOOLS first, GLOSSARY last. Orientation entries are read in the order the curriculum lists them. Instruction reading (operand order per instruction family) is a MIPS entry.
- **Terms, not markup.** A mission may list `terms`: the GLOSSARY entries for the terms its text uses. Text stays plain, with no link syntax to parse, render, or check under the real-mission text rules. Curriculum validation reports a term that names an unknown entry or an entry outside GLOSSARY. The briefing lists the terms, each opening to its definition in place, and the workspace Manual lists them after the mission's linked entries.
- **Orientation route.** `#/orientation` shows the ORIENTATION and TOOLS entries in order, then links to the first mission on the default path and to the manual. A save that has never opened a mission shows a Start here panel on the landing page that links to it. Other saves keep a small link to the orientation and the manual. The first mission on the default path links to it from its briefing. Orientation is never required, dispatches nothing, and records no skill evidence.
- **One manual browser.** `#/manual` and `#/manual/:entryId` show every entry by section, with search, and focus the named entry. The workspace Manual uses the same browser: it opens on "This mission", toggles to "All entries", and a search always covers every entry.
- **Search.** Every word of the query must appear in an entry's title or body, ignoring case. Title matches come first, then body matches, each in manual order. Nothing is indexed or stored.

## Consequences

- Earlier definitions are reachable from any mission, including ones the player skipped ahead to.
- New missions list their terms, and each needs a GLOSSARY entry before validation passes. Terms are optional, so existing and generated real missions stay valid.
- A term is defined once, in the manual. Mission text still has to introduce a term in words or rely on its terms list; nothing checks that the text and the list agree beyond the shipped-data test for the first mission.
- Orientation content is manual data, so revisiting it from the manual and the route never drift apart.
- The Manual still opens as the workspace overlay. Docking it beside the listing is a separate change.
