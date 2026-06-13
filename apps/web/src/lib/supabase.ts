import { createClient } from '@supabase/supabase-js';

export const getEnvVar = (val: string | undefined, fallback: string): string => {
  if (!val || val === 'undefined' || val === 'null' || val.trim() === '') {
    return fallback;
  }
  return val;
};

const supabaseUrl = getEnvVar(process.env.NEXT_PUBLIC_SUPABASE_URL, 'https://placeholder-project.supabase.co');
const supabaseAnonKey = getEnvVar(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY, 'placeholder-anon-key');

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true,
  },
});

export type SupabaseSession = Awaited<
  ReturnType<typeof supabase.auth.getSession>
>['data']['session'];
