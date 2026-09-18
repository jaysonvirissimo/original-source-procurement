import { readImportIndex, type Root } from "./artifacts.ts";
import type { GitReader } from "./checkout.ts";
import { messageOf, MISSING_CHECKOUTS, type CommandOutput } from "./cli.ts";
import type { CorpusConfig } from "./config.ts";
import { renderDecodedTarget } from "./decode.ts";
import { sha256Hex } from "./hash.ts";
import { functionSpan } from "./spans.ts";
import { extractDwWords } from "./target.ts";

/*
 * Commands for authoring a real mission. Both read the pinned upstream
 * checkout and print to the terminal; neither writes into the repository.
 */

export const SPANS_USAGE =
  "Usage: pnpm corpus:spans SYMBOL PATH [SYMBOL PATH ...], each PATH a source file in mgs_reversing.";

export const DECODE_USAGE = "Usage: pnpm corpus:decode SYMBOL [SYMBOL ...].";

const decoder = new TextDecoder();

/**
 * Prints, for each symbol and source path, what a stage 5 or stage 9 reveal
 * records: the file's hash at the pinned commit, the function's line span,
 * and its signature. Returns a process exit code.
 */
export async function runSpansCommand(
  upstream: GitReader | undefined,
  config: CorpusConfig,
  args: readonly string[],
  output: CommandOutput,
): Promise<number> {
  if (upstream === undefined) {
    output.error(MISSING_CHECKOUTS);
    return 1;
  }
  if (args.length === 0 || args.length % 2 !== 0) {
    output.error(SPANS_USAGE);
    return 1;
  }

  let failed = false;
  for (let index = 0; index < args.length; index += 2) {
    const symbol = args.slice(index, index + 1).join("");
    const path = args.slice(index + 1, index + 2).join("");
    const bytes = await upstream.blob(config.upstreamCommit, path);
    if (bytes === undefined) {
      output.error(
        `${path}: not in mgs_reversing at ${config.upstreamCommit}.`,
      );
      failed = true;
      continue;
    }
    const text = decoder.decode(bytes);
    const lineCount = text.split("\n").length - (text.endsWith("\n") ? 1 : 0);
    const span = functionSpan(text, symbol);
    output.log("=".repeat(72));
    output.log(`${symbol}  ${path}`);
    output.log(`  commit      : ${config.upstreamCommit}`);
    output.log(`  file sha256 : ${sha256Hex(bytes)}`);
    output.log(
      `  bytes       : ${String(bytes.byteLength)}   lines: ${String(lineCount)}`,
    );
    if (span === undefined) {
      output.error(`  span        : ${symbol} is not defined in this file.`);
      failed = true;
      continue;
    }
    output.log(
      `  span        : ${String(span.start)}..${String(span.end)}   (${String(span.end - span.start + 1)} lines)`,
    );
    output.log(`  signature   : ${span.signature}`);
  }
  return failed ? 1 : 0;
}

/**
 * Prints each symbol's pinned target as instructions, reading the target's
 * words from the assembly file the last import pinned. Returns a process
 * exit code.
 */
export async function runDecodeCommand(
  upstream: GitReader | undefined,
  args: readonly string[],
  output: CommandOutput,
  root: Root = ".",
): Promise<number> {
  if (upstream === undefined) {
    output.error(MISSING_CHECKOUTS);
    return 1;
  }
  if (args.length === 0) {
    output.error(DECODE_USAGE);
    return 1;
  }

  let index;
  try {
    index = await readImportIndex(root);
  } catch (error) {
    output.error(`${messageOf(error)} Run pnpm corpus:import first.`);
    return 1;
  }

  let failed = false;
  for (const symbol of args) {
    const pinned = index.functions.find(
      (record) => record.symbol === symbol,
    )?.pinned;
    if (pinned === undefined) {
      output.error(`${symbol}: the last import pinned no target for it.`);
      failed = true;
      continue;
    }
    const bytes = await upstream.blob(pinned.target.commit, pinned.target.path);
    if (bytes === undefined) {
      output.error(
        `${symbol}: ${pinned.target.path} is not in mgs_reversing at ${pinned.target.commit}.`,
      );
      failed = true;
      continue;
    }
    output.log("=".repeat(72));
    for (const line of renderDecodedTarget(
      symbol,
      extractDwWords(decoder.decode(bytes)),
    )) {
      output.log(line);
    }
  }
  return failed ? 1 : 0;
}
