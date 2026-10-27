'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

export function NavLinks({ items, exact }: { items: { href: string; label: string }[]; exact: string }) {
  const path = usePathname();
  return (
    <nav className="flex items-center gap-1">
      {items.map((n) => {
        const active = n.href === exact ? path === n.href || path.startsWith(`${n.href}/posts`) : path.startsWith(n.href);
        return (
          <Link
            key={n.href}
            href={n.href}
            aria-current={active ? 'page' : undefined}
            className={`rounded px-2.5 py-1.5 text-sm ${active ? 'bg-paper font-semibold text-ink' : 'text-muted hover:text-ink'}`}
          >
            {n.label}
          </Link>
        );
      })}
    </nav>
  );
}
