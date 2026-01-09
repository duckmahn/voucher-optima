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
  code text,
  user_id uuid references auth.users
(id),
  product_price numeric,
  product_url text,
  product_image text
);

-- Set up Row Level Security (RLS) for vouchers
alter table vouchers enable row level security;

-- Policies for vouchers
drop policy
if exists "Enable read access for all users" on vouchers;
drop policy
if exists "Enable insert access for all users" on vouchers;
drop policy
if exists "Enable delete access for all users" on vouchers;
drop policy
if exists "Users can view their own vouchers" on vouchers;
drop policy
if exists "Users can insert their own vouchers" on vouchers;
drop policy
if exists "Users can delete their own vouchers" on vouchers;

-- Create new policies based on user_id
create policy "Users can view their own vouchers" on vouchers
  for
select using (auth.uid() = user_id);

create policy "Users can insert their own vouchers" on vouchers
  for
insert with check (auth.uid() =
user_id);

create policy "Users can delete their own vouchers" on vouchers
  for
delete using (auth.uid
() = user_id);

-- Policies for saved_comparisons
drop policy
if exists "Enable read access for all users" on saved_comparisons;
drop policy
if exists "Enable insert access for all users" on saved_comparisons;
drop policy
if exists "Enable delete access for all users" on saved_comparisons;
drop policy
if exists "Users can view their own comparisons" on saved_comparisons;
drop policy
if exists "Users can insert their own comparisons" on saved_comparisons;
drop policy
if exists "Users can delete their own comparisons" on saved_comparisons;

-- Create new policies based on user_id
create policy "Users can view their own comparisons" on saved_comparisons
  for
select using (auth.uid() = user_id);

create policy "Users can insert their own comparisons" on saved_comparisons
  for
insert with check (auth.uid() =
user_id);

create policy "Users can delete their own comparisons" on saved_comparisons
  for
delete using (auth.uid
() = user_id);
