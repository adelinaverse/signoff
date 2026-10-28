import { NextResponse, type NextRequest } from 'next/server';
import { createClient, createServiceClient } from '@/lib/supabase/server';

/**
 * A client's direct link. Signs them in as themselves without an email, then opens the page in `next`.
 * The link is private to that person: anyone holding it acts as them, so reset it in Settings if it leaks.
 */
export async function GET(request: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const url = new URL(request.url);
  const fail = (reason: string) => NextResponse.redirect(new URL(`/login?error=${reason}`, url.origin));

  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) return fail('setup');

  const admin = createServiceClient();
  const { data: link } = await admin.from('access_links').select('workspace_id, email').eq('token', token).maybeSingle();
  if (!link) return fail('direct');

  const base = `/w/${link.workspace_id}`;
  const nextParam = url.searchParams.get('next') ?? '';
  // Only ever send people somewhere inside the workspace the link belongs to
  const next = nextParam === base || nextParam.startsWith(`${base}/`) ? nextParam : base;

  const supabase = await createClient();
  const { data: current } = await supabase.auth.getClaims();
  const currentEmail = String(current?.claims?.email ?? '').toLowerCase();

  // The agency opening a client's link: show the client's view without signing out
  if (current?.claims?.sub) {
    const { data: isAdmin } = await supabase.rpc('is_agency_admin');
    if (isAdmin) {
      const dest = new URL(next, url.origin);
      if (dest.pathname.includes('/posts/')) dest.searchParams.set('view', 'client');
      return NextResponse.redirect(dest);
    }
  }

  // Never let a client link sign anyone in as the agency
  const { data: admins } = await admin.from('agency_admins').select('email');
  if ((admins ?? []).some((a) => a.email.toLowerCase() === link.email.toLowerCase())) return fail('direct');

  if (currentEmail !== link.email.toLowerCase()) {
    // Creates their account the first time, without sending any email
    const { data: gen, error } = await admin.auth.admin.generateLink({ type: 'magiclink', email: link.email });
    if (error || !gen?.properties?.hashed_token) return fail('direct');
    const { error: vErr } = await supabase.auth.verifyOtp({ type: 'magiclink', token_hash: gen.properties.hashed_token });
    if (vErr) return fail('direct');
    await supabase.rpc('claim_invites');
  }

  return NextResponse.redirect(new URL(next, url.origin));
}
