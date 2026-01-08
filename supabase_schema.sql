-- Enable UUID extension if not already enabled
create extension
if not exists "uuid-ossp";

-- Create vouchers table if it doesn't exist
create table
if not exists vouchers
(
  id uuid default gen_random_uuid
() primary key,
  created_at timestamp
with time zone default timezone
('utc'::text, now
()) not null,
  percentage numeric not null,
  min_condition numeric not null,
  max_discount numeric not null,
  code text
);

-- Set up Row Level Security (RLS) for vouchers
alter table vouchers enable row level security;

-- Policies for vouchers (drop if exists to avoid errors on re-run, or use DO block)
drop policy
if exists "Enable read access for all users" on vouchers;
create policy "Enable read access for all users" on vouchers
  for
select using (true);

drop policy
if exists "Enable insert access for all users" on vouchers;
create policy "Enable insert access for all users" on vouchers
  for
insert with check
    (true)
;

drop policy
if exists "Enable delete access for all users" on vouchers;
create policy "Enable delete access for all users" on vouchers
  for
delete using (true);


-- Create saved_comparisons table if it doesn't exist
create table
if not exists saved_comparisons
(
  id uuid default gen_random_uuid
() primary key,
  title text,
  stores jsonb not null,
  created_at timestamp
with time zone default timezone
('utc'::text, now
()) not null
);

-- Set up Row Level Security (RLS) for saved_comparisons
alter table saved_comparisons enable row level security;

-- Policies for saved_comparisons
drop policy
if exists "Enable read access for all users" on saved_comparisons;
create policy "Enable read access for all users"
  on saved_comparisons for
select
    using (true);

drop policy
if exists "Enable insert access for all users" on saved_comparisons;
create policy "Enable insert access for all users"
  on saved_comparisons for
insert
  with check
    (true)
;

drop policy
if exists "Enable delete access for all users" on saved_comparisons;
create policy "Enable delete access for all users"
  on saved_comparisons for
delete
  using (true);
