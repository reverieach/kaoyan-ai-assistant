'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import Link from 'next/link'
import { BrainCircuit, Clock, Trash2 } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import { zhCN } from 'date-fns/locale'

type MistakePreview = {
    id: string
    original_image: string
    created_at: string
}

export default function PendingMistakesPage() {
    const [mistakes, setMistakes] = useState<MistakePreview[]>([])
    const [loading, setLoading] = useState(true)
    const supabase = createClient()

    useEffect(() => {
        fetchPendingMistakes()
    }, [])

    const fetchPendingMistakes = async () => {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return

        const { data } = await supabase
            .from('mistakes')
            .select('id, original_image, created_at')
            .eq('user_id', user.id)
            .eq('status', 'pending')
            .order('created_at', { ascending: false })

        if (data) setMistakes(data)
        setLoading(false)
    }

    const handleDelete = async (id: string) => {
        if (!confirm('确定要删除这张吗？')) return
        await supabase.from('mistakes').delete().eq('id', id)
        setMistakes(prev => prev.filter(m => m.id !== id))
    }

    if (loading) return <div className="p-8 text-center">加载中...</div>

    return (
        <div className="container p-4 mx-auto">
            <h1 className="text-2xl font-bold mb-6 flex items-center gap-2">
                <Clock className="w-6 h-6" />
                待处理队列 ({mistakes.length})
            </h1>

            {mistakes.length === 0 ? (
                <div className="text-center py-20 bg-gray-50 rounded-lg text-gray-500">
                    <p>太棒了！所有错题都处理完了。</p>
                    <Link href="/mistakes/new">
                        <Button variant="link">去录入新的</Button>
                    </Link>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {mistakes.map(mistake => (
                        <Card key={mistake.id} className="overflow-hidden group hover:shadow-lg transition-shadow">
                            <div className="aspect-video relative overflow-hidden bg-gray-100">
                                <img
                                    src={mistake.original_image}
                                    alt="Mistake"
                                    className="object-cover w-full h-full"
                                />
                            </div>
                            <CardFooter className="p-4 flex justify-between items-center bg-white">
                                <span className="text-xs text-gray-400">
                                    {formatDistanceToNow(new Date(mistake.created_at), { addSuffix: true, locale: zhCN })}
                                </span>
                                <div className="flex gap-2">
                                    <Button variant="ghost" size="icon" className="text-red-500 hover:text-red-600" onClick={() => handleDelete(mistake.id)}>
                                        <Trash2 className="w-4 h-4" />
                                    </Button>
                                    <Link href={`/mistakes/${mistake.id}/edit`}>
                                        <Button size="sm" className="gap-1">
                                            <BrainCircuit className="w-4 h-4" />
                                            开始分析
                                        </Button>
                                    </Link>
                                </div>
                            </CardFooter>
                        </Card>
                    ))}
                </div>
            )}
        </div>
    )
}
