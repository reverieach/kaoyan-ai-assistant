-- Create Enums
create type mistake_status as enum ('pending', 'analyzing', 'review_needed', 'active');
create type subject_category as enum ('Math', 'DataStructures', 'CompOrg', 'OS', 'Network', 'Other');
create type error_type_enum as enum ('Concept', 'Calculation', 'Logic', 'Carelessness', 'Other');

-- Create Mistakes Table
create table mistakes (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users not null,
  
  -- Original Content
  original_image text not null, -- URL to storage
  question_text text, -- OCR result (Markdown/LaTeX)
  
  -- User & Correct Answer
  user_answer text,
  correct_answer text,
  answer_image text, -- Standard Answer Image URL
  
  -- Analysis & Metadata
  knowledge_tags text[], -- Array of strings
  subject subject_category not null default 'Other',
  error_type error_type_enum,
  ai_analysis text,
  
  -- SM-2 Algorithm Fields
  mastery_level int default 0, -- repetition number
  ease_factor float default 2.5,
  interval_days int default 0,
  next_review_at timestamptz default now(),
  
  -- Workflow Status
  status mistake_status default 'pending',
  
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Enable RLS
alter table mistakes enable row level security;

-- Create Policies
create policy "Users can view their own mistakes" 
on mistakes for select 
using (auth.uid() = user_id);

create policy "Users can insert their own mistakes" 
on mistakes for insert 
with check (auth.uid() = user_id);

create policy "Users can create feedbacks"
on feedbacks for insert
with check (auth.uid() = user_id);

-- References Table (Knowledge Base)
create table references_kb (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users not null,
  title text not null,
  content text, -- Markdown content
  summary text,
  created_at timestamptz default now()
);

alter table references_kb enable row level security;

create policy "Users can view their own references"
on references_kb for select
using (auth.uid() = user_id);

create policy "Users can insert references"
on references_kb for insert
with check (auth.uid() = user_id);

create policy "Users can delete their own references"
on references_kb for delete
using (auth.uid() = user_id);

-- Storage bucket for Reference Images
insert into storage.buckets (id, name, public)
values ('reference_images', 'reference_images', true)
on conflict (id) do nothing;

create policy "Reference images are publicly accessible"
  on storage.objects for select
  using ( bucket_id = 'reference_images' );

create policy "Users can upload reference images"
  on storage.objects for insert
  with check ( bucket_id = 'reference_images' AND auth.uid() = owner );

create policy "Users can update their own mistakes" 
on mistakes for update 
using (auth.uid() = user_id);

create policy "Users can delete their own mistakes" 
on mistakes for delete 
using (auth.uid() = user_id);

-- Create Storage Bucket (if not exists)
insert into storage.buckets (id, name, public) 
values ('mistakes', 'mistakes', true)
on conflict (id) do nothing;

create policy "Mistake Images are publicly accessible"
on storage.objects for select
using ( bucket_id = 'mistakes' );

create policy "Users can upload mistake images"
on storage.objects for insert
with check ( bucket_id = 'mistakes' and auth.uid() = owner );
