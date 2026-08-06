import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

/**
 * Refreshes the Supabase auth session on every request that matches the
 * middleware matcher. This keeps the user's access token valid using the
 * long-lived refresh token stored in cookies, so a signed-in user stays
 * signed in across browser restarts, server restarts, and periods where
 * the app was offline, without ever being forced back to /login.
 */
export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // Touching auth.getUser() here is what actually validates the access
  // token and, if it has expired, silently exchanges the refresh token
  // for a new one and rewrites the auth cookies on the response below.
  await supabase.auth.getUser();

  return supabaseResponse;
}
