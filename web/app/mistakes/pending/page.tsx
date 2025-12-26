'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { BrainCircuit, Clock, Trash2, Zap, Loader2, CheckCircle, Layers } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import { zhCN } from 'date-fns/locale'
import { toast } from 'sonner'

type MistakePreview = {
    id: string
    original_image: string
    created_at: string
    status: string
}

export default function PendingMistakesPage() {
    const [mistakes, setMistakes] = useState<MistakePreview[]>([])
    const [loading, setLoading] = useState(true)
    const [processing, setProcessing] = useState(false)
    const [progress, setProgress] = useState({ current: 0, total: 0 })
    const supabase = createClient()
    const router = useRouter() // Import needed

    useEffect(() => {
        fetchPendingMistakes()
    }, [])

    const fetchPendingMistakes = async () => {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return

        const { data } = await supabase
            .from('mistakes')
            .select('id, original_image, created_at, status')
            .eq('user_id', user.id)
            .in('status', ['pending', 'review_needed', 'analyzing'])
            .order('created_at', { ascending: true }) // FIFO: Process oldest first

        if (data) setMistakes(data)
        setLoading(false)
    }

    const [currentProcessingId, setCurrentProcessingId] = useState<string | null>(null)

    const handleDelete = async (id: string) => {
        if (!confirm('确定要删除这张吗？')) return
        await supabase.from('mistakes').delete().eq('id', id)
        setMistakes(prev => prev.filter(m => m.id !== id))
    }

    // 🔥 Batch Analysis Logic (Strict Sequential)
    const handleBatchAnalysis = async () => {
        if (mistakes.length === 0) return
        setProcessing(true)
        setProgress({ current: 0, total: mistakes.length })

        // Authentication
        const { data: { session } } = await supabase.auth.getSession()
        const token = session?.access_token

        if (!token) {
            toast.error('认证失效，请重新登录')
            setProcessing(false)
            return
        }

        // Process sequentially (one by one) to show real progress
        for (let i = 0; i < mistakes.length; i++) {
            const mistake = mistakes[i]
            setCurrentProcessingId(mistake.id)

            try {
                // 1. Mark as analyzing in DB (if not already)
                await supabase.from('mistakes').update({ status: 'analyzing' }).eq('id', mistake.id)

                // 2. Call AI API
                const response = await fetch('/api/analyze-mistake', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${token}`
                    },
                    body: JSON.stringify({ imageUrl: mistake.original_image })
                })

                if (!response.ok) {
                    const errData = await response.json().catch(() => ({}))
                    const msg = `[${response.status}] ${errData.error || response.statusText || 'API Failed'}`
                    throw new Error(msg)
                }
                const result = await response.json()

                // 3. Update DB with result
                await supabase.from('mistakes').update({
                    status: 'review_needed',
                    question_text: result.question_text,
                    ai_analysis: result.ai_analysis,
                    subject: result.subject || 'Other',
                    error_type: result.error_type || 'Carelessness',
                    knowledge_tags: result.knowledge_tags || [],
                    user_answer: result.user_answer
                }).eq('id', mistake.id)

                // Update local state to reflect change immediately
                setMistakes(prev => prev.map(m =>
                    m.id === mistake.id ? { ...m, status: 'review_needed' } : m
                ))

            } catch (error: any) {
                console.error(`Failed to analyze ${mistake.id}`, error)
                toast.error(`分析失败 (${i + 1}/${mistakes.length}): ${error.message}`)
            } finally {
                setProgress(prev => ({ ...prev, current: i + 1 }))
                // Polite delay between requests
                if (i < mistakes.length - 1) {
                    await new Promise(r => setTimeout(r, 1000))
                }
            }
        }

        setProcessing(false)
        setCurrentProcessingId(null)
        toast.success(`队列处理完成！`)
        fetchPendingMistakes() // Final refresh
    }

    if (loading) return <div className="p-8 text-center text-muted-foreground">加载中...</div>

    return (
        <div className="container p-4 mx-auto space-y-6">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <h1 className="text-2xl font-bold flex items-center gap-2">
                    <Layers className="w-6 h-6 text-primary" />
                    人工审核队列 (Secondary Review)
                </h1>

                {mistakes.length > 0 && (
                    <Button
                        size="lg"
                        onClick={handleBatchAnalysis}
                        disabled={processing}
                        variant="secondary"
                        className="w-full md:w-auto"
                    >
                        {processing ? (
                            <>
                                <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                                正在重试 ({progress.current}/{progress.total})...
                            </>
                        ) : (
                            <>
                                <Zap className="w-5 h-5 mr-2" />
                                重新分析 (Retry All)
                            </>
                        )}
                    </Button>
                )}
            </div>

            {/* Progress Bar */}
            {processing && (
                <div className="w-full bg-secondary h-2 rounded-full overflow-hidden">
                    <div
                        className="bg-primary h-full transition-all duration-300 ease-out"
                        style={{ width: `${(progress.current / progress.total) * 100}%` }}
                    />
                </div>
            )}

            {mistakes.length === 0 ? (
                <div className="text-center py-20 bg-slate-50 rounded-xl border-dashed border-2 border-slate-200 text-slate-500">
                    <CheckCircle className="w-16 h-16 mx-auto mb-4 text-green-500/20" />
                    <p className="text-lg">太棒了！队列空空如也。</p>
                    <p className="text-sm text-slate-400 mt-2">分析完成的题目请去“题库”中查看。</p>
                    <Link href="/mistakes/new" className="mt-6 inline-block">
                        <Button variant="outline">去录入新的</Button>
                    </Link>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {mistakes.map(mistake => (
                        <Card key={mistake.id} className={`overflow-hidden group hover:shadow-lg transition-all duration-300 ${mistake.status === 'review_needed' ? 'ring-2 ring-green-500/50' : ''}`}>
                            <div className="aspect-video relative overflow-hidden bg-slate-100">
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img
                                    src={mistake.original_image}
                                    alt="Mistake"
                                    className="object-cover w-full h-full group-hover:scale-105 transition-transform duration-500"
                                />
                                <div className={`absolute top-2 right-2 text-white text-[10px] px-2 py-1 rounded backdrop-blur-sm ${mistake.status === 'review_needed' ? 'bg-green-600/80' :
                                    mistake.status === 'analyzing' ? 'bg-blue-600/80 animate-pulse' : 'bg-black/50'
                                    }`}>
                                    {mistake.status === 'review_needed' ? '待确认' :
                                        mistake.status === 'analyzing' ? 'AI 分析中...' : '待处理'}
                                </div>
                            </div>
                            <CardFooter className="p-4 flex justify-between items-center bg-white border-t">
                                <span className="text-xs text-slate-400 flex items-center gap-1">
                                    <Clock className="w-3 h-3" />
                                    {formatDistanceToNow(new Date(mistake.created_at), { addSuffix: true, locale: zhCN })}
                                </span>
                                <div className="flex gap-2">
                                    <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400 hover:text-red-500 hover:bg-red-50" onClick={() => handleDelete(mistake.id)}>
                                        <Trash2 className="w-4 h-4" />
                                    </Button>

                                    {mistake.status === 'review_needed' ? (
                                        <Link href={`/mistakes/${mistake.id}/edit`}>
                                            <Button size="sm" className="h-8 text-xs bg-green-600 hover:bg-green-700">
                                                确认结果
                                            </Button>
                                        </Link>
                                    ) : (
                                        <Link href={`/mistakes/${mistake.id}/edit`}>
                                            {mistake.status === 'analyzing' ? (
                                                <Button size="sm" variant="secondary" className="h-8 text-xs" disabled>
                                                    <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                                                    分析中
                                                </Button>
                                            ) : (
                                                <Button size="sm" variant="secondary" className="h-8 text-xs">
                                                    手动分析
                                                </Button>
                                            )}
                                        </Link>
                                    )}
                                </div>
                            </CardFooter>
                        </Card>
                    ))}
                </div>
            )}
        </div>
    )
}
