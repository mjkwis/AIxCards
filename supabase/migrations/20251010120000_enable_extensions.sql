-- ============================================================================
-- Migration: Enable Required PostgreSQL Extensions
-- Description: Enables uuid-ossp extension for UUID generation in primary keys
-- Tables affected: N/A (prerequisite for all tables)
-- Dependencies: None
-- ============================================================================

-- enable uuid-ossp extension for generating uuids in primary key columns
-- this extension provides uuid_generate_v4() function used as default value
create extension if not exists "uuid-ossp";

