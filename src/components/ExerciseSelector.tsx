import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Search, Plus, ArrowLeft } from "lucide-react";
import { toast } from "sonner";

interface Exercise {
  id: string;
  name: string;
  category: string | null;
}

interface ExerciseSelectorProps {
  open: boolean;
  onClose: () => void;
  onSelect: (exerciseName: string) => void;
}

const FOCUS_AREAS = [
  "Chest",
  "Back",
  "Shoulders",
  "Arms",
  "Legs",
  "Core",
  "Cardio",
  "Other",
];

const ExerciseSelector = ({ open, onClose, onSelect }: ExerciseSelectorProps) => {
  const { user } = useAuth();
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [filteredExercises, setFilteredExercises] = useState<Exercise[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [activeFilters, setActiveFilters] = useState<string[]>([]);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    category: "",
    note: "",
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      loadExercises();
      setShowCreateForm(false);
      setActiveFilters([]);
    }
  }, [open]);

  useEffect(() => {
    let filtered = exercises;
    
    // Filter by search term
    if (searchTerm) {
      filtered = filtered.filter((ex) =>
        ex.name.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }
    
    // Filter by active focus areas
    if (activeFilters.length > 0) {
      filtered = filtered.filter((ex) =>
        activeFilters.includes(ex.category || "Other")
      );
    }
    
    const sorted = [...filtered].sort((a, b) => {
      const catA = a.category || "Other";
      const catB = b.category || "Other";
      if (catA === catB) return a.name.localeCompare(b.name);
      return catA.localeCompare(catB);
    });
    
    setFilteredExercises(sorted);
  }, [searchTerm, exercises, activeFilters]);

  const toggleFilter = (area: string) => {
    setActiveFilters((prev) =>
      prev.includes(area)
        ? prev.filter((f) => f !== area)
        : [...prev, area]
    );
  };

  const loadExercises = async () => {
    const { data } = await supabase
      .from("exercises")
      .select("*")
      .order("name");
    setExercises(data || []);
    setFilteredExercises(data || []);
  };

  const handleSelect = (exerciseName: string) => {
    onSelect(exerciseName);
    setSearchTerm("");
  };

  const handleCreateExercise = async () => {
    if (!formData.name.trim()) {
      toast.error("Exercise name is required");
      return;
    }
    if (!formData.category) {
      toast.error("Focus area is required");
      return;
    }

    setSaving(true);
    try {
      const { error } = await supabase.from("exercises").insert({
        name: formData.name.trim(),
        category: formData.category,
        note: formData.note.trim() || null,
        user_id: user?.id,
      });

      if (error) throw error;
      
      toast.success("Exercise created");
      setFormData({ name: "", category: "", note: "" });
      setShowCreateForm(false);
      loadExercises();
    } catch (error: any) {
      toast.error("Failed to create exercise");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>
            {showCreateForm ? (
              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => setShowCreateForm(false)}
                >
                  <ArrowLeft className="h-4 w-4" />
                </Button>
                Create Exercise
              </div>
            ) : (
              "Select Exercise"
            )}
          </DialogTitle>
        </DialogHeader>

        {showCreateForm ? (
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
              <Label htmlFor="category">Focus Area *</Label>
              <Select
                value={formData.category}
                onValueChange={(value) =>
                  setFormData({ ...formData, category: value })
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select focus area" />
                </SelectTrigger>
                <SelectContent>
                  {FOCUS_AREAS.map((area) => (
                    <SelectItem key={area} value={area}>
                      {area}
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
              onClick={handleCreateExercise}
              disabled={saving}
            >
              {saving ? "Creating..." : "Create Exercise"}
            </Button>
          </div>
        ) : (
          <>
            <div className="relative">
              <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search exercises..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9"
              />
            </div>
            <div className="overflow-x-auto overflow-y-hidden scrollbar-hide -mx-6 px-6">
              <div className="flex gap-2 py-1 min-w-max">
                {FOCUS_AREAS.map((area) => (
                  <Button
                    key={area}
                    variant={activeFilters.includes(area) ? "default" : "outline"}
                    size="default"
                    className="shrink-0"
                    onClick={() => toggleFilter(area)}
                  >
                    {area}
                  </Button>
                ))}
              </div>
            </div>
            <Button
              variant="outline"
              className="w-full justify-start"
              onClick={() => setShowCreateForm(true)}
            >
              <Plus className="h-4 w-4 mr-2" />
              Create Custom Exercise
            </Button>
            <div className="flex-1 overflow-y-auto">
              {filteredExercises.map((exercise, idx) => {
                const prevCategory = idx > 0 ? filteredExercises[idx - 1].category : null;
                const currentCategory = exercise.category || "Other";
                const showCategoryHeader = currentCategory !== prevCategory;
                
                return (
                  <div key={exercise.id}>
                    {showCategoryHeader && (
                      <div className="px-2 py-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                        {currentCategory}
                      </div>
                    )}
                    <button
                      className="w-full px-4 py-3 text-left md:hover:bg-accent/5 transition-colors"
                      onClick={() => handleSelect(exercise.name)}
                    >
                      <span>{exercise.name}</span>
                    </button>
                    {idx < filteredExercises.length - 1 && (
                      <div className="border-b border-border" />
                    )}
                  </div>
                );
              })}
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default ExerciseSelector;
