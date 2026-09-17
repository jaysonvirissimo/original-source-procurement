import { MissionSchema } from "@osp/mission-schema";
import { curriculumCoverage } from "./coverage.ts";
import { validateCurriculum, type CurriculumData } from "./validate.ts";

export interface ValidationOutput {
  log(line: string): void;
  error(line: string): void;
}

/**
 * Validates curriculum data, prints the outcome, and returns an exit code.
 * Coverage warnings for a valid curriculum are printed but never fail it.
 */
export async function runValidation(
  data: CurriculumData,
  output: ValidationOutput,
): Promise<number> {
  const issues = await validateCurriculum(data);

  if (issues.length === 0) {
    output.log(
      `Curriculum is valid: ${String(data.skills.length)} skills, ${String(data.missions.length)} missions, ${String(data.defaultPath.length)} on the default path.`,
    );
    const warnings = curriculumCoverage(
      data.missions.map((mission) => MissionSchema.parse(mission)),
      data.defaultPath,
    );
    for (const warning of warnings) {
      output.log(
        `warning: ${warning.path}: ${warning.message} [${warning.code}]`,
      );
    }
    if (warnings.length > 0) {
      const noun = warnings.length === 1 ? "warning" : "warnings";
      output.log(
        `Coverage: ${String(warnings.length)} ${noun}, not yet blocking.`,
      );
    }
    return 0;
  }

  for (const issue of issues) {
    output.error(`${issue.path}: ${issue.message} [${issue.code}]`);
  }
  const noun = issues.length === 1 ? "issue" : "issues";
  output.error(
    `Curriculum validation failed with ${String(issues.length)} ${noun}.`,
  );
  return 1;
}
