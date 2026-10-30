// Checks the migration and its permission rules against an in-memory Postgres. Run: npm run test:db
import { PGlite } from '@electric-sql/pglite';
import fs from 'node:fs';

const db = new PGlite();
const stubs = `
create schema auth;
create table auth.users (id uuid primary key default gen_random_uuid(), email text);
create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('app.uid', true), '')::uuid $$;
create schema storage;
create table storage.buckets (id text primary key, name text, public boolean);
create table storage.objects (id uuid primary key default gen_random_uuid(), bucket_id text, name text); alter table storage.objects enable row level security;
create function storage.foldername(name text) returns text[] language sql as $$ select (string_to_array(name, '/'))[1:array_length(string_to_array(name,'/'),1)-1] $$;
create role authenticated;
`;
await db.exec(stubs);
await db.exec(fs.readFileSync(new URL('../supabase/migrations/0001_init.sql', import.meta.url), 'utf8'));
await db.exec(fs.readFileSync(new URL('../supabase/migrations/0002_access_links.sql', import.meta.url), 'utf8'));
await db.exec(fs.readFileSync(new URL('../supabase/migrations/0003_reopen_approved.sql', import.meta.url), 'utf8'));
await db.exec(`grant usage on schema public, auth, storage to authenticated;
grant all on all tables in schema public to authenticated;
grant all on all tables in schema storage to authenticated;
grant execute on all functions in schema public, auth, storage to authenticated;`);
console.log('migration ok');

const q = async (sql, params) => (await db.query(sql, params)).rows;
const as = async (uid, fn) => {
  await db.exec(`set role authenticated; select set_config('app.uid', '${uid}', false);`);
  try { return await fn(); } finally { await db.exec(`reset role; select set_config('app.uid', '', false);`); }
};

await q(`insert into agency_admins values ('admin@agency.com')`);
const [admin] = await q(`insert into auth.users (email) values ('Admin@Agency.com') returning id`);
const [ws] = await q(`insert into workspaces (name) values ('AWE Group') returning id`);
const [ws2] = await q(`insert into workspaces (name) values ('Ooranya') returning id`);
await q(`insert into workspace_invites (workspace_id, email) values ($1, 'owner@awe.com')`, [ws.id]);
const [owner] = await q(`insert into auth.users (email) values ('owner@awe.com') returning id`);
const mem = await q(`select role from workspace_members where user_id = $1`, [owner.id]);
console.log('invite claimed:', mem);

const [draft] = await q(`insert into posts (workspace_id, title) values ($1, 'draft one') returning id`, [ws.id]);
const [ready] = await q(`insert into posts (workspace_id, title, status, version) values ($1, 'ready one', 'ready', 1) returning id`, [ws.id]);
await q(`insert into posts (workspace_id, title, status) values ($1, 'other client', 'ready')`, [ws2.id]);
await q(`insert into platform_versions (post_id, platform, caption) values ($1, 'linkedin', 'Hello crew')`, [ready.id]);

console.log('admin is admin:', await as(admin.id, () => q(`select is_agency_admin() a`)));
console.log('owner sees posts:', await as(owner.id, () => q(`select title, status from posts`)));
console.log('owner sees workspaces:', await as(owner.id, () => q(`select name from workspaces`)));
console.log('admin sees posts:', (await as(admin.id, () => q(`select title from posts`))).length);

// client cannot update posts directly
const upd = await as(owner.id, () => q(`update posts set status = 'approved' returning id`));
console.log('owner direct update rows:', upd.length);

// decision without reason fails
try { await as(owner.id, () => q(`select decide_post($1, 'changes_requested', '')`, [ready.id])); console.log('BAD: no reason allowed'); }
catch (e) { console.log('reason required:', e.message); }

// approve
console.log(await as(owner.id, () => q(`select decide_post($1, 'approved') s`, [ready.id])));
console.log('learning:', await q(`select kind, after_text from learning_records`));
try { await as(owner.id, () => q(`select decide_post($1, 'approved')`, [ready.id])); } catch (e) { console.log('second decide:', e.message); }

// comments and suggestions
await as(owner.id, () => q(`insert into comments (post_id, version, author_id, body, pin_x, pin_y) values ($1, 1, $2, 'swap photo', 0.4, 0.5)`, [ready.id, owner.id]));
try { await as(owner.id, () => q(`insert into comments (post_id, version, author_id, body) values ($1, 0, $2, 'sneaky')`, [draft.id, owner.id])); console.log('BAD: comment on draft'); }
catch (e) { console.log('comment on draft blocked'); }
await as(owner.id, () => q(`insert into caption_suggestions (post_id, platform, version, author_id, original, suggested) values ($1, 'linkedin', 1, $2, 'Hello crew', 'Hello team')`, [ready.id, owner.id]));
console.log('suggestion stored');

// storage
await q(`insert into storage.objects (bucket_id, name) values ('media', $1), ('media', $2)`, [`${ws.id}/${ready.id}/a.jpg`, `${ws2.id}/x/b.jpg`]);
console.log('owner storage objects:', (await as(owner.id, () => q(`select name from storage.objects`))).length);
try { await as(owner.id, () => q(`insert into storage.objects (bucket_id, name) values ('media', 'x/y.jpg')`)); console.log('BAD upload'); }
catch { console.log('client upload blocked'); }
console.log('profiles visible to owner:', (await as(owner.id, () => q(`select email from profiles`))).map(r => r.email));

// direct links: only the agency can see or make them
await as(admin.id, () => q(`insert into access_links (token, workspace_id, email) values ('tok123', $1, 'owner@awe.com')`, [ws.id]));
console.log('admin sees links:', (await as(admin.id, () => q(`select token from access_links`))).length);
console.log('client sees links:', (await as(owner.id, () => q(`select token from access_links`))).length);
try { await as(owner.id, () => q(`insert into access_links (token, workspace_id, email) values ('x', $1, 'me@x.com')`, [ws.id])); console.log('BAD: client made a link'); }
catch { console.log('client cannot make links'); }

// a second approver can request changes after the post was approved
console.log('reopen:', await as(owner.id, () => q(`select decide_post($1, 'changes_requested', 'Wrong photo on slide 2') s`, [ready.id])));
console.log('approved examples after reopen:', (await q(`select 1 from learning_records where post_id = $1 and kind = 'approved_caption'`, [ready.id])).length);
try { await as(owner.id, () => q(`select decide_post($1, 'approved')`, [ready.id])); console.log('BAD: approved a post being revised'); }
catch (e) { console.log('cannot approve while being revised:', e.message); }
