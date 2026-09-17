import { describe, expect, it } from "vitest";
import { includedNames, includeOrder } from "./includeOrder";

// OSP-authored header text.
const headers = {
  "psyq/include/sys/types.h": "typedef unsigned int u_int;\n",
  "psyq/include/shapes.h":
    "#include <sys/types.h>\ntypedef struct { short w; } Box;\n",
  "local.h": '#include "game/unit.h"\n#include <shapes.h>\n',
  "source/game/unit.h": "#include <shapes.h>\nint unit;\n",
  "source/unused.h": "int unused;\n",
  "extra.h": "int extra;\n",
};
const cppFlags = ["-D_PSYQ", "-Ipsyq/include", "-Isource"];

describe("includedNames", () => {
  it("reads quoted and angled includes, with spacing, in order", () => {
    expect(
      includedNames(
        '#include "a.h"\n  #  include <b/c.h>\n// #include "no.h"\n',
      ),
    ).toEqual(["a.h", "b/c.h"]);
  });
});

describe("includeOrder", () => {
  it("walks includes depth first through the search path, then lists the rest", () => {
    expect(
      includeOrder('#include "local.h"\n\nint f(void);\n', headers, cppFlags),
    ).toEqual([
      "local.h",
      "source/game/unit.h",
      "psyq/include/shapes.h",
      "psyq/include/sys/types.h",
      "extra.h",
      "source/unused.h",
    ]);
  });

  it("sorts every header when the starter includes none it can resolve", () => {
    expect(
      includeOrder('#include "missing.h"\n', { "b.h": "", "a.h": "" }, []),
    ).toEqual(["a.h", "b.h"]);
  });
});
