-- Sign Off: post approval app, initial schema
-- Run in the Supabase SQL editor (or `supabase db push`).

-- ---------------------------------------------------------------------------
-- Types
-- ---------------------------------------------------------------------------
create type member_role as enum ('approver', 'viewer');
create type post_status as enum ('draft', 'ready', 'changes_requested', 'approved', 'rejected', 'scheduled', 'published');
create type platform as enum ('linkedin', 'instagram', 'facebook');
create type media_kind as enum ('image', 'video');
create type decision as enum ('approved', 'changes_requested', 'rejected');
create type suggestion_status as enum ('pending', 'accepted', 'rejected');

-- ---------------------------------------------------------------------------
-- People
-- ---------------------------------------------------------------------------
-- Emails allowed full agency access. Add yours after running this file:
--   insert into agency_admins (email) values ('you@yourdomain.com');
create table agency_admins (
  email text primary key
);

create table profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text not null unique,
  full_name text,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Workspaces (one per client)
-- ---------------------------------------------------------------------------
create table workspaces (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  logo_path text,
  -- planned post times and the calendar are shown in this timezone
  timezone text not null default 'Australia/Perth',
  created_at timestamptz not null default now()
);

create table workspace_members (
  workspace_id uuid not null references workspaces (id) on delete cascade,
  user_id uuid not null references profiles (id) on delete cascade,
  role member_role not null default 'approver',
  created_at timestamptz not null default now(),
  primary key (workspace_id, user_id)
);

-- Invites are claimed automatically the first time that email signs in.
create table workspace_invites (
  workspace_id uuid not null references workspaces (id) on delete cascade,
  email text not null,
  role member_role not null default 'approver',
  created_at timestamptz not null default now(),
  primary key (workspace_id, email)
);

-- ---------------------------------------------------------------------------
-- Posts
-- ---------------------------------------------------------------------------
create table posts (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces (id) on delete cascade,
  title text not null default 'Untitled post',
  context_note text,
  status post_status not null default 'draft',
  planned_at timestamptz,
  -- 0 until first sent; bumped each time the post is sent for approval
  version int not null default 0,
  sent_at timestamptz,
  created_by uuid references profiles (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index posts_workspace_idx on posts (workspace_id, status);
create index posts_planned_idx on posts (workspace_id, planned_at);

create table media_items (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references posts (id) on delete cascade,
  storage_path text not null,
  kind media_kind not null,
  position int not null default 0,
  width int,
  height int,
  duration_sec numeric,
  file_name text,
  created_at timestamptz not null default now()
);
create index media_post_idx on media_items (post_id, position);

create table platform_versions (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references posts (id) on delete cascade,
  platform platform not null,
  caption text not null default '',
  -- instagram only: true when the post is a Reel
  is_reel boolean not null default false,
  updated_at timestamptz not null default now(),
  unique (post_id, platform)
);

-- Snapshot of the post each time it is sent for approval
create table post_versions (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references posts (id) on delete cascade,
  version int not null,
  snapshot jsonb not null,
  sent_by uuid references profiles (id),
  sent_at timestamptz not null default now(),
  unique (post_id, version)
);

create table comments (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references posts (id) on delete cascade,
  version int not null,
  author_id uuid not null references profiles (id),
  body text not null,
  media_item_id uuid references media_items (id) on delete set null,
  -- pin position on an image, 0..1 of width and height
  pin_x numeric check (pin_x between 0 and 1),
  pin_y numeric check (pin_y between 0 and 1),
  -- pin position in a video, seconds
  at_seconds numeric,
  platform platform,
  resolved boolean not null default false,
  created_at timestamptz not null default now()
);
create index comments_post_idx on comments (post_id, created_at);

create table caption_suggestions (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references posts (id) on delete cascade,
  platform platform not null,
  version int not null,
  author_id uuid not null references profiles (id),
  original text not null,
  suggested text not null,
  note text,
  status suggestion_status not null default 'pending',
  created_at timestamptz not null default now()
);

create table approvals (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references posts (id) on delete cascade,
  version int not null,
  user_id uuid not null references profiles (id),
  decision decision not null,
  reason text,
  created_at timestamptz not null default now()
);
create index approvals_post_idx on approvals (post_id, version);

-- What the caption generator learns from (filled from phase 1 so history builds up)
create table learning_records (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces (id) on delete cascade,
  post_id uuid references posts (id) on delete set null,
  platform platform,
  kind text not null check (kind in ('approved_caption', 'accepted_edit', 'change_reason', 'rejection_reason')),
  before_text text,
  after_text text,
  note text,
  created_at timestamptz not null default now()
);
create index learning_ws_idx on learning_records (workspace_id, kind);

-- ---------------------------------------------------------------------------
-- Helper functions (security definer so policies don't recurse)
-- ---------------------------------------------------------------------------
create or replace function is_agency_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from profiles p join agency_admins a on lower(a.email) = lower(p.email)
    where p.id = auth.uid()
  );
$$;

create or replace function member_role_in(ws uuid) returns member_role
language sql stable security definer set search_path = public as $$
  select role from workspace_members where workspace_id = ws and user_id = auth.uid();
$$;

create or replace function can_see_workspace(ws uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select is_agency_admin() or member_role_in(ws) is not null;
$$;

-- Clients see every post except drafts
create or replace function can_see_post(pid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from posts p where p.id = pid
      and (is_agency_admin() or (member_role_in(p.workspace_id) is not null and p.status <> 'draft'))
  );
$$;

create or replace function post_workspace(pid uuid) returns uuid
language sql stable security definer set search_path = public as $$
  select workspace_id from posts where id = pid;
$$;

-- ---------------------------------------------------------------------------
-- New users: create a profile and claim any invites for their email
-- ---------------------------------------------------------------------------
create or replace function handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into profiles (id, email) values (new.id, lower(new.email))
  on conflict (id) do nothing;

  insert into workspace_members (workspace_id, user_id, role)
  select workspace_id, new.id, role from workspace_invites where lower(email) = lower(new.email)
  on conflict do nothing;

  delete from workspace_invites where lower(email) = lower(new.email);
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();

-- Also callable after sign in, for invites sent to people who already have an account
create or replace function claim_invites() returns void
language plpgsql security definer set search_path = public as $$
declare
  my_email text;
begin
  select email into my_email from profiles where id = auth.uid();
  if my_email is null then return; end if;

  insert into workspace_members (workspace_id, user_id, role)
  select workspace_id, auth.uid(), role from workspace_invites where lower(email) = lower(my_email)
  on conflict do nothing;

  delete from workspace_invites where lower(email) = lower(my_email);
end;
$$;

-- ---------------------------------------------------------------------------
-- Client decision: the only way a client changes a post's status
-- ---------------------------------------------------------------------------
create or replace function decide_post(pid uuid, choice decision, why text default null)
returns post_status
language plpgsql security definer set search_path = public as $$
declare
  p posts;
  new_status post_status;
begin
  select * into p from posts where id = pid for update;
  if p.id is null then raise exception 'Post not found'; end if;

  if not (is_agency_admin() or member_role_in(p.workspace_id) = 'approver') then
    raise exception 'Only approvers can decide on posts';
  end if;
  if p.status <> 'ready' then
    raise exception 'This post is not waiting for approval';
  end if;
  if choice <> 'approved' and coalesce(trim(why), '') = '' then
    raise exception 'Add a short reason so the changes are clear';
  end if;

  insert into approvals (post_id, version, user_id, decision, reason)
  values (pid, p.version, auth.uid(), choice, nullif(trim(why), ''));

  new_status := case choice
    when 'approved' then 'approved'::post_status
    when 'changes_requested' then 'changes_requested'::post_status
    else 'rejected'::post_status end;

  update posts set status = new_status, updated_at = now() where id = pid;

  if choice = 'approved' then
    insert into learning_records (workspace_id, post_id, platform, kind, after_text)
    select p.workspace_id, pid, pv.platform, 'approved_caption', pv.caption
    from platform_versions pv where pv.post_id = pid and pv.caption <> '';
  else
    insert into learning_records (workspace_id, post_id, kind, note)
    values (p.workspace_id, pid,
      case when choice = 'rejected' then 'rejection_reason' else 'change_reason' end,
      trim(why));
  end if;

  return new_status;
end;
$$;

-- ---------------------------------------------------------------------------
-- Row level security
-- ---------------------------------------------------------------------------
alter table agency_admins enable row level security;
alter table profiles enable row level security;
alter table workspaces enable row level security;
alter table workspace_members enable row level security;
alter table workspace_invites enable row level security;
alter table posts enable row level security;
alter table media_items enable row level security;
alter table platform_versions enable row level security;
alter table post_versions enable row level security;
alter table comments enable row level security;
alter table caption_suggestions enable row level security;
alter table approvals enable row level security;
alter table learning_records enable row level security;

-- agency_admins: admins can read the list; changes only via SQL editor
create policy "admins read admin list" on agency_admins for select using (is_agency_admin());

-- profiles: see yourself, the agency team, people in your workspaces, everyone if admin
create or replace function is_admin_profile(pid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from profiles p join agency_admins a on lower(a.email) = lower(p.email) where p.id = pid
  );
$$;

create policy "read profiles" on profiles for select using (
  id = auth.uid() or is_agency_admin() or is_admin_profile(id) or exists (
    select 1 from workspace_members a join workspace_members b on a.workspace_id = b.workspace_id
    where a.user_id = auth.uid() and b.user_id = profiles.id
  )
);
create policy "update own profile" on profiles for update using (id = auth.uid());

-- workspaces
create policy "read workspaces" on workspaces for select using (can_see_workspace(id));
create policy "admins manage workspaces" on workspaces for all using (is_agency_admin()) with check (is_agency_admin());

-- members and invites: admins manage, members can see who else is in their workspace
create policy "read members" on workspace_members for select using (can_see_workspace(workspace_id));
create policy "admins manage members" on workspace_members for all using (is_agency_admin()) with check (is_agency_admin());
create policy "admins manage invites" on workspace_invites for all using (is_agency_admin()) with check (is_agency_admin());

-- posts: admins do everything; clients read non-drafts (status changes go through decide_post)
create policy "read posts" on posts for select using (can_see_post(id));
create policy "admins manage posts" on posts for all using (is_agency_admin()) with check (is_agency_admin());

-- media, captions, versions: follow the post
create policy "read media" on media_items for select using (can_see_post(post_id));
create policy "admins manage media" on media_items for all using (is_agency_admin()) with check (is_agency_admin());

create policy "read platform versions" on platform_versions for select using (can_see_post(post_id));
create policy "admins manage platform versions" on platform_versions for all using (is_agency_admin()) with check (is_agency_admin());

create policy "read post versions" on post_versions for select using (can_see_post(post_id));
create policy "admins manage post versions" on post_versions for all using (is_agency_admin()) with check (is_agency_admin());

-- comments: anyone who can see the post can comment (viewers included) and edit their own
create policy "read comments" on comments for select using (can_see_post(post_id));
create policy "write comments" on comments for insert with check (author_id = auth.uid() and can_see_post(post_id));
create policy "edit own comments" on comments for update using (author_id = auth.uid() or is_agency_admin());
create policy "delete own comments" on comments for delete using (author_id = auth.uid() or is_agency_admin());

-- caption suggestions: approvers suggest, admins accept or reject
create policy "read suggestions" on caption_suggestions for select using (can_see_post(post_id));
create policy "approvers suggest" on caption_suggestions for insert with check (
  author_id = auth.uid() and can_see_post(post_id)
  and (is_agency_admin() or member_role_in(post_workspace(post_id)) = 'approver')
);
create policy "admins manage suggestions" on caption_suggestions for update using (is_agency_admin());
create policy "delete own suggestions" on caption_suggestions for delete using (author_id = auth.uid() or is_agency_admin());

-- approvals are written by decide_post only
create policy "read approvals" on approvals for select using (can_see_post(post_id));

-- learning records are agency-only
create policy "admins manage learning" on learning_records for all using (is_agency_admin()) with check (is_agency_admin());

-- ---------------------------------------------------------------------------
-- Storage: private "media" bucket, files stored as <workspace_id>/<post_id>/<file>
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public) values ('media', 'media', false)
on conflict (id) do nothing;

create policy "media read" on storage.objects for select using (
  bucket_id = 'media' and can_see_workspace(((storage.foldername(name))[1])::uuid)
);
create policy "media admin insert" on storage.objects for insert with check (bucket_id = 'media' and is_agency_admin());
create policy "media admin update" on storage.objects for update using (bucket_id = 'media' and is_agency_admin());
create policy "media admin delete" on storage.objects for delete using (bucket_id = 'media' and is_agency_admin());
