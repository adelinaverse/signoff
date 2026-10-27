# Sign Off

A social post approval app. You upload the imagery and captions, the client sees each post as it will look on LinkedIn, Instagram or Facebook, leaves comments pinned to the image or a moment in the video, suggests caption edits, and approves, requests changes or rejects.

This is milestone one of the phase 1 spec: workspaces, posts and media, the full approval loop, feed previews and format checks, version history, email digests and the export for manual scheduling. The brand profile, brand checks and caption generator come next and build on the tables already here.

The app name is neutral and set with `NEXT_PUBLIC_APP_NAME`, so you can rename it any time.

## What you need

- A [Supabase](https://supabase.com) project (database, logins and file storage)
- A [Vercel](https://vercel.com) account connected to GitHub
- A [Resend](https://resend.com) account for emails (optional to start)

## 1. Set up Supabase

1. Create a new project. Pick the Sydney region so it's close to your clients.
2. Open **SQL Editor**, paste the whole of `supabase/migrations/0001_init.sql` and run it.
3. In the same editor, make yourself the agency admin:

   ```sql
   insert into agency_admins (email) values ('you@yourdomain.com');
   ```

   Anyone in this table can see and manage every client. Add team members the same way later.
4. Go to **Authentication > URL Configuration**:
   - Site URL: your Vercel address, e.g. `https://signoff.vercel.app`
   - Redirect URLs: add `https://signoff.vercel.app/auth/callback` and `http://localhost:3000/auth/callback`
5. Go to **Authentication > Emails > SMTP Settings** and connect Resend's SMTP (Resend shows the details under Settings > SMTP). Supabase's built-in email only sends a few sign-in links an hour, which runs out fast once clients are logging in.
6. Go to **Storage > Settings** and check the upload size limit. The free plan caps each file at 50 MB, which is fine for images but tight for Reels. On the Pro plan you can raise it to a few hundred MB.

## 2. Deploy to Vercel

1. Push this folder to a new private GitHub repo.
2. In Vercel, **Add New > Project**, import the repo. It detects Next.js on its own.
3. Add these environment variables (Supabase values are under **Project Settings > API**):

   | Name | Value |
   | --- | --- |
   | `NEXT_PUBLIC_SUPABASE_URL` | Project URL |
   | `NEXT_PUBLIC_SUPABASE_ANON_KEY` | anon public key |
   | `SUPABASE_SERVICE_ROLE_KEY` | service_role key (secret, used only by the daily reminder) |
   | `NEXT_PUBLIC_SITE_URL` | your Vercel address |
   | `NEXT_PUBLIC_APP_NAME` | whatever you want clients to see |
   | `RESEND_API_KEY` | from Resend |
   | `EMAIL_FROM` | e.g. `Sign Off <approvals@yourdomain.com>` (domain verified in Resend) |
   | `CRON_SECRET` | any long random string |
   | `REMINDER_DAYS` | `3` |

4. Deploy. `vercel.json` sets up a daily job at 9am Perth time that reminds approvers about posts waiting longer than `REMINDER_DAYS`.

## 3. First run

1. Open the app and sign in with your admin email. You'll get a link by email.
2. Add a client (e.g. AWE Group). Upload their logo, check the timezone (defaults to Perth), and add the owner's email as an **Approver**. They get an invite email and are linked to the workspace the first time they sign in.
3. Create a post: add images, a carousel or a video, tick the platforms, write each caption, set the planned date, then **Send for approval**.
4. Use **See what the client sees** to check their view, then **Email client** on the Posts list to send them one digest of everything waiting.

## How a post moves

Draft, then Ready for approval. The client approves, requests changes (with a reason) or rejects. Changes requested goes back to you; when you resend it becomes a new version and the client can compare it with the last one. Once approved, **Download for scheduling** gives you a zip of the media in order plus each caption, you schedule it yourself, then mark it Scheduled and Published.

Every approved caption, accepted client edit and change reason is saved to `learning_records`, so the caption generator will have real history to learn from when it's added.

## Working on it locally

```bash
cp .env.example .env.local   # fill in your Supabase values
npm install
npm run dev                  # http://localhost:3000
npm run test:db              # checks the migration and permission rules
```

## Where things live

- `supabase/migrations/0001_init.sql` holds every table, the permission rules (clients only ever see their own workspace and never drafts) and the approval function.
- `lib/actions.ts` has everything that changes data.
- `lib/platforms.ts` has caption limits and format checks per platform. The limits are approximate; adjust them there if a platform changes.
- `app/w/[ws]/posts/[post]/post-editor.tsx` is your editing screen; `post-review.tsx` is the client's.
