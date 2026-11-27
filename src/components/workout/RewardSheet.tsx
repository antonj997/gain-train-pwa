import { useLayoutEffect, useRef } from "react";
import { CalendarDays, Flag, Trophy } from "lucide-react";
import { MOTION, SPRING, playSpring } from "@/lib/motion";
import { weekOrdinal } from "@/lib/finish-summary";
import Sheet from "@/components/ui/Sheet";
import { FinishStats } from "@/components/workout/FinishSheet";
import { useT } from "@/i18n/useT";

/**
 * The reward after Spara passet (v6 B9, B10): an icon pop (a warm trophy, or
 * an accent flag for the first workout ever) over --gt-dur-reward, "Passet
 * sparat" with the records and the workout's place in its week, the three
 * numbers with one sheen, "Visa schemat …" inside an active plan, and Klar.
 */
export default function RewardSheet({
  open,
  first,
  records,
  weekNumber,
  done,
  volumeKg,
  minutes,
  plan,
  onPlan,
  onDone,
}: {
  open: boolean;
  /** The first workout ever finished. */
  first: boolean;
  records: number;
  /** The workout's number in its week, this one counted. */
  weekNumber: number;
  done: number;
  volumeKg: number;
  minutes: number | null;
  /** The active plan's name, for "Visa schemat Styrkeblock". */
  plan?: string;
  onPlan?: () => void;
  /** Klar, or closing: back to Train. */
  onDone: () => void;
}) {
  const { t, language } = useT();
  const icon = useRef<HTMLSpanElement>(null);
  useLayoutEffect(() => {
    if (!open) return;
    // The app's record pop, on the reward's time.
    playSpring(
      icon.current,
      SPRING.record,
      0.4,
      1,
      (v) => ({ transform: `scale(${v})`, opacity: Math.min(1, v) }),
      { delay: 80, fill: "backwards", duration: MOTION.reward },
    );
  }, [open]);
  return (
    <Sheet
      open={open}
      onClose={onDone}
      title={first ? t("finish.firstSaved") : t("finish.saved")}
      description={
        first
          ? t("finish.firstSub")
          : t("finish.rewardSub", {
              count: records,
              ordinal: weekOrdinal(weekNumber, language),
            })
      }
      className="reward-sheet"
    >
      <span
        ref={icon}
        className={`reward-icon${first ? " is-first" : ""}`}
        aria-hidden="true"
      >
        {first ? (
          <Flag size={28} strokeWidth={2} />
        ) : (
          <Trophy size={28} strokeWidth={2} />
        )}
      </span>
      <FinishStats done={done} volumeKg={volumeKg} minutes={minutes} sheen />
      {plan && onPlan && (
        <button
          type="button"
          className="btn-secondary btn-block"
          onClick={onPlan}
        >
          <CalendarDays size={18} aria-hidden="true" />
          {t("finish.showPlan", { plan })}
        </button>
      )}
      <button type="button" className="btn-primary btn-block" onClick={onDone}>
        {t("finish.done")}
      </button>
    </Sheet>
  );
}
