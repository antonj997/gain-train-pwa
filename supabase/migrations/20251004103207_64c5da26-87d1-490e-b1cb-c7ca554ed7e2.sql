-- Create exercises table for predefined exercise list
CREATE TABLE public.exercises (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  category TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create workout_templates table for saved workout plans
CREATE TABLE public.workout_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  name TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create template_exercises table for exercises in a template
CREATE TABLE public.template_exercises (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id UUID NOT NULL REFERENCES public.workout_templates(id) ON DELETE CASCADE,
  exercise_name TEXT NOT NULL,
  order_index INTEGER NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create workout_sessions table for completed workouts
CREATE TABLE public.workout_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  template_id UUID REFERENCES public.workout_templates(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  date TIMESTAMP WITH TIME ZONE DEFAULT now(),
  duration INTEGER,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create workout_sets table for individual sets
CREATE TABLE public.workout_sets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES public.workout_sessions(id) ON DELETE CASCADE,
  exercise_name TEXT NOT NULL,
  set_number INTEGER NOT NULL,
  reps INTEGER NOT NULL,
  weight DECIMAL(6,2),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.exercises ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workout_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.template_exercises ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workout_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workout_sets ENABLE ROW LEVEL SECURITY;

-- RLS Policies for exercises (public read, no write for now)
CREATE POLICY "Anyone can view exercises"
  ON public.exercises FOR SELECT
  USING (true);

-- RLS Policies for workout_templates
CREATE POLICY "Users can view their own templates"
  ON public.workout_templates FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own templates"
  ON public.workout_templates FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own templates"
  ON public.workout_templates FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own templates"
  ON public.workout_templates FOR DELETE
  USING (auth.uid() = user_id);

-- RLS Policies for template_exercises
CREATE POLICY "Users can view exercises in their templates"
  ON public.template_exercises FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.workout_templates
      WHERE id = template_exercises.template_id
      AND user_id = auth.uid()
    )
  );

CREATE POLICY "Users can add exercises to their templates"
  ON public.template_exercises FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.workout_templates
      WHERE id = template_exercises.template_id
      AND user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update exercises in their templates"
  ON public.template_exercises FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.workout_templates
      WHERE id = template_exercises.template_id
      AND user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete exercises from their templates"
  ON public.template_exercises FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.workout_templates
      WHERE id = template_exercises.template_id
      AND user_id = auth.uid()
    )
  );

-- RLS Policies for workout_sessions
CREATE POLICY "Users can view their own sessions"
  ON public.workout_sessions FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own sessions"
  ON public.workout_sessions FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own sessions"
  ON public.workout_sessions FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own sessions"
  ON public.workout_sessions FOR DELETE
  USING (auth.uid() = user_id);

-- RLS Policies for workout_sets
CREATE POLICY "Users can view sets in their sessions"
  ON public.workout_sets FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.workout_sessions
      WHERE id = workout_sets.session_id
      AND user_id = auth.uid()
    )
  );

CREATE POLICY "Users can create sets in their sessions"
  ON public.workout_sets FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.workout_sessions
      WHERE id = workout_sets.session_id
      AND user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update sets in their sessions"
  ON public.workout_sets FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.workout_sessions
      WHERE id = workout_sets.session_id
      AND user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete sets from their sessions"
  ON public.workout_sets FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.workout_sessions
      WHERE id = workout_sets.session_id
      AND user_id = auth.uid()
    )
  );

-- Insert some default exercises
INSERT INTO public.exercises (name, category) VALUES
  ('Bench Press', 'Chest'),
  ('Squat', 'Legs'),
  ('Deadlift', 'Back'),
  ('Overhead Press', 'Shoulders'),
  ('Barbell Row', 'Back'),
  ('Pull Up', 'Back'),
  ('Dumbbell Curl', 'Arms'),
  ('Tricep Dip', 'Arms'),
  ('Leg Press', 'Legs'),
  ('Leg Curl', 'Legs'),
  ('Leg Extension', 'Legs'),
  ('Calf Raise', 'Legs'),
  ('Lateral Raise', 'Shoulders'),
  ('Face Pull', 'Shoulders'),
  ('Cable Fly', 'Chest'),
  ('Incline Press', 'Chest'),
  ('Romanian Deadlift', 'Back'),
  ('Lat Pulldown', 'Back'),
  ('Hammer Curl', 'Arms'),
  ('Skull Crusher', 'Arms');

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for workout_templates
CREATE TRIGGER update_workout_templates_updated_at
  BEFORE UPDATE ON public.workout_templates
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();