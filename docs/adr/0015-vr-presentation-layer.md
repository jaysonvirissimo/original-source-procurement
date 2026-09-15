# ADR 0015: VR presentation layer

Status: Accepted

## Context

OSP presents its workspace inside an abstract training chamber: a near-black void, a luminous grid, and sparse low-poly geometry behind crisp 2D panels. ADR 0001 chose React Three Fiber and Three.js for that layer and kept the editor and all gameplay UI in the DOM. The chamber must never carry information a player needs, must not harm code readability, and must stay cheap on an ordinary desktop.

When the layer was added, the game pinned React 19.3.0. The newest React Three Fiber release, 9.7.0, and its 10.0 prerelease both declare `react` and `react-dom` peers of `>=19 <19.3`. Installing outside a declared peer range would run the renderer against a React reconciler it was not released for.

The sound vocabulary also needs a home before any original sounds exist.

## Decision

- **React is pinned to 19.2.8**, the newest release inside React Three Fiber's peer range, together with matching 19.2 type packages. Revisit once a React Three Fiber release declares support for React 19.3 or later.
- **Presentation state only.** The 3D tree in `apps/game/src/vr/` receives a `VrPresentationState`: a phase (`idle`, `compiling`, `error`, `improved`, `exact`), a mission tier (`training`, `field`, `live`), whether motion is reduced, and a quality (`full`, `simple`). It never receives source text, target words, or match data. The workspace publishes its phase and tier through a narrow context; the app adds settings.
- **Decorative only.** The canvas sits behind the UI with `pointer-events: none` and is hidden from assistive technology. Every state it shows is also shown in the DOM.
- **Cost limits.** Device pixel ratio is capped at 1.5, there are no shadows and no post-processing, and rendering stops while the document is hidden.
- **Motion.** A `motion` setting (`system`, the default, follows `prefers-reduced-motion`; `reduced` always reduces) removes camera movement and ambient drift. Phase changes then appear as static changes.
- **Simple graphics.** A `graphics` setting (`full`, the default, or `simple`) decides whether WebGL mounts at all. In simple mode, when WebGL is unavailable, or when the canvas fails, the flat CSS grid stays as the background.
- **Lazy loading.** The canvas and Three.js load in their own chunk, only when the layer mounts, so the first screen does not wait on them.
- **Audio placeholders.** A typed set of sound cues and an `AudioService` exist, with music and sound-effect channels that each have a volume and mute. The shipped service is silent. No sound is ever required to play.
- The new settings are optional fields with defaults, so, as ADR 0012 describes, they need no migration.

## Consequences

- React 19.3 features are unavailable until the pin is lifted.
- Colors in the 3D scene come from the CSS design tokens, read at mount, so the palette stays defined in one place.
- Declarative mesh components are excluded from coverage. The logic that decides phase, tier, quality, and whether to mount stays covered by unit tests.
- Adding real sounds means supplying original audio behind the existing `AudioService`, without changing callers.
