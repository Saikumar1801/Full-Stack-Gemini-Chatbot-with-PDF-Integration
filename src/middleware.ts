// src/middleware.ts
import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  });

  // Create a Supabase client configured to use cookies
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return request.cookies.get(name)?.value;
        },
        set(name: string, value: string, options: CookieOptions) {
          // If the cookie is set, update the response
          // so the new cookie is set on the client
          response.cookies.set({
            name,
            value,
            ...options,
          });
        },
        remove(name: string, options: CookieOptions) {
          // If the cookie is removed, update the response
          // so the cookie is removed from the client
          response.cookies.set({
            name,
            value: '', // Must set value to empty string to remove cookie on some browsers
            ...options,
            maxAge: 0, // Set maxAge to 0 to delete the cookie
          });
        },
      },
    }
  );

  // Refresh session if expired - important for Server Components
  // await supabase.auth.getSession(); // This line is often debated.
                                    // The getSession call below should be enough for protection.
                                    // It also helps keep the session token fresh.

  const { data: { session } } = await supabase.auth.getSession();

  const { pathname } = request.nextUrl;

  // Define protected routes
  const protectedRoutes = ['/chatbot']; // Add any other routes you want to protect
  const isProtectedRoute = protectedRoutes.some(route => pathname.startsWith(route));

  // Define auth routes (users should be redirected away if logged in)
  const authRoutes = ['/login', '/register'];
  const isAuthRoute = authRoutes.some(route => pathname.startsWith(route));

  if (isProtectedRoute && !session) {
    // User is not authenticated and trying to access a protected route
    return NextResponse.redirect(new URL('/login', request.url));
  }

  if (isAuthRoute && session) {
    // User is authenticated and trying to access login/register
    return NextResponse.redirect(new URL('/chatbot', request.url)); // or '/' or a dashboard page
  }

  return response;
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * Feel free to modify this pattern to include more paths.
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};