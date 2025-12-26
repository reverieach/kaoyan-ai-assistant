import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export function middleware(request: NextRequest) {
    const { pathname } = request.nextUrl

    // 强制拦截旧路由，重定向到新路由
    if (pathname === '/auth/login') {
        return NextResponse.redirect(new URL('/auth/signin', request.url))
    }
    if (pathname === '/auth/register') {
        return NextResponse.redirect(new URL('/auth/signup', request.url))
    }

    // 根路径重定向
    if (pathname === '/') {
        return NextResponse.redirect(new URL('/auth/signin', request.url))
    }
}

export const config = {
    matcher: ['/', '/auth/login', '/auth/register'],
}
