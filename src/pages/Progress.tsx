import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TrendingUp, Activity, BarChart3 } from "lucide-react";
import { useScrollPosition } from "@/hooks/useScrollPosition";
import LoadingSpinner from "@/components/LoadingSpinner";
import { LineChart, Line, XAxis, YAxis, ResponsiveContainer, Scatter, Bar, ComposedChart, Tooltip, CartesianGrid } from "recharts";
import { useTheme } from "@/contexts/ThemeContext";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

interface SetData {
  weight: number;
  reps: number;
  date: string;
}

interface ExerciseProgress {
  exerciseName: string;
  latestE1RM: number;
  delta7Day: number;
  delta30Day: number;
  uniqueDates: number;
  maxWeight: number;
  weeklyData: {
    week: string;
    weekStart: Date;
    topE1RM: number;
    volume: number;
    isPR: boolean;
  }[];
  rollingAverage: number[];
}

// Epley formula: e1RM = weight × (1 + reps/30)
// Cap reps at 10 to avoid overestimation
const calculateE1RM = (weight: number, reps: number): number => {
  const cappedReps = Math.min(reps, 10);
  return weight * (1 + cappedReps / 30);
};

const Progress = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { theme } = useTheme();
  const [progress, setProgress] = useState<ExerciseProgress[]>([]);
  const [loading, setLoading] = useState(true);
  const [showLoading, setShowLoading] = useState(false);
  const [selectedExercise, setSelectedExercise] = useState<ExerciseProgress | null>(null);
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
        .order("date", { ascending: false });

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

      // Create session date map
      const sessionDateMap = new Map(sessions.map((s) => [s.id, s.date]));

      // Group sets by exercise
      const exerciseMap = new Map<string, SetData[]>();

      sets.forEach((set) => {
        const date = sessionDateMap.get(set.session_id);
        if (!date) return;

        if (!exerciseMap.has(set.exercise_name)) {
          exerciseMap.set(set.exercise_name, []);
        }

        exerciseMap.get(set.exercise_name)!.push({
          weight: set.weight || 0,
          reps: set.reps,
          date,
        });
      });

      const progressData: ExerciseProgress[] = [];

      exerciseMap.forEach((setData, exerciseName) => {
        // Calculate unique workout dates to determine if we should show charts
        const uniqueDates = new Set(setData.map(s => s.date)).size;

        // Calculate e1RM for each set
        const setsWithE1RM = setData.map((set) => ({
          ...set,
          e1rm: calculateE1RM(set.weight, set.reps),
          date: new Date(set.date),
        }));

        // Calculate recent max e1RM for warm-up exclusion threshold (50% cutoff)
        const recentSets = setsWithE1RM.slice(0, 30);
        const recentMaxE1RM = Math.max(...recentSets.map((s) => s.e1rm));
        const warmupThreshold = recentMaxE1RM * 0.5;

        // Filter out warm-up sets
        const workingSets = setsWithE1RM.filter((s) => s.e1rm >= warmupThreshold);

        if (workingSets.length === 0) return;

        // Group by week
        const weeklyMap = new Map<string, { topE1RM: number; volume: number; weekStart: Date }>();

        workingSets.forEach((set) => {
          // Get Monday of the week
          const weekStart = new Date(set.date);
          const day = weekStart.getDay();
          const diff = weekStart.getDate() - day + (day === 0 ? -6 : 1);
          weekStart.setDate(diff);
          weekStart.setHours(0, 0, 0, 0);

          const weekKey = weekStart.toISOString().split("T")[0];

          if (!weeklyMap.has(weekKey)) {
            weeklyMap.set(weekKey, { topE1RM: 0, volume: 0, weekStart });
          }

          const week = weeklyMap.get(weekKey)!;
          week.topE1RM = Math.max(week.topE1RM, set.e1rm);
          week.volume += set.weight * set.reps;
        });

        // Convert to array and sort by date
        const weeklyData = Array.from(weeklyMap.entries())
          .map(([week, data]) => ({
            week,
            weekStart: data.weekStart,
            topE1RM: data.topE1RM,
            volume: data.volume,
            isPR: false,
          }))
          .sort((a, b) => a.weekStart.getTime() - b.weekStart.getTime());

        // Mark PRs
        let maxE1RM = 0;
        weeklyData.forEach((week) => {
          if (week.topE1RM > maxE1RM) {
            week.isPR = true;
            maxE1RM = week.topE1RM;
          }
        });

        // Calculate 4-week rolling average
        const rollingAverage: number[] = [];
        for (let i = 0; i < weeklyData.length; i++) {
          const start = Math.max(0, i - 3);
          const windowData = weeklyData.slice(start, i + 1);
          const avg = windowData.reduce((sum, w) => sum + w.topE1RM, 0) / windowData.length;
          rollingAverage.push(avg);
        }

        // Calculate deltas
        const latestE1RM = weeklyData[weeklyData.length - 1]?.topE1RM || 0;
        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

        const e1rm7DaysAgo =
          weeklyData.find((w) => w.weekStart <= sevenDaysAgo)?.topE1RM || latestE1RM;
        const e1rm30DaysAgo =
          weeklyData.find((w) => w.weekStart <= thirtyDaysAgo)?.topE1RM || latestE1RM;

        const delta7Day = latestE1RM - e1rm7DaysAgo;
        const delta30Day = latestE1RM - e1rm30DaysAgo;

        // Calculate max weight across all sets
        const maxWeight = Math.max(...workingSets.map(s => s.weight));

        progressData.push({
          exerciseName,
          latestE1RM,
          delta7Day,
          delta30Day,
          uniqueDates,
          maxWeight,
          weeklyData: uniqueDates >= 5 ? weeklyData : [],
          rollingAverage: uniqueDates >= 5 ? rollingAverage : [],
        });
      });

      // Sort by latest e1RM descending
      const sortedProgress = progressData.sort((a, b) => b.latestE1RM - a.latestE1RM);
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
              Complete at least 5 workouts per exercise to track your progress!
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {progress.map((exercise) => {
            const chartData = exercise.weeklyData.map((week, idx) => ({
              week: week.week,
              e1rm: week.topE1RM,
              avg: exercise.rollingAverage[idx],
              volume: week.volume / 100, // Scale down for visibility
              isPR: week.isPR,
            }));

            const prData = chartData.filter((d) => d.isPR);

            return (
              <Card key={exercise.exerciseName}>
                <CardHeader className="pb-3">
                  <CardTitle className="text-lg mb-3">{exercise.exerciseName}</CardTitle>
                  <div className="grid grid-cols-4 gap-3 text-center">
                    <div>
                      <div className="text-xs text-muted-foreground mb-1">Current e1RM</div>
                      <div className="flex items-center justify-center gap-1">
                        <Activity className="h-3 w-3 text-primary" />
                        <span className="font-semibold text-sm">{exercise.latestE1RM.toFixed(1)} kg</span>
                      </div>
                    </div>
                    <div>
                      <div className="text-xs text-muted-foreground mb-1">PR</div>
                      <span className="font-semibold text-sm text-success">
                        {exercise.maxWeight > 0 ? `${exercise.maxWeight.toFixed(1)} kg` : "-"}
                      </span>
                    </div>
                    <div>
                      <div className="text-xs text-muted-foreground mb-1">7d Change</div>
                      <span
                        className={`font-semibold text-sm ${
                          exercise.delta7Day > 0
                            ? "text-success"
                            : exercise.delta7Day < 0
                            ? "text-destructive"
                            : ""
                        }`}
                      >
                        {exercise.delta7Day > 0 ? "+" : ""}
                        {exercise.delta7Day.toFixed(1)} kg
                      </span>
                    </div>
                    <div>
                      <div className="text-xs text-muted-foreground mb-1">30d Change</div>
                      <span
                        className={`font-semibold text-sm ${
                          exercise.delta30Day > 0
                            ? "text-success"
                            : exercise.delta30Day < 0
                            ? "text-destructive"
                            : ""
                        }`}
                      >
                        {exercise.delta30Day > 0 ? "+" : ""}
                        {exercise.delta30Day.toFixed(1)} kg
                      </span>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  {exercise.weeklyData.length > 0 ? (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium text-muted-foreground">Estimated 1RM Progress</span>
                        <span className="text-xs text-muted-foreground">Click to expand</span>
                      </div>
                      <div 
                        className="h-32 relative rounded-lg border bg-card cursor-pointer hover:bg-accent/5 transition-all p-2"
                        onClick={() => setSelectedExercise(exercise)}
                      >
                        <ResponsiveContainer width="100%" height="100%">
                          <ComposedChart data={chartData} margin={{ top: 10, right: 10, bottom: 20, left: 0 }}>
                            <defs>
                              <linearGradient id={`gradient-${exercise.exerciseName}`} x1="0" y1="0" x2="0" y2="1">
                                <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.8} />
                                <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0.1} />
                              </linearGradient>
                              <linearGradient id={`gradient-light-${exercise.exerciseName}`} x1="0" y1="0" x2="0" y2="1">
                                <stop offset="0%" stopColor="hsl(220, 15%, 60%)" stopOpacity={0.5} />
                                <stop offset="100%" stopColor="hsl(220, 15%, 90%)" stopOpacity={0.05} />
                              </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.3} />
                            <XAxis 
                              dataKey="week" 
                              stroke="hsl(var(--muted-foreground))"
                              fontSize={10}
                              tickLine={false}
                            />
                            <YAxis 
                              stroke="hsl(var(--muted-foreground))"
                              fontSize={10}
                              domain={["auto", "auto"]}
                              tickLine={false}
                              width={30}
                            />
                            <Tooltip 
                              contentStyle={{
                                backgroundColor: 'hsl(var(--popover))',
                                border: '1px solid hsl(var(--border))',
                                borderRadius: '6px',
                                fontSize: '12px',
                              }}
                              labelStyle={{ fontWeight: 'bold', marginBottom: '4px' }}
                            />
                            <Bar dataKey="volume" fill="hsl(var(--muted))" opacity={0.2} name="Volume (x100)" />
                            <Line
                              type="monotone"
                              dataKey="avg"
                              stroke="hsl(var(--muted-foreground))"
                              strokeWidth={1.5}
                              strokeDasharray="3 3"
                              dot={false}
                              name="4-week avg"
                            />
                            <Line
                              type="monotone"
                              dataKey="e1rm"
                              stroke={theme === "light" ? `url(#gradient-light-${exercise.exerciseName})` : `url(#gradient-${exercise.exerciseName})`}
                              strokeWidth={2.5}
                              dot={{ fill: 'hsl(var(--primary))', r: 3 }}
                              name="Estimated 1RM"
                            />
                            <Scatter
                              data={prData}
                              dataKey="e1rm"
                              fill="hsl(var(--success))"
                              shape="circle"
                              r={5}
                              name="PR"
                            />
                          </ComposedChart>
                        </ResponsiveContainer>
                      </div>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center py-6 text-center">
                      <BarChart3 className="h-8 w-8 text-muted-foreground mb-2" />
                      <p className="text-sm text-muted-foreground">
                        Complete 5 workouts to see progression
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {5 - exercise.uniqueDates} more to go
                      </p>
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Detailed Chart Dialog */}
      {selectedExercise && (
        <Dialog open={!!selectedExercise} onOpenChange={() => setSelectedExercise(null)}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>{selectedExercise.exerciseName}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="flex items-center justify-around text-center">
                <div>
                  <div className="text-2xl font-bold">{selectedExercise.latestE1RM.toFixed(1)} kg</div>
                  <div className="text-xs text-muted-foreground">Current e1RM</div>
                </div>
                <div>
                  <div className={`text-2xl font-bold ${selectedExercise.delta7Day > 0 ? 'text-success' : selectedExercise.delta7Day < 0 ? 'text-destructive' : ''}`}>
                    {selectedExercise.delta7Day > 0 ? '+' : ''}{selectedExercise.delta7Day.toFixed(1)}
                  </div>
                  <div className="text-xs text-muted-foreground">7-day change</div>
                </div>
                <div>
                  <div className={`text-2xl font-bold ${selectedExercise.delta30Day > 0 ? 'text-success' : selectedExercise.delta30Day < 0 ? 'text-destructive' : ''}`}>
                    {selectedExercise.delta30Day > 0 ? '+' : ''}{selectedExercise.delta30Day.toFixed(1)}
                  </div>
                  <div className="text-xs text-muted-foreground">30-day change</div>
                </div>
              </div>
              
              <div className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart 
                    data={selectedExercise.weeklyData.map((week, idx) => ({
                      week: new Date(week.weekStart).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
                      e1rm: week.topE1RM,
                      avg: selectedExercise.rollingAverage[idx],
                      volume: week.volume / 100,
                      isPR: week.isPR,
                    }))}
                    margin={{ top: 10, right: 10, bottom: 30, left: 10 }}
                  >
                    <defs>
                      <linearGradient id="detailGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.8} />
                        <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0.1} />
                      </linearGradient>
                      <linearGradient id="detailGradientLight" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="hsl(220, 15%, 60%)" stopOpacity={0.5} />
                        <stop offset="100%" stopColor="hsl(220, 15%, 90%)" stopOpacity={0.05} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.3} />
                    <XAxis 
                      dataKey="week" 
                      stroke="hsl(var(--muted-foreground))"
                      fontSize={12}
                      angle={-45}
                      textAnchor="end"
                      height={60}
                    />
                    <YAxis 
                      stroke="hsl(var(--muted-foreground))"
                      fontSize={12}
                      domain={["auto", "auto"]}
                    />
                    <Tooltip 
                      contentStyle={{
                        backgroundColor: 'hsl(var(--popover))',
                        border: '1px solid hsl(var(--border))',
                        borderRadius: '6px',
                      }}
                    />
                    <Bar dataKey="volume" fill="hsl(var(--muted))" opacity={0.3} />
                    <Line
                      type="monotone"
                      dataKey="avg"
                      stroke="hsl(var(--muted-foreground))"
                      strokeWidth={2}
                      strokeDasharray="5 5"
                      dot={false}
                      name="4-week avg"
                    />
                    <Line
                      type="monotone"
                      dataKey="e1rm"
                      stroke={theme === "light" ? "url(#detailGradientLight)" : "url(#detailGradient)"}
                      strokeWidth={3}
                      dot={{ fill: 'hsl(var(--primary))', r: 4 }}
                      name="e1RM"
                    />
                    <Scatter
                      data={selectedExercise.weeklyData.map((week, idx) => week.isPR ? {
                        week: new Date(week.weekStart).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
                        e1rm: week.topE1RM,
                      } : null).filter(Boolean)}
                      dataKey="e1rm"
                      fill="hsl(var(--success))"
                      shape="circle"
                      r={6}
                      name="PR"
                    />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
};

export default Progress;
