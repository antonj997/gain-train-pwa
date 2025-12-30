import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Plus, Dumbbell, Trash2, Pencil } from "lucide-react";
import { toast } from "sonner";
import { useScrollPosition } from "@/hooks/useScrollPosition";
import LoadingSpinner from "@/components/LoadingSpinner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface Exercise {
  id: string;
  name: string;
  category: string | null;
  note: string | null;
  user_id: string | null;
}

const BODY_PARTS = [
  "Chest",
  "Back",
  "Shoulders",
  "Arms",
  "Legs",
  "Core",
  "Cardio",
  "Other",
];

const MyExercises = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [exerciseToDelete, setExerciseToDelete] = useState<string | null>(null);
  const [formDialogOpen, setFormDialogOpen] = useState(false);
  const [editingExercise, setEditingExercise] = useState<Exercise | null>(null);
  const [formData, setFormData] = useState({
    name: "",
    category: "",
    note: "",
  });
  const [saving, setSaving] = useState(false);
  useScrollPosition();

  useEffect(() => {
    if (!user) {
      navigate("/auth");
      return;
    }
    loadExercises();
  }, [user, navigate]);

  const loadExercises = async () => {
    try {
      const { data, error } = await supabase
        .from("exercises")
        .select("*")
        .eq("user_id", user?.id)
        .order("name", { ascending: true });

      if (error) throw error;
      setExercises(data || []);
    } catch (error: any) {
      toast.error("Failed to load exercises");
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteExercise = async () => {
    if (!exerciseToDelete) return;

    try {
      const { error } = await supabase
        .from("exercises")
        .delete()
        .eq("id", exerciseToDelete);

      if (error) throw error;

      toast.success("Exercise deleted");
      loadExercises();
    } catch (error: any) {
      toast.error("Failed to delete exercise");
    } finally {
      setDeleteDialogOpen(false);
      setExerciseToDelete(null);
    }
  };

  const openCreateForm = () => {
    setEditingExercise(null);
    setFormData({ name: "", category: "", note: "" });
    setFormDialogOpen(true);
  };

  const openEditForm = (exercise: Exercise) => {
    setEditingExercise(exercise);
    setFormData({
      name: exercise.name,
      category: exercise.category || "",
      note: exercise.note || "",
    });
    setFormDialogOpen(true);
  };

  const handleSaveExercise = async () => {
    if (!formData.name.trim()) {
      toast.error("Exercise name is required");
      return;
    }
    if (!formData.category) {
      toast.error("Body part is required");
      return;
    }

    setSaving(true);
    try {
      if (editingExercise) {
        const { error } = await supabase
          .from("exercises")
          .update({
            name: formData.name.trim(),
            category: formData.category,
            note: formData.note.trim() || null,
          })
          .eq("id", editingExercise.id);

        if (error) throw error;
        toast.success("Exercise updated");
      } else {
        const { error } = await supabase.from("exercises").insert({
          name: formData.name.trim(),
          category: formData.category,
          note: formData.note.trim() || null,
          user_id: user?.id,
        });

        if (error) throw error;
        toast.success("Exercise created");
      }

      setFormDialogOpen(false);
      loadExercises();
    } catch (error: any) {
      toast.error(editingExercise ? "Failed to update exercise" : "Failed to create exercise");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6 pb-20">
      <div className="mt-2">
        <h1 className="text-3xl font-bold">My Exercises</h1>
        <p className="text-muted-foreground">Manage your custom exercises</p>
      </div>

      <Button
        size="lg"
        className="w-full relative p-[2px] bg-gradient-to-br from-[hsl(270,83%,58%)] to-[hsl(225,83%,58%)] rounded-lg h-auto"
        onClick={openCreateForm}
      >
        <span className="flex items-center justify-center w-full bg-background text-foreground md:hover:bg-background/90 rounded-md px-6 py-3 transition-colors">
          <Plus className="mr-2 h-5 w-5" />
          Create New Exercise
        </span>
      </Button>

      <div>
        <h2 className="text-xl font-semibold mb-4">Your Custom Exercises</h2>
        {loading ? (
          <LoadingSpinner text="Loading your exercises..." />
        ) : exercises.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <Dumbbell className="h-12 w-12 text-muted-foreground mb-4" />
              <p className="text-muted-foreground text-center mb-4">
                No custom exercises yet.
                <br />
                Create your first exercise to get started!
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {exercises.map((exercise) => (
              <Card
                key={exercise.id}
                className="md:hover:bg-accent/5 transition-colors"
              >
                <CardHeader className="pb-3 pt-3">
                  <div className="flex items-center gap-3">
                    <div className="flex-1">
                      <CardTitle className="text-lg">{exercise.name}</CardTitle>
                      <p className="text-sm text-muted-foreground">
                        {exercise.category}
                        {exercise.note && ` • ${exercise.note}`}
                      </p>
                    </div>
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => openEditForm(exercise)}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => {
                        setExerciseToDelete(exercise.id);
                        setDeleteDialogOpen(true);
                      }}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </CardHeader>
              </Card>
            ))}
          </div>
        )}
      </div>

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Exercise</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this exercise? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteExercise}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={formDialogOpen} onOpenChange={setFormDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingExercise ? "Edit Exercise" : "Create Exercise"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Name *</Label>
              <Input
                id="name"
                placeholder="Exercise name"
                value={formData.name}
                onChange={(e) =>
                  setFormData({ ...formData, name: e.target.value })
                }
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="category">Body Part *</Label>
              <Select
                value={formData.category}
                onValueChange={(value) =>
                  setFormData({ ...formData, category: value })
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select body part" />
                </SelectTrigger>
                <SelectContent>
                  {BODY_PARTS.map((part) => (
                    <SelectItem key={part} value={part}>
                      {part}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="note">Note</Label>
              <Textarea
                id="note"
                placeholder="Optional notes about this exercise..."
                value={formData.note}
                onChange={(e) =>
                  setFormData({ ...formData, note: e.target.value })
                }
                rows={3}
              />
            </div>
            <Button
              className="w-full"
              onClick={handleSaveExercise}
              disabled={saving}
            >
              {saving ? "Saving..." : editingExercise ? "Update Exercise" : "Create Exercise"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default MyExercises;
