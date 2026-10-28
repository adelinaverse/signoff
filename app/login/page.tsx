import { LoginForm } from './login-form';

const APP_NAME = process.env.NEXT_PUBLIC_APP_NAME || 'Sign Off';

export const metadata = { title: 'Sign in' };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string; email?: string; error?: string }> }) {
  const { next, email, error } = await searchParams;
  return (
    <main className="min-h-dvh grid place-items-center px-4 py-16">
      <div className="w-full max-w-sm">
        <div className="mb-10 flex items-center gap-3">
          <span className="stamp stamp-lg text-ink">Approved</span>
          <span className="text-lg font-semibold">{APP_NAME}</span>
        </div>
        <h1 className="text-2xl font-bold tracking-tight">Sign in to review your posts</h1>
        <p className="mt-2 text-muted">We&apos;ll email you a link. No password needed.</p>
        {error && (
          <p className="mt-6 rounded-md bg-red-soft px-3 py-2 text-sm text-red">
            {error === 'direct'
              ? 'That link is no longer active. Ask for a new one, or sign in with your email below.'
              : error === 'setup'
                ? 'Direct links are not switched on yet. Sign in with your email below.'
                : 'That sign-in link has expired or was already used. Request a new one below.'}
          </p>
        )}
        <LoginForm next={next} defaultEmail={email} />
      </div>
    </main>
  );
}
