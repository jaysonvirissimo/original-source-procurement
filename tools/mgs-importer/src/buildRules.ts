/**
 * Upstream's per-file build rules, transcribed from its build script.
 *
 * OSP imports from the default game build only. Two other toolchains appear
 * upstream and are excluded: the sound and MTS sources build with PsyQ 4.3 and
 * ASPSX 2.56, and a separate disc variant builds with ASPSX 2.81. Everything
 * imported therefore assembles at ASPSX 2.77.
 */

/** Source directories built with the older toolchain, which OSP excludes. */
export const EXCLUDED_DIRECTORIES = ["mts/", "sound/"] as const;

/**
 * Sources compiled with a small-data threshold of 8 bytes. Every other source
 * uses 0. Upstream matches these as substrings of the source path, so the
 * leading slash is what keeps `/menu/debug.c` from matching `/libgv/debug.c`.
 */
export const GLOBAL_SIZE_PATHS: readonly string[] = [
  "/chara/snake/afterse.c",
  "/chara/snake/shadow.c",
  "/chara/snake/sna_init.c",
  "/chara/snake/snake.c",
  "/chara/snake_vr/sna_init.c",
  "/font/font.c",
  "/game/alert.c",
  "/game/area.c",
  "/game/camera.c",
  "/game/chara.c",
  "/game/control.c",
  "/game/delay.c",
  "/game/gamed.c",
  "/game/homing.c",
  "/game/loader.c",
  "/game/map.c",
  "/game/motion.c",
  "/game/object.c",
  "/game/over.c",
  "/game/script.c",
  "/game/g_sound.c",
  "/game/target.c",
  "/kojo/m1e1catr.c",
  "/libdg/bound.c",
  "/libdg/chanl.c",
  "/libdg/divide.c",
  "/libdg/frame.c",
  "/libdg/light.c",
  "/libdg/loader.c",
  "/libdg/matrix.c",
  "/libdg/obj.c",
  "/libdg/opack.c",
  "/libdg/palette.c",
  "/libdg/pos.c",
  "/libdg/prim.c",
  "/libdg/pshade.c",
  "/libdg/screen.c",
  "/libdg/shade.c",
  "/libdg/sort.c",
  "/libdg/text.c",
  "/libdg/trans.c",
  "/libgcl/basic.c",
  "/libgcl/command.c",
  "/libgcl/expr.c",
  "/libgcl/gcl_init.c",
  "/libgcl/parse.c",
  "/libgcl/variable.c",
  "/libgv/actor.c",
  "/libgv/cache.c",
  "/libgv/debug.c",
  "/libgv/gvd.c",
  "/libgv/near.c",
  "/libgv/memory.c",
  "/libgv/message.c",
  "/libgv/pad.c",
  "/libgv/resident.c",
  "/libgv/strcode.c",
  "/libgv/util.c",
  "/libhzd/bind.c",
  "/libhzd/dynamic.c",
  "/libhzd/hzdd.c",
  "/libhzd/level.c",
  "/libhzd/nagivate.c",
  "/libhzd/near.c",
  "/libhzd/online.c",
  "/libhzd/route.c",
  "/libhzd/surface.c",
  "/libhzd/trap.c",
  "/libsio/dummy.c",
  "/main/main.c",
  "/menu/datasave.c",
  "/menu/debug.c",
  "/menu/item.c",
  "/menu/jimaku.c",
  "/menu/life.c",
  "/menu/menuman.c",
  "/menu/radar.c",
  "/menu/radio.c",
  "/menu/radioanim.c",
  "/menu/radiofacedraw.c",
  "/menu/radiomem.c",
  "/menu/radiomes.c",
  "/menu/radiotable.c",
  "/menu/radiotex.c",
  "/menu/weapon.c",
  "/weapon/aam.c",
  "/weapon/bomb.c",
  "/weapon/famas.c",
  "/weapon/grenade.c",
  "/weapon/mine.c",
  "/weapon/rcm.c",
  "/weapon/rfsight.c",
  "/weapon/rifle.c",
  "/weapon/socom.c",
  "/weapon/stnsight.c",
];

/** The small-data threshold upstream compiles and assembles this source with. */
export function gpSizeFor(sourcePath: string): 0 | 8 {
  return GLOBAL_SIZE_PATHS.some((entry) => sourcePath.includes(entry)) ? 8 : 0;
}

/** Whether this source builds with a toolchain OSP does not import. */
export function isExcludedSource(sourcePath: string): boolean {
  return EXCLUDED_DIRECTORIES.some((entry) => sourcePath.includes(entry));
}

/**
 * The overlay a source belongs to. Sources under `source/overlays/<name>/`
 * are linked into that overlay; everything else is in the main executable.
 */
export function overlayFor(sourcePath: string): string {
  return /^source\/overlays\/([^/]+)\//.exec(sourcePath)?.[1] ?? "main";
}
