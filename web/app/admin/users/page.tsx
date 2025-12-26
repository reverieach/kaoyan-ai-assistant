import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { isAdmin } from '@/lib/admin/activity'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Users, Mail, Calendar, MoreVertical } from 'lucide-react'
import Link from 'next/link'

export const dynamic = 'force-dynamic'

export default async function AdminUsersPage() {
    const supabase = await createClient()

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
        redirect('/auth/signin')
    }

    // 检查管理员权限
    const adminCheck = await isAdmin(user.id)
    if (!adminCheck) {
        redirect('/dashboard')
    }

    // 获取所有用户（通过 mistakes 表间接获取）
    const { data: userStats } = await supabase
        .from('mistakes')
        .select('user_id')

    // 统计每个用户的错题数
    const userCounts: Record<string, number> = {}
    userStats?.forEach(m => {
        userCounts[m.user_id] = (userCounts[m.user_id] || 0) + 1
    })

    const users = Object.entries(userCounts).map(([id, count]) => ({
        id,
        mistakeCount: count
    }))

    return (
        <div className="container max-w-5xl mx-auto p-4 sm:p-6 space-y-6">
            <header className="flex items-center justify-between border-b pb-4">
                <div>
                    <h1 className="text-2xl font-bold text-red-600">👥 用户管理</h1>
                    <p className="text-muted-foreground text-sm mt-1">查看和管理所有用户</p>
                </div>
                <Link href="/admin">
                    <Button variant="outline">返回概览</Button>
                </Link>
            </header>

            <div className="grid gap-4">
                {users.length === 0 ? (
                    <Card className="border-dashed">
                        <CardContent className="p-8 text-center text-muted-foreground">
                            暂无用户数据
                        </CardContent>
                    </Card>
                ) : (
                    users.map(u => (
                        <Card key={u.id} className="hover:shadow-md transition-shadow">
                            <CardContent className="p-4">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center">
                                            <Users className="w-5 h-5 text-blue-500" />
                                        </div>
                                        <div>
                                            <p className="font-mono text-sm">{u.id.slice(0, 8)}...</p>
                                            <p className="text-xs text-muted-foreground">
                                                错题数: {u.mistakeCount}
                                            </p>
                                        </div>
                                    </div>
                                    <Link href={`/admin/users/${u.id}`}>
                                        <Button variant="ghost" size="sm">
                                            详情
                                        </Button>
                                    </Link>
                                </div>
                            </CardContent>
                        </Card>
                    ))
                )}
            </div>

            <Card className="bg-yellow-50 border-yellow-200">
                <CardContent className="p-4">
                    <p className="text-sm text-yellow-800">
                        💡 <strong>提示</strong>：重置密码功能需要配置 Supabase 的 Service Role Key。
                        请在 <code>.env.local</code> 中设置 <code>SUPABASE_SERVICE_ROLE_KEY</code>。
                    </p>
                </CardContent>
            </Card>
        </div>
    )
}
