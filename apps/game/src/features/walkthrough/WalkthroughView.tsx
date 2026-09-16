import type { WordFacts } from "@osp/matching-core";
import type { MissionWalkthrough, WalkthroughStep } from "@osp/mission-schema";
import type { ReactElement } from "react";
import { classNames } from "../../styles/classNames";
import controls from "../../styles/controls.module.css";
import table from "../diff/DiffPanel.module.css";
import { wordsLabel } from "../diff/diffLabels";
import { hex } from "../scan/format";
import { bitGroups } from "./bits";
import { operandReading } from "./operands";
import styles from "./Walkthrough.module.css";

/** A heading for each kind of walkthrough. */
const WALKTHROUGH_TITLES: Readonly<Record<MissionWalkthrough["kind"], string>> =
  {
    trace: "Step by step",
    timeline: "Timeline",
    bits: "Bits",
    caller: "From the caller",
    operands: "Reading the operands",
  };

interface WalkthroughViewProps {
  readonly walkthrough: MissionWalkthrough;
  /** Target instructions as the listing shows them. */
  readonly listing: readonly string[];
  /** Facts about the target words, once the target is known. */
  readonly facts: readonly WordFacts[] | undefined;
}

/** One static walkthrough as a captioned table. Nothing executes. */
export function WalkthroughView({
  walkthrough,
  listing,
  facts,
}: WalkthroughViewProps): ReactElement {
  const title = WALKTHROUGH_TITLES[walkthrough.kind];
  return (
    <div className={styles.walkthrough}>
      <h3 className={controls.label}>{title}</h3>
      <p className={styles.caption}>{walkthrough.caption}</p>
      {renderBody(walkthrough, title, listing, facts)}
    </div>
  );
}

function renderBody(
  walkthrough: MissionWalkthrough,
  title: string,
  listing: readonly string[],
  facts: readonly WordFacts[] | undefined,
): ReactElement {
  switch (walkthrough.kind) {
    case "trace":
      return (
        <StepTable label={title} steps={walkthrough.steps} listing={listing} />
      );
    case "timeline":
      return (
        <>
          {walkthrough.lanes.map((lane) => (
            <StepTable
              key={lane.label}
              label={`${title}: ${lane.label}`}
              caption={lane.label}
              steps={lane.steps}
              listing={listing}
            />
          ))}
        </>
      );
    case "bits":
      return (
        <div className={table.tableWrap}>
          <table className={table.table} aria-label={title}>
            <thead>
              <tr>
                <th scope="col">Value</th>
                <th scope="col">Width</th>
                <th scope="col">Bits</th>
                <th scope="col">Hex</th>
              </tr>
            </thead>
            <tbody>
              {walkthrough.rows.map((row) => (
                <tr key={row.label}>
                  <td>{row.label}</td>
                  <td>{row.width}</td>
                  <td>
                    <code>{bitGroups(row.value, row.width)}</code>
                  </td>
                  <td>
                    <code>{hex(row.value)}</code>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
    case "caller":
      return (
        <>
          <pre className={styles.code}>
            <code>{walkthrough.code}</code>
          </pre>
          <div className={table.tableWrap}>
            <table
              className={classNames(table.table, styles.wrap)}
              aria-label={title}
            >
              <thead>
                <tr>
                  <th scope="col">Name</th>
                  <th scope="col">Before</th>
                  <th scope="col">After</th>
                  <th scope="col">Note</th>
                </tr>
              </thead>
              <tbody>
                {walkthrough.rows.map((row) => (
                  <tr key={row.name}>
                    <td>
                      <code>{row.name}</code>
                    </td>
                    <td>{exampleValue(row.before)}</td>
                    <td>{exampleValue(row.after)}</td>
                    <td>{row.note ?? ""}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      );
    case "operands": {
      const reading = operandReading(facts?.[walkthrough.word]);
      if (reading === undefined) {
        return <p className={styles.caption}>The target is not loaded.</p>;
      }
      return (
        <>
          <p>
            <code>{listing[walkthrough.word]}</code>: {reading.summary}
          </p>
          <div className={table.tableWrap}>
            <table
              className={classNames(table.table, styles.wrap)}
              aria-label={title}
            >
              <thead>
                <tr>
                  <th scope="col">Part</th>
                  <th scope="col">Operand</th>
                  <th scope="col">Meaning</th>
                </tr>
              </thead>
              <tbody>
                {reading.parts.map((part) => (
                  <tr key={part.role}>
                    <td>{part.role}</td>
                    <td>
                      <code>{part.value}</code>
                    </td>
                    <td>{part.meaning}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      );
    }
  }
}

/** An example value, or a dash when it is not set or does not matter. */
function exampleValue(value: number | undefined): ReactElement | string {
  if (value === undefined) {
    return "—";
  }
  return value >= 0x1000 ? <code>{hex(value)}</code> : <code>{value}</code>;
}

interface StepTableProps {
  readonly label: string;
  readonly caption?: string;
  readonly steps: readonly WalkthroughStep[];
  readonly listing: readonly string[];
}

function StepTable({
  label,
  caption,
  steps,
  listing,
}: StepTableProps): ReactElement {
  return (
    <div className={table.tableWrap}>
      <table
        className={classNames(table.table, styles.wrap)}
        aria-label={label}
      >
        {caption === undefined ? null : (
          <caption className={styles.caption}>{caption}</caption>
        )}
        <thead>
          <tr>
            <th scope="col">Step</th>
            <th scope="col">Words</th>
            <th scope="col">What happens</th>
          </tr>
        </thead>
        <tbody>
          {steps.map((step, index) => (
            <tr key={index}>
              <td>{index + 1}</td>
              <td>
                {step.range === undefined ? (
                  "—"
                ) : (
                  <>
                    {wordsLabel(step.range)}:{" "}
                    <code>
                      {listing
                        .slice(step.range.start, step.range.end)
                        .join("; ")}
                    </code>
                  </>
                )}
              </td>
              <td>{step.text}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
