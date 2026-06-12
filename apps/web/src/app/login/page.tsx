'use client';

export const dynamic = 'force-dynamic';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { signIn } = useAuth();
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsSubmitting(true);
    try {
      await signIn(email, password);
      router.push('/chat');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Login failed');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#F4F6F9]">
      <div className="relative w-full max-w-md">
        <div className="relative rounded-2xl bg-white p-8 shadow-xl">
          {/* Logo mark */}
          <div className="mb-8 flex flex-col items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl shadow-md" style={{ background: '#2F7CF6' }}>
              <svg className="h-6 w-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
              </svg>
            </div>
            <div className="text-center">
              <h1 className="text-2xl font-bold tracking-tight text-[#1A1A1A]">Welcome back</h1>
              <p className="mt-1 text-sm text-[#8A94A6]">Sign in to Talka</p>
            </div>
          </div>

          {error && (
            <div className="mb-5 flex items-center gap-2 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-600">
              <svg className="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
              </svg>
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label htmlFor="login-email" className="mb-1.5 block text-sm font-medium text-[#1A1A1A]">
                Email
              </label>
              <input
                id="login-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                className="w-full rounded-lg border border-[#E8ECF2] bg-white px-4 py-2.5 text-sm text-[#1A1A1A] placeholder-[#B0B8C9] transition-colors duration-150 focus:border-[#2F7CF6] focus:outline-none focus:ring-1 focus:ring-[#2F7CF6]/30"
                required
                autoComplete="email"
              />
            </div>

            <div>
              <label htmlFor="login-password" className="mb-1.5 block text-sm font-medium text-[#1A1A1A]">
                Password
              </label>
              <input
                id="login-password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full rounded-lg border border-[#E8ECF2] bg-white px-4 py-2.5 text-sm text-[#1A1A1A] placeholder-[#B0B8C9] transition-colors duration-150 focus:border-[#2F7CF6] focus:outline-none focus:ring-1 focus:ring-[#2F7CF6]/30"
                required
                autoComplete="current-password"
              />
            </div>

            <button
              id="login-submit"
              type="submit"
              disabled={isSubmitting}
              className="mt-1 w-full cursor-pointer rounded-lg px-4 py-2.5 text-sm font-semibold text-white shadow-md transition-all duration-150 hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-[#2F7CF6] focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
              style={{ background: '#2F7CF6' }}
            >
              {isSubmitting ? 'Signing in…' : 'Sign In'}
            </button>
          </form>

          <p className="mt-6 text-center text-sm text-[#8A94A6]">
            No account?{' '}
            <Link href="/register" className="font-medium text-[#2F7CF6] transition-colors hover:text-[#1E5FCC]">
              Create one
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
