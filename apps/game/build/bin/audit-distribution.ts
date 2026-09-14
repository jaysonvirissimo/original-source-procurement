/// <reference types="node" />
import { runDistributionAudit } from "../audit-distribution.ts";
import { PSYQ_WASM_RELEASE } from "../psyq-wasm-release.ts";
import { NOTICES_FILE_NAME } from "../third-party-notices.ts";

const siteDirectory = process.argv[2] ?? "apps/game/dist";

process.exitCode = await runDistributionAudit(
  siteDirectory,
  {
    release: PSYQ_WASM_RELEASE,
    noticesFile: NOTICES_FILE_NAME,
    noticeText: [
      `psyq-wasm ${PSYQ_WASM_RELEASE.version}`,
      "License: MIT AND GPL-2.0-only",
      "GNU GENERAL PUBLIC LICENSE",
      "Version 2, June 1991",
      "psyq-asm 0.2.0",
    ],
  },
  console,
);
