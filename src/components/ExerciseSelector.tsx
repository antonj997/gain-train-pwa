import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search } from "lucide-react";

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

const ExerciseSelector = ({ open, onClose, onSelect }: ExerciseSelectorProps) => {
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [filteredExercises, setFilteredExercises] = useState<Exercise[]>([]);
  const [searchTerm, setSearchTerm] = useState("");

  useEffect(() => {
    if (open) {
      loadExercises();
    }
  }, [open]);

  useEffect(() => {
    const filtered = searchTerm
      ? exercises.filter((ex) =>
          ex.name.toLowerCase().includes(searchTerm.toLowerCase())
        )
      : exercises;
    
    // Sort by category for grouping
    const sorted = [...filtered].sort((a, b) => {
      const catA = a.category || "Other";
      const catB = b.category || "Other";
      if (catA === catB) return a.name.localeCompare(b.name);
      return catA.localeCompare(catB);
    });
    
    setFilteredExercises(sorted);
  }, [searchTerm, exercises]);

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

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Select Exercise</DialogTitle>
        </DialogHeader>
        <div className="relative">
          <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search exercises..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9"
          />
        </div>
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
                  className="w-full px-4 py-3 text-left hover:bg-accent/5 transition-colors"
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
      </DialogContent>
    </Dialog>
  );
};

export default ExerciseSelector;
