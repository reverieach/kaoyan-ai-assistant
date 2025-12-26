import { createClient } from '@/lib/supabase/server'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import Link from 'next/link'
import { Calculator, Server, Cpu, Radio, Hash, Book, ChevronRight } from 'lucide-react'
import { redirect } from 'next/navigation'

export const dynamic = 'force-dynamic'

const SUBJECT_CONFIG = {
    'Math': { label: '高等数学', icon: Calculator, color: 'text-blue-500', bg: 'bg-blue-50' },
    'DataStructures': { label: '数据结构', icon: Hash, color: 'text-green-500', bg: 'bg-green-50' },
    'CompOrg': { label: '计算机组成原理', icon: Cpu, color: 'text-purple-500', bg: 'bg-purple-50' },
    'OS': { label: '操作系统', icon: Server, color: 'text-orange-500', bg: 'bg-orange-50' },
    'Network': { label: '计算机网络', icon: Radio, color: 'text-cyan-500', bg: 'bg-cyan-50' },
    'Other': { label: '其他科目', icon: Book, color: 'text-gray-500', bg: 'bg-gray-50' },
}

export default async function MistakeLibraryPage() {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
        redirect('/auth/login')
    }

    // 聚合查询各科目的错题数量
    // 由于 Supabase JS 客户端暂不支持 group by，我们先拉取所有 active 的 metadata
    // 或者对于规模不大时，拉取所有 id, subject 也可以
    const { data: mistakes } = await supabase
        .from('mistakes')
        .select('subject, knowledge_tags')
        .eq('user_id', user.id)

    // 统计逻辑
    const stats: Record<string, { count: number, tags: Set<string> }> = {}

    // 初始化
    Object.keys(SUBJECT_CONFIG).forEach(key => {
        stats[key] = { count: 0, tags: new Set() }
    })

    // 聚合
    mistakes?.forEach(m => {
        const sub = m.subject as string
        if (stats[sub]) {
            stats[sub].count++
            if (Array.isArray(m.knowledge_tags)) {
                m.knowledge_tags.forEach((t: string) => stats[sub].tags.add(t))
            }
        }
    })

    return (
        <div className="container max-w-5xl mx-auto p-6 space-y-8">
            <header className="flex justify-between items-center border-b pb-6">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">错题知识库</h1>
                    <p className="text-muted-foreground mt-2">
                        按科目浏览你的知识盲区，支持自定义标签筛选
                    </p>
                </div>
            </header>

            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                {Object.entries(SUBJECT_CONFIG).map(([key, config]) => {
                    const data = stats[key] || { count: 0, tags: new Set() }
                    const TagPreview = Array.from(data.tags).slice(0, 3)

                    return (
                        <Card key={key} className="hover:shadow-lg transition-all duration-200 cursor-pointer group flex flex-col h-full">
                            <CardHeader className="pb-2">
                                <div className="flex justify-between items-start">
                                    <div className={`p-3 rounded-xl ${config.bg}`}>
                                        <config.icon className={`w-6 h-6 ${config.color}`} />
                                    </div>
                                    <span className="text-2xl font-bold">{data.count}</span>
                                </div>
                                <CardTitle className="mt-4 text-xl">{config.label}</CardTitle>
                            </CardHeader>
                            <CardContent className="flex-1 flex flex-col justify-end mt-4">
                                <div className="space-y-4">
                                    {/* Tag Preview */}
                                    <div className="flex flex-wrap gap-2 min-h-[2rem]">
                                        {TagPreview.length > 0 ? (
                                            TagPreview.map(tag => (
                                                <span key={tag} className="px-2 py-1 bg-gray-100 text-xs text-gray-600 rounded-md">
                                                    #{tag}
                                                </span>
                                            ))
                                        ) : (
                                            <span className="text-xs text-gray-400 italic">暂无标签</span>
                                        )}
                                        {data.tags.size > 3 && (
                                            <span className="text-xs text-gray-400 self-center">
                                                +{data.tags.size - 3}
                                            </span>
                                        )}
                                    </div>

                                    <Link href={`/mistakes/list?subject=${key}`} className="block">
                                        <Button className="w-full group-hover:bg-primary group-hover:text-white transition-colors" variant="outline">
                                            浏览错题库
                                            <ChevronRight className="w-4 h-4 ml-2 group-hover:translate-x-1 transition-transform" />
                                        </Button>
                                    </Link>
                                </div>
                            </CardContent>
                        </Card>
                    )
                })}
            </div>
        </div>
    )
}
