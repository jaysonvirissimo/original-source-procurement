/// <reference types="node" />
import { checkoutsFromEnvironment } from "../checkout.ts";
import { runImportCommand } from "../cli.ts";
import { CORPUS_CONFIG } from "../config.ts";

process.exitCode = await runImportCommand(
  checkoutsFromEnvironment(),
  CORPUS_CONFIG,
  console,
);
