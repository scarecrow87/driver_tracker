import { withAuth } from 'next-auth/middleware';
import { NextResponse } from 'next/server';

export default withAuth(
  function middleware(req) {
    const { pathname } = req.nextUrl;
    const role = req.nextauth.token?.role;
    const isAdminSide = role === 'ADMIN' || role === 'SUPERUSER';

    // Admin-only routes
    if (pathname.startsWith('/admin') && !isAdminSide) {
      return NextResponse.redirect(new URL('/driver/dashboard', req.url));
    }

    // Driver-only routes
    if (pathname.startsWith('/driver') && role !== 'DRIVER') {
      return NextResponse.redirect(new URL('/admin/dashboard', req.url));
    }

    return NextResponse.next();
  },
  {
    callbacks: {
      authorized: ({ token }) => !!token,
    },
  }
);

export const config = {
  matcher: ['/admin/:path*', '/driver/:path*'],
};
