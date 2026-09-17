/**
 * What each provenance label means, and whether a player needs it while
 * solving. OSP-authored and generic to every field mission.
 */
export const PROVENANCE_LEGEND = [
  {
    term: "Recovered from",
    meaning:
      "The public decompilation project whose contributors recovered this function's C. You can ignore it while solving.",
  },
  {
    term: "Overlay",
    meaning:
      "Which part of the game's code holds the function. main is the program that is always loaded; other overlays load only for particular parts of the game. You can ignore it while solving.",
  },
  {
    term: "Symbol",
    meaning:
      "The function's name. You need this one: your source must define a function with exactly this name, because the comparison looks for it.",
  },
  {
    term: "Address",
    meaning:
      "Where the function sits in the game's memory when it runs. You can ignore it while solving.",
  },
  {
    term: "Target",
    meaning:
      "The project file that holds the instructions you match, and the commit: a fixed snapshot of the project, so the target never changes while you work. You can ignore it while solving.",
  },
] as const;
