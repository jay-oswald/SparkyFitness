-- Drop the previous table if it exists (for re-running during development)
drop table if exists public.user_api_keys cascade;

-- Create user_api_keys table with description and permissions
create table public.user_api_keys (
  id uuid not null default gen_random_uuid (),
  user_id uuid not null,
  api_key text not null unique,
  description text null, -- Added for user-defined description of the key's purpose
  permissions jsonb not null default '{}'::jsonb, -- Added for granular control over key capabilities
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  last_used_at timestamp with time zone null,
  is_active boolean not null default true,
  constraint user_api_keys_pkey primary key (id),
  constraint user_api_keys_user_id_fkey foreign KEY (user_id) references auth.users (id) on delete CASCADE
) TABLESPACE pg_default;

-- Enable Row Level Security (RLS) for user_api_keys table
alter table public.user_api_keys enable row level security;

-- Create RLS policy for SELECT: Users can select their own API keys
create policy "Users can view their own API keys."
on public.user_api_keys for select
to authenticated
using (auth.uid() = user_id);

-- Create RLS policy for INSERT: Users can insert their own API keys
create policy "Users can create their own API keys."
on public.user_api_keys for insert
to authenticated
with check (auth.uid() = user_id);

-- Create RLS policy for UPDATE: Users can update their own API keys (e.g., deactivate, update last_used_at, description, permissions)
create policy "Users can update their own API keys."
on public.user_api_keys for update
to authenticated
using (auth.uid() = user_id);

-- Create RLS policy for DELETE: Users can delete their own API keys
create policy "Users can delete their own API keys."
on public.user_api_keys for delete
to authenticated
using (auth.uid() = user_id);

-- Add a function to generate a new API key for a user with default permissions
create or replace function public.generate_user_api_key(p_user_id uuid, p_description text default null)
returns text
language plpgsql
security definer
as $$
declare
  new_api_key text;
begin
  -- Generate a random UUID and use it as the API key
  new_api_key := gen_random_uuid();

  -- Insert the new API key into the user_api_keys table with default permissions for health data write
  insert into public.user_api_keys (user_id, api_key, description, permissions)
  values (p_user_id, new_api_key, p_description, '{"health_data_write": true}'::jsonb);

  return new_api_key;
end;
$$;

-- Add a function to revoke an API key for a user
create or replace function public.revoke_user_api_key(p_user_id uuid, p_api_key text)
returns void
language plpgsql
security definer
as $$
begin
  update public.user_api_keys
  set is_active = false, updated_at = now()
  where user_id = p_user_id and api_key = p_api_key;
end;
$$;

-- Add a function to revoke all API keys for a user
create or replace function public.revoke_all_user_api_keys(p_user_id uuid)
returns void
language plpgsql
security definer
as $$
begin
  update public.user_api_keys
  set is_active = false, updated_at = now()
  where user_id = p_user_id;
end;
$$;