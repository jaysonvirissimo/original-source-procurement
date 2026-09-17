/**
 * Lists the members of named struct and union types from preprocessed C.
 *
 * This is not a C parser. It reads declarations only as far as the offset
 * table needs: each member's name, the text of its type, and whether it is a
 * pointer, an array, or an embedded aggregate. The compiler, not this code,
 * decides every offset and size. Anything it does not understand, such as a
 * bit-field or a function pointer, makes that type unavailable instead of
 * guessing.
 */

export type MemberKind = "scalar" | "pointer" | "array" | "aggregate";

export interface MemberDeclaration {
  readonly name: string;
  /** The declared type as written, such as `RECT *` or `short[4]`. */
  readonly typeText: string;
  readonly kind: MemberKind;
}

export type TypeDeclaration =
  | {
      readonly kind: "declared";
      readonly name: string;
      readonly members: readonly MemberDeclaration[];
    }
  | {
      readonly kind: "unavailable";
      readonly name: string;
      readonly reason: string;
    };

type Token = string;

/** The tokens between an aggregate's braces. */
type Body = readonly Token[];

const TOKEN =
  /[A-Za-z_][A-Za-z0-9_]*|0[xX][0-9A-Fa-f]+[uUlL]*|\d+[uUlL]*|\.\.\.|->|[{}()[\];,*:=]|\S/g;
const IDENTIFIER = /^[A-Za-z_][A-Za-z0-9_]*$/;
const QUALIFIERS = new Set(["const", "volatile", "signed", "unsigned"]);
const KEYWORDS = new Set([
  ...QUALIFIERS,
  "struct",
  "union",
  "enum",
  "typedef",
  "extern",
  "static",
  "register",
  "void",
  "char",
  "short",
  "int",
  "long",
  "float",
  "double",
]);

/** Tokens of preprocessed C, without line markers, strings, or characters. */
export function tokenize(preprocessed: string): Token[] {
  const code = preprocessed
    .split("\n")
    .filter((line) => !line.trimStart().startsWith("#"))
    .join("\n")
    .replace(/"(?:[^"\\\n]|\\.)*"|'(?:[^'\\\n]|\\.)*'/g, " 0 ");
  return code.match(TOKEN) ?? [];
}

/** The index just past the bracket that closes the one at `open`. */
function closing(tokens: readonly Token[], open: number): number {
  let depth = 0;
  for (let index = open; index < tokens.length; index += 1) {
    const token = tokens[index];
    if (token === "{" || token === "(" || token === "[") {
      depth += 1;
    } else if (token === "}" || token === ")" || token === "]") {
      depth -= 1;
      if (depth === 0) {
        return index + 1;
      }
    }
  }
  return tokens.length;
}

/** Each token with the number of brackets open before it. */
function withDepth(tokens: readonly Token[]): [Token, number][] {
  let depth = 0;
  return tokens.map((token) => {
    const before = depth;
    if (token === "{" || token === "(" || token === "[") {
      depth += 1;
    } else if (token === "}" || token === ")" || token === "]") {
      depth -= 1;
    }
    return [token, before];
  });
}

/** Splits tokens at `separator` where no bracket is open. */
function splitTopLevel(tokens: readonly Token[], separator: Token): Token[][] {
  const parts: Token[][] = [[]];
  for (const [token, depth] of withDepth(tokens)) {
    if (token === separator && depth === 0) {
      parts.push([]);
    } else {
      parts.at(-1)?.push(token);
    }
  }
  return parts.filter((part) => part.length > 0);
}

/**
 * Top-level statements. A function body ends its statement without a `;`,
 * so the declaration after it starts a statement of its own.
 */
function statements(tokens: readonly Token[]): Token[][] {
  const parts: Token[][] = [[]];
  let functionBody = false;
  withDepth(tokens).forEach(([token, depth], index) => {
    if (token === ";" && depth === 0) {
      parts.push([]);
      return;
    }
    parts.at(-1)?.push(token);
    if (token === "{" && depth === 0) {
      functionBody = tokens[index - 1] === ")";
    } else if (token === "}" && depth === 1 && functionBody) {
      parts.push([]);
    }
  });
  return parts.filter((part) => part.length > 0);
}

/** Every struct and union body, by tag and by typedef name. */
class Declarations {
  private readonly tags = new Map<string, Body>();
  private readonly typedefs = new Map<string, Token[]>();

  constructor(tokens: readonly Token[]) {
    for (const statement of statements(tokens)) {
      this.readStatement(statement);
    }
  }

  private readStatement(statement: readonly Token[]): void {
    this.collectBodies(statement);
    if (statement[0] !== "typedef") {
      return;
    }
    const rest = statement.slice(1);
    const [first = [], ...others] = splitTopLevel(rest, ",");
    const declarator = splitDeclarator(first);
    if (declarator === undefined) {
      return;
    }
    const alias = (tokens: readonly Token[], name: string) => {
      this.typedefs.set(name, [...tokens]);
    };
    if (declarator.stars === 0 && declarator.arrays.length === 0) {
      alias(declarator.specifier, declarator.name);
    }
    for (const other of others) {
      const extra = splitDeclarator(other);
      if (
        extra?.specifier.length === 0 &&
        extra.stars === 0 &&
        extra.arrays.length === 0
      ) {
        alias(declarator.specifier, extra.name);
      }
    }
  }

  /** Records every tagged body in a statement, including nested ones. */
  private collectBodies(tokens: readonly Token[]): void {
    for (let index = 0; index < tokens.length; index += 1) {
      const keyword = tokens[index];
      if (keyword !== "struct" && keyword !== "union") {
        continue;
      }
      const tag = tokens[index + 1];
      const open =
        tag !== undefined && IDENTIFIER.test(tag) ? index + 2 : index + 1;
      if (tokens[open] !== "{") {
        continue;
      }
      const end = closing(tokens, open);
      const body = tokens.slice(open + 1, end - 1);
      if (open === index + 2 && tag !== undefined) {
        this.tags.set(`${keyword} ${tag}`, body);
      }
    }
  }

  /** The body a type specifier names, following typedefs. */
  bodyOf(
    specifier: readonly Token[],
    seen = new Set<string>(),
  ): Body | undefined {
    const tokens = specifier.filter((token) => !QUALIFIERS.has(token));
    const [head, tag, next] = tokens;
    if (head === "struct" || head === "union") {
      if (tag === "{" || next === "{") {
        const open = tag === "{" ? 1 : 2;
        return tokens.slice(open + 1, closing(tokens, open) - 1);
      }
      return tag === undefined ? undefined : this.tags.get(`${head} ${tag}`);
    }
    if (head === undefined || tokens.length !== 1 || seen.has(head)) {
      return undefined;
    }
    const target = this.typedefs.get(head);
    return target === undefined
      ? undefined
      : this.bodyOf(target, new Set([...seen, head]));
  }
}

interface Declarator {
  readonly specifier: Token[];
  readonly stars: number;
  readonly name: string;
  readonly arrays: Token[][];
}

/**
 * Splits `specifier *... name [n]...`. The specifier may be empty for the
 * second and later names in a comma list.
 */
function splitDeclarator(tokens: readonly Token[]): Declarator | undefined {
  let end = tokens.length;
  const arrays: Token[][] = [];
  while (end > 0 && tokens[end - 1] === "]") {
    const open = tokens.lastIndexOf("[", end - 1);
    /* v8 ignore next 3 -- the starter compiled, so every ] has its [. */
    if (open === -1) {
      return undefined;
    }
    arrays.unshift(tokens.slice(open + 1, end - 1));
    end = open;
  }
  const name = tokens[end - 1];
  if (name === undefined || !IDENTIFIER.test(name) || KEYWORDS.has(name)) {
    return undefined;
  }
  let start = end - 1;
  let stars = 0;
  while (
    start > 0 &&
    (tokens[start - 1] === "*" || tokens[start - 1] === "const")
  ) {
    start -= 1;
    if (tokens[start] === "*") {
      stars += 1;
    }
  }
  return { specifier: tokens.slice(0, start), stars, name, arrays };
}

/** Collapses an inline body so a type reads `struct { … }`. */
function specifierText(specifier: readonly Token[]): string {
  const open = specifier.indexOf("{");
  const shown =
    open === -1
      ? specifier
      : [
          ...specifier.slice(0, open),
          "{ … }",
          ...specifier.slice(closing(specifier, open)),
        ];
  return shown.join(" ");
}

function membersOf(
  body: Body,
  declarations: Declarations,
): readonly MemberDeclaration[] | string {
  const members: MemberDeclaration[] = [];
  for (const statement of splitTopLevel(body, ";")) {
    const depthZero = withDepth(statement).flatMap(([token, depth]) =>
      depth === 0 ? [token] : [],
    );
    if (depthZero.includes(":")) {
      return "it has a bit-field";
    }
    if (depthZero.includes("(")) {
      return "it has a function pointer or a parenthesized declarator";
    }
    // A statement is never empty, so it always has a first part.
    const [first = [], ...others] = splitTopLevel(statement, ",");
    const lead = splitDeclarator(first);
    if (lead === undefined || lead.specifier.length === 0) {
      return "it has a member without a name";
    }
    const declarators = [lead];
    for (const other of others) {
      const declarator = splitDeclarator(other);
      if (declarator === undefined || declarator.specifier.length > 0) {
        return "it has a member list OSP cannot read";
      }
      declarators.push(declarator);
    }
    const aggregate = declarations.bodyOf(lead.specifier) !== undefined;
    for (const declarator of declarators) {
      const stars = "*".repeat(declarator.stars);
      const arrays = declarator.arrays
        .map((size) => `[${size.join("")}]`)
        .join("");
      members.push({
        name: declarator.name,
        typeText: `${specifierText(lead.specifier)}${stars === "" ? "" : ` ${stars}`}${arrays}`,
        kind:
          declarator.arrays.length > 0
            ? "array"
            : declarator.stars > 0
              ? "pointer"
              : aggregate
                ? "aggregate"
                : "scalar",
      });
    }
  }
  return members.length === 0 ? "it has no members" : members;
}

/** The members of each named type, in declaration order. */
export function readDeclarations(
  preprocessed: string,
  names: readonly string[],
): TypeDeclaration[] {
  const declarations = new Declarations(tokenize(preprocessed));
  return names.map((name) => {
    const body = declarations.bodyOf(name.split(" "));
    if (body === undefined) {
      return {
        kind: "unavailable",
        name,
        reason: "its declaration was not found",
      };
    }
    const members = membersOf(body, declarations);
    return typeof members === "string"
      ? { kind: "unavailable", name, reason: members }
      : { kind: "declared", name, members };
  });
}
