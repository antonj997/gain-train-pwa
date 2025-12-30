-- Add user_id and note columns to exercises table for user-created exercises
ALTER TABLE public.exercises 
ADD COLUMN user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
ADD COLUMN note text;

-- Drop the existing SELECT policy
DROP POLICY IF EXISTS "Anyone can view exercises" ON public.exercises;

-- Create new policies for exercises
-- Users can view all default exercises (user_id is null) and their own exercises
CREATE POLICY "Users can view default and own exercises" 
ON public.exercises 
FOR SELECT 
USING (user_id IS NULL OR auth.uid() = user_id);

-- Users can create their own exercises
CREATE POLICY "Users can create their own exercises" 
ON public.exercises 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

-- Users can update their own exercises
CREATE POLICY "Users can update their own exercises" 
ON public.exercises 
FOR UPDATE 
USING (auth.uid() = user_id);

-- Users can delete their own exercises
CREATE POLICY "Users can delete their own exercises" 
ON public.exercises 
FOR DELETE 
USING (auth.uid() = user_id);