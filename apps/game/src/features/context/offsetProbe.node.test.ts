import { missions } from "@osp/curriculum";
import { assemble } from "psyq-asm";
import { createCompiler } from "psyq-wasm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { FIELD_HEADER, fieldMission } from "../../test/fieldFixture";
import {
  checkoutsFromEnvironment,
  createLocalCheckoutUpstream,
} from "../../test/localCheckoutUpstream.node";
import { PSYQ_ASM_VERSION } from "../compiler/browserToolchain";
import { createToolchainService } from "../compiler/toolchainService";
import type { ToolchainService } from "../compiler/types";
import { offlineUpstream } from "../upstream/upstreamContext";
import { loadMissionContext } from "../workspace/missionContext";
import { runOffsetProbe, type TypeLayout } from "./offsetProbe";

// The offset probe with the pinned toolchain. 012B and the fixture header
// are OSP-authored, so their offsets are asserted exactly. Real missions
// read upstream headers from local checkouts at run time, and their
// assertions never include offsets, sizes, or member names.

function measured(layout: TypeLayout | undefined) {
  if (layout?.kind !== "measured") {
    throw new Error(`Expected a measured type, got ${String(layout?.kind)}.`);
  }
  return layout;
}

describe("the offset probe with the pinned toolchain", () => {
  let service: ToolchainService;

  beforeAll(async () => {
    service = await createToolchainService({
      createCompiler: () => createCompiler(),
      assemble,
      psyqAsmVersion: PSYQ_ASM_VERSION,
    });
  }, 30_000);

  afterAll(() => {
    service.dispose();
  });

  it("measures 012B's padded structs as its example shows them", async () => {
    const mission = missions.find(({ id }) => id === "012B");
    if (mission?.contextTypes === undefined) {
      throw new Error("012B names no context types.");
    }
    const context = await loadMissionContext(mission, offlineUpstream);
    if (context.kind !== "ready") {
      throw new Error(`012B context did not resolve: ${context.kind}.`);
    }

    const outcome = await runOffsetProbe(
      service,
      context.input,
      mission.starterSource,
      mission.contextTypes,
    );

    expect(outcome.kind).toBe("measured");
    const [mixed, pair] = outcome.kind === "measured" ? outcome.types : [];
    expect(measured(mixed)).toEqual({
      kind: "measured",
      name: "struct Mixed",
      size: 16,
      fields: [
        { name: "tag", typeText: "char", kind: "scalar", offset: 0, size: 1 },
        { name: "count", typeText: "int", kind: "scalar", offset: 4, size: 4 },
        { name: "span", typeText: "short", kind: "scalar", offset: 8, size: 2 },
        {
          name: "in",
          typeText: "struct Pair16",
          kind: "aggregate",
          offset: 0xa,
          size: 4,
        },
      ],
    });
    expect(measured(pair).size).toBe(4);

    const cells = mission.example?.regions[0]?.cells ?? [];
    for (const field of measured(mixed).fields.slice(0, 3)) {
      expect(cells.find(({ label }) => label === field.name)?.offset).toBe(
        field.offset,
      );
    }
  });

  it("measures a fixture header with -G 8", async () => {
    const { compiler, starterSource, contextTypes } = await fieldMission();
    const outcome = await runOffsetProbe(
      service,
      {
        filename: compiler.filename,
        source: "",
        headers: {
          "psyq/include/osp_pair.h": FIELD_HEADER.replaceAll("\r\n", "\n"),
        },
        cppFlags: compiler.cppFlags,
        rawFlags: compiler.rawFlags,
        // Real missions build with -G 8, and the probe must still find its words.
        gpSize: 8,
        aspsxVersion: compiler.aspsxVersion,
        encoding: compiler.encoding,
      },
      starterSource,
      contextTypes ?? [],
    );
    expect(outcome).toEqual({
      kind: "measured",
      types: [
        {
          kind: "measured",
          name: "OspSlot",
          size: 20,
          fields: [
            {
              name: "tag",
              typeText: "char",
              kind: "scalar",
              offset: 0,
              size: 1,
            },
            {
              name: "count",
              typeText: "int",
              kind: "scalar",
              offset: 4,
              size: 4,
            },
            {
              name: "pair",
              typeText: "OspPair",
              kind: "aggregate",
              offset: 8,
              size: 8,
            },
            {
              name: "next",
              typeText: "OspPair *",
              kind: "pointer",
              offset: 16,
              size: 4,
            },
          ],
        },
        {
          kind: "measured",
          name: "OspPair",
          size: 8,
          fields: [
            {
              name: "left",
              typeText: "int",
              kind: "scalar",
              offset: 0,
              size: 4,
            },
            {
              name: "right",
              typeText: "int",
              kind: "scalar",
              offset: 4,
              size: 4,
            },
          ],
        },
      ],
    });
  });
});

const checkouts = checkoutsFromEnvironment();
const realMissions = missions.filter(
  (mission) => mission.kind === "real-solved",
);

describe.skipIf(checkouts === undefined)(
  "the offset probe on shipped real missions from local checkouts",
  () => {
    let service: ToolchainService;

    beforeAll(async () => {
      service = await createToolchainService({
        createCompiler: () => createCompiler(),
        assemble,
        psyqAsmVersion: PSYQ_ASM_VERSION,
      });
    }, 30_000);

    afterAll(() => {
      service.dispose();
    });

    it.each(realMissions.map((mission) => [mission.id, mission] as const))(
      "%s measures every context type it names",
      async (_id, mission) => {
        if (checkouts === undefined) {
          throw new Error("Local upstream checkouts are not configured.");
        }
        const context = await loadMissionContext(
          mission,
          createLocalCheckoutUpstream(checkouts),
        );
        if (context.kind !== "ready") {
          throw new Error(`Context did not load: ${context.kind}.`);
        }
        const names = mission.contextTypes ?? [];
        expect(names.length).toBeGreaterThan(0);

        const outcome = await runOffsetProbe(
          service,
          context.input,
          mission.starterSource,
          names,
        );

        expect(outcome.kind).toBe("measured");
        const types = outcome.kind === "measured" ? outcome.types : [];
        expect(types.map(({ name, kind }) => [name, kind])).toEqual(
          names.map((name) => [name, "measured"]),
        );
        for (const type of types.map(measured)) {
          expect(type.fields.length).toBeGreaterThan(0);
          const inside = type.fields.every((field, index, fields) => {
            // A struct may end with a zero-length array, which marks where
            // variable-length data begins rather than holding anything. It
            // sits at the type's own size, so it is the one member allowed to
            // be empty, and only in last place.
            const empty = field.size === 0;
            const last = index === fields.length - 1;
            return (
              (!empty || last) &&
              field.offset + field.size <= type.size &&
              field.offset >= (fields[index - 1]?.offset ?? 0)
            );
          });
          expect(inside, `${type.name} fields lie inside it, in order`).toBe(
            true,
          );
        }
      },
      60_000,
    );
  },
);
