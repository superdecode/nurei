-- ============================================
-- MANDARIN: lesson engine schema (courses -> levels -> units -> lessons)
-- ============================================

create table if not exists public.mandarin_courses (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  title text not null,
  description text,
  is_published boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.mandarin_levels (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.mandarin_courses(id) on delete cascade,
  slug text not null,
  title text not null,
  order_index integer not null default 0,
  is_published boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (course_id, slug)
);
create index idx_mandarin_levels_course on public.mandarin_levels(course_id);

create table if not exists public.mandarin_units (
  id uuid primary key default gen_random_uuid(),
  level_id uuid not null references public.mandarin_levels(id) on delete cascade,
  slug text not null,
  title text not null,
  order_index integer not null default 0,
  is_published boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (level_id, slug)
);
create index idx_mandarin_units_level on public.mandarin_units(level_id);

create table if not exists public.mandarin_lessons (
  id uuid primary key default gen_random_uuid(),
  unit_id uuid not null references public.mandarin_units(id) on delete cascade,
  slug text not null,
  title text not null,
  objective text,
  order_index integer not null default 0,
  is_published boolean not null default false,
  is_demo_content boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (unit_id, slug)
);
create index idx_mandarin_lessons_unit on public.mandarin_lessons(unit_id);
create index idx_mandarin_lessons_slug on public.mandarin_lessons(slug);

create table if not exists public.mandarin_vocab_items (
  id uuid primary key default gen_random_uuid(),
  hanzi text not null,
  pinyin text not null,
  es text not null,
  notes text,
  is_demo_content boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.mandarin_lesson_vocab (
  lesson_id uuid not null references public.mandarin_lessons(id) on delete cascade,
  vocab_id uuid not null references public.mandarin_vocab_items(id) on delete cascade,
  order_index integer not null default 0,
  primary key (lesson_id, vocab_id)
);
create index idx_mandarin_lesson_vocab_vocab on public.mandarin_lesson_vocab(vocab_id);

create table if not exists public.mandarin_grammar_points (
  id uuid primary key default gen_random_uuid(),
  lesson_id uuid not null references public.mandarin_lessons(id) on delete cascade,
  title text not null,
  explanation text not null,
  order_index integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index idx_mandarin_grammar_points_lesson on public.mandarin_grammar_points(lesson_id);

create table if not exists public.mandarin_examples (
  id uuid primary key default gen_random_uuid(),
  lesson_id uuid not null references public.mandarin_lessons(id) on delete cascade,
  hanzi text not null,
  pinyin text not null,
  es text not null,
  order_index integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index idx_mandarin_examples_lesson on public.mandarin_examples(lesson_id);

create table if not exists public.mandarin_exercises (
  id uuid primary key default gen_random_uuid(),
  lesson_id uuid not null references public.mandarin_lessons(id) on delete cascade,
  type text not null check (type in ('vocab_multiple_choice', 'sentence_order')),
  prompt text not null,
  data jsonb not null,
  order_index integer not null default 0,
  is_published boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index idx_mandarin_exercises_lesson on public.mandarin_exercises(lesson_id);

create table if not exists public.mandarin_user_progress (
  user_id uuid not null references auth.users(id) on delete cascade,
  lesson_id uuid not null references public.mandarin_lessons(id) on delete cascade,
  status text not null default 'not_started' check (status in ('not_started', 'in_progress', 'completed')),
  completed_at timestamptz,
  updated_at timestamptz not null default now(),
  primary key (user_id, lesson_id)
);
create index idx_mandarin_user_progress_lesson on public.mandarin_user_progress(lesson_id);

create table if not exists public.mandarin_user_exercise_attempts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  exercise_id uuid not null references public.mandarin_exercises(id) on delete cascade,
  is_correct boolean not null,
  response jsonb not null,
  answered_at timestamptz not null default now()
);
create index idx_mandarin_attempts_user_date on public.mandarin_user_exercise_attempts(user_id, answered_at desc);
create index idx_mandarin_attempts_exercise on public.mandarin_user_exercise_attempts(exercise_id);

alter table public.mandarin_courses enable row level security;
alter table public.mandarin_levels enable row level security;
alter table public.mandarin_units enable row level security;
alter table public.mandarin_lessons enable row level security;
alter table public.mandarin_vocab_items enable row level security;
alter table public.mandarin_lesson_vocab enable row level security;
alter table public.mandarin_grammar_points enable row level security;
alter table public.mandarin_examples enable row level security;
alter table public.mandarin_exercises enable row level security;
alter table public.mandarin_user_progress enable row level security;
alter table public.mandarin_user_exercise_attempts enable row level security;

create policy "mandarin_courses: anyone can read published"
  on public.mandarin_courses for select using (is_published = true);

create policy "mandarin_levels: anyone can read published"
  on public.mandarin_levels for select using (is_published = true);

create policy "mandarin_units: anyone can read published"
  on public.mandarin_units for select using (is_published = true);

create policy "mandarin_lessons: anyone can read published"
  on public.mandarin_lessons for select using (is_published = true);

create policy "mandarin_vocab_items: anyone can read"
  on public.mandarin_vocab_items for select using (true);

create policy "mandarin_lesson_vocab: anyone can read for published lessons"
  on public.mandarin_lesson_vocab for select using (
    exists (
      select 1 from public.mandarin_lessons l
      where l.id = lesson_id and l.is_published = true
    )
  );

create policy "mandarin_grammar_points: anyone can read for published lessons"
  on public.mandarin_grammar_points for select using (
    exists (
      select 1 from public.mandarin_lessons l
      where l.id = lesson_id and l.is_published = true
    )
  );

create policy "mandarin_examples: anyone can read for published lessons"
  on public.mandarin_examples for select using (
    exists (
      select 1 from public.mandarin_lessons l
      where l.id = lesson_id and l.is_published = true
    )
  );

create policy "mandarin_exercises: anyone can read published"
  on public.mandarin_exercises for select using (is_published = true);

create policy "mandarin_user_progress: users read own"
  on public.mandarin_user_progress for select using (user_id = auth.uid());

create policy "mandarin_user_progress: users insert own"
  on public.mandarin_user_progress for insert with check (user_id = auth.uid());

create policy "mandarin_user_progress: users update own"
  on public.mandarin_user_progress for update using (user_id = auth.uid());

create policy "mandarin_user_exercise_attempts: users read own"
  on public.mandarin_user_exercise_attempts for select using (user_id = auth.uid());

create policy "mandarin_user_exercise_attempts: users insert own"
  on public.mandarin_user_exercise_attempts for insert with check (user_id = auth.uid());
