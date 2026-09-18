/// <reference types="node" />
import { feasibilityPointers, missions } from "@osp/curriculum";
import { fingerprintsOf, runUpstreamAudit } from "../audit-upstream.ts";

process.exitCode = await runUpstreamAudit(
  {
    repositoryRoot: ".",
    siteDirectory: process.argv[2] ?? "apps/game/dist",
    // Naming the site, as pnpm check does, means it must exist.
    requireSite: process.argv[2] !== undefined,
    fingerprints: fingerprintsOf(feasibilityPointers, missions),
  },
  console,
);
