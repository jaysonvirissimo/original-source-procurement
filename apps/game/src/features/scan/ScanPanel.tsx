import { usesStack, type WordFacts } from "@osp/matching-core";
import type { MissionExample, MissionWalkthrough } from "@osp/mission-schema";
import { useId, useState, type ReactElement } from "react";
import controls from "../../styles/controls.module.css";
import type { WordAnnotation } from "../diff/annotations";
import { wordsLabel } from "../diff/diffLabels";
import { WalkthroughView } from "../walkthrough/WalkthroughView";
import styles from "../workspace/OverlayPanel.module.css";
import { MemoryLayer } from "./MemoryLayer";
import { RegisterLayer } from "./RegisterLayer";
import scan from "./Scan.module.css";

const LAYERS = [
  "Notes",
  "Walkthrough",
  "Registers",
  "Memory",
  "Stack",
] as const;
type Layer = (typeof LAYERS)[number];

interface ScanPanelProps {
  /** Every note on the target, whatever the current help level shows. */
  readonly annotations: readonly WordAnnotation[];
  /** Facts about the target words, once the target is known. */
  readonly facts: readonly WordFacts[] | undefined;
  readonly example: MissionExample | undefined;
  readonly walkthroughs: readonly MissionWalkthrough[];
  /** Target instructions as the listing shows them. */
  readonly listing: readonly string[];
  readonly onClose: () => void;
}

/** Teaching layers on request, one at a time, at every help level. */
export function ScanPanel({
  annotations,
  facts,
  example,
  walkthroughs,
  listing,
  onClose,
}: ScanPanelProps): ReactElement {
  const titleId = useId();
  const [layer, setLayer] = useState<Layer>("Notes");

  const renderLayer = (): ReactElement => {
    if (layer === "Notes") {
      return annotations.length === 0 ? (
        <p className={styles.dim}>This target has no notes to scan.</p>
      ) : (
        <ul className={styles.list} aria-label="Notes">
          {annotations.map((annotation, index) => (
            <li className={styles.item} key={index}>
              <p className={controls.label}>
                {wordsLabel(annotation.range)} · {annotation.label}
              </p>
              <p>{annotation.text}</p>
            </li>
          ))}
        </ul>
      );
    }
    if (layer === "Walkthrough") {
      return walkthroughs.length === 0 ? (
        <p className={styles.dim}>This mission has no walkthrough.</p>
      ) : (
        <>
          {walkthroughs.map((walkthrough, index) => (
            <WalkthroughView
              key={index}
              walkthrough={walkthrough}
              listing={listing}
              facts={facts}
            />
          ))}
        </>
      );
    }
    if (facts === undefined) {
      return <p className={styles.dim}>The target is not loaded.</p>;
    }
    if (layer === "Registers") {
      return <RegisterLayer example={example} facts={facts} />;
    }
    if (layer === "Memory") {
      return example === undefined ? (
        <p className={styles.dim}>This mission has no example memory.</p>
      ) : (
        <MemoryLayer example={example} facts={facts} />
      );
    }
    return (
      <p>
        {usesStack(facts)
          ? "A stack frame is memory a function reserves for itself by moving the stack pointer, $sp. This function changes $sp, so it has one. Stack frames are taught in later missions."
          : "A stack frame is memory a function reserves for itself by moving the stack pointer, $sp. This function never changes $sp, so it has none. Stack frames are taught in later missions."}
      </p>
    );
  };

  return (
    <section className={styles.overlay} aria-labelledby={titleId}>
      <header className={styles.header}>
        <h2 className={controls.label} id={titleId}>
          Scan
        </h2>
        <button className={controls.button} type="button" onClick={onClose}>
          Close
        </button>
      </header>
      <fieldset className={scan.layers}>
        <legend className={controls.visuallyHidden}>Layer</legend>
        {LAYERS.map((name) => (
          <label key={name}>
            <input
              type="radio"
              name={titleId}
              checked={layer === name}
              onChange={() => {
                setLayer(name);
              }}
            />{" "}
            {name}
          </label>
        ))}
      </fieldset>
      {renderLayer()}
    </section>
  );
}
