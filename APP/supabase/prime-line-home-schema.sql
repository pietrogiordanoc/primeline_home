-- PrimeLineHome: private job application storage and review metadata.
-- Run this script once in Supabase SQL Editor.

create extension if not exists pgcrypto;

create table if not exists public.job_applications (
  id uuid primary key default gen_random_uuid(),
  idempotency_key text not null unique,
  applicant_name text not null,
  applicant_email text not null,
  template_version text not null,
  status text not null default 'received'
    check (status in ('received', 'under_review', 'closed', 'failed')),
  final_pdf_path text not null,
  resume_path text,
  signature_accepted_at timestamptz,
  signature_ip_hash text,
  submitted_at timestamptz not null default timezone('utc', now()),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create index if not exists job_applications_submitted_at_idx
  on public.job_applications (submitted_at desc);

create index if not exists job_applications_status_idx
  on public.job_applications (status);

alter table public.job_applications enable row level security;

revoke all on table public.job_applications from anon, authenticated;
grant select, update on table public.job_applications to authenticated;
grant usage on schema public to service_role;
grant select, insert, update, delete on table public.job_applications to service_role;

create or replace function public.is_prime_line_hr()
returns boolean
language sql
stable
as $$
  select coalesce((auth.jwt() -> 'app_metadata' ->> 'role') in ('hr', 'admin'), false);
$$;

drop policy if exists "HR can view job applications" on public.job_applications;
create policy "HR can view job applications"
  on public.job_applications
  for select
  to authenticated
  using (public.is_prime_line_hr());

drop policy if exists "HR can update job applications" on public.job_applications;
create policy "HR can update job applications"
  on public.job_applications
  for update
  to authenticated
  using (public.is_prime_line_hr())
  with check (public.is_prime_line_hr());

insert into storage.buckets (id, name, public)
values ('prime-line-home-documents', 'prime-line-home-documents', false)
on conflict (id) do update set public = excluded.public;

drop policy if exists "HR can view application documents" on storage.objects;
create policy "HR can view application documents"
  on storage.objects
  for select
  to authenticated
  using (
    bucket_id = 'prime-line-home-documents'
    and public.is_prime_line_hr()
  );

drop policy if exists "HR can delete application documents" on storage.objects;
create policy "HR can delete application documents"
  on storage.objects
  for delete
  to authenticated
  using (
    bucket_id = 'prime-line-home-documents'
    and public.is_prime_line_hr()
  );

create or replace function public.set_job_application_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

drop trigger if exists job_applications_updated_at on public.job_applications;
create trigger job_applications_updated_at
before update on public.job_applications
for each row execute function public.set_job_application_updated_at();