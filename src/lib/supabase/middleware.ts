import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

const PUBLIC_PATHS = ["/login", "/setup", "/menu", "/order", "/offline", "/api/auth", "/api/public", "/api/setup"];

function isPublic(pathname: string): boolean {
  return PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(p + "/"));
}

export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const { pathname } = request.nextUrl;

  if (!url || !key) {
    return response;
  }

  const supabase = createServerClient(url, key, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet: { name: string; value: string; options?: CookieOptions }[]) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options),
        );
      },
    },
  });

  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    // Halaman terlindungi: redirect ke login jika belum punya sesi
    if (!user && !isPublic(pathname)) {
      const redirect = request.nextUrl.clone();
      redirect.pathname = "/login";
      redirect.search = "";
      redirect.searchParams.set("next", pathname);
      return NextResponse.redirect(redirect);
    }

    // Sudah login tapi membuka /login → ke dashboard
    if (user && pathname === "/login") {
      const redirect = request.nextUrl.clone();
      redirect.pathname = "/dashboard";
      redirect.search = "";
      return NextResponse.redirect(redirect);
    }
  } catch {
    if (!isPublic(pathname)) {
      const redirect = request.nextUrl.clone();
      redirect.pathname = "/login";
      redirect.search = "";
      return NextResponse.redirect(redirect);
    }
  }

  return response;
}
