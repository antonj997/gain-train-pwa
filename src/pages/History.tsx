import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { formatDistanceToNow, startOfWeek, endOfWeek, eachDayOfInterval, format, isSameDay, addWeeks, subWeeks } from "date-fns";
import { Calendar, Dumbbell, TrendingUp, Clock, Target, ChevronLeft, ChevronRight, Trash2 } from "lucide-react";
import { useScrollPosition } from "@/hooks/useScrollPosition";
import LoadingSpinner from "@/components/LoadingSpinner";
import { useToast } from "@/hooks/use-toast";

interface WorkoutSession {
  id: string;
  name: string;
  date: string;
  duration: number | null;
}

interface WorkoutSet {
  exercise_name: string;
  set_number: number;
  reps: number;
  weight: number | null;
}

interface WorkoutDetail {
  id: string;
  session: WorkoutSession;
  sets: WorkoutSet[];
}

const History = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [sessions, setSessions] = useState<WorkoutSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [showLoading, setShowLoading] = useState(false);
  const [selectedWeek, setSelectedWeek] = useState(new Date());
  const [selectedWorkout, setSelectedWorkout] = useState<WorkoutDetail | null>(null);
  const [trendStats, setTrendStats] = useState({
    totalWorkouts: 0,
    avgDuration: 0,
    totalSets: 0,
  });
  useScrollPosition();

  useEffect(() => {
    if (!user) {
      navigate("/auth");
      return;
    }
    loadSessions();
  }, [user, navigate]);

  useEffect(() => {
    if (sessions.length > 0) {
      calculateWeekStats();
    }
  }, [selectedWeek, sessions]);

  useEffect(() => {
    setShowLoading(loading);
  }, [loading]);

  const loadSessions = async () => {
    try {
      const { data, error } = await supabase
        .from("workout_sessions")
        .select("*")
        .order("date", { ascending: false });

      if (error) throw error;
      setSessions(data || []);
    } catch (error) {
      console.error("Error loading sessions:", error);
    } finally {
      setLoading(false);
    }
  };

  const calculateWeekStats = async () => {
    const weekSessions = getWeekSessions();
    
    if (weekSessions.length === 0) {
      setTrendStats({
        totalWorkouts: 0,
        avgDuration: 0,
        totalSets: 0,
      });
      return;
    }

    const totalDuration = weekSessions.reduce((sum, s) => sum + (s.duration || 0), 0);
    
    // Get total sets from week sessions
    const sessionIds = weekSessions.map(s => s.id);
    const { data: setsData } = await supabase
      .from("workout_sets")
      .select("id")
      .in("session_id", sessionIds);

    setTrendStats({
      totalWorkouts: weekSessions.length,
      avgDuration: weekSessions.length > 0 ? Math.round(totalDuration / weekSessions.length) : 0,
      totalSets: setsData?.length || 0,
    });
  };

  const getWeekDays = () => {
    const start = startOfWeek(selectedWeek, { weekStartsOn: 1 });
    const end = endOfWeek(selectedWeek, { weekStartsOn: 1 });
    return eachDayOfInterval({ start, end });
  };

  const hasWorkoutOnDay = (day: Date) => {
    return sessions.some(session => isSameDay(new Date(session.date), day));
  };

  const getWeekSessions = () => {
    const start = startOfWeek(selectedWeek, { weekStartsOn: 1 });
    const end = endOfWeek(selectedWeek, { weekStartsOn: 1 });
    return sessions.filter(session => {
      const sessionDate = new Date(session.date);
      return sessionDate >= start && sessionDate <= end;
    });
  };

  const handlePreviousWeek = () => {
    setSelectedWeek(prev => subWeeks(prev, 1));
  };

  const handleNextWeek = () => {
    setSelectedWeek(prev => addWeeks(prev, 1));
  };

  const loadWorkoutDetails = async (sessionId: string) => {
    try {
      const { data: sessionData } = await supabase
        .from("workout_sessions")
        .select("*")
        .eq("id", sessionId)
        .single();

      const { data: setsData } = await supabase
        .from("workout_sets")
        .select("*")
        .eq("session_id", sessionId)
        .order("exercise_name")
        .order("set_number");

      if (sessionData && setsData) {
        setSelectedWorkout({
          id: sessionId,
          session: sessionData,
          sets: setsData,
        });
      }
    } catch (error) {
      console.error("Error loading workout details:", error);
    }
  };

  const handleDeleteWorkout = async (sessionId: string) => {
    try {
      const { error } = await supabase
        .from("workout_sessions")
        .delete()
        .eq("id", sessionId);

      if (error) throw error;

      toast({
        title: "Workout deleted",
        description: "Your workout has been removed from history.",
      });

      setSelectedWorkout(null);
      loadSessions();
    } catch (error) {
      console.error("Error deleting workout:", error);
      toast({
        title: "Error",
        description: "Failed to delete workout. Please try again.",
        variant: "destructive",
      });
    }
  };

  const groupSetsByExercise = (sets: WorkoutSet[]) => {
    const grouped: { [key: string]: WorkoutSet[] } = {};
    sets.forEach(set => {
      if (!grouped[set.exercise_name]) {
        grouped[set.exercise_name] = [];
      }
      grouped[set.exercise_name].push(set);
    });
    return grouped;
  };

  return (
    <div className="space-y-6 pb-20">
      <h1 className="text-3xl font-bold">Workout History</h1>

      {showLoading ? (
        <LoadingSpinner text="Loading your workout history..." />
      ) : (
        <>
          {sessions.length > 0 && (
            <>
              {/* Trend Stats */}
              <div className="grid grid-cols-3 gap-3">
                <Card>
                  <CardContent className="pt-6">
                    <div className="text-center">
                      <TrendingUp className="h-5 w-5 mx-auto mb-2 text-primary" />
                      <div className="text-2xl font-bold">{trendStats.totalWorkouts}</div>
                      <p className="text-xs text-muted-foreground">Workouts</p>
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-6">
                    <div className="text-center">
                      <Clock className="h-5 w-5 mx-auto mb-2 text-accent" />
                      <div className="text-2xl font-bold">{trendStats.avgDuration}</div>
                      <p className="text-xs text-muted-foreground">Avg. Min</p>
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-6">
                    <div className="text-center">
                      <Target className="h-5 w-5 mx-auto mb-2 text-success" />
                      <div className="text-2xl font-bold">{trendStats.totalSets}</div>
                      <p className="text-xs text-muted-foreground">Total Sets</p>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Week Calendar */}
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base">
                      {format(startOfWeek(selectedWeek, { weekStartsOn: 1 }), "MMM d")} - {format(endOfWeek(selectedWeek, { weekStartsOn: 1 }), "MMM d, yyyy")}
                    </CardTitle>
                    <div className="flex gap-2">
                      <Button size="icon" variant="ghost" onClick={handlePreviousWeek}>
                        <ChevronLeft className="h-4 w-4" />
                      </Button>
                      <Button size="icon" variant="ghost" onClick={handleNextWeek}>
                        <ChevronRight className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-7 gap-2">
                    {getWeekDays().map((day, index) => {
                      const hasWorkout = hasWorkoutOnDay(day);
                      return (
                        <div key={index} className="text-center">
                          <div className="text-xs text-muted-foreground mb-1">
                            {format(day, "EEE")}
                          </div>
                          <div
                            className={`aspect-square rounded-lg flex items-center justify-center text-sm font-medium ${
                              hasWorkout
                                ? "bg-primary text-primary-foreground"
                                : "bg-muted text-muted-foreground"
                            }`}
                          >
                            {format(day, "d")}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
            </>
          )}

          {sessions.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <Calendar className="h-12 w-12 text-muted-foreground mb-4" />
                <p className="text-muted-foreground text-center">
                  No workouts yet. Start your first workout to see it here!
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {getWeekSessions().map((session) => (
                <Card 
                  key={session.id} 
                  className="hover:bg-accent/5 transition-colors cursor-pointer"
                  onClick={() => loadWorkoutDetails(session.id)}
                >
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between">
                      <div>
                        <CardTitle className="text-lg">{session.name}</CardTitle>
                        <p className="text-sm text-muted-foreground mt-1">
                          {formatDistanceToNow(new Date(session.date), {
                            addSuffix: true,
                          })}
                        </p>
                      </div>
                      <Dumbbell className="h-5 w-5 text-primary" />
                    </div>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-muted-foreground">
                      Duration: {session.duration ? (session.duration === 0 ? "< 1 min" : `${session.duration} min`) : "Unknown"}
                    </p>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}

          {/* Workout Details Dialog */}
          <Dialog open={!!selectedWorkout} onOpenChange={() => setSelectedWorkout(null)}>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <div className="flex items-center justify-between pr-6">
                  <DialogTitle>{selectedWorkout?.session.name}</DialogTitle>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => selectedWorkout && handleDeleteWorkout(selectedWorkout.id)}
                    className="text-destructive hover:text-destructive hover:bg-destructive/10"
                  >
                    <Trash2 className="h-5 w-5" />
                  </Button>
                </div>
              </DialogHeader>
              <div className="space-y-4">
                {selectedWorkout && (
                  <>
                    <div className="text-sm text-muted-foreground">
                      {format(new Date(selectedWorkout.session.date), "MMMM d, yyyy")}
                      {selectedWorkout.session.duration && ` • ${selectedWorkout.session.duration} min`}
                    </div>
                    {Object.entries(groupSetsByExercise(selectedWorkout.sets)).map(([exercise, sets]) => (
                      <div key={exercise} className="space-y-2">
                        <h4 className="font-medium">{exercise}</h4>
                        <div className="text-sm space-y-1">
                          {sets.map((set) => (
                            <div key={set.set_number} className="flex justify-between text-muted-foreground">
                              <span>Set {set.set_number}</span>
                              <span>{set.reps} reps × {set.weight || 0} kg</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </>
                )}
              </div>
            </DialogContent>
          </Dialog>
        </>
      )}
    </div>
  );
};

export default History;
