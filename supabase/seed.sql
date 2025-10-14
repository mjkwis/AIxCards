-- Seed file for development data
-- This file is executed after migrations during `supabase db reset`

-- Insert mock user for development
-- This user matches the mock user ID used in middleware and AuthProvider
-- Using minimal required fields to avoid column constraints
INSERT INTO auth.users (
    id,
    aud,
    role,
    email
) VALUES (
    '2c87435e-48a2-4467-9a6b-e6c7524e730e'::uuid,
    'authenticated',
    'authenticated',
    'mjk.wisniewski@gmail.com'
) ON CONFLICT (id) DO NOTHING;
