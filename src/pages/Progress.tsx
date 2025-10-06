import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TrendingUp, TrendingDown, Minus, BarChart3 } from "lucide-react";
import { useScrollPosition } from "@/hooks/useScrollPosition";
import LoadingSpinner from "@/components/LoadingSpinner";
import { LineChart, Line, XAxis, YAxis, ResponsiveContainer } from "recharts";

interface ExerciseProgress {
  exerciseName: string;
  totalSets: number;
  maxWeight: number;
  lastWorkout: string;
  volumeHistory: number[];
  trend: "up" | "down" | "stable";
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
    setShowLoading(loading);
  }, [loading]);

  const loadProgress = async () => {
    try {
      const { data: sessions } = await supabase
        .from("workout_sessions")
        .select("id, date")
        .order("date", { ascending: false })
        .limit(10);

      if (!sessions || sessions.length === 0) {
        setLoading(false);
        return;
      }

      const sessionIds = sessions.map((s) => s.id);
      const { data: sets } = await supabase
        .from("workout_sets")
        .select("exercise_name, weight, reps, session_id")
        .in("session_id", sessionIds)
        .order("session_id", { ascending: false });

      if (!sets) {
        setLoading(false);
        return;
      }

      const exerciseMap = new Map<string, ExerciseProgress>();

      // Group sets by exercise and session
      const exerciseSessions = new Map<string, Map<string, number>>();

      sets.forEach((set) => {
        const volume = (set.weight || 0) * set.reps;
        
        if (!exerciseSessions.has(set.exercise_name)) {
          exerciseSessions.set(set.exercise_name, new Map());
        }
        
        const sessionVolumes = exerciseSessions.get(set.exercise_name)!;
        const currentVolume = sessionVolumes.get(set.session_id) || 0;
        sessionVolumes.set(set.session_id, currentVolume + volume);
      });

      // Calculate progress for each exercise
      exerciseSessions.forEach((sessionVolumes, exerciseName) => {
        const volumes = Array.from(sessionVolumes.values()).slice(0, 10);
        const exerciseSets = sets.filter(s => s.exercise_name === exerciseName);
        const maxWeight = Math.max(...exerciseSets.map(s => s.weight || 0));
        const lastSession = sessions.find(s => s.id === exerciseSets[0].session_id);
        
        // Calculate trend (compare last 3 to previous 3)
        let trend: "up" | "down" | "stable" = "stable";
        if (volumes.length >= 3) {
          const recent = volumes.slice(0, 3).reduce((a, b) => a + b, 0) / 3;
          const previous = volumes.slice(3, 6).reduce((a, b) => a + b, 0) / Math.min(3, volumes.length - 3);
          if (recent > previous * 1.05) trend = "up";
          else if (recent < previous * 0.95) trend = "down";
        }

        exerciseMap.set(exerciseName, {
          exerciseName,
          totalSets: exerciseSets.length,
          maxWeight,
          lastWorkout: lastSession?.date || "",
          volumeHistory: volumes,
          trend,
        });
      });

      // Sort by most frequently performed (totalSets) descending
      const sortedProgress = Array.from(exerciseMap.values()).sort((a, b) => b.totalSets - a.totalSets);
      setProgress(sortedProgress);
    } catch (error) {
      console.error("Error loading progress:", error);
    } finally {
      setLoading(false);
    }
  };

  if (showLoading) {
    return (
      <div className="space-y-6 pb-20">
        <h1 className="text-3xl font-bold">Your Progress</h1>
        <LoadingSpinner text="Loading your progress..." />
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
          {progress.map((exercise) => {
            const TrendIcon = exercise.trend === "up" ? TrendingUp : exercise.trend === "down" ? TrendingDown : Minus;
            const trendColor = exercise.trend === "up" ? "text-success" : exercise.trend === "down" ? "text-destructive" : "text-muted-foreground";
            const showChart = exercise.volumeHistory.length >= 5;
            const chartData = exercise.volumeHistory.map((volume, idx) => ({ volume, idx })).reverse();
            
            return (
              <Card key={exercise.exerciseName}>
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <CardTitle className="text-lg">
                      {exercise.exerciseName}
                    </CardTitle>
                    {showChart && <TrendIcon className={`h-5 w-5 ${trendColor}`} />}
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Total Sets:</span>
                    <span className="font-medium">{exercise.totalSets}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Max Weight:</span>
                    <span className="font-medium">{exercise.maxWeight} kg</span>
                  </div>
                  {showChart ? (
                    <div className="space-y-2">
                      <span className="text-sm text-muted-foreground">Volume Trend (Last 10)</span>
                      <div className="h-16 relative">
                        <div className="absolute inset-0 bg-gradient-to-b from-white/10 to-transparent rounded" />
                        <ResponsiveContainer width="100%" height="100%">
                          <LineChart data={chartData} margin={{ top: 5, right: 5, bottom: 5, left: 5 }}>
                            <XAxis dataKey="idx" hide />
                            <YAxis hide domain={['auto', 'auto']} />
                            <Line 
                              type="monotone" 
                              dataKey="volume" 
                              stroke="hsl(var(--primary))" 
                              strokeWidth={2}
                              dot={false}
                            />
                          </LineChart>
                        </ResponsiveContainer>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <div className="flex flex-col items-center justify-center py-6 text-center">
                        <BarChart3 className="h-12 w-12 text-muted-foreground/30 mb-2" />
                        <p className="text-sm text-muted-foreground">
                          Complete 5 workouts to see progression
                        </p>
                        <p className="text-xs text-muted-foreground/60 mt-1">
                          {exercise.volumeHistory.length}/5 completed
                        </p>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default Progress;
