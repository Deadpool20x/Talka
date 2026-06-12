'use client';

export const dynamic = 'force-dynamic';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';

export default function RegisterPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { signUp } = useAuth();
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsSubmitting(true);
    try {
      const result = await signUp(email, password, username);

      // Fire-and-forget: insert profile row into the public users table.
      // If this fails we still navigate to /chat — don't block the user.
      if (result?.user?.id) {
        try {
          await fetch('http://localhost:3001/api/v1/users/register', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              id: result.user.id,
              username,
              email,
            }),
          });
        } catch (registerErr) {
          console.error('[register] Failed to create user profile:', registerErr);
        }
      }

      router.push('/chat');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Registration failed');
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
              <h1 className="text-2xl font-bold tracking-tight text-[#1A1A1A]">Create account</h1>
              <p className="mt-1 text-sm text-[#8A94A6]">Join Talka today</p>
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
              <label htmlFor="register-username" className="mb-1.5 block text-sm font-medium text-[#1A1A1A]">
                Username
              </label>
              <input
                id="register-username"
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="cooluser42"
                className="w-full rounded-lg border border-[#E8ECF2] bg-white px-4 py-2.5 text-sm text-[#1A1A1A] placeholder-[#B0B8C9] transition-colors duration-150 focus:border-[#2F7CF6] focus:outline-none focus:ring-1 focus:ring-[#2F7CF6]/30"
                required
                minLength={3}
                maxLength={30}
                autoComplete="username"
              />
            </div>

            <div>
              <label htmlFor="register-email" className="mb-1.5 block text-sm font-medium text-[#1A1A1A]">
                Email
              </label>
              <input
                id="register-email"
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
              <label htmlFor="register-password" className="mb-1.5 block text-sm font-medium text-[#1A1A1A]">
                Password
                <span className="ml-2 font-normal text-slate-500">(min 6 chars)</span>
              </label>
              <input
                id="register-password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full rounded-lg border border-[#E8ECF2] bg-white px-4 py-2.5 text-sm text-[#1A1A1A] placeholder-[#B0B8C9] transition-colors duration-150 focus:border-[#2F7CF6] focus:outline-none focus:ring-1 focus:ring-[#2F7CF6]/30"
                required
                minLength={6}
                autoComplete="new-password"
              />
            </div>

            <button
              id="register-submit"
              type="submit"
              disabled={isSubmitting}
              className="mt-1 w-full cursor-pointer rounded-lg px-4 py-2.5 text-sm font-semibold text-white shadow-md transition-all duration-150 hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-[#2F7CF6] focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
              style={{ background: '#2F7CF6' }}
            >
              {isSubmitting ? 'Creating account…' : 'Sign Up'}
            </button>
          </form>

          <p className="mt-6 text-center text-sm text-[#8A94A6]">
            Already have an account?{' '}
            <Link href="/login" className="font-medium text-[#2F7CF6] transition-colors hover:text-[#1E5FCC]">
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
