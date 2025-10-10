-- ============================================================================
-- Migration: Create Performance Indexes
-- Description: Creates indexes to optimize query performance
-- Tables affected: generation_requests, flashcards
-- Dependencies: generation_requests table, flashcards table
-- Performance impact: Improves query speed for user-specific and study session queries
-- ============================================================================

-- index on generation_requests.user_id
-- speeds up queries fetching all generation requests for a specific user
-- used in user dashboard and history views
create index idx_generation_requests_user_id on generation_requests(user_id);

-- index on flashcards.user_id
-- speeds up queries fetching all flashcards for a specific user
-- critical for "my flashcards" view and user-specific operations
create index idx_flashcards_user_id on flashcards(user_id);

-- index on flashcards.generation_request_id
-- speeds up queries fetching all flashcards from a specific ai generation request
-- used when displaying results of ai generation and tracking generation success
create index idx_flashcards_generation_request_id on flashcards(generation_request_id);

-- partial index on flashcards.next_review_at for active flashcards only
-- optimizes the most critical query: fetching flashcards due for review
-- partial index reduces index size by only including active flashcards
-- inactive flashcards (pending_review, rejected) are excluded from study sessions
create index idx_flashcards_next_review_at on flashcards(next_review_at) 
where status = 'active';

-- index on flashcards.status
-- speeds up filtering flashcards by lifecycle status
-- used in ui tabs: "active", "pending review", "rejected"
create index idx_flashcards_status on flashcards(status);

-- composite index for study session queries
-- optimizes the main study session query: fetch user's active flashcards due for review
-- column order: user_id (high selectivity) -> next_review_at (range scan) -> status (filter)
-- partial index includes only active flashcards to minimize index size
create index idx_flashcards_user_next_review on flashcards(user_id, next_review_at, status) 
where status = 'active';

