import { createClient } from '@/lib/supabase/server'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import Link from 'next/link'
import { BrainCircuit, Clock, Layers, PlusCircle, CheckCircle, Search, BookOpen, Activity, Database } from 'lucide-react'
import { redirect } from 'next/navigation'

export const dynamic = 'force-dynamic'

export default async function DashboardPage() {
    const supabase = await createClient()

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
        redirect('/auth/signin')
    }

    // 1. 获取统计数据
    // 待复习数量
    const { count: reviewCount } = await supabase
        .from('mistakes')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .eq('status', 'active')
        .lte('next_review_at', new Date().toISOString())

    // 待处理（正在分析或等待确认）数量
    const { count: pendingCount } = await supabase
        .from('mistakes')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .in('status', ['pending', 'analyzing', 'review_needed'])

    // 总错题数
    const { count: totalCount } = await supabase
        .from('mistakes')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id)

    const stats = [
        {
            title: "今日待复习",
            value: reviewCount || 0,
            icon: Clock,
            color: "text-orange-500",
            bg: "bg-orange-50",
            action: reviewCount && reviewCount > 0 ? { label: "开始复习", href: "/review" } : null
        },
        {
            title: "待处理队列",
            value: pendingCount || 0,
            icon: Layers,
            color: "text-blue-500",
            bg: "bg-blue-50",
            action: { label: "去处理", href: "/mistakes/pending" }
        },
        {
            title: "知识库文档",
            value: "12", // Mock data for now
            icon: BookOpen,
            color: "text-teal-500",
            bg: "bg-teal-50",
            action: { label: "查阅文档", href: "/references" }
        }
    ]

    return (
        <div className="container max-w-5xl mx-auto p-4 sm:p-6 space-y-6 sm:space-y-8">
            {/* Header */}
            <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b pb-6">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-blue-700 to-purple-700">
                        考研AI复习助手
                    </h1>
                    <p className="text-muted-foreground mt-2">
                        你好 {user.email?.split('@')[0]}, 今天主攻什么科目？
                    </p>
                </div>
                <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
                    <Link href="/references" className="w-full sm:w-auto">
                        <Button variant="outline" size="lg" className="w-full shadow-sm">
                            <Search className="mr-2 h-4 w-4" />
                            AI 问答
                        </Button>
                    </Link>
                    <Link href="/mistakes/new" className="w-full sm:w-auto">
                        <Button size="lg" className="w-full shadow-lg bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white border-0">
                            <PlusCircle className="mr-2 h-5 w-5" />
                            录入新题
                        </Button>
                    </Link>
                </div>
            </header>

            {/* Core Metrics */}
            <section>
                <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                    <Activity className="w-5 h-5 text-gray-500" />
                    核心指标
                </h2>
                <div className="grid gap-4 md:grid-cols-3">
                    {stats.map((stat, index) => (
                        <Card key={index} className="border-none shadow-sm hover:shadow-md transition-all hover:-translate-y-1 duration-200 h-full flex flex-col">
                            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                <CardTitle className="text-sm font-medium text-muted-foreground">
                                    {stat.title}
                                </CardTitle>
                                <div className={`p-2 rounded-full ${stat.bg}`}>
                                    <stat.icon className={`h-4 w-4 ${stat.color}`} />
                                </div>
                            </CardHeader>
                            <CardContent className="flex flex-col flex-1">
                                <div className="text-2xl font-bold">{stat.value}</div>
                                <div className="flex-1 min-h-2" />
                                {stat.action ? (
                                    <Link href={stat.action.href} className="mt-4 block">
                                        <Button variant="outline" size="sm" className="w-full text-xs border-dashed border-gray-300 hover:border-gray-400">
                                            {stat.action.label}
                                        </Button>
                                    </Link>
                                ) : (
                                    <div className="mt-4 h-9" />
                                )}
                            </CardContent>
                        </Card>
                    ))}
                </div>
            </section>

            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                {/* Module 1: Mistake Review Status */}
                <Card className="h-full hover:border-primary/50 transition-colors">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <CheckCircle className="w-5 h-5 text-green-500" />
                            智能复习
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <p className="text-sm text-muted-foreground min-h-[40px]">
                            基于 SM-2 记忆曲线为你安排今日复习任务。
                            {(reviewCount || 0) > 0 ? ` 还有 ${reviewCount} 道题待完成。` : " 今日任务已完成。"}
                        </p>
                        <Link href="/review" className="block">
                            <Button className={`w-full ${(reviewCount || 0) > 0 ? 'bg-orange-500 hover:bg-orange-600 text-white' : ''}`} variant={(reviewCount || 0) > 0 ? "default" : "secondary"}>
                                {(reviewCount || 0) > 0 ? "开始今日复习" : "自由复习模式"}
                            </Button>
                        </Link>
                    </CardContent>
                </Card>

                {/* Module 2: Mistake Library */}
                <Card className="h-full hover:border-primary/50 transition-colors">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <BookOpen className="w-5 h-5 text-blue-500" />
                            错题知识库
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <p className="text-sm text-muted-foreground min-h-[40px]">
                            按科目浏览错题，通过自定义标签筛选知识盲区。
                            已经积累了 {totalCount} 道错题。
                        </p>
                        <Link href="/mistakes" className="block">
                            <Button className="w-full" variant="outline">
                                进入知识库
                            </Button>
                        </Link>
                    </CardContent>
                </Card>

                {/* Module 3: Knowledge Base / RAG */}
                <Card className="h-full hover:border-primary/50 transition-colors">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2 text-teal-600">
                            <Database className="w-5 h-5" />
                            AI 资料库
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <p className="text-sm text-muted-foreground min-h-[40px]">
                            上传教材、笔记 PDF，让 AI 基于你的资料回答问题。
                            支持语义检索与引用追踪。
                        </p>
                        <Link href="/references" className="block">
                            <Button className="w-full bg-teal-600 hover:bg-teal-700 text-white">
                                开始学习
                            </Button>
                        </Link>
                    </CardContent>
                </Card>
            </div>
        </div>
    )
}
