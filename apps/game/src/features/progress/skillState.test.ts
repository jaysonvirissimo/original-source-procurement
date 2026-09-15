import { describe, expect, it } from "vitest";
import { timestamp } from "../persistence/persistence.test-helpers";
import type { PlayerState, SkillEvidence } from "../persistence/schema";
import { shippedMission } from "../workspace/workspace.test-helpers";
import { completionEvidence } from "./evidence";
import {
  completionSkillChanges,
  SKILL_STATES,
  skillState,
  skillStateOf,
  type SkillState,
} from "./skillState";

const SKILL = "MIPS.LOAD.WORD";

interface EventOptions {
  readonly mission?: string;
  readonly hint?: number;
  readonly revealed?: boolean;
  readonly at?: number;
  readonly completion?: string;
}

let sequence = 0;

/** One completion's evidence for the skill, each from a new mission unless named. */
function event(
  kind: SkillEvidence["kind"],
  options: EventOptions = {},
): SkillEvidence {
  sequence += 1;
  const completionId = options.completion ?? `visit:${String(sequence)}`;
  return {
    id: `${completionId}:${SKILL}`,
    completionId,
    skill: SKILL,
    missionId: options.mission ?? String(100 + sequence),
    kind,
    hintMaxStage: options.hint ?? 0,
    solutionRevealed: options.revealed ?? false,
    completedAt: timestamp(options.at ?? sequence),
  };
}

/** Evidence that reaches each state, one qualifying event per step. */
function reach(state: SkillState): SkillEvidence[] {
  const steps = [
    () => event("introduced"),
    () => event("practiced"),
    () => event("synthesis"),
    () => event("real"),
  ];
  return steps.slice(0, SKILL_STATES.indexOf(state)).map((step) => step());
}

describe("skillState", () => {
  it.each<[string, () => SkillEvidence[], SkillState]>([
    ["no evidence is NEW", () => [], "NEW"],
    [
      "an introduction reaches INTRODUCED",
      () => reach("INTRODUCED"),
      "INTRODUCED",
    ],
    ["practice reaches PRACTICED", () => reach("PRACTICED"), "PRACTICED"],
    [
      "synthesis reaches DEMONSTRATED",
      () => reach("DEMONSTRATED"),
      "DEMONSTRATED",
    ],
    ["a real mission reaches MASTERED", () => reach("MASTERED"), "MASTERED"],
  ])("%s", (_name, evidence, expected) => {
    expect(skillState(evidence())).toBe(expected);
  });

  describe("NEW to INTRODUCED", () => {
    it.each(["introduced", "practiced", "synthesis", "real"] as const)(
      "any %s event qualifies, even with every hint opened",
      (kind) => {
        expect(skillState([event(kind, { hint: 8 })])).toBe("INTRODUCED");
      },
    );
  });

  describe("INTRODUCED to PRACTICED", () => {
    it.each<[SkillEvidence["kind"], number, SkillState]>([
      ["practiced", 6, "PRACTICED"],
      ["practiced", 7, "INTRODUCED"],
      ["synthesis", 6, "PRACTICED"],
      ["real", 6, "PRACTICED"],
      ["introduced", 0, "INTRODUCED"],
    ])("a %s event at hint stage %i gives %s", (kind, hint, expected) => {
      expect(skillState([...reach("INTRODUCED"), event(kind, { hint })])).toBe(
        expected,
      );
    });
  });

  describe("PRACTICED to DEMONSTRATED", () => {
    it.each<[SkillEvidence["kind"], number, SkillState]>([
      ["synthesis", 4, "DEMONSTRATED"],
      ["synthesis", 5, "PRACTICED"],
      ["real", 4, "DEMONSTRATED"],
      ["practiced", 0, "PRACTICED"],
      ["introduced", 0, "PRACTICED"],
    ])("a %s event at hint stage %i gives %s", (kind, hint, expected) => {
      expect(skillState([...reach("PRACTICED"), event(kind, { hint })])).toBe(
        expected,
      );
    });
  });

  describe("DEMONSTRATED to MASTERED", () => {
    it.each<[SkillEvidence["kind"], number, SkillState]>([
      ["synthesis", 3, "MASTERED"],
      ["real", 3, "MASTERED"],
      ["real", 4, "DEMONSTRATED"],
      ["practiced", 0, "DEMONSTRATED"],
    ])("a %s event at hint stage %i gives %s", (kind, hint, expected) => {
      expect(
        skillState([...reach("DEMONSTRATED"), event(kind, { hint })]),
      ).toBe(expected);
    });

    it("needs a different mission than the one that reached DEMONSTRATED", () => {
      const evidence = reach("PRACTICED");
      const demonstrated = event("synthesis", { mission: "012" });
      const replay = event("synthesis", { mission: "012" });

      expect(skillState([...evidence, demonstrated, replay])).toBe(
        "DEMONSTRATED",
      );
    });
  });

  it.each(["NEW", "INTRODUCED", "PRACTICED", "DEMONSTRATED"] as const)(
    "a revealed solution never advances from %s",
    (state) => {
      expect(
        skillState([...reach(state), event("real", { revealed: true })]),
      ).toBe(state);
    },
  );

  it("advances one step per event, however strong", () => {
    expect(skillState([event("real")])).toBe("INTRODUCED");
  });

  it("counts skipping ahead as nothing more than the later mission's events", () => {
    expect(skillState([event("synthesis", { mission: "012" })])).toBe(
      "INTRODUCED",
    );
  });

  it("lets a mission advance a skill only once, however often it is replayed", () => {
    const replays = [1, 2, 3].map(() => event("synthesis", { mission: "012" }));

    expect(skillState(replays)).toBe("INTRODUCED");
  });

  it("lets a replay advance when the mission's earlier run did not qualify", () => {
    const evidence = [
      event("introduced", { mission: "006" }),
      event("practiced", { mission: "007", hint: 9 }),
      event("practiced", { mission: "007", hint: 2 }),
    ];

    expect(skillState(evidence)).toBe("PRACTICED");
  });

  it("orders events by completion time, then by ID, whatever the input order", () => {
    const evidence = [
      event("introduced", { at: 1 }),
      event("practiced", { at: 2, hint: 9 }),
      event("practiced", { at: 3 }),
    ];

    expect(skillState([...evidence].reverse())).toBe("PRACTICED");
    // At equal times the IDs decide, so the result is the same either way.
    const tied = [
      event("introduced", { at: 5, completion: "a" }),
      event("practiced", { at: 5, completion: "b" }),
    ];
    expect(skillState(tied)).toBe(skillState([...tied].reverse()));
  });

  it("never decreases as evidence is added", () => {
    const templates: (() => SkillEvidence)[] = [
      () => event("introduced", { mission: "001" }),
      () => event("practiced", { mission: "002", hint: 5 }),
      () => event("practiced", { mission: "003", hint: 8 }),
      () => event("synthesis", { mission: "004", hint: 2 }),
      () => event("real", { mission: "005", revealed: true }),
      () => event("real", { mission: "006", hint: 4 }),
    ];
    const orders = (length: number): number[][] =>
      length === 0
        ? [[]]
        : orders(length - 1).flatMap((order) =>
            templates.map((_template, index) => [...order, index]),
          );

    for (const order of orders(4)) {
      const evidence: SkillEvidence[] = [];
      let previous = 0;
      for (const index of order) {
        evidence.push(templates[index]?.() ?? event("introduced"));
        const rank = SKILL_STATES.indexOf(skillState(evidence));
        expect(rank).toBeGreaterThanOrEqual(previous);
        previous = rank;
      }
    }
  });
});

describe("skillStateOf", () => {
  it("reads a skill's stored evidence, and NEW for a skill with none", () => {
    const skills: PlayerState["skills"] = {
      [SKILL]: { evidence: reach("PRACTICED") },
    };

    expect(skillStateOf(skills, SKILL)).toBe("PRACTICED");
    expect(skillStateOf(skills, "ABI.RETURN")).toBe("NEW");
  });

  it.each([true, false])(
    "gives the same state after a prediction mission whether the prediction was right (%s)",
    (right) => {
      const argumentZero = shippedMission("002");
      const answer = argumentZero.prediction?.answer ?? 0;
      const facts = {
        completionId: "visit",
        hintStage: 0,
        completedAt: timestamp(1),
      };
      const evidence = completionEvidence(argumentZero, {
        ...facts,
        predictionChoice: right ? answer : answer + 1,
      });
      const unpredicted = completionEvidence(argumentZero, facts);

      expect(evidence.prediction?.correct).toBe(right);
      expect(evidence.skills).toEqual(unpredicted.skills);
      const skills: PlayerState["skills"] = Object.fromEntries(
        evidence.skills.map((event) => [event.skill, { evidence: [event] }]),
      );
      for (const skill of argumentZero.teaches) {
        expect(skillStateOf(skills, skill)).toBe("INTRODUCED");
      }
    },
  );
});

describe("completionSkillChanges", () => {
  it("reports each skill's state before and after one completion", () => {
    const earlier = event("introduced", { mission: "006" });
    const completion = "visit:done";
    const skills: PlayerState["skills"] = {
      [SKILL]: {
        evidence: [earlier, event("practiced", { mission: "007", completion })],
      },
      "ABI.RETURN": {
        evidence: [
          {
            ...event("practiced", { mission: "007", completion }),
            id: `${completion}:ABI.RETURN`,
            skill: "ABI.RETURN",
          },
        ],
      },
      "ABI.ARGUMENT": { evidence: [event("introduced")] },
    };

    expect(completionSkillChanges(skills, completion)).toEqual([
      {
        skill: SKILL,
        before: "INTRODUCED",
        after: "PRACTICED",
        solutionRevealed: false,
      },
      {
        skill: "ABI.RETURN",
        before: "NEW",
        after: "INTRODUCED",
        solutionRevealed: false,
      },
    ]);
  });

  it("marks a completion that revealed the solution, and reports nothing for an unknown one", () => {
    const completion = "visit:revealed";
    const skills: PlayerState["skills"] = {
      [SKILL]: {
        evidence: [
          ...reach("INTRODUCED"),
          event("practiced", { completion, revealed: true }),
        ],
      },
    };

    expect(completionSkillChanges(skills, completion)).toEqual([
      {
        skill: SKILL,
        before: "INTRODUCED",
        after: "INTRODUCED",
        solutionRevealed: true,
      },
    ]);
    expect(completionSkillChanges(skills, "visit:unknown")).toEqual([]);
  });
});
