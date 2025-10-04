import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatDistanceToNow, startOfWeek, endOfWeek, eachDayOfInterval, format, isSameDay } from "date-fns";
import { Calendar, Dumbbell, TrendingUp, Clock, Target } from "lucide-react";
import { useScrollPosition } from "@/hooks/useScrollPosition";

interface WorkoutSession {
  id: string;
  name: string;
  date: string;
  duration: number | null;
}

const History = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [sessions, setSessions] = useState<WorkoutSession[]>([]);
  const [loading, setLoading] = useState(true);
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

  const loadSessions = async () => {
    try {
      const { data, error } = await supabase
        .from("workout_sessions")
        .select("*")
        .order("date", { ascending: false });

      if (error) throw error;
      setSessions(data || []);

      // Calculate trend stats from last 5 workouts
      if (data && data.length > 0) {
        const last5 = data.slice(0, 5);
        const totalDuration = last5.reduce((sum, s) => sum + (s.duration || 0), 0);
        
        // Get total sets from last 5 workouts
        const sessionIds = last5.map(s => s.id);
        const { data: setsData } = await supabase
          .from("workout_sets")
          .select("id")
          .in("session_id", sessionIds);

        setTrendStats({
          totalWorkouts: last5.length,
          avgDuration: Math.round(totalDuration / last5.length),
          totalSets: setsData?.length || 0,
        });
      }
    } catch (error) {
      console.error("Error loading sessions:", error);
    } finally {
      setLoading(false);
    }
  };

  const getWeekDays = () => {
    const now = new Date();
    const start = startOfWeek(now, { weekStartsOn: 1 });
    const end = endOfWeek(now, { weekStartsOn: 1 });
    return eachDayOfInterval({ start, end });
  };

  const hasWorkoutOnDay = (day: Date) => {
    return sessions.some(session => isSameDay(new Date(session.date), day));
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="text-muted-foreground">Loading...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-20">
      <h1 className="text-3xl font-bold">Workout History</h1>

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
              <CardTitle className="text-base">This Week</CardTitle>
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
          {sessions.map((session) => (
            <Card key={session.id} className="hover:bg-accent/5 transition-colors">
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
              {session.duration && (
                <CardContent>
                  <p className="text-sm text-muted-foreground">
                    Duration: {session.duration} minutes
                  </p>
                </CardContent>
              )}
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};

export default History;
