/// <reference types="node" />
import { runSpansCommand } from "../authoringCommands.ts";
import { checkoutsFromEnvironment, createGitReader } from "../checkout.ts";
import { CORPUS_CONFIG } from "../config.ts";

const checkouts = checkoutsFromEnvironment();

process.exitCode = await runSpansCommand(
  checkouts && createGitReader(checkouts.mgsReversing),
  CORPUS_CONFIG,
  process.argv.slice(2),
  console,
);
