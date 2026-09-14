import {
  UPSTREAM_DEFAULT_BUILD,
  type FeasibilityPointer,
  type RemoteCReference,
} from "@osp/mission-schema";

/*
 * Pointers to solved upstream functions that are checked, from local
 * checkouts, to compile from their recorded context and match their target.
 * They hold commits, paths, and hashes only. No upstream content is
 * committed: every file is read at run time.
 */

const UPSTREAM_COMMIT = "d8145676642e629623f5eaf036ed8e8b1c5e17af";
const SDK_COMMIT = "91719fa5bdca0b7e55c5c4b9e045da407db93510";

function upstream(path: string, sha256: string): RemoteCReference {
  return {
    repository: "FoxdieTeam/mgs_reversing",
    commit: UPSTREAM_COMMIT,
    path,
    sha256,
  };
}

function sdk(name: string, sha256: string): RemoteCReference {
  return {
    repository: "FoxdieTeam/psyq_sdk",
    commit: SDK_COMMIT,
    path: `psyq_4.4/include/${name}`,
    sha256,
  };
}

export const feasibilityPointers: readonly FeasibilityPointer[] = [
  {
    schemaVersion: 1,
    symbol: "GV_VecDir2",
    source: {
      kind: "mgs-reversing",
      repository: "FoxdieTeam/mgs_reversing",
      build: "default",
      overlay: "main",
      symbol: "GV_VecDir2",
      address: 0x80016ef8,
      sourcePath: "source/libgv/util.c",
    },
    // The parent of the commit that matched the function.
    target: {
      kind: "remote",
      commit: "a2a563417ea619ab7cdd2e33f4b2ab85e4672a21",
      path: "asm/libgv/GV_VecDir2_80016EF8.s",
      wordCount: 11,
      wordsSha256:
        "361c906e189bd3717e79cb7628c86d51d1208c8cec9ec880adf07cdef6dfbef9",
    },
    solution: upstream(
      "source/libgv/util.c",
      "7af8262c7d41449e2fbf61048035b2a098797b7512d6cbbd3e961fc3b19dc854",
    ),
    compiler: {
      // source/libgv/util.c is on upstream's global-size list.
      gpSize: 8,
      aspsxVersion: UPSTREAM_DEFAULT_BUILD.aspsxVersion,
      rawFlags: [...UPSTREAM_DEFAULT_BUILD.rawFlags],
      cppFlags: [...UPSTREAM_DEFAULT_BUILD.cppFlags],
      encoding: UPSTREAM_DEFAULT_BUILD.encoding,
      filename: "util.c",
      headers: {},
      remoteHeaders: {
        "libgv.h": upstream(
          "source/libgv/libgv.h",
          "5f2e7dae989094f386bb0c083f78220e680e3a18135a2e6f3ea9609b27d41d89",
        ),
        "source/include/common.h": upstream(
          "source/include/common.h",
          "c61d096de738a318b04e416531fed4f3739659d51253b8a80df1bb2b3cd50a11",
        ),
        "source/include/psxdefs.h": upstream(
          "source/include/psxdefs.h",
          "fe3ca48a455788a687f63ae54c7f4d6ef59cedcaf551359b80fa64d94765d9ef",
        ),
        "psyq/include/abs.h": sdk(
          "abs.h",
          "7aa807921a32a11ba3aab586379bf51d455caec3e32cce1bec3f970697da4e4b",
        ),
        "psyq/include/convert.h": sdk(
          "convert.h",
          "988f2865f319a8a7d90433dae3755cfb9cbd647ed887cad97d7e204cf47ef907",
        ),
        "psyq/include/libetc.h": sdk(
          "libetc.h",
          "aa7c00aa9436562f9226461fdde85e38942d8326388ec0f6e9919eee8fd1e0af",
        ),
        "psyq/include/libgpu.h": sdk(
          "libgpu.h",
          "570c094691dbddcce8aab8e50e0e87552464cb43ab07c5f2a33a8dd4899b822c",
        ),
        "psyq/include/libgte.h": sdk(
          "libgte.h",
          "73f3f0935d0191f3fbb94541de19e7e5b4532f3e492c6261e97295fd60ef1e38",
        ),
        "psyq/include/malloc.h": sdk(
          "malloc.h",
          "cc155bd6c982890028a73695a3d6aa090163995ab0631061e394c6723660a49f",
        ),
        "psyq/include/qsort.h": sdk(
          "qsort.h",
          "87905a8b1004b19cc330d125e4649d684c33ec2e702e1038622fadfa67ddca98",
        ),
        "psyq/include/rand.h": sdk(
          "rand.h",
          "db2629d50e0937028fbc9c895716aa696fc5da5f06d4d904224734431272609f",
        ),
        "psyq/include/stddef.h": sdk(
          "stddef.h",
          "5e038138414f79b9e57a6d754081cd2d37d81132fa7380dc8f67e045e9c5d7a5",
        ),
        "psyq/include/stdlib.h": sdk(
          "stdlib.h",
          "b49a68255ff5eb434bd30300f1cca7c671bcd30147b36bc4583824e04d757637",
        ),
        "psyq/include/sys/types.h": sdk(
          "sys/types.h",
          "815a444d268dfeed62804d44e30b23130ab378f4f29a6fff04e1d9eddebf19b7",
        ),
      },
    },
  },
];
