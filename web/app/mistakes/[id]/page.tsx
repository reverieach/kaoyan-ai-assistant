import { createClient } from '@/lib/supabase/server'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import Link from 'next/link'
import { ArrowLeft, Edit, Trash2 } from 'lucide-react'
import { redirect } from 'next/navigation'
import Latex from 'react-latex-next'
import { DeleteMistakeButton } from './components/delete-button'

export const dynamic = 'force-dynamic'

interface Props {
    params: Promise<{ id: string }>
}

export default async function MistakeDetailPage({ params }: Props) {
    const { id } = await params
    const supabase = await createClient()

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) redirect('/auth/login')

    const { data: mistake } = await supabase
        .from('mistakes')
        .select('*')
        .eq('id', id)
        .eq('user_id', user.id)
        .single()

    if (!mistake) {
        return <div className="p-8 text-center text-muted-foreground">找不到该错题</div>
    }

    return (
        <div className="container max-w-3xl mx-auto p-6 space-y-8 min-h-screen pb-20">
            {/* Header */}
            <div className="flex items-center justify-between mb-2">
                <Link
                    href={`/mistakes?subject=${mistake.subject}`} // Adjusted link to overview or list
                    className="flex items-center text-muted-foreground hover:text-primary transition-colors"
                >
                    <ArrowLeft className="w-4 h-4 mr-2" />
                    返回题库
                </Link>
                <div className="flex gap-2">
                    <Link href={`/mistakes/${id}/edit`}>
                        <Button variant="outline" size="sm">
                            <Edit className="w-4 h-4 mr-2" />
                            编辑
                        </Button>
                    </Link>
                    <DeleteMistakeButton id={id} />
                </div>
            </div>

            {/* 1. Meta Info & Tags */}
            <div className="space-y-3">
                <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="default" className="text-sm px-3 py-1 bg-primary/90 hover:bg-primary">
                        {mistake.subject}
                    </Badge>
                    <Badge variant="outline" className="text-sm px-3 py-1 text-muted-foreground border-muted-foreground/30">
                        {mistake.error_type}
                    </Badge>
                </div>

                {mistake.knowledge_tags && mistake.knowledge_tags.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                        {mistake.knowledge_tags.map((tag: string) => (
                            <Link key={tag} href={`/mistakes/list?subject=${encodeURIComponent(mistake.subject)}&search=${encodeURIComponent(tag)}`}>
                                <Badge
                                    variant="secondary"
                                    className="text-xs px-2 py-0.5 cursor-pointer hover:bg-blue-100 hover:text-blue-700 transition-colors"
                                >
                                    #{tag}
                                </Badge>
                            </Link>
                        ))}
                    </div>
                )}
            </div>

            {/* 2. Main Content Flow (Vertical) */}
            <div className="space-y-12">

                {/* A. 原始题目 (Image + Text) */}
                <section className="space-y-4">
                    <h2 className="text-xl font-bold flex items-center gap-2 border-l-4 border-primary pl-3">
                        题目原件
                    </h2>
                    <Card className="border-0 shadow-sm bg-slate-50/50">
                        <CardContent className="p-4 space-y-4">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                                src={mistake.original_image}
                                alt="Original Question"
                                className="w-full h-auto rounded-lg border border-slate-200"
                            />
                            {mistake.question_text && (
                                <div className="prose prose-slate max-w-none p-4 bg-white rounded border border-slate-100">
                                    <Latex>{mistake.question_text}</Latex>
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </section>

                {/* B. 用户的错解 (User Wrong Answer) */}
                <section className="space-y-4">
                    <h2 className="text-xl font-bold flex items-center gap-2 border-l-4 border-orange-400 pl-3">
                        错解记录
                    </h2>
                    <Card className="border-orange-100 bg-orange-50/20 shadow-none">
                        <CardContent className="p-6 prose prose-slate max-w-none text-slate-700">
                            {mistake.user_answer ? (
                                <Latex>{mistake.user_answer}</Latex>
                            ) : (
                                <span className="text-muted-foreground italic">未识别到手写过程</span>
                            )}
                        </CardContent>
                    </Card>
                </section>

                {/* C. AI 分析 (AI Analysis) */}
                <section className="space-y-4">
                    <h2 className="text-xl font-bold flex items-center gap-2 border-l-4 border-blue-500 pl-3">
                        AI 智能分析
                    </h2>
                    <Card className="border-blue-100 bg-blue-50/30 shadow-sm">
                        <CardContent className="p-6 prose prose-blue max-w-none text-slate-800">
                            <Latex>{mistake.ai_analysis || "正在生成分析..."}</Latex>
                        </CardContent>
                    </Card>
                </section>

                {/* D. 标准参考 (Standard Answer) */}
                <section className="space-y-4">
                    <h2 className="text-xl font-bold flex items-center gap-2 border-l-4 border-green-500 pl-3">
                        标准解析
                    </h2>
                    <Card className="border-green-100 bg-green-50/20 shadow-none">
                        <CardContent className="p-0">
                            {mistake.answer_image && (
                                <div className="p-4">
                                    {/* eslint-disable-next-line @next/next/no-img-element */}
                                    <img
                                        src={mistake.answer_image}
                                        alt="Standard Answer"
                                        className="w-full h-auto rounded border border-green-200/50"
                                    />
                                </div>
                            )}
                            <div className="p-6 prose prose-slate max-w-none">
                                <Latex>{mistake.correct_answer || '暂无文字解析'}</Latex>
                            </div>
                        </CardContent>
                    </Card>
                </section>

            </div>
        </div>
    )
}
