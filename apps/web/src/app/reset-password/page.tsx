'use client';

export const dynamic = 'force-dynamic';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';

type PageState = 'detecting' | 'ready' | 'success' | 'invalid';

export default function ResetPasswordPage() {
  const router = useRouter();
  const [pageState, setPageState] = useState<PageState>('detecting');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    let settled = false;

    const markReady = () => {
      if (!settled) {
        settled = true;
        setPageState('ready');
      }
    };

    // ── Layer 1: onAuthStateChange ────────────────────────────────────────────
    // supabase-js v2 fires PASSWORD_RECOVERY when it processes the hash tokens.
    // Also catch SIGNED_IN as a fallback (some builds fire this instead).
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'PASSWORD_RECOVERY') {
        markReady();
      }
      // Some Supabase versions fire SIGNED_IN for recovery sessions
      if (event === 'SIGNED_IN' && session) {
        markReady();
      }
    });

    // ── Layer 2: getSession() ─────────────────────────────────────────────────
    // If supabase-js already processed the hash before our listener attached,
    // the event won't fire again but the session will exist.
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) markReady();
    });

    // ── Layer 3: Manual hash detection ───────────────────────────────────────
    // If the URL hash contains the recovery token, give the SDK time to process
    // it (it exchanges tokens asynchronously) then show the form.
    if (typeof window !== 'undefined') {
      const hash = window.location.hash;
      if (hash.includes('type=recovery') || hash.includes('access_token=')) {
        // Hash is present — SDK is processing; show form after a short delay
        const hashTimer = setTimeout(markReady, 800);
        return () => {
          clearTimeout(hashTimer);
          subscription.unsubscribe();
        };
      }
    }

    // ── Fallback: mark invalid if no recovery signal in 4 seconds ────────────
    const invalidTimer = setTimeout(() => {
      if (!settled) {
        settled = true;
        setPageState('invalid');
      }
    }, 4000);

    return () => {
      subscription.unsubscribe();
      clearTimeout(invalidTimer);
    };
  }, []);

  // Auto-redirect to /login 2 seconds after success
  useEffect(() => {
    if (pageState !== 'success') return;
    const timer = setTimeout(() => router.replace('/login'), 2000);
    return () => clearTimeout(timer);
  }, [pageState, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (newPassword.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setIsSubmitting(true);
    try {
      const { error: updateError } = await supabase.auth.updateUser({
        password: newPassword,
      });
      if (updateError) throw updateError;
      setPageState('success');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to update password.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      {/* Background grid */}
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.03]"
        style={{
          backgroundImage:
            'linear-gradient(#fff 1px,transparent 1px),linear-gradient(90deg,#fff 1px,transparent 1px)',
          backgroundSize: '40px 40px',
        }}
      />

      <div className="relative w-full max-w-md px-4">
        {/* Glow */}
        <div className="absolute -inset-1 rounded-2xl bg-gradient-to-r from-sky-500/20 via-blue-500/10 to-sky-500/20 blur-xl" />

        <div className="relative rounded-2xl border border-white/10 bg-white/5 p-8 shadow-2xl backdrop-blur-xl">
          {/* Logo mark */}
          <div className="mb-8 flex flex-col items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-sky-400 to-blue-600 shadow-lg shadow-sky-500/30">
              <svg className="h-6 w-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
            </div>
            <div className="text-center">
              <h1 className="text-2xl font-bold tracking-tight text-white">Reset Password</h1>
              <p className="mt-1 text-sm text-slate-400">Choose a new password for your account</p>
            </div>
          </div>

          {/* ── Detecting ── */}
          {pageState === 'detecting' && (
            <div className="flex flex-col items-center gap-3 py-6">
              <div className="h-8 w-8 animate-spin rounded-full border-[3px] border-slate-600 border-t-sky-500" />
              <p className="text-sm text-slate-400">Verifying recovery link…</p>
            </div>
          )}

          {/* ── Invalid / expired ── */}
          {pageState === 'invalid' && (
            <div className="text-center">
              <div className="mb-4 flex items-start gap-2 rounded-lg border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-400">
                <svg className="mt-0.5 h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
                </svg>
                <span>This link is invalid or has expired. Please request a new password reset email.</span>
              </div>
              <Link
                href="/login"
                className="mt-2 inline-block text-sm font-medium text-sky-400 transition-colors hover:text-sky-300"
              >
                ← Back to login
              </Link>
            </div>
          )}

          {/* ── Success ── */}
          {pageState === 'success' && (
            <div className="text-center">
              <div className="mb-4 flex items-center gap-2 rounded-lg border border-emerald-500/20 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-400">
                <svg className="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
                <span>Password updated successfully. Redirecting to login…</span>
              </div>
              <div className="mt-3 h-1 w-full overflow-hidden rounded-full bg-slate-700">
                <div className="h-full animate-[shrink_2s_linear_forwards] rounded-full bg-sky-500" />
              </div>
            </div>
          )}

          {/* ── Form ── */}
          {pageState === 'ready' && (
            <>
              {error && (
                <div className="mb-5 flex items-center gap-2 rounded-lg border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-400">
                  <svg className="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
                  </svg>
                  {error}
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-5">
                <div>
                  <label htmlFor="new-password" className="mb-1.5 block text-sm font-medium text-slate-300">
                    New Password
                  </label>
                  <input
                    id="new-password"
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Min. 6 characters"
                    className="w-full rounded-lg border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-white placeholder-slate-500 transition-colors duration-150 focus:border-sky-500/60 focus:outline-none focus:ring-1 focus:ring-sky-500/40"
                    required
                    minLength={6}
                    autoComplete="new-password"
                    autoFocus
                  />
                </div>

                <div>
                  <label htmlFor="confirm-password" className="mb-1.5 block text-sm font-medium text-slate-300">
                    Confirm Password
                  </label>
                  <input
                    id="confirm-password"
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Re-enter new password"
                    className="w-full rounded-lg border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-white placeholder-slate-500 transition-colors duration-150 focus:border-sky-500/60 focus:outline-none focus:ring-1 focus:ring-sky-500/40"
                    required
                    autoComplete="new-password"
                  />
                </div>

                <button
                  id="reset-password-submit"
                  type="submit"
                  disabled={isSubmitting}
                  className="mt-1 w-full cursor-pointer rounded-lg bg-gradient-to-r from-sky-500 to-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-md shadow-sky-500/20 transition-all duration-150 hover:from-sky-400 hover:to-blue-500 hover:shadow-sky-500/30 focus:outline-none focus:ring-2 focus:ring-sky-500 focus:ring-offset-2 focus:ring-offset-slate-900 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isSubmitting ? 'Updating…' : 'Update Password'}
                </button>
              </form>
            </>
          )}

          {(pageState === 'ready' || pageState === 'invalid') && (
            <p className="mt-6 text-center text-sm text-slate-400">
              Remember it?{' '}
              <Link href="/login" className="font-medium text-sky-400 transition-colors hover:text-sky-300">
                Sign in
              </Link>
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
