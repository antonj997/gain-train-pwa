-- Add comprehensive gym exercise bank including machines and cable exercises
INSERT INTO exercises (name, category) VALUES
-- Chest exercises
('Cable Crossover', 'Chest'),
('Dumbbell Fly', 'Chest'),
('Dumbbell Press', 'Chest'),
('Decline Bench Press', 'Chest'),
('Machine Chest Press', 'Chest'),
('Pec Deck Machine', 'Chest'),
('Push Up', 'Chest'),
('Dip', 'Chest'),

-- Back exercises
('Cable Row', 'Back'),
('T-Bar Row', 'Back'),
('Seated Cable Row', 'Back'),
('Single Arm Dumbbell Row', 'Back'),
('Machine Row', 'Back'),
('Chest Supported Row', 'Back'),
('Face Pull', 'Back'),
('Hyperextension', 'Back'),
('Good Morning', 'Back'),
('Chin Up', 'Back'),

-- Shoulders exercises
('Arnold Press', 'Shoulders'),
('Cable Lateral Raise', 'Shoulders'),
('Dumbbell Shoulder Press', 'Shoulders'),
('Machine Shoulder Press', 'Shoulders'),
('Rear Delt Fly', 'Shoulders'),
('Cable Rear Delt Fly', 'Shoulders'),
('Upright Row', 'Shoulders'),
('Shrugs', 'Shoulders'),

-- Arms exercises
('Cable Curl', 'Arms'),
('Preacher Curl', 'Arms'),
('Concentration Curl', 'Arms'),
('Cable Tricep Extension', 'Arms'),
('Overhead Tricep Extension', 'Arms'),
('Close Grip Bench Press', 'Arms'),
('Tricep Pushdown', 'Arms'),
('Rope Pushdown', 'Arms'),

-- Legs exercises
('Bulgarian Split Squat', 'Legs'),
('Front Squat', 'Legs'),
('Hack Squat', 'Legs'),
('Leg Press Machine', 'Legs'),
('Lying Leg Curl', 'Legs'),
('Seated Leg Curl', 'Legs'),
('Standing Calf Raise', 'Legs'),
('Seated Calf Raise', 'Legs'),
('Goblet Squat', 'Legs'),
('Lunges', 'Legs'),
('Walking Lunges', 'Legs'),
('Hip Thrust', 'Legs'),
('Glute Bridge', 'Legs'),
('Cable Pull Through', 'Legs'),
('Sumo Deadlift', 'Legs'),

-- Core exercises
('Plank', 'Core'),
('Side Plank', 'Core'),
('Ab Wheel', 'Core'),
('Cable Crunch', 'Core'),
('Hanging Leg Raise', 'Core'),
('Russian Twist', 'Core'),
('Cable Woodchop', 'Core')
ON CONFLICT (name) DO NOTHING;