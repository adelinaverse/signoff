'use client';

import { useRef, useState, useTransition } from 'react';

type Result = { error?: string; ok?: string } | void;

/** A form that calls a server action and shows its result underneath. */
export function ActionForm({
  action, children, className, resetOnSuccess,
}: {
  action: (formData: FormData) => Promise<Result>;
  children: React.ReactNode;
  className?: string;
  resetOnSuccess?: boolean;
}) {
  const [pending, start] = useTransition();
  const [result, setResult] = useState<Result>();
  const ref = useRef<HTMLFormElement>(null);

  return (
    <form
      ref={ref}
      className={className}
      onSubmit={(e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        start(async () => {
          const r = await action(fd);
          setResult(r);
          if (resetOnSuccess && r && !r.error) ref.current?.reset();
        });
      }}
    >
      <fieldset disabled={pending} className="contents">{children}</fieldset>
      {result?.error && <p role="alert" className="mt-2 text-sm text-red">{result.error}</p>}
      {result?.ok && <p role="status" className="mt-2 text-sm text-green">{result.ok}</p>}
    </form>
  );
}
