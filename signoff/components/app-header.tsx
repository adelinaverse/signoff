import Link from 'next/link';
import { NavLinks } from './nav-links';

const APP_NAME = process.env.NEXT_PUBLIC_APP_NAME || 'Sign Off';

export function AppHeader({
  workspace, logoUrl, nav, email, showAllWorkspaces,
}: {
  workspace?: { id: string; name: string };
  logoUrl?: string | null;
  nav?: { href: string; label: string }[];
  email?: string;
  showAllWorkspaces?: boolean;
}) {
  return (
    <header className="border-b border-line bg-surface">
      <div className="mx-auto flex max-w-6xl items-center gap-4 px-4 py-3 sm:px-6">
        {workspace ? (
          <Link href={`/w/${workspace.id}`} className="flex min-w-0 items-center gap-3">
            {logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={logoUrl} alt="" className="h-8 w-8 rounded object-contain" />
            ) : (
              <span className="grid h-8 w-8 place-items-center rounded bg-ink text-sm font-bold text-white">
                {workspace.name.slice(0, 1)}
              </span>
            )}
            <span className="truncate font-semibold">{workspace.name}</span>
          </Link>
        ) : (
          <Link href="/" className="font-semibold">{APP_NAME}</Link>
        )}

        {nav && workspace && <NavLinks items={nav} exact={`/w/${workspace.id}`} />}

        <div className="ml-auto flex items-center gap-2 text-sm">
          {showAllWorkspaces && <Link href="/workspaces" className="hidden text-muted hover:text-ink sm:inline">All clients</Link>}
          {email && <span className="hidden text-muted md:inline">{email}</span>}
          <form action="/auth/signout" method="post">
            <button className="btn btn-ghost btn-sm">Sign out</button>
          </form>
        </div>
      </div>
    </header>
  );
}
