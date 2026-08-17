import { createServerClient } from "@supabase/ssr";
import {
  NextResponse,
  type NextRequest,
} from "next/server";

export async function proxy(
  request: NextRequest
) {
  let response =
    NextResponse.next({
      request,
    });

  const supabase =
    createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
      {
        cookies: {
          getAll() {
            return request.cookies.getAll();
          },

          setAll(cookiesToSet) {
            cookiesToSet.forEach(
              ({
                name,
                value,
              }) => {
                request.cookies.set(
                  name,
                  value
                );
              }
            );

            response =
              NextResponse.next({
                request,
              });

            cookiesToSet.forEach(
              ({
                name,
                value,
                options,
              }) => {
                response.cookies.set(
                  name,
                  value,
                  options
                );
              }
            );
          },
        },
      }
    );

  /*
    Recuperiamo l'utente autenticato.
  */

  const {
    data: {
      user,
    },
  } =
    await supabase.auth.getUser();

  const pathname =
    request.nextUrl.pathname;

  /*
    ========================================
    LOGIN
    ========================================
  */

  if (pathname === "/login") {

    /*
      Se è già autenticato e apre
      /login, lo riportiamo alla home.
    */

    if (user) {
      return NextResponse.redirect(
        new URL(
          "/",
          request.url
        )
      );
    }

    return response;
  }

  /*
    ========================================
    API
    ========================================
  */

  if (
    pathname.startsWith("/api")
  ) {
    return response;
  }

  /*
    ========================================
    FILE STATICI
    ========================================
  */

  if (
    pathname.startsWith("/_next") ||
    pathname.includes(".")
  ) {
    return response;
  }

  /*
    ========================================
    PAGINE PROTETTE
    ========================================
  */

  if (!user) {
    const loginUrl =
      new URL(
        "/login",
        request.url
      );

    loginUrl.searchParams.set(
      "redirect",
      pathname
    );

    return NextResponse.redirect(
      loginUrl
    );
  }

  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};