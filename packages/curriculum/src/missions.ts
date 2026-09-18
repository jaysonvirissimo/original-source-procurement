import type { InlineTarget, Mission } from "@osp/mission-schema";
import type { MissionDraft } from "./missions/authoring.ts";
import { missionDrafts } from "./missions/drafts.ts";
import { target as target001 } from "./missions/targets/001.ts";
import { target as target002 } from "./missions/targets/002.ts";
import { target as target003 } from "./missions/targets/003.ts";
import { target as target004 } from "./missions/targets/004.ts";
import { target as target005 } from "./missions/targets/005.ts";
import { target as target006 } from "./missions/targets/006.ts";
import { target as target007 } from "./missions/targets/007.ts";
import { target as target008 } from "./missions/targets/008.ts";
import { target as target009 } from "./missions/targets/009.ts";
import { target as target010 } from "./missions/targets/010.ts";
import { target as target011 } from "./missions/targets/011.ts";
import { target as target011A } from "./missions/targets/011A.ts";
import { target as target011B } from "./missions/targets/011B.ts";
import { target as target012 } from "./missions/targets/012.ts";
import { target as target012A } from "./missions/targets/012A.ts";
import { target as target012B } from "./missions/targets/012B.ts";
import { target as target012C } from "./missions/targets/012C.ts";
import { target as target012D } from "./missions/targets/012D.ts";
import { target as target013 } from "./missions/targets/013.ts";
import { target as target014 } from "./missions/targets/014.ts";
import { target as target015 } from "./missions/targets/015.ts";
import { target as target016 } from "./missions/targets/016.ts";
import { target as target017 } from "./missions/targets/017.ts";
import { target as target018 } from "./missions/targets/018.ts";
import { target as target019 } from "./missions/targets/019.ts";
import { target as target020 } from "./missions/targets/020.ts";
import { target as target021 } from "./missions/targets/021.ts";
import { target as target022 } from "./missions/targets/022.ts";
import { target as target023 } from "./missions/targets/023.ts";
import { target as target024 } from "./missions/targets/024.ts";
import { target as target025 } from "./missions/targets/025.ts";
import { target as target026 } from "./missions/targets/026.ts";
import { target as target027 } from "./missions/targets/027.ts";
import { target as target028 } from "./missions/targets/028.ts";
import { target as target029 } from "./missions/targets/029.ts";
import { target as target030 } from "./missions/targets/030.ts";
import { target as target031 } from "./missions/targets/031.ts";
import { target as target032 } from "./missions/targets/032.ts";
import { target as target033 } from "./missions/targets/033.ts";
import { target as target034 } from "./missions/targets/034.ts";
import { target as target035 } from "./missions/targets/035.ts";
import { target as target036 } from "./missions/targets/036.ts";
import { target as target037 } from "./missions/targets/037.ts";
import { target as target038 } from "./missions/targets/038.ts";
import { target as target039 } from "./missions/targets/039.ts";
import { target as target040 } from "./missions/targets/040.ts";
import { target as target041 } from "./missions/targets/041.ts";
import { target as target042 } from "./missions/targets/042.ts";
import { target as target043 } from "./missions/targets/043.ts";
import { target as target044 } from "./missions/targets/044.ts";
import { target as target045 } from "./missions/targets/045.ts";
import { target as target046 } from "./missions/targets/046.ts";
import { target as target047 } from "./missions/targets/047.ts";
import { target as target048 } from "./missions/targets/048.ts";

/** Targets generated from each synthetic mission's solution, by mission ID. */
const generatedTargets: Readonly<Record<string, InlineTarget>> = {
  "001": target001,
  "002": target002,
  "003": target003,
  "004": target004,
  "005": target005,
  "006": target006,
  "007": target007,
  "008": target008,
  "009": target009,
  "010": target010,
  "011": target011,
  "011A": target011A,
  "011B": target011B,
  "012": target012,
  "012A": target012A,
  "012B": target012B,
  "012C": target012C,
  "012D": target012D,
  "013": target013,
  "014": target014,
  "015": target015,
  "016": target016,
  "017": target017,
  "018": target018,
  "019": target019,
  "020": target020,
  "021": target021,
  "022": target022,
  "023": target023,
  "024": target024,
  "025": target025,
  "026": target026,
  "027": target027,
  "028": target028,
  "029": target029,
  "030": target030,
  "031": target031,
  "032": target032,
  "033": target033,
  "034": target034,
  "035": target035,
  "036": target036,
  "037": target037,
  "038": target038,
  "039": target039,
  "040": target040,
  "041": target041,
  "042": target042,
  "043": target043,
  "044": target044,
  "045": target045,
  "046": target046,
  "047": target047,
  "048": target048,
};

export function withTarget(
  draft: MissionDraft,
  targets: Readonly<Record<string, InlineTarget>>,
): Mission {
  const target = targets[draft.id];
  if (target === undefined) {
    throw new Error(
      `Mission ${draft.id} has no generated target. Run pnpm curriculum:targets.`,
    );
  }
  return { ...draft, target };
}

/** Mission definitions, each with the target generated from its solution. */
export const missions: readonly Mission[] = missionDrafts.map((draft) =>
  withTarget(draft, generatedTargets),
);

/**
 * The recommended mission order. Prerequisites remain the source of truth:
 * validation requires every mission on this path to be completable with
 * skills taught earlier on it.
 */
export const defaultPath: readonly string[] = [
  "001",
  "002",
  "003",
  "004",
  "005",
  "006",
  "007",
  "008",
  "009",
  "010",
  "011",
  "011A",
  "011B",
  "012",
  "012A",
  "012B",
  "012C",
  "012D",
  "013",
  "014",
  "015",
  "016",
  "017",
  "018",
  "019",
  "020",
  "021",
  "022",
  "023",
  "024",
  "025",
  "026",
  "027",
  "028",
  "029",
  "030",
  "031",
  "032",
  "033",
  "034",
  "035",
  "036",
  "037",
  "038",
  "039",
  "040",
  "041",
  "042",
  "043",
  "044",
  "045",
  "046",
  "047",
  "048",
  "F04",
  "F05",
  "F06",
  "F01",
  "F02",
  "F03",
];
