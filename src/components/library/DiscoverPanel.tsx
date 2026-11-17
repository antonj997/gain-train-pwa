import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { Search } from "lucide-react";
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
import { sharedTileFacts } from "@/lib/routine-tile-facts";
import { routineEditPath } from "@/lib/routes";
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
 * Library → Upptäck: what people shared. A search and focus chips (Push,
 * Pull, Ben, Helkropp, Hemma) over "Delat av dig" (your shared routines, each
 * with Dela), other people's routines as tiles with + to save, and shared
 * exercises with Add. A tile opens the preview, with your own last results,
 * Spara and Prova en gång. `?shared=<id>` opens that routine's preview (the
 * Dela sheet's link).
 */
export default function DiscoverPanel({
  request = null,
}: {
  request?: PanelRequest;
}) {
  const { state } = useData();
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
        <p className="empty" role="status">
          {shared.canShare ? (
            t("sharedRoutines.offline")
          ) : (
            <>
              {t("sharedRoutines.signIn")}{" "}
              <Link className="text-button" to="/auth">
                {t("shared.signInLink")}
              </Link>
            </>
          )}
        </p>
      </div>
    );

  const routinesStatus = status("routines");
  return (
    <div className="col-12 discover-panel">
      {workoutStart.confirmation}
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
                      <span className="row-sub">{meta}</span>
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
