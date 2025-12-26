import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export function middleware(request: NextRequest) {
    // 强制处理根路径重定向，避开页面级缓存
    if (request.nextUrl.pathname === '/') {
        return NextResponse.redirect(new URL('/auth/signin', request.url))
    }
}

export const config = {
    matcher: '/',
}
