import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export function middleware(request: NextRequest) {
    const { pathname } = request.nextUrl

    // 1. 强制根路径重定向
    if (pathname === '/') {
        return NextResponse.redirect(new URL('/auth/signin', request.url))
    }

    // 2. 保护路由（如果需要，比如 /dashboard, /mistakes），这里暂时只做根路径让它更纯粹
    // 如果未来需要做全站鉴权，写在这里
}

export const config = {
    // 匹配所有路径，确保根路径一定被捕获
    // 排除 _next (静态资源), api (接口), static (静态文件)
    matcher: '/((?!api|_next/static|_next/image|favicon.ico).*)',
}
