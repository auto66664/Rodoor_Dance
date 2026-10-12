-- =====================================================================
-- รด.แดนซ์ — Supabase schema
-- รันทั้งไฟล์ใน Supabase Dashboard → SQL Editor → New query → Run
-- (รันซ้ำได้: ใช้ if not exists / or replace / drop policy if exists)
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. โปรไฟล์ผู้ใช้ (1 แถวต่อ 1 บัญชีใน auth.users สร้างอัตโนมัติตอนสมัคร)
-- ---------------------------------------------------------------------
create table if not exists public.profiles (
  id          uuid primary key references auth.users (id) on delete cascade,
  role        text not null default 'student' check (role in ('student', 'trainer')),
  email       text,
  rank        text,                         -- ยศ (ครูฝึก)
  first_name  text not null default '',
  last_name   text not null default '',
  school      text,                         -- สถานศึกษา (นศท.) / หน่วยฝึก (ครูฝึก)
  year        smallint check (year between 1 and 5),  -- ชั้นปี (นศท.)
  company     text,                         -- กองร้อย
  platoon     text,                         -- หมวด
  squad       text,                         -- หมู่
  order_no    text,                         -- ลำดับที่
  affiliation text,                         -- สังกัด (ครูฝึก)
  created_at  timestamptz not null default now()
);

-- สร้างโปรไฟล์จากข้อมูลที่กรอกตอนสมัคร (raw_user_meta_data)
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  meta jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
begin
  insert into public.profiles (
    id, role, email, rank, first_name, last_name, school,
    year, company, platoon, squad, order_no, affiliation
  ) values (
    new.id,
    case when meta->>'role' = 'trainer' then 'trainer' else 'student' end,
    new.email,
    nullif(meta->>'rank', ''),
    coalesce(meta->>'first_name', ''),
    coalesce(meta->>'last_name', ''),
    nullif(meta->>'school', ''),
    nullif(meta->>'year', '')::smallint,
    nullif(meta->>'company', ''),
    nullif(meta->>'platoon', ''),
    nullif(meta->>'squad', ''),
    nullif(meta->>'order_no', ''),
    nullif(meta->>'affiliation', '')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ห้ามเปลี่ยนบทบาทตัวเอง (กันนักศึกษาแก้ตัวเองเป็นครูฝึก)
create or replace function public.prevent_role_change()
returns trigger
language plpgsql
as $$
begin
  if new.role <> old.role and auth.uid() = old.id then
    raise exception 'ไม่สามารถเปลี่ยนบทบาทได้';
  end if;
  return new;
end;
$$;

drop trigger if exists profiles_prevent_role_change on public.profiles;
create trigger profiles_prevent_role_change
  before update on public.profiles
  for each row execute function public.prevent_role_change();

-- ---------------------------------------------------------------------
-- 2. ห้องเรียน (ครูฝึกสร้าง / นศท. เข้าด้วยรหัส 6 หลัก)
-- ---------------------------------------------------------------------
create or replace function public.generate_classroom_code()
returns text
language plpgsql
as $$
declare
  chars constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  new_code text;
begin
  loop
    new_code := '';
    for i in 1..6 loop
      new_code := new_code || substr(chars, 1 + floor(random() * length(chars))::int, 1);
    end loop;
    exit when not exists (select 1 from public.classrooms where code = new_code);
  end loop;
  return new_code;
end;
$$;

create table if not exists public.classrooms (
  id           uuid primary key default gen_random_uuid(),
  code         text not null unique,
  name         text not null,
  trainer_id   uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  trainer_name text not null default '',
  date         date not null default current_date,
  exercises    text[] not null default '{}',
  note         text not null default '',
  created_at   timestamptz not null default now()
);

alter table public.classrooms alter column code set default public.generate_classroom_code();

create table if not exists public.classroom_members (
  classroom_id uuid not null references public.classrooms (id) on delete cascade,
  student_id   uuid not null references public.profiles (id) on delete cascade,
  joined_at    timestamptz not null default now(),
  primary key (classroom_id, student_id)
);

create index if not exists classroom_members_student_idx on public.classroom_members (student_id);

-- ---------------------------------------------------------------------
-- 3. ผลการทดสอบท่า (โหมดทดสอบ)
-- ---------------------------------------------------------------------
create table if not exists public.test_results (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  exercise_slug text not null,
  exercise_name text not null,
  accuracy      numeric(5, 1) not null check (accuracy between 0 and 100),   -- คะแนนความแม่นยำ
  similarity    numeric(5, 1) check (similarity between 0 and 100),          -- ความคล้ายต้นแบบ (Siamese)
  passed        boolean not null default false,
  errors        jsonb not null default '[]'::jsonb,                           -- [{code, name, tip}]
  body_visible  boolean not null default true,
  created_at    timestamptz not null default now()
);

create index if not exists test_results_user_idx on public.test_results (user_id, created_at desc);

-- ---------------------------------------------------------------------
-- 4. ฟังก์ชันช่วยเช็กสิทธิ์ (security definer = ไม่ติด RLS วนซ้ำ)
-- ---------------------------------------------------------------------
-- ผู้ใช้ปัจจุบันเป็นครูฝึกของห้องที่ นศท. คนนี้อยู่ไหม
create or replace function public.is_trainer_of(student uuid)
returns boolean
language sql
stable
security definer set search_path = public
as $$
  select exists (
    select 1
    from public.classroom_members m
    join public.classrooms c on c.id = m.classroom_id
    where m.student_id = student and c.trainer_id = auth.uid()
  );
$$;

-- ผู้ใช้ปัจจุบันเป็นสมาชิกของห้องนี้ไหม
create or replace function public.is_member_of(room uuid)
returns boolean
language sql
stable
security definer set search_path = public
as $$
  select exists (
    select 1 from public.classroom_members
    where classroom_id = room and student_id = auth.uid()
  );
$$;

-- ผู้ใช้ปัจจุบันเป็นครูฝึกไหม
create or replace function public.is_trainer()
returns boolean
language sql
stable
security definer set search_path = public
as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role = 'trainer');
$$;

-- นศท. เข้าห้องเรียนด้วยรหัส → คืนรหัสห้อง (null = ไม่พบห้อง)
create or replace function public.join_classroom(room_code text)
returns text
language plpgsql
security definer set search_path = public
as $$
declare
  room public.classrooms;
begin
  if auth.uid() is null then
    raise exception 'ต้องเข้าสู่ระบบก่อน';
  end if;

  select * into room from public.classrooms where code = upper(trim(room_code));

  if room.id is null then
    return null;
  end if;

  if room.trainer_id <> auth.uid() then
    insert into public.classroom_members (classroom_id, student_id)
    values (room.id, auth.uid())
    on conflict do nothing;
  end if;

  return room.code;
end;
$$;

-- ---------------------------------------------------------------------
-- 5. Row Level Security
-- ---------------------------------------------------------------------
alter table public.profiles          enable row level security;
alter table public.classrooms        enable row level security;
alter table public.classroom_members enable row level security;
alter table public.test_results      enable row level security;

-- profiles: ดู/แก้ของตัวเอง, ครูฝึกดูโปรไฟล์ นศท. ในห้องของตัวเองได้
drop policy if exists "profiles select" on public.profiles;
create policy "profiles select" on public.profiles
  for select to authenticated
  using (id = auth.uid() or public.is_trainer_of(id));

drop policy if exists "profiles update own" on public.profiles;
create policy "profiles update own" on public.profiles
  for update to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

-- classrooms: ครูฝึกเจ้าของ + สมาชิกในห้องดูได้, เฉพาะครูฝึกสร้าง/แก้/ลบห้องของตัวเอง
drop policy if exists "classrooms select" on public.classrooms;
create policy "classrooms select" on public.classrooms
  for select to authenticated
  using (trainer_id = auth.uid() or public.is_member_of(id));

drop policy if exists "classrooms insert" on public.classrooms;
create policy "classrooms insert" on public.classrooms
  for insert to authenticated
  with check (trainer_id = auth.uid() and public.is_trainer());

drop policy if exists "classrooms update" on public.classrooms;
create policy "classrooms update" on public.classrooms
  for update to authenticated
  using (trainer_id = auth.uid())
  with check (trainer_id = auth.uid());

drop policy if exists "classrooms delete" on public.classrooms;
create policy "classrooms delete" on public.classrooms
  for delete to authenticated
  using (trainer_id = auth.uid());

-- classroom_members: นศท. ดู/ออกจากห้องของตัวเอง, ครูฝึกดู/ลบสมาชิกในห้องตัวเอง
-- (การเข้าห้องทำผ่าน join_classroom() เท่านั้น)
drop policy if exists "members select" on public.classroom_members;
create policy "members select" on public.classroom_members
  for select to authenticated
  using (
    student_id = auth.uid()
    or exists (select 1 from public.classrooms c where c.id = classroom_id and c.trainer_id = auth.uid())
  );

drop policy if exists "members delete" on public.classroom_members;
create policy "members delete" on public.classroom_members
  for delete to authenticated
  using (
    student_id = auth.uid()
    or exists (select 1 from public.classrooms c where c.id = classroom_id and c.trainer_id = auth.uid())
  );

-- test_results: บันทึก/ดูของตัวเอง, ครูฝึกดูผลของ นศท. ในห้องตัวเอง
drop policy if exists "results select" on public.test_results;
create policy "results select" on public.test_results
  for select to authenticated
  using (user_id = auth.uid() or public.is_trainer_of(user_id));

drop policy if exists "results insert own" on public.test_results;
create policy "results insert own" on public.test_results
  for insert to authenticated
  with check (user_id = auth.uid());

drop policy if exists "results delete own" on public.test_results;
create policy "results delete own" on public.test_results
  for delete to authenticated
  using (user_id = auth.uid());

-- ---------------------------------------------------------------------
-- 6. ซ่อมโปรไฟล์ที่หายไป (บัญชีที่สมัครก่อนรันไฟล์นี้ / trigger ไม่ทำงาน)
-- ---------------------------------------------------------------------
-- สร้างโปรไฟล์ของผู้ใช้ปัจจุบันจากข้อมูลตอนสมัคร ถ้ายังไม่มี (เว็บเรียกให้อัตโนมัติ)
create or replace function public.ensure_profile()
returns void
language plpgsql
security definer set search_path = public
as $$
declare
  u auth.users;
  meta jsonb;
begin
  if auth.uid() is null or exists (select 1 from public.profiles where id = auth.uid()) then
    return;
  end if;

  select * into u from auth.users where id = auth.uid();
  meta := coalesce(u.raw_user_meta_data, '{}'::jsonb);

  insert into public.profiles (
    id, role, email, rank, first_name, last_name, school,
    year, company, platoon, squad, order_no, affiliation
  ) values (
    u.id,
    case when meta->>'role' = 'trainer' then 'trainer' else 'student' end,
    u.email,
    nullif(meta->>'rank', ''),
    coalesce(meta->>'first_name', ''),
    coalesce(meta->>'last_name', ''),
    nullif(meta->>'school', ''),
    nullif(meta->>'year', '')::smallint,
    nullif(meta->>'company', ''),
    nullif(meta->>'platoon', ''),
    nullif(meta->>'squad', ''),
    nullif(meta->>'order_no', ''),
    nullif(meta->>'affiliation', '')
  )
  on conflict (id) do nothing;
end;
$$;

-- สร้างโปรไฟล์ให้ทุกบัญชีที่ยังไม่มี (รันครั้งเดียวตอนรันไฟล์นี้)
insert into public.profiles (
  id, role, email, rank, first_name, last_name, school,
  year, company, platoon, squad, order_no, affiliation
)
select
  u.id,
  case when u.raw_user_meta_data->>'role' = 'trainer' then 'trainer' else 'student' end,
  u.email,
  nullif(u.raw_user_meta_data->>'rank', ''),
  coalesce(u.raw_user_meta_data->>'first_name', ''),
  coalesce(u.raw_user_meta_data->>'last_name', ''),
  nullif(u.raw_user_meta_data->>'school', ''),
  nullif(u.raw_user_meta_data->>'year', '')::smallint,
  nullif(u.raw_user_meta_data->>'company', ''),
  nullif(u.raw_user_meta_data->>'platoon', ''),
  nullif(u.raw_user_meta_data->>'squad', ''),
  nullif(u.raw_user_meta_data->>'order_no', ''),
  nullif(u.raw_user_meta_data->>'affiliation', '')
from auth.users u
where not exists (select 1 from public.profiles p where p.id = u.id);

-- เติมช่องที่ยังว่างในโปรไฟล์ จากข้อมูลที่กรอกตอนสมัคร (ไม่ทับค่าที่มีอยู่แล้ว)
update public.profiles p set
  rank        = coalesce(p.rank,        nullif(u.raw_user_meta_data->>'rank', '')),
  first_name  = coalesce(nullif(p.first_name, ''), u.raw_user_meta_data->>'first_name', ''),
  last_name   = coalesce(nullif(p.last_name, ''),  u.raw_user_meta_data->>'last_name', ''),
  school      = coalesce(p.school,      nullif(u.raw_user_meta_data->>'school', '')),
  year        = coalesce(p.year,        nullif(u.raw_user_meta_data->>'year', '')::smallint),
  company     = coalesce(p.company,     nullif(u.raw_user_meta_data->>'company', '')),
  platoon     = coalesce(p.platoon,     nullif(u.raw_user_meta_data->>'platoon', '')),
  squad       = coalesce(p.squad,       nullif(u.raw_user_meta_data->>'squad', '')),
  order_no    = coalesce(p.order_no,    nullif(u.raw_user_meta_data->>'order_no', '')),
  affiliation = coalesce(p.affiliation, nullif(u.raw_user_meta_data->>'affiliation', ''))
from auth.users u
where u.id = p.id;

-- ---------------------------------------------------------------------
-- 7. รูปโปรไฟล์ (Supabase Storage bucket "avatars")
-- ---------------------------------------------------------------------
alter table public.profiles add column if not exists avatar_url text;

-- bucket สาธารณะ (ดูรูปได้ผ่านลิงก์) จำกัดเฉพาะรูป ขนาดไม่เกิน 2 MB
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('avatars', 'avatars', true, 2097152, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- อัปโหลด/แก้/ลบ ได้เฉพาะไฟล์ในโฟลเดอร์ของตัวเอง: avatars/<user id>/...
drop policy if exists "avatars insert own" on storage.objects;
create policy "avatars insert own" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "avatars update own" on storage.objects;
create policy "avatars update own" on storage.objects
  for update to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "avatars delete own" on storage.objects;
create policy "avatars delete own" on storage.objects
  for delete to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "avatars select own" on storage.objects;
create policy "avatars select own" on storage.objects
  for select to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

-- สิทธิ์เรียกฟังก์ชัน
grant execute on function public.join_classroom(text) to authenticated;
grant execute on function public.ensure_profile() to authenticated;
