import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
    let supabaseResponse = NextResponse.next({
        request,
    })

    // 创建 Supabase 客户端并刷新 Session
    const supabase = createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
            cookies: {
                getAll() {
                    return request.cookies.getAll()
                },
                setAll(cookiesToSet) {
                    cookiesToSet.forEach(({ name, value, options }) =>
                        request.cookies.set(name, value)
                    )
                    supabaseResponse = NextResponse.next({
                        request,
                    })
                    cookiesToSet.forEach(({ name, value, options }) =>
                        supabaseResponse.cookies.set(name, value, options)
                    )
                },
            },
        }
    )

    // 刷新 Session（这是关键！）
    // 不要使用 getSession()，因为它不会刷新 cookie
    const {
        data: { user },
    } = await supabase.auth.getUser()

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

    // 保护需要认证的路由
    const protectedRoutes = ['/dashboard', '/profile', '/mistakes', '/review', '/references', '/admin']
    const isProtected = protectedRoutes.some(route => pathname.startsWith(route))

    if (isProtected && !user) {
        // 未登录用户访问受保护路由，重定向到登录页
        const redirectUrl = new URL('/auth/signin', request.url)
        redirectUrl.searchParams.set('redirect', pathname)
        return NextResponse.redirect(redirectUrl)
    }

    // 已登录用户访问登录/注册页，重定向到 dashboard
    if (user && (pathname.startsWith('/auth/signin') || pathname.startsWith('/auth/signup'))) {
        return NextResponse.redirect(new URL('/dashboard', request.url))
    }

    return supabaseResponse
}

export const config = {
    matcher: [
        /*
         * Match all request paths except for the ones starting with:
         * - _next/static (static files)
         * - _next/image (image optimization files)
         * - favicon.ico (favicon file)
         * - icon.png (icon file)
         * - api (API routes that handle their own auth)
         */
        '/((?!_next/static|_next/image|favicon.ico|icon.png|api).*)',
    ],
}
