import { describe, expect, it } from "vitest";
import { isDefaultBuildSource, variantOnlySources } from "./linkerCommands.ts";

const TEMPLATE = String.raw`
    include "{{OBJ_DIR}}\chara\snake\snake.obj"
{% if not VR_EXE %}
    include "{{OBJ_DIR}}\chara\snake\sna_init.obj"
{% else %}
    include "{{OBJ_DIR}}\chara\snake_vr\sna_init.obj"
{% endif %}
{% if not VR_EXE %}
    include "{{OBJ_DIR}}\equip\jpegcam.obj"
{% endif %}
    include "{{PSYQ_SDK}}\psyq_4.4\lib\libc2\EXIT.OBJ", overlay
    include "{{OBJ_DIR}}\libhzd\navigate.obj
`;

describe("variantOnlySources", () => {
  it("names the source only the VR disc links", () => {
    expect([...variantOnlySources(TEMPLATE)]).toEqual([
      "source/chara/snake_vr/sna_init.c",
    ]);
  });

  it("keeps a source the default branch links", () => {
    const variantOnly = variantOnlySources(TEMPLATE);
    expect(variantOnly.has("source/chara/snake/sna_init.c")).toBe(false);
    expect(variantOnly.has("source/equip/jpegcam.c")).toBe(false);
  });

  it("ignores objects from the PsyQ SDK libraries", () => {
    expect([...variantOnlySources(TEMPLATE)]).not.toContain(
      "source/psyq_4.4/lib/libc2/EXIT.OBJ.c",
    );
  });

  it("reads an entry whose closing quote upstream left off", () => {
    expect(
      variantOnlySources(
        String.raw`{% if not VR_EXE %}
{% else %}
    include "{{OBJ_DIR}}\libhzd\navigate.obj
{% endif %}`,
      ),
    ).toEqual(new Set(["source/libhzd/navigate.c"]));
  });

  it("keeps both branches of a guard it does not recognise", () => {
    expect(
      variantOnlySources(
        String.raw`{% if DEV_EXE %}
    include "{{OBJ_DIR}}\a.obj"
{% else %}
    include "{{OBJ_DIR}}\b.obj"
{% endif %}`,
      ).size,
    ).toBe(0);
  });

  it("reads a template with no guards at all", () => {
    expect(
      variantOnlySources(String.raw`    include "{{OBJ_DIR}}\a.obj"`).size,
    ).toBe(0);
  });

  it("reads a stray else or endif without losing the entries around it", () => {
    expect(
      variantOnlySources(
        String.raw`{% else %}
{% endif %}
    include "{{OBJ_DIR}}\a.obj"`,
      ).size,
    ).toBe(0);
  });
});

describe("isDefaultBuildSource", () => {
  const variantOnly = new Set(["source/chara/snake_vr/sna_init.c"]);

  it("rejects a VR-only source", () => {
    expect(
      isDefaultBuildSource("source/chara/snake_vr/sna_init.c", variantOnly),
    ).toBe(false);
  });

  it("accepts a source the template never mentions", () => {
    expect(isDefaultBuildSource("source/libgv/util.c", variantOnly)).toBe(true);
  });

  it("accepts every overlay source, which links from its own file", () => {
    expect(
      isDefaultBuildSource("source/overlays/brf/b_select.c", variantOnly),
    ).toBe(true);
  });
});
