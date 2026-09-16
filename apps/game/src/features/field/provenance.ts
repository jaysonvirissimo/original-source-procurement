import type { Mission } from "@osp/mission-schema";
import { sourceLink } from "../upstream/urls";

/** Where a real mission's function comes from, for players to read. */
export interface MissionProvenance {
  readonly repository: string;
  readonly overlay: string;
  readonly symbol: string;
  /** The function's address, as 8 uppercase hexadecimal digits after 0x. */
  readonly address: string | undefined;
  /** The pinned target file. It holds machine words, never the solution. */
  readonly target: {
    readonly path: string;
    readonly commit: string;
    readonly url: string | undefined;
  };
}

/**
 * The provenance of a real mission, or `undefined` for a synthetic one. The
 * link opens the target file at its pinned commit, not the upstream source
 * file, because the source file holds the known solution.
 */
export function missionProvenance(
  mission: Pick<Mission, "source" | "target">,
): MissionProvenance | undefined {
  const { source, target } = mission;
  if (source.kind !== "mgs-reversing" || target.kind !== "remote") {
    return undefined;
  }
  return {
    repository: source.repository,
    overlay: source.overlay,
    symbol: source.symbol,
    address:
      source.address === undefined
        ? undefined
        : `0x${source.address.toString(16).toUpperCase().padStart(8, "0")}`,
    target: {
      path: target.path,
      commit: target.commit,
      url: sourceLink(target.commit, target.path),
    },
  };
}
