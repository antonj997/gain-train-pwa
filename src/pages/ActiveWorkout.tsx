import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Plus, Check, X, Copy, Trash2, GripVertical, Loader2 } from "lucide-react";
import { toast } from "sonner";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import ExerciseSelector from "@/components/ExerciseSelector";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";

interface ExerciseSet {
  id: string;
  exerciseName: string;
  sets: { reps: number; weight: number; isBodyweight: boolean }[];
}

interface SortableExerciseCardProps {
  exercise: ExerciseSet;
  exerciseIndex: number;
  onRemove: () => void;
  onAddSet: () => void;
  onDuplicateSet: (setIndex: number) => void;
  onRemoveSet: (setIndex: number) => void;
  onUpdateSet: (setIndex: number, field: "reps" | "weight", value: number) => void;
  onToggleBodyweight: (setIndex: number) => void;
}

const SortableExerciseCard = ({
  exercise,
  exerciseIndex,
  onRemove,
  onAddSet,
  onDuplicateSet,
  onRemoveSet,
  onUpdateSet,
  onToggleBodyweight,
}: SortableExerciseCardProps) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: exercise.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <Card ref={setNodeRef} style={style} className="relative">
      <div 
        {...attributes} 
        {...listeners} 
        className="absolute right-3 top-3 cursor-grab active:cursor-grabbing p-2 opacity-50 hover:opacity-100 transition-opacity touch-none"
      >
        <GripVertical className="h-5 w-5 text-muted-foreground" />
      </div>
      <CardHeader className="pr-14">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg">{exercise.exerciseName}</CardTitle>
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={onRemove}
            disabled={isDragging}
            className="pointer-events-auto"
          >
            Remove
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {exercise.sets.map((set, setIndex) => (
          <div key={setIndex} className="space-y-2">
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">#{setIndex + 1}</span>
              <Input
                type="number"
                placeholder="Reps"
                value={set.reps || ""}
                onChange={(e) => onUpdateSet(setIndex, "reps", parseInt(e.target.value) || 0)}
                className="w-[100px]"
                min="0"
                disabled={isDragging}
              />
              <div className="relative w-[100px]">
                <Input
                  type="number"
                  placeholder={set.isBodyweight ? "Extra" : "Weight"}
                  value={set.weight || ""}
                  onChange={(e) => onUpdateSet(setIndex, "weight", parseFloat(e.target.value) || 0)}
                  className="pr-11"
                  min="0"
                  step="0.5"
                  disabled={isDragging}
                />
                <button
                  onClick={() => onToggleBodyweight(setIndex)}
                  disabled={isDragging}
                  className={`absolute right-0.5 top-1/2 -translate-y-1/2 h-8 w-9 text-xs font-medium rounded transition-colors ${
                    set.isBodyweight 
                      ? "bg-primary text-primary-foreground" 
                      : "text-muted-foreground hover:text-foreground"
                  } disabled:opacity-50 disabled:cursor-not-allowed`}
                >
                  BW
                </button>
              </div>
              <button
                onClick={() => onDuplicateSet(setIndex)}
                disabled={isDragging}
                className="p-2 hover:bg-accent rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Copy className="h-4 w-4" />
              </button>
              <button
                onClick={() => onRemoveSet(setIndex)}
                disabled={isDragging}
                className="p-2 hover:bg-accent rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <span className="text-xl font-light">−</span>
              </button>
            </div>
          </div>
        ))}
        <Button 
          variant="outline" 
          size="sm" 
          className="w-full" 
          onClick={onAddSet}
          disabled={isDragging}
        >
          <Plus className="h-4 w-4 mr-2" />
          Add Set
        </Button>
      </CardContent>
    </Card>
  );
};

const ActiveWorkout = () => {
  const { templateId } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [workoutName, setWorkoutName] = useState("");
  const [exercises, setExercises] = useState<ExerciseSet[]>([]);
  const [showExerciseSelector, setShowExerciseSelector] = useState(false);
  const [startTime] = useState(Date.now());
  const [showCompleteDialog, setShowCompleteDialog] = useState(false);
  const [completionName, setCompletionName] = useState("");
  const [saveAsTemplate, setSaveAsTemplate] = useState(false);
  const [isCompleting, setIsCompleting] = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  useEffect(() => {
    if (!user) {
      navigate("/auth");
      return;
    }

    if (templateId && templateId !== "new") {
      loadTemplate();
    } else {
      setWorkoutName("Quick Workout");
    }
  }, [templateId, user, navigate]);

  const loadTemplate = async () => {
    try {
      const { data: template, error: templateError } = await supabase
        .from("workout_templates")
        .select("name")
        .eq("id", templateId)
        .single();

      if (templateError) throw templateError;

      const { data: templateExercises, error: exercisesError } = await supabase
        .from("template_exercises")
        .select("exercise_name")
        .eq("template_id", templateId)
        .order("order_index");

      if (exercisesError) throw exercisesError;

      setWorkoutName(template.name);
      setExercises(
        templateExercises.map((ex) => ({
          id: crypto.randomUUID(),
          exerciseName: ex.exercise_name,
          sets: [{ reps: 0, weight: 0, isBodyweight: false }],
        }))
      );
    } catch (error: any) {
      toast.error("Failed to load workout template");
      navigate("/");
    }
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      setExercises((items) => {
        const oldIndex = items.findIndex((item) => item.id === active.id);
        const newIndex = items.findIndex((item) => item.id === over.id);
        return arrayMove(items, oldIndex, newIndex);
      });
    }
  };

  const addExercise = (exerciseName: string) => {
    setExercises([
      ...exercises,
      { id: crypto.randomUUID(), exerciseName, sets: [{ reps: 0, weight: 0, isBodyweight: false }] },
    ]);
    setShowExerciseSelector(false);
  };

  const addSet = (exerciseIndex: number) => {
    const newExercises = [...exercises];
    newExercises[exerciseIndex].sets.push({ reps: 0, weight: 0, isBodyweight: false });
    setExercises(newExercises);
  };

  const duplicateSet = (exerciseIndex: number, setIndex: number) => {
    const newExercises = [...exercises];
    const setToDuplicate = newExercises[exerciseIndex].sets[setIndex];
    newExercises[exerciseIndex].sets.push({ ...setToDuplicate });
    setExercises(newExercises);
  };

  const removeSet = (exerciseIndex: number, setIndex: number) => {
    const newExercises = [...exercises];
    if (newExercises[exerciseIndex].sets.length === 1) {
      toast.error("Cannot remove the last set. Remove the exercise instead.");
      return;
    }
    newExercises[exerciseIndex].sets.splice(setIndex, 1);
    setExercises(newExercises);
  };

  const updateSet = (
    exerciseIndex: number,
    setIndex: number,
    field: "reps" | "weight",
    value: number
  ) => {
    const newExercises = [...exercises];
    newExercises[exerciseIndex].sets[setIndex][field] = value;
    setExercises(newExercises);
  };

  const toggleBodyweight = (exerciseIndex: number, setIndex: number) => {
    const newExercises = [...exercises];
    newExercises[exerciseIndex].sets[setIndex].isBodyweight = 
      !newExercises[exerciseIndex].sets[setIndex].isBodyweight;
    setExercises(newExercises);
  };

  const removeExercise = (exerciseIndex: number) => {
    setExercises(exercises.filter((_, i) => i !== exerciseIndex));
  };

  const initiateComplete = () => {
    if (exercises.length === 0) {
      toast.error("Add at least one exercise to complete the workout");
      return;
    }
    setCompletionName(workoutName);
    setSaveAsTemplate(false);
    setShowCompleteDialog(true);
  };

  const completeWorkout = async () => {
    if (isCompleting) return;
    
    setIsCompleting(true);
    try {
      const duration = Math.floor((Date.now() - startTime) / 1000 / 60);

      const { data: session, error: sessionError } = await supabase
        .from("workout_sessions")
        .insert({
          user_id: user!.id,
          template_id: templateId !== "new" ? templateId : null,
          name: completionName || workoutName,
          duration,
        })
        .select()
        .single();

      if (sessionError) throw sessionError;

      for (const exercise of exercises) {
        for (let i = 0; i < exercise.sets.length; i++) {
          await supabase.from("workout_sets").insert({
            session_id: session.id,
            exercise_name: exercise.exerciseName,
            set_number: i + 1,
            reps: exercise.sets[i].reps,
            weight: exercise.sets[i].weight,
          });
        }
      }

      if (saveAsTemplate && (!templateId || templateId === "new")) {
        const { data: newTemplate, error: templateError } = await supabase
          .from("workout_templates")
          .insert({
            user_id: user!.id,
            name: completionName || workoutName,
          })
          .select()
          .single();

        if (templateError) throw templateError;

        for (let i = 0; i < exercises.length; i++) {
          await supabase.from("template_exercises").insert({
            template_id: newTemplate.id,
            exercise_name: exercises[i].exerciseName,
            order_index: i,
          });
        }
      }

      toast.success("Workout completed!");
      setShowCompleteDialog(false);
      navigate("/");
    } catch (error: any) {
      toast.error("Failed to save workout");
    } finally {
      setIsCompleting(false);
    }
  };

  return (
    <div className="space-y-4 pb-24">
      <div className="sticky top-16 z-10 bg-background pb-4">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">{workoutName}</h1>
          <Button variant="ghost" size="icon" onClick={() => navigate("/")}>
            <X className="h-5 w-5" />
          </Button>
        </div>
      </div>

      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
      >
        <SortableContext
          items={exercises.map((ex) => ex.id)}
          strategy={verticalListSortingStrategy}
        >
          {exercises.map((exercise, exerciseIndex) => (
            <SortableExerciseCard
              key={exercise.id}
              exercise={exercise}
              exerciseIndex={exerciseIndex}
              onRemove={() => removeExercise(exerciseIndex)}
              onAddSet={() => addSet(exerciseIndex)}
              onDuplicateSet={(setIndex) => duplicateSet(exerciseIndex, setIndex)}
              onRemoveSet={(setIndex) => removeSet(exerciseIndex, setIndex)}
              onUpdateSet={(setIndex, field, value) =>
                updateSet(exerciseIndex, setIndex, field, value)
              }
              onToggleBodyweight={(setIndex) => toggleBodyweight(exerciseIndex, setIndex)}
            />
          ))}
        </SortableContext>
      </DndContext>

      <Button
        variant="outline"
        className="w-full"
        onClick={() => setShowExerciseSelector(true)}
      >
        <Plus className="h-4 w-4 mr-2" />
        Add Exercise
      </Button>

      {exercises.length > 0 && (
        <div className="fixed bottom-24 left-0 right-0 p-4 bg-background border-t pointer-events-none">
          <div className="container">
            <Button
              size="lg"
              className="w-full bg-accent hover:bg-accent/90 pointer-events-auto"
              onClick={initiateComplete}
            >
              <Check className="mr-2 h-5 w-5" />
              Complete Workout
            </Button>
          </div>
        </div>
      )}

      <ExerciseSelector
        open={showExerciseSelector}
        onClose={() => setShowExerciseSelector(false)}
        onSelect={addExercise}
      />

      <Dialog open={showCompleteDialog} onOpenChange={setShowCompleteDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Complete Workout</DialogTitle>
            <DialogDescription>
              Give your workout a name to save it to your history.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="workout-name">Workout Name</Label>
              <Input
                id="workout-name"
                value={completionName}
                onChange={(e) => setCompletionName(e.target.value)}
                placeholder="Enter workout name"
              />
            </div>
            {(!templateId || templateId === "new") && (
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="save-template"
                  checked={saveAsTemplate}
                  onCheckedChange={(checked) => setSaveAsTemplate(checked as boolean)}
                  className="rounded-sm"
                />
                <Label
                  htmlFor="save-template"
                  className="text-sm font-normal cursor-pointer"
                >
                  Save as template
                </Label>
              </div>
            )}
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setShowCompleteDialog(false)} disabled={isCompleting}>
              Cancel
            </Button>
            <Button onClick={completeWorkout} disabled={isCompleting}>
              {isCompleting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Completing...
                </>
              ) : (
                <>
                  <Check className="mr-2 h-4 w-4" />
                  Complete
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ActiveWorkout;
