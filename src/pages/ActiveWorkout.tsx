import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Plus, Check, X } from "lucide-react";
import { toast } from "sonner";
import ExerciseSelector from "@/components/ExerciseSelector";

interface ExerciseSet {
  exerciseName: string;
  sets: { reps: number; weight: number }[];
}

const ActiveWorkout = () => {
  const { templateId } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [workoutName, setWorkoutName] = useState("");
  const [exercises, setExercises] = useState<ExerciseSet[]>([]);
  const [showExerciseSelector, setShowExerciseSelector] = useState(false);
  const [startTime] = useState(Date.now());

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
          exerciseName: ex.exercise_name,
          sets: [{ reps: 0, weight: 0 }],
        }))
      );
    } catch (error: any) {
      toast.error("Failed to load workout template");
      navigate("/");
    }
  };

  const addExercise = (exerciseName: string) => {
    setExercises([
      ...exercises,
      { exerciseName, sets: [{ reps: 0, weight: 0 }] },
    ]);
    setShowExerciseSelector(false);
  };

  const addSet = (exerciseIndex: number) => {
    const newExercises = [...exercises];
    newExercises[exerciseIndex].sets.push({ reps: 0, weight: 0 });
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

  const removeExercise = (exerciseIndex: number) => {
    setExercises(exercises.filter((_, i) => i !== exerciseIndex));
  };

  const completeWorkout = async (saveAsTemplate: boolean) => {
    if (exercises.length === 0) {
      toast.error("Add at least one exercise to complete the workout");
      return;
    }

    try {
      const duration = Math.floor((Date.now() - startTime) / 1000 / 60);

      const { data: session, error: sessionError } = await supabase
        .from("workout_sessions")
        .insert({
          user_id: user!.id,
          template_id: templateId !== "new" ? templateId : null,
          name: workoutName,
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
            name: workoutName,
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
      navigate("/");
    } catch (error: any) {
      toast.error("Failed to save workout");
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

      {exercises.map((exercise, exerciseIndex) => (
        <Card key={exerciseIndex}>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg">{exercise.exerciseName}</CardTitle>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => removeExercise(exerciseIndex)}
              >
                Remove
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {exercise.sets.map((set, setIndex) => (
              <div key={setIndex} className="flex items-center gap-3">
                <span className="text-sm font-medium w-8">#{setIndex + 1}</span>
                <div className="flex-1 space-y-1">
                  <Label className="text-xs">Reps</Label>
                  <Input
                    type="number"
                    value={set.reps || ""}
                    onChange={(e) =>
                      updateSet(
                        exerciseIndex,
                        setIndex,
                        "reps",
                        parseInt(e.target.value) || 0
                      )
                    }
                    min="0"
                  />
                </div>
                <div className="flex-1 space-y-1">
                  <Label className="text-xs">Weight (kg)</Label>
                  <Input
                    type="number"
                    value={set.weight || ""}
                    onChange={(e) =>
                      updateSet(
                        exerciseIndex,
                        setIndex,
                        "weight",
                        parseFloat(e.target.value) || 0
                      )
                    }
                    min="0"
                    step="0.5"
                  />
                </div>
              </div>
            ))}
            <Button
              variant="outline"
              size="sm"
              className="w-full"
              onClick={() => addSet(exerciseIndex)}
            >
              <Plus className="h-4 w-4 mr-2" />
              Add Set
            </Button>
          </CardContent>
        </Card>
      ))}

      <Button
        variant="outline"
        className="w-full"
        onClick={() => setShowExerciseSelector(true)}
      >
        <Plus className="h-4 w-4 mr-2" />
        Add Exercise
      </Button>

      <div className="fixed bottom-20 left-0 right-0 p-4 bg-background border-t">
        <div className="container space-y-2">
          <Button
            size="lg"
            className="w-full bg-accent hover:bg-accent/90"
            onClick={() => completeWorkout(false)}
          >
            <Check className="mr-2 h-5 w-5" />
            Complete Workout
          </Button>
          {(!templateId || templateId === "new") && exercises.length > 0 && (
            <Button
              size="lg"
              variant="outline"
              className="w-full"
              onClick={() => completeWorkout(true)}
            >
              Complete & Save as Template
            </Button>
          )}
        </div>
      </div>

      <ExerciseSelector
        open={showExerciseSelector}
        onClose={() => setShowExerciseSelector(false)}
        onSelect={addExercise}
      />
    </div>
  );
};

export default ActiveWorkout;
