-- GapFinder AI Database Schema
-- Run this in your Supabase SQL Editor

-- Enable pgvector extension
create extension if not exists vector;

-- ===== PROFILES =====
create table if not exists public.profiles (
  id uuid references auth.users on delete cascade primary key,
  email text not null,
  full_name text,
  avatar_url text,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);

alter table public.profiles enable row level security;

create policy "Users can view own profile" on public.profiles
  for select using (auth.uid() = id);

create policy "Users can update own profile" on public.profiles
  for update using (auth.uid() = id);

create policy "Users can insert own profile" on public.profiles
  for insert with check (auth.uid() = id);

-- Auto-create profile on signup
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, email, full_name)
  values (new.id, new.email, new.raw_user_meta_data->>'full_name');
  return new;
end;
$$ language plpgsql security definer;

create or replace trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- ===== MATERIALS =====
create table if not exists public.materials (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users on delete cascade not null,
  title text not null,
  type text not null check (type in ('syllabus', 'notes', 'textbook', 'question_paper')),
  file_name text not null,
  file_url text,
  raw_text text not null default '',
  status text not null default 'processing' check (status in ('processing', 'ready', 'error')),
  created_at timestamp with time zone default now()
);

alter table public.materials enable row level security;

create policy "Users can view own materials" on public.materials
  for select using (auth.uid() = user_id);
create policy "Users can insert own materials" on public.materials
  for insert with check (auth.uid() = user_id);
create policy "Users can update own materials" on public.materials
  for update using (auth.uid() = user_id);
create policy "Users can delete own materials" on public.materials
  for delete using (auth.uid() = user_id);

-- ===== MATERIAL CHUNKS (with vector embeddings) =====
create table if not exists public.material_chunks (
  id uuid default gen_random_uuid() primary key,
  material_id uuid references public.materials on delete cascade not null,
  user_id uuid references auth.users on delete cascade not null,
  content text not null,
  topic_hint text,
  chunk_index integer not null,
  embedding vector(768),
  metadata jsonb default '{}'::jsonb
);

alter table public.material_chunks enable row level security;

create policy "Users can view own chunks" on public.material_chunks
  for select using (auth.uid() = user_id);
create policy "Users can insert own chunks" on public.material_chunks
  for insert with check (auth.uid() = user_id);
create policy "Users can delete own chunks" on public.material_chunks
  for delete using (auth.uid() = user_id);

-- Vector similarity search function
create or replace function match_chunks(
  query_embedding vector(768),
  match_user_id uuid,
  match_count int default 5,
  match_threshold float default 0.5
)
returns table (
  id uuid,
  material_id uuid,
  content text,
  topic_hint text,
  metadata jsonb,
  similarity float
)
language sql stable
as $$
  select
    material_chunks.id,
    material_chunks.material_id,
    material_chunks.content,
    material_chunks.topic_hint,
    material_chunks.metadata,
    1 - (material_chunks.embedding <=> query_embedding) as similarity
  from material_chunks
  where material_chunks.user_id = match_user_id
    and 1 - (material_chunks.embedding <=> query_embedding) > match_threshold
  order by material_chunks.embedding <=> query_embedding
  limit match_count;
$$;

-- ===== TOPICS =====
create table if not exists public.topics (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users on delete cascade not null,
  material_id uuid references public.materials on delete set null,
  name text not null,
  parent_topic_id uuid references public.topics on delete set null,
  description text,
  order_index integer not null default 0,
  strength text not null default 'untested' check (strength in ('weak', 'medium', 'strong', 'untested')),
  score real not null default 0,
  created_at timestamp with time zone default now()
);

alter table public.topics enable row level security;

create policy "Users can view own topics" on public.topics
  for select using (auth.uid() = user_id);
create policy "Users can insert own topics" on public.topics
  for insert with check (auth.uid() = user_id);
create policy "Users can update own topics" on public.topics
  for update using (auth.uid() = user_id);
create policy "Users can delete own topics" on public.topics
  for delete using (auth.uid() = user_id);

-- ===== QUIZZES =====
create table if not exists public.quizzes (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users on delete cascade not null,
  title text not null,
  topic_ids uuid[] default '{}',
  total_questions integer not null default 0,
  answered_questions integer not null default 0,
  correct_answers integer not null default 0,
  status text not null default 'in_progress' check (status in ('in_progress', 'completed')),
  created_at timestamp with time zone default now(),
  completed_at timestamp with time zone
);

alter table public.quizzes enable row level security;

create policy "Users can view own quizzes" on public.quizzes
  for select using (auth.uid() = user_id);
create policy "Users can insert own quizzes" on public.quizzes
  for insert with check (auth.uid() = user_id);
create policy "Users can update own quizzes" on public.quizzes
  for update using (auth.uid() = user_id);

-- ===== QUIZ QUESTIONS =====
create table if not exists public.quiz_questions (
  id uuid default gen_random_uuid() primary key,
  quiz_id uuid references public.quizzes on delete cascade not null,
  topic_id uuid references public.topics on delete set null,
  question text not null,
  options text[] not null,
  correct_answer integer not null,
  explanation text not null default '',
  citation text not null default '',
  difficulty text not null default 'medium' check (difficulty in ('easy', 'medium', 'hard')),
  order_index integer not null default 0
);

alter table public.quiz_questions enable row level security;

create policy "Users can view quiz questions" on public.quiz_questions
  for select using (
    exists (select 1 from public.quizzes where quizzes.id = quiz_questions.quiz_id and quizzes.user_id = auth.uid())
  );
create policy "Users can insert quiz questions" on public.quiz_questions
  for insert with check (
    exists (select 1 from public.quizzes where quizzes.id = quiz_questions.quiz_id and quizzes.user_id = auth.uid())
  );

-- ===== QUIZ ANSWERS =====
create table if not exists public.quiz_answers (
  id uuid default gen_random_uuid() primary key,
  quiz_id uuid references public.quizzes on delete cascade not null,
  question_id uuid references public.quiz_questions on delete cascade not null,
  user_id uuid references auth.users on delete cascade not null,
  selected_answer integer not null,
  is_correct boolean not null,
  time_taken_seconds integer default 0,
  created_at timestamp with time zone default now()
);

alter table public.quiz_answers enable row level security;

create policy "Users can view own answers" on public.quiz_answers
  for select using (auth.uid() = user_id);
create policy "Users can insert own answers" on public.quiz_answers
  for insert with check (auth.uid() = user_id);

-- ===== GAP REPORTS =====
create table if not exists public.gap_reports (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users on delete cascade not null,
  quiz_id uuid references public.quizzes on delete cascade not null,
  topic_id uuid references public.topics on delete cascade not null,
  topic_name text not null,
  strength text not null check (strength in ('weak', 'medium', 'strong')),
  score real not null default 0,
  total_questions integer not null default 0,
  correct_answers integer not null default 0,
  reason text not null default '',
  suggestions text[] default '{}',
  created_at timestamp with time zone default now()
);

alter table public.gap_reports enable row level security;

create policy "Users can view own gap reports" on public.gap_reports
  for select using (auth.uid() = user_id);
create policy "Users can insert own gap reports" on public.gap_reports
  for insert with check (auth.uid() = user_id);

-- ===== REVISION PLANS =====
create table if not exists public.revision_plans (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users on delete cascade not null,
  gap_report_ids uuid[] default '{}',
  title text not null,
  available_hours real not null default 10,
  plan_data jsonb not null default '[]'::jsonb,
  status text not null default 'active' check (status in ('active', 'completed', 'archived')),
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);

alter table public.revision_plans enable row level security;

create policy "Users can view own plans" on public.revision_plans
  for select using (auth.uid() = user_id);
create policy "Users can insert own plans" on public.revision_plans
  for insert with check (auth.uid() = user_id);
create policy "Users can update own plans" on public.revision_plans
  for update using (auth.uid() = user_id);

-- ===== PROGRESS HISTORY =====
create table if not exists public.progress_history (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users on delete cascade not null,
  topic_id uuid references public.topics on delete cascade not null,
  topic_name text not null,
  score real not null default 0,
  strength text not null check (strength in ('weak', 'medium', 'strong')),
  quiz_id uuid references public.quizzes on delete cascade not null,
  recorded_at timestamp with time zone default now()
);

alter table public.progress_history enable row level security;

create policy "Users can view own progress" on public.progress_history
  for select using (auth.uid() = user_id);
create policy "Users can insert own progress" on public.progress_history
  for insert with check (auth.uid() = user_id);

-- ===== STORAGE BUCKET =====
insert into storage.buckets (id, name, public) 
values ('materials', 'materials', false)
on conflict (id) do nothing;

create policy "Users can upload materials" on storage.objects
  for insert with check (bucket_id = 'materials' and auth.uid()::text = (storage.foldername(name))[1]);

create policy "Users can view own materials" on storage.objects
  for select using (bucket_id = 'materials' and auth.uid()::text = (storage.foldername(name))[1]);

create policy "Users can delete own materials" on storage.objects
  for delete using (bucket_id = 'materials' and auth.uid()::text = (storage.foldername(name))[1]);
