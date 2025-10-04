import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TrendingUp, Activity } from "lucide-react";
import { useScrollPosition } from "@/hooks/useScrollPosition";

interface ExerciseProgress {
  exerciseName: string;
  totalSets: number;
  maxWeight: number;
  lastWorkout: string;
}

const Progress = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [progress, setProgress] = useState<ExerciseProgress[]>([]);
  const [loading, setLoading] = useState(true);
  const [showLoading, setShowLoading] = useState(false);
  useScrollPosition();

  useEffect(() => {
    if (!user) {
      navigate("/auth");
      return;
    }
    loadProgress();
  }, [user, navigate]);

  useEffect(() => {
    // Only show loading screen if data takes longer than 200ms to load
    const timer = setTimeout(() => {
      if (loading) {
        setShowLoading(true);
      }
    }, 200);

    return () => clearTimeout(timer);
  }, [loading]);

  const loadProgress = async () => {
    try {
      const { data: sessions } = await supabase
        .from("workout_sessions")
        .select("id, date")
        .order("date", { ascending: false });

      if (!sessions || sessions.length === 0) {
        setLoading(false);
        return;
      }

      const sessionIds = sessions.map((s) => s.id);
      const { data: sets } = await supabase
        .from("workout_sets")
        .select("exercise_name, weight, session_id")
        .in("session_id", sessionIds);

      if (!sets) {
        setLoading(false);
        return;
      }

      const exerciseMap = new Map<string, ExerciseProgress>();

      sets.forEach((set) => {
        const existing = exerciseMap.get(set.exercise_name);
        const session = sessions.find((s) => s.id === set.session_id);

        if (!existing) {
          exerciseMap.set(set.exercise_name, {
            exerciseName: set.exercise_name,
            totalSets: 1,
            maxWeight: set.weight || 0,
            lastWorkout: session?.date || "",
          });
        } else {
          existing.totalSets++;
          existing.maxWeight = Math.max(existing.maxWeight, set.weight || 0);
          exerciseMap.set(set.exercise_name, existing);
        }
      });

      setProgress(Array.from(exerciseMap.values()));
    } catch (error) {
      console.error("Error loading progress:", error);
    } finally {
      setLoading(false);
    }
  };

  if (showLoading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="text-muted-foreground">Loading...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-20">
      <h1 className="text-3xl font-bold">Your Progress</h1>

      {progress.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <TrendingUp className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-muted-foreground text-center">
              Complete workouts to track your progress over time!
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {progress.map((exercise) => (
            <Card key={exercise.exerciseName}>
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <CardTitle className="text-lg">
                    {exercise.exerciseName}
                  </CardTitle>
                  <Activity className="h-5 w-5 text-accent" />
                </div>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Total Sets:</span>
                  <span className="font-medium">{exercise.totalSets}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Max Weight:</span>
                  <span className="font-medium">{exercise.maxWeight} kg</span>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};

export default Progress;
