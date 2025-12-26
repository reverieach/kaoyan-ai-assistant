import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { LogOut, User, Mail, Calendar, BookOpen, Brain, Clock, Key } from 'lucide-react'
import { EditProfileDialog } from './components/edit-profile-dialog'
import { FeedbackDialog } from './components/feedback-dialog'
import { ChangePasswordDialog } from './components/change-password-dialog'

export const dynamic = 'force-dynamic'

export default async function ProfilePage() {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
        redirect('/auth/signin')
    }

    // 获取简单统计数据
    const { count: mistakeCount } = await supabase
        .from('mistakes')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id)

    const { count: pendingCount } = await supabase
        .from('mistakes')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .eq('status', 'pending')

    // 获取最近复习时间
    const joinDate = new Date(user.created_at).toLocaleDateString('zh-CN')

    return (
        <div className="container max-w-4xl mx-auto p-6 space-y-8">
            <h1 className="text-3xl font-bold tracking-tight">个人中心</h1>

            {/* Profile Header */}
            <Card className="bg-gradient-to-r from-blue-50 to-indigo-50 border-none shadow-sm">
                <CardContent className="p-8 flex flex-col md:flex-row items-center gap-6">
                    <Avatar className="w-24 h-24 border-4 border-white shadow-lg">
                        <AvatarImage src={user.user_metadata?.avatar_url} className="object-cover" />
                        <AvatarFallback className="text-2xl bg-indigo-100 text-indigo-600">
                            {user.email?.charAt(0).toUpperCase()}
                        </AvatarFallback>
                    </Avatar>

                    <div className="flex-1 text-center md:text-left space-y-2">
                        <div className="flex items-center justify-center md:justify-start gap-2">
                            <h2 className="text-2xl font-bold text-gray-900">
                                {user.user_metadata?.full_name || '考研战士'}
                            </h2>
                            <EditProfileDialog user={user} />
                        </div>

                        <div className="flex flex-col md:flex-row gap-4 text-gray-500 text-sm justify-center md:justify-start">
                            <div className="flex items-center gap-2">
                                <Mail className="w-4 h-4" />
                                {user.email}
                            </div>
                            <div className="flex items-center gap-2">
                                <Calendar className="w-4 h-4" />
                                加入时间: {joinDate}
                            </div>
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* Stats Grid */}
            <div className="grid gap-6 md:grid-cols-3">
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                        <CardTitle className="text-sm font-medium text-muted-foreground">
                            累计收录错题
                        </CardTitle>
                        <BookOpen className="w-4 h-4 text-blue-500" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{mistakeCount || 0}</div>
                        <p className="text-xs text-muted-foreground mt-1">
                            书山有路勤为径
                        </p>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                        <CardTitle className="text-sm font-medium text-muted-foreground">
                            待处理队列
                        </CardTitle>
                        <Clock className="w-4 h-4 text-orange-500" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-orange-600">{pendingCount || 0}</div>
                        <p className="text-xs text-muted-foreground mt-1">
                            今日事今日毕
                        </p>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                        <CardTitle className="text-sm font-medium text-muted-foreground">
                            复习掌握率
                        </CardTitle>
                        <Brain className="w-4 h-4 text-green-500" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">--%</div>
                        <p className="text-xs text-muted-foreground mt-1">
                            算法正在积累数据中...
                        </p>
                    </CardContent>
                </Card>
            </div>

            {/* Settings / Actions */}
            <div className="space-y-4">
                <div className="flex items-center justify-between">
                    <h3 className="text-lg font-semibold">账户与反馈</h3>
                    <div className="w-48">
                        <FeedbackDialog />
                    </div>
                </div>

                <Card>
                    <CardContent className="p-0 divide-y">
                        <div className="p-4 flex items-center justify-between hover:bg-slate-50 transition-colors">
                            <div className="flex items-center gap-3">
                                <User className="w-5 h-5 text-gray-400" />
                                <div>
                                    <p className="font-medium">基本资料</p>
                                    <p className="text-xs text-muted-foreground">点击上方编辑按钮修改</p>
                                </div>
                            </div>
                        </div>

                        <div className="p-4 flex items-center justify-between hover:bg-slate-50 transition-colors">
                            <div className="flex items-center gap-3">
                                <Key className="w-5 h-5 text-gray-500" />
                                <div>
                                    <p className="font-medium">账号安全</p>
                                    <p className="text-xs text-muted-foreground">修改登录密码</p>
                                </div>
                            </div>
                            <ChangePasswordDialog />
                        </div>

                        <div className="p-4 flex items-center justify-between hover:bg-slate-50 transition-colors">
                            <div className="flex items-center gap-3 text-red-600">
                                <LogOut className="w-5 h-5" />
                                <div>
                                    <p className="font-medium">退出登录</p>
                                    <p className="text-xs text-red-400">登出当前账户</p>
                                </div>
                            </div>
                            <form action="/auth/signout" method="post">
                                <Button variant="ghost" size="sm" className="text-red-600 hover:text-red-700 hover:bg-red-50">
                                    退出
                                </Button>
                            </form>
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    )
}
