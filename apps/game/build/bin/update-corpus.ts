/// <reference types="node" />
import { pointerCorpus } from "@osp/curriculum";
import {
  checkoutsFromEnvironment,
  runUpdateCommand,
  CORPUS_CONFIG,
} from "@osp/mgs-importer";

process.exitCode = await runUpdateCommand(
  checkoutsFromEnvironment(),
  CORPUS_CONFIG,
  pointerCorpus,
  console,
);
