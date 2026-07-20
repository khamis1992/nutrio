import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowUpRight,
  Check,
  ChevronRight,
  Clock3,
  Dumbbell,
  Lock,
  Play,
  BedDouble,
  Search,
  Sparkles,
} from "lucide-react";

import { ExerciseCatalogSheet } from "@/components/exercises/ExerciseCatalogSheet";
import { ExerciseMedia } from "@/components/exercises/ExerciseMedia";
import { useExerciseCatalog } from "@/hooks/useExerciseCatalog";
import type { CoachProgram, ProgramExercise, ProgramWorkoutDay } from "@/hooks/useCoachPrograms";
import { useWorkoutDayLocks } from "@/hooks/useWorkoutDayLocks";
import { formatExerciseLabel, type ExerciseCatalogItem } from "@/lib/exercise-catalog";
import { cn } from "@/lib/utils";

interface CoachWorkoutExperienceProps {
  clientId?: string;
  programs: CoachProgram[];
  exercises: ProgramExercise[];
  workoutDays: ProgramWorkoutDay[];
  isExerciseCompleted: (exerciseId: string) => boolean;
  toggleExercise: (exerciseId: string) => void | Promise<void>;
}

export function CoachWorkoutExperience({
  clientId,
  programs,
  exercises,
  workoutDays,
  isExerciseCompleted,
  toggleExercise,
}: CoachWorkoutExperienceProps) {
  const navigate = useNavigate();
  const { exercises: catalog } = useExerciseCatalog();
  const [selectedDays, setSelectedDays] = useState<Record<string, number>>({});
  const [libraryOpen, setLibraryOpen] = useState(false);
  const [initialExerciseId, setInitialExerciseId] = useState<string | null>(null);
  const { isDayLogged, isDayUnlocked, getPreviousLockedDay } = useWorkoutDayLocks(clientId, exercises);

  const catalogById = useMemo(
    () => new Map(catalog.map((exercise) => [exercise.id, exercise])),
    [catalog],
  );
  const assignedCatalogIds = useMemo(
    () => [...new Set(exercises.map((exercise) => exercise.exercise_catalog_id).filter((id): id is string => Boolean(id)))],
    [exercises],
  );
  const assignedCatalog = useMemo(
    () => assignedCatalogIds.map((id) => catalogById.get(id)).filter((item): item is ExerciseCatalogItem => Boolean(item)),
    [assignedCatalogIds, catalogById],
  );
  const completedCount = exercises.filter((exercise) => isExerciseCompleted(exercise.id)).length;
  const progress = exercises.length > 0 ? Math.round((completedCount / exercises.length) * 100) : 0;
  const totalDays = new Set(exercises.map((exercise) => `${exercise.program_id}:${exercise.day_number}`)).size;

  const openLibrary = (exerciseId?: string | null) => {
    setInitialExerciseId(exerciseId ?? null);
    setLibraryOpen(true);
  };

  if (programs.length === 0) {
    return (
      <section className="rounded-[28px] bg-white px-6 py-10 text-center shadow-[0_14px_34px_rgba(15,23,42,0.06)] ring-1 ring-[#E5EAF1]">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-[22px] bg-[#EEFDF9] text-[#16A98A] ring-1 ring-[#22C7A1]/20">
          <Dumbbell className="h-7 w-7" />
        </div>
        <h3 className="mt-5 text-[20px] font-extrabold text-[#07152F]">Your workout plan is on its way</h3>
        <p className="mx-auto mt-2 max-w-[300px] text-[13px] font-medium leading-6 text-[#71809C]">
          Exercises selected by your coach will appear here with movement previews and guided sessions.
        </p>
      </section>
    );
  }

  return (
    <div className="space-y-4">
      <section className="overflow-hidden rounded-[28px] bg-white shadow-[0_16px_38px_rgba(15,23,42,0.07)] ring-1 ring-[#DDE5EF]">
        <div className="px-5 pb-5 pt-5">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 text-[#15A98A]">
                <Sparkles className="h-4 w-4" />
                <p className="text-[10px] font-extrabold uppercase tracking-[0.14em]">Selected by your coach</p>
              </div>
              <h3 className="mt-2 text-[22px] font-extrabold leading-[1.15] text-[#07152F]">Your movement library</h3>
              <p className="mt-2 max-w-[280px] text-[12px] font-medium leading-5 text-[#71809C]">
                Review the exact exercises in your plan before starting today&apos;s session.
              </p>
            </div>
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-[18px] bg-[#E9FBF7] text-[#16A98A] ring-1 ring-[#22C7A1]/20">
              <Dumbbell className="h-5 w-5" />
            </div>
          </div>

          <button
            type="button"
            onClick={() => openLibrary()}
            disabled={assignedCatalogIds.length === 0}
            className="mt-5 flex min-h-12 w-full items-center gap-3 rounded-[17px] bg-[#F5F8FC] px-4 text-left ring-1 ring-[#DDE5EF] transition active:scale-[0.99] disabled:opacity-55"
          >
            <Search className="h-5 w-5 shrink-0 text-[#16A98A]" />
            <span className="min-w-0 flex-1 text-[12px] font-bold text-[#8A98AF]">
              {exercises.length > 0
                ? `Search your ${exercises.length} assigned exercise${exercises.length === 1 ? "" : "s"}`
                : "Waiting for your coach's exercise selection"}
            </span>
            <ArrowUpRight className="h-4 w-4 shrink-0 text-[#07152F]" />
          </button>

          <div className="mt-4 grid grid-cols-3 divide-x divide-[#DDE5EF] rounded-[18px] bg-[#F8FAFC] py-3 ring-1 ring-[#E5EAF1]">
            <Metric value={exercises.length} label="Exercises" />
            <Metric value={totalDays} label="Training days" />
            <Metric value={`${progress}%`} label="Complete" accent />
          </div>
        </div>

        {exercises.length === 0 ? (
          <div className="flex items-center gap-3 border-t border-[#DDE5EF] bg-[#F1FBF8] px-5 py-4">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[16px] bg-white text-[#7069E8] ring-1 ring-[#DDE5EF]">
              <Sparkles className="h-5 w-5" />
            </span>
            <span className="min-w-0">
              <span className="block text-[13px] font-extrabold text-[#07152F]">No exercises selected yet</span>
              <span className="mt-1 block text-[11px] font-medium leading-4 text-[#71809C]">Your coach&apos;s selections will appear here automatically.</span>
            </span>
          </div>
        ) : (
          <div className="grid grid-cols-3 border-t border-[#DDE5EF] bg-[#F1FBF8]">
            {assignedCatalog.slice(0, 3).map((exercise) => (
            <button
              type="button"
              key={exercise.id}
              onClick={() => openLibrary(exercise.id)}
              className="group relative aspect-square overflow-hidden bg-white [&:not(:first-child)]:border-l [&:not(:first-child)]:border-[#DDE5EF]"
              aria-label={`View ${formatExerciseLabel(exercise.name)}`}
            >
              <ExerciseMedia
                exercise={exercise}
                alt=""
                loading="lazy"
                className="h-full w-full object-contain p-2 transition duration-300 group-active:scale-95"
              />
            </button>
            ))}
            {assignedCatalog.length === 0 && exercises.slice(0, 3).map((exercise) => (
              <div key={exercise.id} className="flex aspect-square flex-col items-center justify-center gap-2 bg-white px-2 text-center [&:not(:first-child)]:border-l [&:not(:first-child)]:border-[#DDE5EF]">
                <Dumbbell className="h-6 w-6 text-[#7C83F6]" />
                <span className="line-clamp-2 text-[10px] font-bold leading-4 text-[#41506A]">{exercise.exercise_name}</span>
              </div>
            ))}
          </div>
        )}
      </section>

      {exercises.length === 0 ? null : programs.map((program) => {
        const programExercises = exercises.filter((exercise) => exercise.program_id === program.id);
        const programDays = workoutDays.filter((day) => day.program_id === program.id);
        const days = [...new Set([...programExercises.map((exercise) => exercise.day_number), ...programDays.map((day) => day.day_number)])].sort((a, b) => a - b);
        const unlockedDays = days.filter((day) => isDayUnlocked(program.id, day));
        const firstIncompleteDay = days.find((day) =>
          programExercises.some((exercise) => exercise.day_number === day && !isExerciseCompleted(exercise.id)),
        );
        const selectedCandidate = selectedDays[program.id] ?? firstIncompleteDay ?? days[0];
        const selectedDay = isDayUnlocked(program.id, selectedCandidate)
          ? selectedCandidate
          : unlockedDays.at(-1) ?? days[0];
        const dayExercises = programExercises.filter((exercise) => exercise.day_number === selectedDay);
        const dayDefinition = programDays.find((day) => day.day_number === selectedDay);
        const programCompleted = programExercises.filter((exercise) => isExerciseCompleted(exercise.id)).length;
        const programProgress = programExercises.length > 0
          ? Math.round((programCompleted / programExercises.length) * 100)
          : 0;
        const dayCompleted = dayExercises.filter((exercise) => isExerciseCompleted(exercise.id)).length;

        return (
          <section key={program.id} className="overflow-hidden rounded-[28px] bg-white shadow-[0_16px_38px_rgba(15,23,42,0.07)] ring-1 ring-[#DDE5EF]">
            <div className="border-b border-[#DDE5EF] bg-[#F7FBFA] px-5 pb-5 pt-5">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0 flex-1">
                  <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-[#0E9F83]">Active training plan</p>
                  <h3 className="mt-2 line-clamp-2 text-[21px] font-extrabold leading-tight text-[#07152F]">{program.title}</h3>
                  <p className="mt-2 text-[11px] font-medium text-[#71809C]">
                    {formatDate(program.start_date)} - {formatDate(program.end_date)}
                  </p>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    <span className="rounded-full bg-white px-2 py-1 text-[9px] font-extrabold text-[#7C83F6] ring-1 ring-[#DDE5EF]">{program.schedule_mode === "flexible" ? "Flexible week" : "Fixed schedule"}</span>
                    <span className="rounded-full bg-white px-2 py-1 text-[9px] font-extrabold text-[#0E9F83] ring-1 ring-[#DDE5EF]">{program.phase_count ?? 1} phase{(program.phase_count ?? 1) === 1 ? "" : "s"}</span>
                  </div>
                </div>
                <div className="flex h-14 w-14 shrink-0 flex-col items-center justify-center rounded-full border-[5px] border-[#22C7A1] bg-white shadow-sm">
                  <span className="text-[13px] font-extrabold leading-none text-[#07152F]">{programProgress}%</span>
                </div>
              </div>
              <div className="mt-4 h-2 overflow-hidden rounded-full bg-[#DFE8E5]">
                <div className="h-full rounded-full bg-[#22C7A1] transition-all duration-500" style={{ width: `${programProgress}%` }} />
              </div>
            </div>

            <div className="px-4 pb-5 pt-4">
              <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
                {days.map((day) => {
                  const count = programExercises.filter((exercise) => exercise.day_number === day).length;
                  const complete = programExercises.filter(
                    (exercise) => exercise.day_number === day && isExerciseCompleted(exercise.id),
                  ).length;
                  const active = day === selectedDay;
                  const unlocked = isDayUnlocked(program.id, day);
                  const logged = isDayLogged(program.id, day);
                  const previousLockedDay = getPreviousLockedDay(program.id, day);
                  return (
                    <button
                      type="button"
                      key={day}
                      onClick={() => {
                        if (!unlocked) return;
                        setSelectedDays((current) => ({ ...current, [program.id]: day }));
                      }}
                      disabled={!unlocked}
                      className={cn(
                        "min-h-[62px] min-w-[92px] rounded-[18px] px-3 text-left transition active:scale-[0.98] disabled:active:scale-100",
                        !unlocked
                          ? "bg-[#F6F8FB] text-[#94A3B8] opacity-75 ring-1 ring-[#E5EAF1]"
                          : active
                          ? "bg-[#E9FBF7] text-[#087B67] ring-1 ring-[#22C7A1]/35"
                          : "bg-[#F6F8FB] text-[#41506A] ring-1 ring-[#E5EAF1]",
                      )}
                      title={!unlocked && previousLockedDay ? `Log Day ${previousLockedDay} to unlock Day ${day}` : undefined}
                    >
                      <span className="flex items-center gap-1 text-[12px] font-extrabold">
                        {!unlocked && <Lock className="h-3 w-3" />}
                        {programDays.find((item) => item.day_number === day)?.day_type === "rest" ? "Rest" : `Day ${day}`}
                      </span>
                      <span className="mt-1 block text-[10px] font-semibold opacity-65">
                        {!unlocked && previousLockedDay
                          ? `Log Day ${previousLockedDay}`
                          : logged
                            ? "Logs saved"
                            : `${complete}/${count} done`}
                      </span>
                    </button>
                  );
                })}
              </div>

              <div className="mt-4 flex items-center justify-between gap-3">
                <div>
                  <p className="text-[10px] font-extrabold uppercase tracking-[0.14em] text-[#7C83F6]">Today&apos;s session</p>
                  <h4 className="mt-1 text-[18px] font-extrabold text-[#07152F]">{dayDefinition?.title || `Day ${selectedDay}`}</h4>
                  <p className="mt-1 text-[11px] font-medium text-[#8A98AF]">
                    {isDayLogged(program.id, selectedDay)
                      ? "Workout logs saved for this day"
                      : `${dayCompleted} of ${dayExercises.length} exercises complete`}
                  </p>
                </div>
                {dayExercises.length > 0 && dayDefinition?.day_type !== "rest" && (
                  <button
                    type="button"
                    onClick={() => navigate(`/coach-programs/workout/${program.id}/day/${selectedDay}`)}
                    className="flex min-h-12 items-center gap-2 rounded-[17px] bg-[#7C83F6] px-4 text-[12px] font-extrabold text-white shadow-[0_10px_24px_rgba(124,131,246,0.25)] transition active:scale-95"
                  >
                    <Play className="h-4 w-4 fill-current" />
                    Start
                  </button>
                )}
              </div>

              {dayDefinition?.day_type === "rest" && (
                <div className="mt-4 flex items-center gap-3 rounded-[20px] bg-[#EFF9FF] p-4 ring-1 ring-[#38BDF8]/25">
                  <span className="flex h-11 w-11 items-center justify-center rounded-[15px] bg-white text-[#38BDF8]"><BedDouble className="h-5 w-5" /></span>
                  <div><p className="text-[13px] font-extrabold text-[#07152F]">Recovery day</p><p className="mt-1 text-[10px] font-medium text-[#71809C]">{dayDefinition.notes || "Rest, hydrate, and prepare for the next session."}</p></div>
                </div>
              )}

              <div className="mt-4 space-y-3">
                {dayExercises.map((exercise, index) => {
                  const catalogExercise = exercise.exercise_catalog_id
                    ? catalogById.get(exercise.exercise_catalog_id)
                    : undefined;
                  const done = isExerciseCompleted(exercise.id);
                  return (
                    <article
                      key={exercise.id}
                      className={cn(
                        "flex min-h-[104px] items-center gap-3 rounded-[22px] p-3 ring-1 transition",
                        done ? "bg-[#F4FBF9] ring-[#BCECDF]" : "bg-[#F8FAFC] ring-[#E1E7EF]",
                      )}
                    >
                      <button
                        type="button"
                        onClick={() => catalogExercise && openLibrary(catalogExercise.id)}
                        disabled={!catalogExercise}
                        className="relative h-[80px] w-[80px] shrink-0 overflow-hidden rounded-[18px] bg-white ring-1 ring-[#E1E7EF] disabled:cursor-default"
                        aria-label={catalogExercise ? `Preview ${exercise.exercise_name}` : undefined}
                      >
                        {catalogExercise ? (
                          <ExerciseMedia exercise={catalogExercise} alt="" loading="lazy" className="h-full w-full object-contain p-1" />
                        ) : (
                          <span className="flex h-full w-full items-center justify-center text-[#7C83F6]"><Dumbbell className="h-7 w-7" /></span>
                        )}
                        <span className="absolute left-2 top-2 flex h-5 min-w-5 items-center justify-center rounded-full bg-[#07152F] px-1 text-[9px] font-extrabold text-white">{index + 1}</span>
                      </button>

                      <div className="min-w-0 flex-1">
                        <p className={cn("line-clamp-2 text-[14px] font-extrabold leading-[18px]", done ? "text-[#71809C] line-through" : "text-[#07152F]")}>{exercise.exercise_name}</p>
                        <div className="mt-2 flex flex-wrap gap-1.5">
                          <span className="rounded-full bg-white px-2 py-1 text-[10px] font-bold text-[#596982] ring-1 ring-[#E1E7EF]">{exercise.sets} sets</span>
                          <span className="rounded-full bg-white px-2 py-1 text-[10px] font-bold text-[#596982] ring-1 ring-[#E1E7EF]">{exercise.reps} reps</span>
                          <span className="flex items-center gap-1 rounded-full bg-white px-2 py-1 text-[10px] font-bold text-[#596982] ring-1 ring-[#E1E7EF]"><Clock3 className="h-3 w-3" />{exercise.rest_seconds ?? 60}s</span>
                        </div>
                        {exercise.notes && (
                          <p className="mt-2 line-clamp-2 text-[10px] font-medium leading-4 text-[#71809C]">
                            {exercise.notes}
                          </p>
                        )}
                        {catalogExercise && (
                          <button type="button" onClick={() => openLibrary(catalogExercise.id)} className="mt-2 flex min-h-7 items-center gap-1 text-[10px] font-extrabold text-[#7C83F6]">
                            View movement <ChevronRight className="h-3 w-3" />
                          </button>
                        )}
                      </div>

                      <button
                        type="button"
                        onClick={() => toggleExercise(exercise.id)}
                        className={cn(
                          "flex h-11 w-11 shrink-0 items-center justify-center rounded-full transition active:scale-90",
                          done
                            ? "bg-[#22C7A1] text-white shadow-[0_8px_18px_rgba(34,199,161,0.25)]"
                            : "bg-white text-[#B0BAC9] ring-1 ring-[#D9E1EB]",
                        )}
                        aria-label={done ? `Mark ${exercise.exercise_name} incomplete` : `Mark ${exercise.exercise_name} complete`}
                      >
                        <Check className="h-5 w-5" strokeWidth={3} />
                      </button>
                    </article>
                  );
                })}
              </div>
            </div>
          </section>
        );
      })}

      <ExerciseCatalogSheet
        open={libraryOpen}
        onOpenChange={setLibraryOpen}
        title="Exercises from your coach"
        allowedExerciseIds={assignedCatalogIds}
        initialExerciseId={initialExerciseId}
      />
    </div>
  );
}

function Metric({ value, label, accent = false }: { value: number | string; label: string; accent?: boolean }) {
  return (
    <div className="px-2 text-center">
      <p className={cn("text-[18px] font-extrabold leading-none", accent ? "text-[#16A98A]" : "text-[#07152F]")}>{value}</p>
      <p className="mt-1.5 text-[9px] font-bold uppercase tracking-[0.08em] text-[#8A98AF]">{label}</p>
    </div>
  );
}

function formatDate(date: string) {
  return new Date(date).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}
