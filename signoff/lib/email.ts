import 'server-only';
import { Resend } from 'resend';

export const APP_NAME = process.env.NEXT_PUBLIC_APP_NAME || 'Sign Off';
export const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000').replace(/\/$/, '');

export async function sendEmail(to: string[], subject: string, html: string) {
  if (!process.env.RESEND_API_KEY || to.length === 0) return { sent: false as const, reason: 'Email is not set up yet' };
  const resend = new Resend(process.env.RESEND_API_KEY);
  const { error } = await resend.emails.send({
    from: process.env.EMAIL_FROM || `${APP_NAME} <onboarding@resend.dev>`,
    to,
    subject,
    html,
  });
  if (error) return { sent: false as const, reason: error.message };
  return { sent: true as const };
}

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]!));

/** Plain, readable email: a line of intro, a list of posts, one button. */
export function digestHtml(opts: { intro: string; items: string[]; buttonLabel: string; buttonUrl: string }) {
  const items = opts.items.map((i) => `<li style="margin:0 0 6px">${esc(i)}</li>`).join('');
  return `<div style="font-family:-apple-system,Segoe UI,Helvetica,Arial,sans-serif;color:#1C2733;font-size:15px;line-height:1.5;max-width:520px">
<p>${esc(opts.intro)}</p>
<ul style="padding-left:18px">${items}</ul>
<p style="margin:24px 0"><a href="${opts.buttonUrl}" style="background:#1C2733;color:#fff;text-decoration:none;padding:12px 20px;border-radius:6px;display:inline-block">${esc(opts.buttonLabel)}</a></p>
<p style="color:#5F6B78;font-size:13px">Sent by ${esc(APP_NAME)}.</p>
</div>`;
}
