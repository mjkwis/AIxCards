-- ============================================================================
-- Migration: Create generation_requests Table
-- Description: Stores source texts submitted by users for AI flashcard generation
-- Tables affected: generation_requests (new)
-- Dependencies: uuid-ossp extension, auth.users (Supabase built-in)
-- Security: RLS enabled with policies for authenticated users only
-- ============================================================================

-- create table for storing ai generation requests
-- this table tracks all source texts submitted for flashcard generation
create table generation_requests (
    id uuid primary key default uuid_generate_v4(),
    user_id uuid not null references auth.users(id) on delete cascade,
    source_text text not null,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

-- create function to automatically update the updated_at timestamp
-- this function will be used by triggers on all tables with updated_at column
create or replace function update_updated_at_column()
returns trigger as $$
begin
    new.updated_at = now();
    return new;
end;
$$ language plpgsql;

-- create trigger to automatically update updated_at on row modifications
create trigger update_generation_requests_updated_at
before update on generation_requests
for each row
execute function update_updated_at_column();

-- enable row level security
-- rls ensures users can only access their own generation requests
alter table generation_requests enable row level security;

-- rls policy: allow authenticated users to view only their own generation requests
-- using auth.uid() ensures the policy applies to the currently authenticated user
create policy "authenticated users can view their own generation requests"
on generation_requests
for select
to authenticated
using (auth.uid() = user_id);

-- rls policy: allow anonymous users to view their own generation requests
-- included for completeness, though generation likely requires authentication
create policy "anonymous users can view their own generation requests"
on generation_requests
for select
to anon
using (auth.uid() = user_id);

-- rls policy: allow authenticated users to insert their own generation requests
-- with check ensures user_id in inserted row matches authenticated user
create policy "authenticated users can insert their own generation requests"
on generation_requests
for insert
to authenticated
with check (auth.uid() = user_id);

-- rls policy: allow anonymous users to insert their own generation requests
create policy "anonymous users can insert their own generation requests"
on generation_requests
for insert
to anon
with check (auth.uid() = user_id);

-- rls policy: allow authenticated users to update only their own generation requests
-- both using and with check clauses ensure user owns the row before and after update
create policy "authenticated users can update their own generation requests"
on generation_requests
for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

-- rls policy: allow anonymous users to update their own generation requests
create policy "anonymous users can update their own generation requests"
on generation_requests
for update
to anon
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

-- rls policy: allow authenticated users to delete only their own generation requests
create policy "authenticated users can delete their own generation requests"
on generation_requests
for delete
to authenticated
using (auth.uid() = user_id);

-- rls policy: allow anonymous users to delete their own generation requests
create policy "anonymous users can delete their own generation requests"
on generation_requests
for delete
to anon
using (auth.uid() = user_id);

