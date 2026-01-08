-- Create the table
create table vouchers
(
    id uuid default gen_random_uuid() primary key,
    created_at timestamp
    with time zone default timezone
    ('utc'::text, now
    ()) not null,
  percentage numeric not null,
  min_condition numeric not null,
  max_discount numeric not null,
  code text
);

    -- Set up Row Level Security (RLS)
    alter table vouchers enable row level security;

    -- Create the table
    create table vouchers
    (
        id uuid default gen_random_uuid() primary key,
        created_at timestamp
        with time zone default timezone
        ('utc'::text, now
        ()) not null,
  percentage numeric not null,
  min_condition numeric not null,
  max_discount numeric not null,
  code text
);

        -- Set up Row Level Security (RLS)
        alter table vouchers enable row level security;

        -- Create a policy that allows anyone to read vouchers (if public) 
        -- OR just allow authenticated users. For this simple app, we might want public read/write for demo purposes, 
        -- but ideally, we should restrict write.
        -- For now, let's allow public read/write for simplicity of the demo, 
        -- BUT WARN the user this is not for production.

        create policy "Enable read access for all users" on vouchers
  for
        select using (true);

        create policy "Enable insert access for all users" on vouchers
  for
        insert with check
            (true)
        ;


        -- Create a table for saved comparisons
        create table saved_comparisons
        (
            id uuid default uuid_generate_v4() primary key,
            title text,
            stores jsonb not null,
            created_at timestamp
            with time zone default timezone
            ('utc'::text, now
            ()) not null
);

            -- Set up Row Level Security (RLS) for saved_comparisons
            alter table saved_comparisons enable row level security;

            create policy "Enable read access for all users"
  on saved_comparisons for
            select
                using (true);

            create policy "Enable insert access for all users"
  on saved_comparisons for
            insert
  with check
                (true)
            ;

            create policy "Enable delete access for all users"
  on saved_comparisons for
            delete
  using (true);
