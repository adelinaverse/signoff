-- Let an approver request changes (or reject) after a post has already been approved,
-- e.g. when one person approved it and a second person wants something changed.
-- Run once in the Supabase SQL editor.

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
  if choice = 'approved' and p.status <> 'ready' then
    raise exception 'This post is not waiting for approval';
  end if;
  if choice <> 'approved' and p.status not in ('ready', 'approved', 'scheduled') then
    raise exception 'This post can no longer be changed from here';
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
    -- A post that was approved and is now reopened no longer counts as an approved example
    if p.status in ('approved', 'scheduled') then
      delete from learning_records where post_id = pid and kind = 'approved_caption';
    end if;
    insert into learning_records (workspace_id, post_id, kind, note)
    values (p.workspace_id, pid,
      case when choice = 'rejected' then 'rejection_reason' else 'change_reason' end, trim(why));
  end if;

  return new_status;
end;
$$;
