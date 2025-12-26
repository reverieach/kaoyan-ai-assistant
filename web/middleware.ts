import { NextResponse, type NextRequest } from 'next/server'

export function middleware(request: NextRequest) {
    const { pathname } = request.nextUrl

    // 只做旧路由重定向，不做任何 session 相关操作
    if (pathname === '/auth/login') {
        return NextResponse.redirect(new URL('/auth/signin', request.url))
    }
    if (pathname === '/auth/register') {
        return NextResponse.redirect(new URL('/auth/signup', request.url))
    }
    if (pathname === '/') {
        return NextResponse.redirect(new URL('/auth/signin', request.url))
    }

    // 其他请求直接放行
    return NextResponse.next()
}

export const config = {
    matcher: ['/', '/auth/login', '/auth/register'],
}
