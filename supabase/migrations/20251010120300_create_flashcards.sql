-- ============================================================================
-- Migration: Create flashcards Table
-- Description: Main table storing all user flashcards (manual and AI-generated)
-- Tables affected: flashcards (new)
-- Dependencies: uuid-ossp, auth.users, generation_requests, ENUMs
-- Security: RLS enabled with policies for authenticated users only
-- Special logic: Trigger automatically sets status based on source
-- ============================================================================

-- create main flashcards table
-- stores both manually created flashcards and ai-generated ones
-- includes columns for spaced repetition algorithm (sm-2)
create table flashcards (
    id uuid primary key default uuid_generate_v4(),
    user_id uuid not null references auth.users(id) on delete cascade,
    generation_request_id uuid references generation_requests(id) on delete set null,
    front text not null,
    back text not null,
    source flashcard_source_enum not null,
    status flashcard_status_enum not null,
    next_review_at timestamptz,
    interval integer default 0,
    ease_factor decimal(3,2) default 2.5,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

-- create function to automatically set status based on flashcard source
-- manual flashcards get 'active' status immediately
-- ai_generated flashcards get 'pending_review' status and require user approval
create or replace function set_flashcard_status_on_insert()
returns trigger as $$
begin
    -- only set status automatically if not explicitly provided
    -- or if the provided status should be overridden based on source
    if new.source = 'manual' then
        new.status = 'active';
    elsif new.source = 'ai_generated' then
        new.status = 'pending_review';
    end if;
    
    return new;
end;
$$ language plpgsql;

-- create trigger to automatically set appropriate status on flashcard creation
create trigger set_flashcard_status_before_insert
before insert on flashcards
for each row
execute function set_flashcard_status_on_insert();

-- create trigger to automatically update updated_at on row modifications
create trigger update_flashcards_updated_at
before update on flashcards
for each row
execute function update_updated_at_column();

-- enable row level security
-- rls ensures users can only access their own flashcards
alter table flashcards enable row level security;

-- rls policy: allow authenticated users to view only their own flashcards
-- using auth.uid() ensures the policy applies to the currently authenticated user
create policy "authenticated users can view their own flashcards"
on flashcards
for select
to authenticated
using (auth.uid() = user_id);

-- rls policy: allow anonymous users to view their own flashcards
-- included for completeness, though flashcard management likely requires authentication
create policy "anonymous users can view their own flashcards"
on flashcards
for select
to anon
using (auth.uid() = user_id);

-- rls policy: allow authenticated users to insert their own flashcards
-- with check ensures user_id in inserted row matches authenticated user
create policy "authenticated users can insert their own flashcards"
on flashcards
for insert
to authenticated
with check (auth.uid() = user_id);

-- rls policy: allow anonymous users to insert their own flashcards
create policy "anonymous users can insert their own flashcards"
on flashcards
for insert
to anon
with check (auth.uid() = user_id);

-- rls policy: allow authenticated users to update only their own flashcards
-- both using and with check clauses ensure user owns the row before and after update
create policy "authenticated users can update their own flashcards"
on flashcards
for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

-- rls policy: allow anonymous users to update their own flashcards
create policy "anonymous users can update their own flashcards"
on flashcards
for update
to anon
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

-- rls policy: allow authenticated users to delete only their own flashcards
-- deletion cascades from auth.users ensure gdpr/rodo compliance (right to be forgotten)
create policy "authenticated users can delete their own flashcards"
on flashcards
for delete
to authenticated
using (auth.uid() = user_id);

-- rls policy: allow anonymous users to delete their own flashcards
create policy "anonymous users can delete their own flashcards"
on flashcards
for delete
to anon
using (auth.uid() = user_id);

-- create function to ensure mock user exists for development
-- this is used by the middleware to create a mock user when in dev mode
create or replace function ensure_mock_user(user_id uuid, user_email text)
returns void as $$
begin
  insert into auth.users (
    id,
    aud,
    role,
    email,
    email_confirmed_at,
    confirmed_at,
    created_at,
    updated_at
  ) values (
    user_id,
    'authenticated',
    'authenticated',
    user_email,
    now(),
    now(),
    now(),
    now()
  ) on conflict (id) do nothing;
end;
$$ language plpgsql security definer;

