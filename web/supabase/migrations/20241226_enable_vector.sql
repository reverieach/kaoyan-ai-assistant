-- Enable the pgvector extension to work with embedding vectors
create extension if not exists vector;

-- Create a table to store document chunks
create table if not exists reference_chunks (
  id uuid default gen_random_uuid() primary key,
  doc_id uuid references references_kb(id) on delete cascade not null,
  content text not null,
  -- 384 dimensions for all-MiniLM-L6-v2
  embedding vector(384),
  metadata jsonb, -- Stores {"chapter": "...", "page": ...}
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- RLS Configuration
alter table reference_chunks enable row level security;

create policy "Users can own access chunks via parent doc"
on reference_chunks for all
using (
  exists (
    select 1 from references_kb
    where references_kb.id = reference_chunks.doc_id
    and references_kb.user_id = auth.uid()
  )
);

-- Search function
create or replace function match_reference_chunks (
  query_embedding vector(384),
  match_threshold float,
  match_count int,
  filter_doc_id uuid DEFAULT NULL
) returns table (
  chunk_id uuid,
  chunk_content text,
  chunk_metadata jsonb,
  similarity float
) language plpgsql stable as $$
begin
  return query
  select
    reference_chunks.id as chunk_id,
    reference_chunks.content as chunk_content,
    reference_chunks.metadata as chunk_metadata,
    1 - (reference_chunks.embedding <=> query_embedding) as similarity
  from reference_chunks
  where 1 - (reference_chunks.embedding <=> query_embedding) > match_threshold
  and (filter_doc_id is null or reference_chunks.doc_id = filter_doc_id)
  order by reference_chunks.embedding <=> query_embedding
  limit match_count;
end;
$$;
