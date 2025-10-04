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
    if (searchTerm) {
      setFilteredExercises(
        exercises.filter((ex) =>
          ex.name.toLowerCase().includes(searchTerm.toLowerCase())
        )
      );
    } else {
      setFilteredExercises(exercises);
    }
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
        <div className="flex-1 overflow-y-auto space-y-2">
          {filteredExercises.map((exercise) => (
            <Button
              key={exercise.id}
              variant="outline"
              className="w-full justify-start"
              onClick={() => handleSelect(exercise.name)}
            >
              <div className="flex flex-col items-start">
                <span>{exercise.name}</span>
                {exercise.category && (
                  <span className="text-xs text-muted-foreground">
                    {exercise.category}
                  </span>
                )}
              </div>
            </Button>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default ExerciseSelector;
