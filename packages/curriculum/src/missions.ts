import type { Mission } from "@osp/mission-schema";

/** Mission definitions. Missions are added with their generated targets. */
export const missions: readonly Mission[] = [];

/**
 * The recommended mission order. Prerequisites remain the source of truth:
 * validation requires every mission on this path to be completable with
 * skills taught earlier on it.
 */
export const defaultPath: readonly string[] = [];
