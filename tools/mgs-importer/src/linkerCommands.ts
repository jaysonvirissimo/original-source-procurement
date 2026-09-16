/**
 * Which sources belong only to the VR disc.
 *
 * Upstream compiles every source under `source/` whatever it is building, and
 * the linker command file decides which objects reach an executable. Two of
 * its entries are guarded by the VR variant: it links
 * `chara/snake_vr/sna_init.obj` where the default build links
 * `chara/snake/sna_init.obj`. A VR-only source defines the same symbols as
 * its default counterpart, so importing it would leave a pointer ambiguous.
 *
 * Only that exclusion is read from the template. Sources it never mentions
 * are linked elsewhere — every stage and overlay has its own command file —
 * and are kept: a source that does not belong to the default build fails the
 * reproduction sweep on its own.
 *
 * The file is read for object paths alone, never for content.
 */

// Upstream's file has one entry with no closing quote, so it is optional.
const OBJECT = /^\s*include\s+"\{\{OBJ_DIR\}\}\\([^"\n]+?)\.obj"?/;
const IF_NOT_VR = /^\s*\{%\s*if\s+not\s+VR_EXE\s*%\}/;
const IF_OTHER = /^\s*\{%\s*if\b/;
const ELSE = /^\s*\{%\s*else\s*%\}/;
const ENDIF = /^\s*\{%\s*endif\s*%\}/;

interface Guard {
  /** Only a `not VR_EXE` guard puts its else branch in the VR variant. */
  readonly variant: boolean;
  inElse: boolean;
}

/** The sources the template links only when it is building the VR disc. */
export function variantOnlySources(template: string): Set<string> {
  const variant = new Set<string>();
  const shared = new Set<string>();
  const guards: Guard[] = [];

  for (const line of template.split("\n")) {
    if (IF_NOT_VR.test(line)) {
      guards.push({ variant: true, inElse: false });
      continue;
    }
    if (IF_OTHER.test(line)) {
      guards.push({ variant: false, inElse: false });
      continue;
    }
    if (ELSE.test(line)) {
      const guard = guards.at(-1);
      if (guard !== undefined) guard.inElse = true;
      continue;
    }
    if (ENDIF.test(line)) {
      guards.pop();
      continue;
    }

    const object = OBJECT.exec(line)?.[1];
    if (object === undefined) continue;
    const path = `source/${object.replaceAll("\\", "/")}.c`;
    const inVariant = guards.some((guard) => guard.variant && guard.inElse);
    (inVariant ? variant : shared).add(path);
  }

  for (const path of shared) variant.delete(path);
  return variant;
}

/** Whether the default game build can link this source. */
export function isDefaultBuildSource(
  sourcePath: string,
  variantOnly: ReadonlySet<string>,
): boolean {
  return !variantOnly.has(sourcePath);
}

/** Where upstream's main-executable linker command template lives. */
export const LINKER_COMMAND_PATH = "build/linker_command_file.txt";
