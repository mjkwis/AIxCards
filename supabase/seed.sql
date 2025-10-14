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

-- Insert sample generation request for development
INSERT INTO generation_requests (
    id,
    user_id,
    source_text,
    flashcards_count,
    status
) VALUES (
    'a1b2c3d4-e5f6-7890-abcd-ef1234567890'::uuid,
    '2c87435e-48a2-4467-9a6b-e6c7524e730e'::uuid,
    'TypeScript to język programowania rozwijany przez Microsoft. Jest nadzbiorem JavaScriptu, co oznacza, że każdy poprawny kod JavaScript jest również poprawnym kodem TypeScript. TypeScript dodaje opcjonalne statyczne typowanie do JavaScriptu, co pomaga w wykrywaniu błędów na etapie kompilacji. TypeScript kompiluje się do czystego JavaScriptu, który może być uruchamiany w dowolnym środowisku obsługującym JavaScript.',
    5,
    'completed'
) ON CONFLICT (id) DO NOTHING;

-- Insert sample flashcards for development (due for review today)
INSERT INTO flashcards (
    id,
    user_id,
    generation_request_id,
    front,
    back,
    source,
    status,
    next_review_at,
    interval,
    ease_factor
) VALUES
(
    'f1111111-1111-1111-1111-111111111111'::uuid,
    '2c87435e-48a2-4467-9a6b-e6c7524e730e'::uuid,
    'a1b2c3d4-e5f6-7890-abcd-ef1234567890'::uuid,
    'Co to jest TypeScript?',
    'TypeScript to język programowania rozwijany przez Microsoft, będący nadzbiorem JavaScriptu z opcjonalnym statycznym typowaniem.',
    'ai_generated',
    'active',
    NOW() - INTERVAL '1 hour',
    0,
    2.5
),
(
    'f2222222-2222-2222-2222-222222222222'::uuid,
    '2c87435e-48a2-4467-9a6b-e6c7524e730e'::uuid,
    'a1b2c3d4-e5f6-7890-abcd-ef1234567890'::uuid,
    'Jaka jest relacja między TypeScript a JavaScript?',
    'Każdy poprawny kod JavaScript jest również poprawnym kodem TypeScript. TypeScript kompiluje się do czystego JavaScriptu.',
    'ai_generated',
    'active',
    NOW() - INTERVAL '30 minutes',
    1,
    2.5
),
(
    'f3333333-3333-3333-3333-333333333333'::uuid,
    '2c87435e-48a2-4467-9a6b-e6c7524e730e'::uuid,
    'a1b2c3d4-e5f6-7890-abcd-ef1234567890'::uuid,
    'Jakie korzyści daje statyczne typowanie w TypeScript?',
    'Statyczne typowanie pomaga w wykrywaniu błędów na etapie kompilacji, zanim kod zostanie uruchomiony.',
    'ai_generated',
    'active',
    NOW() - INTERVAL '15 minutes',
    0,
    2.5
),
(
    'f4444444-4444-4444-4444-444444444444'::uuid,
    '2c87435e-48a2-4467-9a6b-e6c7524e730e'::uuid,
    NULL,
    'Co oznacza skrót SQL?',
    'SQL oznacza Structured Query Language - ustrukturyzowany język zapytań.',
    'manual',
    'active',
    NOW() - INTERVAL '5 minutes',
    0,
    2.5
),
(
    'f5555555-5555-5555-5555-555555555555'::uuid,
    '2c87435e-48a2-4467-9a6b-e6c7524e730e'::uuid,
    NULL,
    'Czym różni się React od Angular?',
    'React to biblioteka do budowania interfejsów użytkownika, podczas gdy Angular to pełny framework. React skupia się na warstwie widoku, Angular dostarcza kompletne rozwiązanie.',
    'manual',
    'active',
    NOW() + INTERVAL '2 days',
    6,
    2.5
)
ON CONFLICT (id) DO NOTHING;
