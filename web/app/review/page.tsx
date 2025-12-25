'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Rating, calculateSM2, ReviewItem } from '@/lib/algorithm/sm2'
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { toast } from 'sonner'
import Latex from 'react-latex-next'
import 'katex/dist/katex.min.css'

export default function ReviewPage() {
    const [reviews, setReviews] = useState<any[]>([])
    const [current, setCurrent] = useState<any>(null)
    const [showAnswer, setShowAnswer] = useState(false)
    const [loading, setLoading] = useState(true)
    const [finished, setFinished] = useState(false)

    const supabase = createClient()

    useEffect(() => {
        fetchReviews()
    }, [])

    const fetchReviews = async () => {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return

        // 获取 status='active' 且 next_review_at <= now
        const { data, error } = await supabase
            .from('mistakes')
            .select('*')
            .eq('user_id', user.id)
            .eq('status', 'active')
            .lte('next_review_at', new Date().toISOString())
            .limit(20) // 每次复习20个

        if (error) {
            toast.error('加载失败')
        } else {
            if (data && data.length > 0) {
                setReviews(data)
                setCurrent(data[0])
            } else {
                setFinished(true)
            }
        }
        setLoading(false)
    }

    const handleRate = async (quality: Rating) => {
        if (!current) return

        const item: ReviewItem = {
            id: current.id,
            repetition_number: current.mastery_level || 0,
            ease_factor: current.ease_factor || 2.5,
            interval_days: current.interval_days || 0,
            mastery_level: current.mastery_level || 0
        }

        const result = calculateSM2(item, quality)

        // Update DB
        const { error } = await supabase
            .from('mistakes')
            .update({
                mastery_level: result.mastery_level,
                ease_factor: result.ease_factor,
                interval_days: result.interval_days,
                next_review_at: result.next_review_at.toISOString(),
                updated_at: new Date().toISOString()
            })
            .eq('id', current.id)

        if (error) {
            toast.error('保存进度失败')
            return
        }

        // Next Card
        const remaining = reviews.filter(r => r.id !== current.id)
        setReviews(remaining)
        setShowAnswer(false)

        if (remaining.length > 0) {
            setCurrent(remaining[0])
        } else {
            setFinished(true)
            setCurrent(null)
        }
    }

    if (loading) return <div className="p-8 text-center">正在准备复习计划...</div>

    if (finished) {
        return (
            <div className="container mx-auto p-10 text-center space-y-4">
                <h1 className="text-3xl font-bold text-green-600">复习完成！🎉</h1>
                <p className="text-gray-500">今天的任务已经全部清理完毕。</p>
                <Button onClick={() => window.location.href = '/dashboard'}>返回仪表盘</Button>
            </div>
        )
    }

    return (
        <div className="container max-w-2xl mx-auto p-4 flex flex-col gap-6 h-[calc(100vh-100px)]">
            <div className="flex justify-between items-center text-sm text-gray-500">
                <span>待复习: {reviews.length}</span>
                <span>当前进度: {current?.subject}</span>
            </div>

            <Card className="flex-1 flex flex-col shadow-xl">
                <CardContent className="flex-1 overflow-y-auto p-6 space-y-6">
                    {/* Front: Question */}
                    <div className="space-y-4">
                        <Badge variant="outline">{current?.subject}</Badge>
                        <div className="prose prose-lg">
                            <Latex>{current?.question_text || ''}</Latex>
                        </div>
                    </div>

                    {/* Back: Answer (Hidden) */}
                    {showAnswer && (
                        <div className="pt-6 border-t animate-in fade-in slide-in-from-bottom-4 duration-500">
                            <h3 className="font-bold text-green-600 mb-2">标准解析</h3>
                            <div className="prose bg-green-50 p-4 rounded-md">
                                <Latex>{current?.correct_answer || '暂无解析'}</Latex>
                            </div>
                            {current?.ai_analysis && (
                                <div className="mt-4">
                                    <h3 className="font-bold text-blue-600 mb-2">AI 分析</h3>
                                    <p className="text-gray-700 whitespace-pre-wrap">{current.ai_analysis}</p>
                                </div>
                            )}
                        </div>
                    )}
                </CardContent>

                <CardFooter className="p-6 bg-gray-50 border-t">
                    {!showAnswer ? (
                        <Button className="w-full text-lg h-12" onClick={() => setShowAnswer(true)}>
                            查看答案
                        </Button>
                    ) : (
                        <div className="grid grid-cols-4 gap-2 w-full">
                            <Button variant="destructive" onClick={() => handleRate(1)}>
                                忘记 (0天)
                            </Button>
                            <Button className="bg-orange-500 hover:bg-orange-600" onClick={() => handleRate(3)}>
                                困难
                            </Button>
                            <Button className="bg-yellow-500 hover:bg-yellow-600" onClick={() => handleRate(4)}>
                                一般
                            </Button>
                            <Button className="bg-green-500 hover:bg-green-600" onClick={() => handleRate(5)}>
                                简单
                            </Button>
                        </div>
                    )}
                </CardFooter>
            </Card>
        </div>
    )
}
