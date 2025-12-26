import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { isAdmin } from '@/lib/admin/activity'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Users, FileText, BookOpen, Activity, DollarSign, Clock } from 'lucide-react'

export const dynamic = 'force-dynamic'

export default async function AdminDashboardPage() {
    const supabase = await createClient()

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
        redirect('/auth/signin')
    }

    // 检查是否是管理员
    const adminCheck = await isAdmin(user.id)
    if (!adminCheck) {
        redirect('/dashboard') // 非管理员重定向
    }

    // 获取统计数据
    const { count: userCount } = await supabase
        .from('user_activity_logs')
        .select('user_id', { count: 'exact', head: true })

    const { count: mistakeCount } = await supabase
        .from('mistakes')
        .select('*', { count: 'exact', head: true })

    const { count: referenceCount } = await supabase
        .from('references_kb')
        .select('*', { count: 'exact', head: true })

    const { count: todayActivity } = await supabase
        .from('user_activity_logs')
        .select('*', { count: 'exact', head: true })
        .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())

    const stats = [
        { title: '总用户数', value: userCount || 0, icon: Users, color: 'text-blue-500', bg: 'bg-blue-50' },
        { title: '总错题数', value: mistakeCount || 0, icon: FileText, color: 'text-green-500', bg: 'bg-green-50' },
        { title: '知识库文档', value: referenceCount || 0, icon: BookOpen, color: 'text-purple-500', bg: 'bg-purple-50' },
        { title: '今日活动', value: todayActivity || 0, icon: Activity, color: 'text-orange-500', bg: 'bg-orange-50' },
    ]

    return (
        <div className="container max-w-5xl mx-auto p-4 sm:p-6 space-y-6">
            <header className="border-b pb-4">
                <h1 className="text-2xl font-bold text-red-600">🔒 管理员后台</h1>
                <p className="text-muted-foreground text-sm mt-1">系统监控与数据统计</p>
            </header>

            {/* Stats Grid */}
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                {stats.map((stat, i) => (
                    <Card key={i}>
                        <CardHeader className="flex flex-row items-center justify-between pb-2">
                            <CardTitle className="text-sm font-medium text-muted-foreground">
                                {stat.title}
                            </CardTitle>
                            <div className={`p-2 rounded-full ${stat.bg}`}>
                                <stat.icon className={`w-4 h-4 ${stat.color}`} />
                            </div>
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">{stat.value}</div>
                        </CardContent>
                    </Card>
                ))}
            </div>

            {/* Placeholder for more admin features */}
            <Card className="border-dashed">
                <CardContent className="p-8 text-center text-muted-foreground">
                    <p>📊 更多功能开发中...</p>
                    <p className="text-sm mt-2">用户管理、API 用量统计、费用报表</p>
                </CardContent>
            </Card>
        </div>
    )
}
