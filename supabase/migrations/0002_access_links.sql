-- Direct links: each client contact gets a private link that signs them in without an email.
-- Run once in the Supabase SQL editor.

create table access_links (
  token text primary key,
  workspace_id uuid not null references workspaces (id) on delete cascade,
  email text not null,
  created_at timestamptz not null default now(),
  unique (workspace_id, email)
);

alter table access_links enable row level security;

-- Only the agency can see or change links. The sign-in route reads them with the service key.
create policy admins_manage_access_links on access_links
  for all using (is_agency_admin()) with check (is_agency_admin());
