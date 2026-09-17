import type { Mission } from "@osp/mission-schema";

/**
 * Whether a mission offers the Context panel: it compiles against headers,
 * or it names types for the field-offset table.
 */
export function hasContext(
  mission: Pick<Mission, "compiler" | "contextTypes">,
): boolean {
  return (
    Object.keys(mission.compiler.headers).length > 0 ||
    Object.keys(mission.compiler.remoteHeaders ?? {}).length > 0 ||
    mission.contextTypes !== undefined
  );
}
