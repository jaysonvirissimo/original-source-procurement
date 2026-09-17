import { describe, expect, it } from "vitest";
import { readDeclarations, tokenize } from "./declarations";

// Every declaration here is OSP-authored, shaped like preprocessor output.
const PREPROCESSED = `# 1 "probe.c"
# 1 "shapes.h" 1
typedef unsigned char u_char;
typedef struct { short x, y; short w, h; } Box;
typedef struct _Node Node;
struct _Node {
    u_char  tag;
    Box    *outline;
    Box     bounds;
    void   *data;
    short   extra[2], *spare;
    struct { int a; } inner;
    const char * const label;
    Node   *next;
};
static int helper(Box *b) { return b->w; }
typedef Node Alias;
union Value { int i; char bytes[4]; };
struct Flags { unsigned ready : 1; };
struct Callback { int (*run)(void); };
struct Anonymous { struct { int a; }; };
struct Empty { };
typedef struct Loop Loop2;
typedef Loop2 Loop;
typedef struct Box2 { int w; } Box2, *Box2Pointer;
char *message = "struct Fake { int x; };";
# 3 "probe.c" 2
`;

describe("tokenize", () => {
  it("drops line markers and literals, and keeps C punctuation", () => {
    expect(
      tokenize('# 1 "a.h"\nchar c = \'{\';\nchar *s = "};";\nint a[0x10u];\n'),
    ).toEqual([
      "char",
      "c",
      "=",
      "0",
      ";",
      "char",
      "*",
      "s",
      "=",
      "0",
      ";",
      "int",
      "a",
      "[",
      "0x10u",
      "]",
      ";",
    ]);
  });
});

describe("readDeclarations", () => {
  it("lists members with their written types and kinds, through typedefs", () => {
    const [node, alias, box] = readDeclarations(PREPROCESSED, [
      "Node",
      "Alias",
      "Box",
    ]);
    expect(node).toEqual({
      kind: "declared",
      name: "Node",
      members: [
        { name: "tag", typeText: "u_char", kind: "scalar" },
        { name: "outline", typeText: "Box *", kind: "pointer" },
        { name: "bounds", typeText: "Box", kind: "aggregate" },
        { name: "data", typeText: "void *", kind: "pointer" },
        { name: "extra", typeText: "short[2]", kind: "array" },
        { name: "spare", typeText: "short *", kind: "pointer" },
        { name: "inner", typeText: "struct { … }", kind: "aggregate" },
        { name: "label", typeText: "const char *", kind: "pointer" },
        { name: "next", typeText: "Node *", kind: "pointer" },
      ],
    });
    expect(alias).toEqual({ ...node, name: "Alias" });
    expect(box).toMatchObject({
      kind: "declared",
      members: [{ name: "x" }, { name: "y" }, { name: "w" }, { name: "h" }],
    });
  });

  it("reads tagged structs and unions, and typedef lists", () => {
    expect(
      readDeclarations(PREPROCESSED, ["union Value", "struct Box2", "Box2"]),
    ).toEqual([
      {
        kind: "declared",
        name: "union Value",
        members: [
          { name: "i", typeText: "int", kind: "scalar" },
          { name: "bytes", typeText: "char[4]", kind: "array" },
        ],
      },
      {
        kind: "declared",
        name: "struct Box2",
        members: [{ name: "w", typeText: "int", kind: "scalar" }],
      },
      {
        kind: "declared",
        name: "Box2",
        members: [{ name: "w", typeText: "int", kind: "scalar" }],
      },
    ]);
  });

  it.each([
    ["struct Flags", "it has a bit-field"],
    [
      "struct Callback",
      "it has a function pointer or a parenthesized declarator",
    ],
    ["struct Anonymous", "it has a member without a name"],
    ["struct Empty", "it has no members"],
    ["Loop", "its declaration was not found"],
    ["Box2Pointer", "its declaration was not found"],
    ["u_char", "its declaration was not found"],
    ["struct Fake", "its declaration was not found"],
    ["Missing", "its declaration was not found"],
  ])("makes %s unavailable because %s", (name, reason) => {
    expect(readDeclarations(PREPROCESSED, [name])).toEqual([
      { kind: "unavailable", name, reason },
    ]);
  });

  it("rejects a comma list it cannot read", () => {
    expect(
      readDeclarations("struct Odd { int a, int b; };\n", ["struct Odd"]),
    ).toEqual([
      {
        kind: "unavailable",
        name: "struct Odd",
        reason: "it has a member list OSP cannot read",
      },
    ]);
  });
});

describe("readDeclarations on malformed or unusual text", () => {
  it("tolerates empty, unbalanced, and incomplete declarations", () => {
    expect(tokenize("")).toEqual([]);
    const pairs = [
      "typedef;",
      "typedef int;",
      "typedef struct Pair { int a; } Pair, *PairPointer, Pairs[2], Twin;",
      "typedef Pair *PairAlias;",
    ].join("\n");
    expect(readDeclarations(pairs, ["Twin", "PairAlias"])).toEqual([
      {
        kind: "declared",
        name: "Twin",
        members: [{ name: "a", typeText: "int", kind: "scalar" }],
      },
      {
        kind: "unavailable",
        name: "PairAlias",
        reason: "its declaration was not found",
      },
    ]);
    expect(readDeclarations("typedef int broken];\n", ["broken"])).toEqual([
      {
        kind: "unavailable",
        name: "broken",
        reason: "its declaration was not found",
      },
    ]);
    expect(
      readDeclarations("typedef const Bare;\n", ["struct", "Bare"]).map(
        ({ kind }) => kind,
      ),
    ).toEqual(["unavailable", "unavailable"]);
    expect(readDeclarations("struct Open { int a;", ["struct Open"])).toEqual([
      {
        kind: "declared",
        name: "struct Open",
        members: [{ name: "a", typeText: "int", kind: "scalar" }],
      },
    ]);
  });
});
