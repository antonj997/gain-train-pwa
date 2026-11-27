import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { ChevronRight, Info, Search } from "lucide-react";
import { useAuth } from "@/contexts/useAuth";
import { useData } from "@/contexts/useData";
import type { RoutineRecord } from "@/data/model";
import { completedWorkouts, routines } from "@/data/selectors";
import { newWorkout } from "@/data/start";
import { lastSessions } from "@/data/workouts";
import RoutineTile from "@/components/library/RoutineTile";
import RoutineGlyph from "@/components/library/RoutineGlyph";
import SharedRoutinePreviewSheet from "@/components/library/SharedRoutinePreview";
import SharedExerciseList from "@/components/library/SharedExerciseList";
import ProgramList from "@/components/library/ProgramList";
import ProgramSheet from "@/components/library/ProgramSheet";
import Reveal from "@/components/motion/Reveal";
import { musclesLookup } from "@/data/exercise-muscles";
import { PROGRAMS, programById, type Program } from "@/data/programs";
import {
  isProgramAdded,
  programRoutines,
  routinesToRemove,
} from "@/lib/program-actions";
import type { ProgramChip } from "@/lib/program-view";
import ShareRoutineSheet from "@/components/library/ShareRoutineSheet";
import type { PanelRequest } from "@/components/library/ExercisesPanel";
import { useRetainedDraft } from "@/hooks/useRetainedDraft";
import { useSharedExercises } from "@/hooks/useSharedExercises";
import { useSharedRoutines } from "@/hooks/useSharedRoutines";
import { useStartWorkout } from "@/hooks/useStartWorkout";
import {
  FOCUSES,
  exerciseFocuses,
  matchesSearch,
  routineFocuses,
  type Focus,
} from "@/lib/discover";
import { draftKey, parseRoutineDraft } from "@/lib/drafts";
import type { LibraryExercise } from "@/lib/library";
import { notify } from "@/lib/message-store";
import { routineAverageMinutes } from "@/lib/routine-preview";
import { ownTileFacts, sharedTileFacts } from "@/lib/routine-tile-facts";
import { newPlanPath, routineEditPath } from "@/lib/routes";
import { useT } from "@/i18n/useT";

/** Shared exercises listed before "Show all". */
const EXERCISES_SHOWN = 8;

const FOCUS_LABEL = {
  push: "discover.push",
  pull: "discover.pull",
  legs: "discover.legs",
  full: "discover.full",
  home: "discover.home",
} as const satisfies Record<Focus, string>;

/**
 * Library → Rutiner → Upptäck (v6 §E6): first the standard programmes (chips,
 * a row per programme with + / ✓, the programme sheet with "Lägg till {n}
 * rutiner" and "Gör det till ett schema"), which work without an account.
 * Then what people shared: a search and focus chips (Push, Pull, Ben,
 * Helkropp, Hemma) over "Delat av dig" (your shared routines, each with
 * Dela), other people's routines as tiles with + to save, and shared
 * exercises with Add; signed out, one row asks to sign in. A tile opens the
 * preview, with your own last results, Spara and Prova en gång.
 * `?shared=<id>` opens that routine's preview (the Dela sheet's link).
 */
export default function DiscoverPanel({
  request = null,
}: {
  request?: PanelRequest;
}) {
  const { state, save, deleteRecord } = useData();
  const { account } = useAuth();
  const { t } = useT();
  const navigate = useNavigate();
  const workoutStart = useStartWorkout();
  const [params, setParams] = useSearchParams();
  // An unfinished routine draft follows its routine's shared id.
  const draft = useRetainedDraft(
    draftKey(account, "routine"),
    parseRoutineDraft,
  );
  const followSharedId = (id: string, sharedId: string | null) => {
    const edit = draft.value;
    if (edit?.id !== id) return;
    const data = structuredClone(edit.data);
    if (sharedId) data.sharedId = sharedId;
    else delete data.sharedId;
    draft.replace({ ...edit, data });
  };
  const shared = useSharedRoutines({
    browsing: true,
    onSharedId: followSharedId,
  });
  const sharedExercises = useSharedExercises({
    browsing: true,
    onSharedId: () => {},
  });
  const [query, setQuery] = useState("");
  const [focus, setFocus] = useState<Focus | null>(null);
  const [allExercises, setAllExercises] = useState(false);
  const [shareId, setShareId] = useState<string | null>(null);
  const [trying, setTrying] = useState(false);
  const searchInput = useRef<HTMLInputElement>(null);
  const previewId = params.get("shared");
  const setPreviewId = (id: string | null) => {
    const next = new URLSearchParams(params);
    if (id) next.set("shared", id);
    else next.delete("shared");
    setParams(next, { replace: true });
  };

  // The header's Search focuses the search field.
  const handled = useRef(request?.n ?? 0);
  useEffect(() => {
    if (!request || request.n === handled.current) return;
    handled.current = request.n;
    if (request.kind === "search") searchInput.current?.focus();
  }, [request]);

  const own = useMemo(() => routines(state.records), [state.records]);

  // The standard programmes: "+" writes their routines, ✓ takes them back.
  const [programChip, setProgramChip] = useState<ProgramChip>("all");
  const [programId, setProgramId] = useState<string | null>(null);
  const [programBusy, setProgramBusy] = useState(false);
  const [othersInfo, setOthersInfo] = useState(false);
  const musclesOf = useMemo(
    () => musclesLookup(state.records),
    [state.records],
  );
  /** Adds the programme's routines that are not in its folder yet; how many. */
  const addProgram = async (p: Program) => {
    const present = new Set(
      own
        .filter((r) => r.payload.folder === p.title)
        .map((r) => r.payload.name),
    );
    const missing = programRoutines(p).filter((r) => !present.has(r.name));
    for (const routine of missing)
      await save(crypto.randomUUID(), "routine", routine);
    return missing.length;
  };
  const toggleProgram = async (p: Program) => {
    if (programBusy) return;
    setProgramBusy(true);
    try {
      if (isProgramAdded(p, own)) {
        const ids = routinesToRemove(p, own);
        for (const id of ids) await deleteRecord(id);
        const kept = own.filter(
          (r) =>
            r.payload.folder === p.title &&
            p.routines.some((x) => x.name === r.payload.name) &&
            !ids.includes(r.id),
        ).length;
        notify.success(
          t("discover.programRemoved", { title: p.title }) +
            (kept ? " " + t("discover.programKept", { count: kept }) : ""),
        );
      } else {
        const count = await addProgram(p);
        notify.success(t("discover.programAdded", { count, title: p.title }));
      }
    } catch {
      notify.error(t("discover.programFailed", { title: p.title }));
    } finally {
      setProgramBusy(false);
    }
  };
  // "Gör det till ett schema": the routines first, then Nytt schema with its weeks.
  const programPlan = async (p: Program) => {
    if (programBusy) return;
    setProgramBusy(true);
    try {
      await addProgram(p);
      setProgramId(null);
      navigate(newPlanPath(p.id));
    } catch {
      notify.error(t("discover.programFailed", { title: p.title }));
    } finally {
      setProgramBusy(false);
    }
  };
  const openProgram = programById(programId) ?? null;
  const programs = (
    <>
      <ProgramList
        programs={PROGRAMS}
        chip={programChip}
        onChip={setProgramChip}
        isAdded={(p) => isProgramAdded(p, own)}
        busy={programBusy}
        onToggle={(p) => void toggleProgram(p)}
        onOpen={(p) => setProgramId(p.id)}
      />
      <ProgramSheet
        program={openProgram}
        musclesOf={musclesOf}
        added={!!openProgram && isProgramAdded(openProgram, own)}
        busy={programBusy}
        onClose={() => setProgramId(null)}
        onToggle={(p) => void toggleProgram(p)}
        onMakePlan={(p) => void programPlan(p)}
      />
    </>
  );
  const sessions = useMemo(
    () => lastSessions(completedWorkouts(state.records)),
    [state.records],
  );
  const rows = useMemo(
    () => shared.rows.map((row) => ({ row, ...sharedTileFacts(row) })),
    [shared.rows],
  );
  const routineMatches = (item: (typeof rows)[number]) =>
    (!focus || routineFocuses(item.facts).has(focus)) &&
    matchesSearch(
      query,
      item.row.name,
      item.row.by_name,
      item.row.note,
      ...item.names,
    );
  const mine = rows.filter((r) => r.row.mine && routineMatches(r));
  const others = rows.filter((r) => !r.row.mine && routineMatches(r));
  const exerciseItems = useMemo(
    (): LibraryExercise[] =>
      sharedExercises.rows
        .filter(
          (r) =>
            (!focus ||
              exerciseFocuses({
                category: r.category,
                equipment: r.equipment ?? undefined,
                load: r.load ?? undefined,
              }).has(focus)) &&
            matchesSearch(query, r.name, r.by_name, ...(r.aliases ?? [])),
        )
        .map((r) => ({
          id: r.id,
          name: r.name,
          category: r.category,
          equipment: r.equipment ?? undefined,
          aliases: r.aliases,
          custom: false,
          favourite: false,
          note: "",
          lastDate: null,
          best: null,
          ...(r.by_name ? { sharedBy: r.by_name } : {}),
        })),
    [sharedExercises.rows, focus, query],
  );
  const shownExercises = allExercises
    ? exerciseItems
    : exerciseItems.slice(0, EXERCISES_SHOWN);
  // Focus chips that would show something.
  const focuses = FOCUSES.filter(
    (f) =>
      rows.some((r) => routineFocuses(r.facts).has(f)) ||
      sharedExercises.rows.some((r) =>
        exerciseFocuses({
          category: r.category,
          equipment: r.equipment ?? undefined,
          load: r.load ?? undefined,
        }).has(f),
      ),
  );

  const localOf = (sharedId: string): RoutineRecord | undefined =>
    own.find((r) => r.payload.sharedId === sharedId);
  const previewRow = rows.find((r) => r.row.id === previewId)?.row ?? null;
  const previewOwn = previewRow?.mine ? localOf(previewRow.id) : undefined;
  // A link to a routine that is no longer shared says so once the feed is in.
  useEffect(() => {
    if (!previewId || shared.status !== "ready" || previewRow) return;
    notify(t("discover.notFound"));
    setPreviewId(null);
    // Checked when the feed or the link changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [previewId, shared.status, previewRow]);

  const tryOnce = async (id: string) => {
    if (trying) return;
    setTrying(true);
    try {
      const routine = await shared.prepareTry(id);
      if (!routine) return;
      const record: RoutineRecord = {
        id: crypto.randomUUID(),
        kind: "routine",
        payload: routine,
        revision: 0,
        deleted: false,
        localVersion: 0,
        dirty: false,
      };
      // Not one of your routines: the workout keeps no routine id.
      const { routineId: _routineId, ...workout } = newWorkout(
        Object.values(state.records),
        { routine: record },
      );
      setPreviewId(null);
      await workoutStart.start(workout);
    } finally {
      setTrying(false);
    }
  };

  const status = (kind: "routines" | "exercises") => {
    const feed = kind === "routines" ? shared : sharedExercises;
    if (feed.status === "loading" && !feed.hasRows)
      return t(
        kind === "routines" ? "sharedRoutines.loading" : "shared.loading",
      );
    if (feed.status === "error" && !feed.hasRows)
      return (
        <>
          {t(
            kind === "routines"
              ? "sharedRoutines.loadFailed"
              : "shared.loadFailed",
          )}{" "}
          <button type="button" className="text-button" onClick={feed.retry}>
            {t("common.retry")}
          </button>
        </>
      );
    return null;
  };

  if (!shared.ready)
    return (
      <div className="col-12 discover-panel">
        {programs}
        {shared.canShare ? (
          <p className="empty" role="status">
            {t("sharedRoutines.offline")}
          </p>
        ) : (
          <div className="discover-others">
            <div className="list">
              <div className="row discover-others-row">
                <Link
                  className="row-main row-open discover-others-open"
                  to="/auth"
                >
                  <span className="discover-others-text">
                    <span className="row-title">{t("discover.others")}</span>
                    <span className="row-sub">
                      {t("discover.othersSignIn")}
                    </span>
                  </span>
                  <span className="discover-others-go">
                    {t("discover.signIn")}
                    <ChevronRight size={18} aria-hidden="true" />
                  </span>
                </Link>
                <button
                  type="button"
                  className="icon-btn"
                  aria-label={t("discover.othersInfoLabel")}
                  aria-expanded={othersInfo}
                  onClick={() => setOthersInfo((on) => !on)}
                >
                  <Info size={20} aria-hidden="true" />
                </button>
              </div>
            </div>
            <Reveal>
              {othersInfo && (
                <p className="program-note" role="note">
                  {t("discover.othersInfo")}
                </p>
              )}
            </Reveal>
          </div>
        )}
      </div>
    );

  const routinesStatus = status("routines");
  return (
    <div className="col-12 discover-panel">
      {workoutStart.confirmation}
      {programs}
      <label className="search-field discover-search">
        <Search size={20} aria-hidden="true" />
        <input
          ref={searchInput}
          type="search"
          placeholder={t("discover.search")}
          aria-label={t("library.searchDiscover")}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </label>
      {focuses.length > 0 && (
        <div
          className="facet-chips"
          role="group"
          aria-label={t("discover.focus")}
        >
          <button
            type="button"
            className="filter-chip"
            aria-pressed={!focus}
            onClick={() => setFocus(null)}
          >
            {t("discover.focusAll")}
          </button>
          {focuses.map((f) => (
            <button
              key={f}
              type="button"
              className="filter-chip"
              aria-pressed={focus === f}
              onClick={() => setFocus(focus === f ? null : f)}
            >
              {t(FOCUS_LABEL[f])}
            </button>
          ))}
        </div>
      )}
      {mine.length > 0 && (
        <section aria-labelledby="discover-mine">
          <h2 className="group-title" id="discover-mine">
            {t("discover.mine")}
          </h2>
          <div className="list discover-mine">
            {mine.map(({ row, icons, meta }) => {
              const local = localOf(row.id);
              // Your own routine's length comes from your history.
              const length = local
                ? ownTileFacts(
                    local.id,
                    local.payload,
                    state.records,
                    undefined,
                    "",
                  ).meta
                : meta;
              return (
                <div className="row discover-mine-row" key={row.id}>
                  <button
                    type="button"
                    className="row-main row-open"
                    aria-label={t("routine.preview", { name: row.name })}
                    onClick={() => setPreviewId(row.id)}
                  >
                    {icons[0] && (
                      <RoutineGlyph
                        exerciseId={icons[0].exerciseId}
                        category={icons[0].category}
                        size={36}
                      />
                    )}
                    <span className="discover-mine-text">
                      <span className="row-title">{row.name}</span>
                      <span className="row-sub">{length}</span>
                    </span>
                  </button>
                  <button
                    type="button"
                    className="unhide"
                    aria-label={t("shareSheet.title", { name: row.name })}
                    onClick={() =>
                      local ? setShareId(local.id) : setPreviewId(row.id)
                    }
                  >
                    {t("routineTile.share")}
                  </button>
                </div>
              );
            })}
          </div>
        </section>
      )}
      <section aria-labelledby="discover-routines">
        <h2 className="group-title" id="discover-routines">
          {t("discover.routines")}
        </h2>
        {routinesStatus ? (
          <p className="empty" role="status">
            {routinesStatus}
          </p>
        ) : others.length ? (
          <div className="routine-grid">
            {others.map(({ row, icons, more, meta, foot }) => {
              const saved = shared.added.has(row.id);
              return (
                <RoutineTile
                  key={row.id}
                  itemKey={row.id}
                  name={row.name}
                  icons={icons}
                  more={more}
                  meta={meta}
                  foot={foot}
                  openLabel={t("routine.preview", { name: row.name })}
                  onOpen={() => setPreviewId(row.id)}
                  action={
                    saved
                      ? { kind: "saved", label: t("discover.saved") }
                      : {
                          kind: "save",
                          label: t("discover.saveNamed", { name: row.name }),
                          disabled: !!shared.adding || trying,
                          onClick: () => void shared.add(row.id),
                        }
                  }
                />
              );
            })}
          </div>
        ) : (
          <p className="empty" role="status">
            {query.trim() || focus
              ? t("discover.noMatch")
              : t("sharedRoutines.empty")}
          </p>
        )}
      </section>
      <section aria-labelledby="discover-exercises">
        <h2 className="group-title" id="discover-exercises">
          {t("discover.exercises")}
        </h2>
        <SharedExerciseList
          canShare={sharedExercises.canShare}
          ready={sharedExercises.ready}
          status={sharedExercises.status}
          hasRows={sharedExercises.hasRows}
          items={shownExercises}
          narrowed={!!query.trim() || !!focus}
          adding={sharedExercises.adding}
          onRetry={sharedExercises.retry}
          onAdd={(id) => void sharedExercises.add(id)}
        />
        {!allExercises && exerciseItems.length > EXERCISES_SHOWN && (
          <button
            type="button"
            className="btn-quiet btn-block"
            onClick={() => setAllExercises(true)}
          >
            {t("discover.showAll", { count: exerciseItems.length })}
          </button>
        )}
      </section>
      <SharedRoutinePreviewSheet
        row={previewRow}
        records={state.records}
        sessions={sessions}
        minutes={
          previewOwn
            ? (routineAverageMinutes(previewOwn.id, state.records) ??
              rows.find((r) => r.row.id === previewRow?.id)?.minutes ??
              null)
            : (rows.find((r) => r.row.id === previewRow?.id)?.minutes ?? null)
        }
        added={!!previewRow && shared.added.has(previewRow.id)}
        adding={!!previewRow && shared.adding === previewRow.id}
        busy={
          trying ||
          workoutStart.busy ||
          shared.sharing ||
          (!!shared.adding && shared.adding !== previewRow?.id)
        }
        canEdit={!!previewOwn}
        onClose={() => setPreviewId(null)}
        onAdd={() => previewRow && void shared.add(previewRow.id)}
        onTry={() => previewRow && void tryOnce(previewRow.id)}
        onShare={() => {
          if (!previewOwn) return;
          setPreviewId(null);
          setShareId(previewOwn.id);
        }}
        onEdit={() => {
          if (!previewOwn) return;
          // The routine editor lives in Library → Routines.
          navigate(routineEditPath(previewOwn.id));
        }}
        onStopSharing={async () => {
          if (previewRow && (await shared.unshare(previewRow.id)))
            setPreviewId(null);
        }}
      />
      <ShareRoutineSheet
        routine={own.find((r) => r.id === shareId) ?? null}
        records={state.records}
        canShare={shared.canShare}
        ready={shared.ready}
        sharing={shared.sharing}
        onClose={() => setShareId(null)}
        onShare={async (r, on) => {
          // A new share shows under "Delat av dig" once the feed is fetched again.
          if (on) {
            if (await shared.share(r.id)) shared.retry();
          } else if (r.payload.sharedId)
            await shared.unshare(r.payload.sharedId);
        }}
      />
    </div>
  );
}
