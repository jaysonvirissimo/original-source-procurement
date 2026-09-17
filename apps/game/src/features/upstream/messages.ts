/** Upstream content could not be reached, while loading a mission's target. */
export const UPSTREAM_UNAVAILABLE =
  "Field missions load their targets from the mgs_reversing project on GitHub, and OSP couldn't reach it. Training missions still work. Check your connection and try again.";

/** Upstream content could not be reached, while loading a hint. */
export const UPSTREAM_HINT_UNAVAILABLE =
  "This hint loads its source from the mgs_reversing project on GitHub, and OSP couldn't reach it. Check your connection and try again.";

/** Upstream content arrived but failed its recorded hash. */
export const UPSTREAM_CONTENT_MISMATCH =
  "The game data OSP downloaded for this mission didn't match what it expected, so it wasn't used. Try again later.";

/** Upstream content could not be reached, shown where the headers would be. */
export const UPSTREAM_CONTEXT_UNAVAILABLE =
  "This mission's target and headers load from the mgs_reversing and psyq_sdk projects on GitHub, and OSP couldn't reach them. Check your connection and try again.";
