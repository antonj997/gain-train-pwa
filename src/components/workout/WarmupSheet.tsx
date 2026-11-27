import { useState } from "react";
import Sheet from "@/components/ui/Sheet";
import Segmented from "@/components/ui/Segmented";
import Reveal from "@/components/motion/Reveal";
import { useT } from "@/i18n/useT";
import { formatDecimal } from "@/i18n";
import { local, storageKeys, writeStored } from "@/lib/storage";
import {
  BARS,
  DEFAULT_BAR,
  PLATES,
  platesText,
  warmupLadder,
  type WarmupRow,
} from "@/lib/warmup";

/** The bar on this device (gt-bar-kg): 20, 15 or 10 kg. */
const readBar = (): number => {
  const value = Number(local.getItem(storageKeys.barKg));
  return (BARS as readonly number[]).includes(value) ? value : DEFAULT_BAR;
};
/** The plates at hand on this device (gt-plates: "25,20,…"); all by default. */
const readPlates = (): number[] => {
  const stored = local.getItem(storageKeys.plates);
  if (!stored) return [...PLATES];
  const chosen = stored
    .split(",")
    .map(Number)
    .filter((p) => (PLATES as readonly number[]).includes(p));
  return chosen.length ? chosen : [...PLATES];
};

/**
 * The warm-up ladder (v6 B6), from the Set sheet's "Lägg till uppvärmning":
 * the empty bar, 40, 60 and 80 % of the first working set, rounded to the
 * exercise's step, with the plates per side. The bar and the plates at hand
 * are kept on the device. Other equipment shows three rows and no plates.
 */
export default function WarmupSheet({
  open,
  onClose,
  name,
  workKg,
  workReps,
  step,
  barbell,
  onAdd,
}: {
  open: boolean;
  onClose: () => void;
  name: string;
  /** The first working set's weight and reps. */
  workKg: number;
  workReps: number | null;
  /** The exercise's weight step in kg. */
  step: number;
  barbell: boolean;
  onAdd: (rows: WarmupRow[]) => void;
}) {
  const { t } = useT();
  const [bar, setBar] = useState(readBar);
  const [plates, setPlates] = useState(readPlates);
  const [editPlates, setEditPlates] = useState(false);
  const rows = warmupLadder(workKg, step, bar, barbell, plates);
  const kg = (value: number) => formatDecimal(value);
  const chooseBar = (value: string) => {
    const next = Number(value);
    setBar(next);
    writeStored(storageKeys.barKg, next === DEFAULT_BAR ? null : String(next));
  };
  const togglePlate = (plate: number) => {
    const next = plates.includes(plate)
      ? plates.filter((p) => p !== plate)
      : [...plates, plate].sort((a, b) => b - a);
    // At least one plate stays.
    if (!next.length) return;
    setPlates(next);
    writeStored(
      storageKeys.plates,
      next.length === PLATES.length ? null : next.join(","),
    );
  };
  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={t("warmup.title", { name })}
      description={t("warmup.sub", {
        kg: kg(workKg),
        reps: workReps ?? "–",
      })}
    >
      {barbell && (
        <div className="sheet-field">
          <span className="sheet-label" aria-hidden="true">
            {t("warmup.bar")}
          </span>
          <Segmented<string>
            label={t("warmup.bar")}
            value={String(bar)}
            options={BARS.map((b) => ({
              value: String(b),
              label: `${b} kg`,
            }))}
            onChange={chooseBar}
          />
        </div>
      )}
      <ul className="list warmup-list">
        {rows.map((row, i) => (
          <li key={i} className="row warmup-row">
            <span className="set-badge-chip warmup-badge" aria-hidden="true">
              {t("badge.warmupText")}
            </span>
            <span className="row-main">
              <span className="row-title">
                {t("warmup.row", { kg: kg(row.kg), reps: row.reps })}
              </span>
              {row.plates && (
                <span className="row-sub">
                  {row.emptyBar
                    ? t("warmup.emptyBar")
                    : row.plates.length
                      ? t("warmup.perSide", {
                          plates: platesText(row.plates, kg),
                        })
                      : t("warmup.noPlates")}
                </span>
              )}
            </span>
          </li>
        ))}
      </ul>
      {barbell && (
        <>
          <p className="sheet-hint">
            {t("warmup.note", { plates: plates.map(kg).join(", ") })}{" "}
            <button
              type="button"
              className="text-link"
              aria-expanded={editPlates}
              onClick={() => setEditPlates((v) => !v)}
            >
              {t("warmup.changePlates")}
            </button>
          </p>
          <Reveal>
            {editPlates && (
              <div
                className="filters warmup-plates"
                role="group"
                aria-label={t("warmup.plates")}
              >
                {PLATES.map((plate) => (
                  <button
                    key={plate}
                    type="button"
                    className="filter-chip"
                    aria-pressed={plates.includes(plate)}
                    onClick={() => togglePlate(plate)}
                  >
                    {kg(plate)}
                  </button>
                ))}
              </div>
            )}
          </Reveal>
        </>
      )}
      {!barbell && <p className="sheet-hint">{t("warmup.noteOther")}</p>}
      <button
        type="button"
        className="btn-primary btn-block"
        disabled={!rows.length}
        onClick={() => {
          onAdd(rows);
          onClose();
        }}
      >
        {t("warmup.add", { count: rows.length })}
      </button>
    </Sheet>
  );
}
