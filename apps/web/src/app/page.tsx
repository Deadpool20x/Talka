'use client';

export const dynamic = 'force-dynamic';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

/**
 * Root page — client-side redirect only.
 *
 * Why NOT server redirect:
 * Supabase appends auth tokens as URL hash fragments (e.g. #access_token=...&type=recovery).
 * The server never receives hash fragments — a server-side redirect would silently drop them.
 * We must read window.location.hash client-side first, then decide where to send the user.
 */
export default function HomePage() {
  const router = useRouter();

  useEffect(() => {
    const hash = window.location.hash;

    if (hash.includes('type=recovery')) {
      // Recovery link landed here — forward to /reset-password with the hash intact
      router.replace('/reset-password' + hash);
    } else if (hash.includes('type=signup') || hash.includes('type=magiclink')) {
      // Other Supabase auth flows that land on root
      router.replace('/chat' + hash);
    } else {
      router.replace('/chat');
    }
  }, [router]);

  // Brief blank screen while we determine the redirect destination
  return (
    <div className="flex h-screen w-screen items-center justify-center bg-slate-950">
      <div className="h-8 w-8 animate-spin rounded-full border-[3px] border-slate-700 border-t-sky-500" />
    </div>
  );
}
