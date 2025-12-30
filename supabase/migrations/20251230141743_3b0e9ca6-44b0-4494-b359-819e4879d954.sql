-- Add section column to track warm-up, working, or wind-down phases
ALTER TABLE public.workout_sets 
ADD COLUMN section text NOT NULL DEFAULT 'working';

-- Add a check constraint to ensure valid section values
ALTER TABLE public.workout_sets 
ADD CONSTRAINT workout_sets_section_check 
CHECK (section IN ('warmup', 'working', 'winddown'));