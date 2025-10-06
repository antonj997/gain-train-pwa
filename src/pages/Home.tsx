import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Plus, Play, Dumbbell } from "lucide-react";
import { toast } from "sonner";
import { useScrollPosition } from "@/hooks/useScrollPosition";
import LoadingSpinner from "@/components/LoadingSpinner";

interface WorkoutTemplate {
  id: string;
  name: string;
  created_at: string;
}

const Home = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [templates, setTemplates] = useState<WorkoutTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [showLoading, setShowLoading] = useState(false);
  useScrollPosition();

  useEffect(() => {
    if (!user) {
      navigate("/auth");
      return;
    }
    loadTemplates();
  }, [user, navigate]);

  useEffect(() => {
    setShowLoading(loading);
  }, [loading]);

  const loadTemplates = async () => {
    try {
      const { data, error } = await supabase
        .from("workout_templates")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;
      setTemplates(data || []);
    } catch (error: any) {
      toast.error("Failed to load workout templates");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6 pb-20">
      {/* Welcome Section */}
      <div>
        <h1 className="text-3xl font-bold">Welcome Back!</h1>
        <p className="text-muted-foreground">All aboard the gain train!</p>
      </div>

      {/* Quick Start */}
      <Button
        size="lg"
        className="w-full relative p-[2px] bg-gradient-to-br from-[hsl(270,83%,58%)] to-[hsl(225,83%,58%)] rounded-lg h-auto"
        onClick={() => navigate("/workout/new")}
      >
        <span className="flex items-center justify-center w-full bg-background text-foreground hover:bg-background/90 rounded-md px-6 py-3 transition-colors">
          <Plus className="mr-2 h-5 w-5" />
          Start New Workout
        </span>
      </Button>

      {/* Saved Templates */}
      <div>
        <h2 className="text-xl font-semibold mb-4">Your Workout Plans</h2>
        {showLoading ? (
          <LoadingSpinner text="Loading your workout plans..." />
        ) : templates.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <Dumbbell className="h-12 w-12 text-muted-foreground mb-4" />
              <p className="text-muted-foreground text-center mb-4">
                No workout plans yet.
                <br />
                Create your first workout to get started!
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {templates.map((template) => (
              <Card
                key={template.id}
                className="hover:bg-accent/5 transition-colors cursor-pointer"
                onClick={() => navigate(`/workout/${template.id}`)}
              >
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-lg">{template.name}</CardTitle>
                    <Button size="icon" variant="ghost">
                      <Play className="h-4 w-4" />
                    </Button>
                  </div>
                </CardHeader>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default Home;
