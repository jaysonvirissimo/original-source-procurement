import { validateCurriculum, type CurriculumData } from "./validate.ts";

export interface ValidationOutput {
  log(line: string): void;
  error(line: string): void;
}

/**
 * Validates curriculum data, prints the outcome, and returns an exit code.
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
