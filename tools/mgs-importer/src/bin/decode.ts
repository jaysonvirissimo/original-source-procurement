/// <reference types="node" />
import { runDecodeCommand } from "../authoringCommands.ts";
import { checkoutsFromEnvironment, createGitReader } from "../checkout.ts";

const checkouts = checkoutsFromEnvironment();

process.exitCode = await runDecodeCommand(
  checkouts && createGitReader(checkouts.mgsReversing),
  process.argv.slice(2),
  console,
);
