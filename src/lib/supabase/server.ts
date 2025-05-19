// src/lib/supabase/server.ts
import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { cookies } from 'next/headers';

export function createSupabaseServerClient() {
  const cookieStore = cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value;
        },
        set(name: string, value: string, options: CookieOptions) {
          try {
            cookieStore.set({ name, value, ...options });
          } catch (error) {
            // Errors can occur if called from Server Components (read-only RSCs).
            // Supabase client might try to refresh session, safe to ignore if middleware handles it.
            // console.warn(`Supabase-SSR Server Client: Error setting cookie "${name}". This is often benign in RSCs if middleware is active. Error: ${error}`);
          }
        },
        remove(name: string, options: CookieOptions) {
          try {
            cookieStore.set({ name, value: '', ...options });
          } catch (error) {
            // Similar to `set`, can occur in RSCs.
            // console.warn(`Supabase-SSR Server Client: Error removing cookie "${name}". This is often benign in RSCs if middleware is active. Error: ${error}`);
          }
        },
      },
    }
  );
}