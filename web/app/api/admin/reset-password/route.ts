import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { createClient as createServerClient } from '@/lib/supabase/server'
import { isAdmin } from '@/lib/admin/activity'

export async function POST(request: NextRequest) {
    try {
        // 验证管理员身份
        const supabase = await createServerClient()
        const { data: { user } } = await supabase.auth.getUser()

        if (!user) {
            return NextResponse.json({ error: '未登录' }, { status: 401 })
        }

        const adminCheck = await isAdmin(user.id)
        if (!adminCheck) {
            return NextResponse.json({ error: '无管理员权限' }, { status: 403 })
        }

        // 获取请求参数
        const { userId, newPassword } = await request.json()

        if (!userId || !newPassword) {
            return NextResponse.json({ error: '参数缺失' }, { status: 400 })
        }

        if (newPassword.length < 6) {
            return NextResponse.json({ error: '密码至少6位' }, { status: 400 })
        }

        // 使用 Service Role Key 创建管理员客户端
        const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
        const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL

        if (!serviceRoleKey || !supabaseUrl) {
            return NextResponse.json({
                error: '服务端未配置 SUPABASE_SERVICE_ROLE_KEY'
            }, { status: 500 })
        }

        const adminClient = createClient(supabaseUrl, serviceRoleKey, {
            auth: {
                autoRefreshToken: false,
                persistSession: false
            }
        })

        // 重置密码
        const { error } = await adminClient.auth.admin.updateUserById(userId, {
            password: newPassword
        })

        if (error) {
            console.error('Reset password error:', error)
            return NextResponse.json({ error: error.message }, { status: 400 })
        }

        return NextResponse.json({ success: true })

    } catch (error: any) {
        console.error('API Error:', error)
        return NextResponse.json({ error: error.message || '服务器错误' }, { status: 500 })
    }
}
