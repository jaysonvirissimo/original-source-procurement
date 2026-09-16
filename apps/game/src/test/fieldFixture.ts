import { sha256Hex, wordsSha256 } from "@osp/curriculum/hash";
import {
  UPSTREAM_DEFAULT_BUILD,
  type Mission,
  type RemoteCReference,
} from "@osp/mission-schema";

// An OSP-authored field mission for browser tests. Its header, source, and
// words are original, and its words come from compiling FIELD_SOURCE with the
// pinned toolchain (checked by fieldFixture.node.test.ts). Browser tests serve
// this content in place of upstream hosts, so no upstream response is ever
// recorded.

export const FIELD_MISSION_ID = "FX1";
export const FIELD_SYMBOL = "osp_pair_sum";

const CORPUS_COMMIT = "f1e1d0c0".repeat(5);
const TARGET_COMMIT = "e2e0".repeat(10);

/** Uses CRLF line endings, as most PsyQ SDK headers do. */
export const FIELD_HEADER = [
  "/* OSP-authored fixture header for browser tests. */",
  "#ifndef OSP_PAIR_H",
  "#define OSP_PAIR_H",
  "",
  "typedef struct OspPair",
  "{",
  "    int left;",
  "    int right;",
  "} OspPair;",
  "",
  "#endif",
  "",
].join("\r\n");

export const FIELD_SOURCE = [
  "/* OSP-authored fixture source for browser tests. */",
  "#include <osp_pair.h>",
  "",
  "int osp_pair_sum(const OspPair *pair)",
  "{",
  "    return pair->left + pair->right;",
  "}",
  "",
].join("\n");

export const FIELD_STARTER =
  "#include <osp_pair.h>\n\nint osp_pair_sum(const OspPair *pair)\n{\n    return 0;\n}\n";

/** The words FIELD_SOURCE assembles to. */
export const FIELD_WORDS: readonly number[] = [
  0x8c830000, 0x8c820004, 0x03e00008, 0x00621021,
];

export const FIELD_PATHS = {
  header: "psyq_4.4/include/osp_pair.h",
  source: "source/osp/pair.c",
  target: "asm/osp/osp_pair_sum.s",
} as const;

export const FIELD_COMMITS = {
  corpus: CORPUS_COMMIT,
  target: TARGET_COMMIT,
} as const;

/** The fixture target as an upstream `.s` file. */
export function fieldTargetText(
  words: readonly number[] = FIELD_WORDS,
): string {
  return [
    `glabel ${FIELD_SYMBOL}`,
    ...words.map(
      (word, index) =>
        `    dw 0x${word.toString(16).toUpperCase().padStart(8, "0")} ; ${(0x80010000 + index * 4).toString(16).toUpperCase()}`,
    ),
    "",
  ].join("\n");
}

/** The field mission, with hashes computed from the fixture content. */
export async function fieldMission(): Promise<Mission> {
  const encoder = new TextEncoder();
  const header: RemoteCReference = {
    repository: "FoxdieTeam/psyq_sdk",
    commit: CORPUS_COMMIT,
    path: FIELD_PATHS.header,
    sha256: await sha256Hex(encoder.encode(FIELD_HEADER)),
  };
  const source: RemoteCReference = {
    repository: "FoxdieTeam/mgs_reversing",
    commit: CORPUS_COMMIT,
    path: FIELD_PATHS.source,
    sha256: await sha256Hex(encoder.encode(FIELD_SOURCE)),
  };
  return {
    schemaVersion: 1,
    id: FIELD_MISSION_ID,
    title: "FIXTURE PAIR",
    phase: "Field work",
    kind: "real-solved",
    source: {
      kind: "mgs-reversing",
      repository: "FoxdieTeam/mgs_reversing",
      build: "default",
      overlay: "main",
      symbol: FIELD_SYMBOL,
      address: 0x80010000,
      sourcePath: FIELD_PATHS.source,
    },
    requires: [],
    teaches: [],
    practices: ["MIPS.LOAD.WORD", "C.STRUCT.FIELD"],
    scaffold: "field",
    completion: "exact",
    compiler: {
      gpSize: 0,
      aspsxVersion: "2.77",
      rawFlags: [...UPSTREAM_DEFAULT_BUILD.rawFlags],
      cppFlags: [...UPSTREAM_DEFAULT_BUILD.cppFlags],
      encoding: "eucjp",
      filename: "pair.c",
      headers: {},
      remoteHeaders: { "psyq/include/osp_pair.h": header },
    },
    briefing: { objective: "Return the sum of two fields." },
    starterSource: FIELD_STARTER,
    symbol: FIELD_SYMBOL,
    target: {
      kind: "remote",
      commit: TARGET_COMMIT,
      path: FIELD_PATHS.target,
      wordCount: FIELD_WORDS.length,
      wordsSha256: await wordsSha256(FIELD_WORDS),
    },
    hints: [
      { stage: 1, text: "Two loads through the first argument, then a sum." },
      {
        stage: 5,
        text: "The pair's declaration.",
        reveal: { ...header, lines: { start: 5, end: 9 } },
      },
      {
        stage: 9,
        text: "The known solution.",
        reveal: { ...source, lines: { start: 4, end: 7 } },
      },
    ],
    difficulty: {
      size: 1,
      controlFlow: 0,
      memory: 1,
      abi: 1,
      types: 1,
      compilerShaping: 0,
      context: 1,
      specialHardware: 0,
    },
  };
}
