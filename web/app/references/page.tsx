'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Upload, FileText, Database, Loader2, MessageSquare } from 'lucide-react'
import { toast } from 'sonner'
import { useRouter } from 'next/navigation'

export default function ReferencesPage() {
    const [uploading, setUploading] = useState(false)
    const [progress, setProgress] = useState(0)
    const [progressMessage, setProgressMessage] = useState('')
    const [dragActive, setDragActive] = useState(false)
    const router = useRouter()

    const handleUpload = async (file: File) => {
        const isPdf = file.type.includes('pdf') || file.name.endsWith('.pdf')
        const isZip = file.type.includes('zip') || file.name.endsWith('.zip')
        const isMd = file.name.endsWith('.md')

        if (!isPdf && !isZip && !isMd) {
            toast.error('不支持的文件类型。请上传 PDF, Zip 或 Markdown 文件')
            return
        }

        setUploading(true)
        setProgress(0)
        setProgressMessage('正在初始化...')

        const formData = new FormData()
        formData.append('file', file)

        try {
            const response = await fetch('/api/upload-reference', {
                method: 'POST',
                body: formData,
            })

            if (!response.ok) throw new Error('上传请求失败')
            if (!response.body) throw new Error('无法读取流')

            const reader = response.body.getReader()
            const decoder = new TextDecoder()
            let done = false

            while (!done) {
                const { value, done: isDone } = await reader.read()
                done = isDone
                if (value) {
                    const chunk = decoder.decode(value)
                    const lines = chunk.split('\n\n')
                    for (const line of lines) {
                        if (line.startsWith('data: ')) {
                            try {
                                const data = JSON.parse(line.replace('data: ', '').trim())
                                if (data.error) throw new Error(data.error)
                                if (data.progress) setProgress(data.progress)
                                if (data.message) setProgressMessage(data.message)
                                if (data.success) {
                                    toast.success('资料上传并解析成功！')
                                    router.refresh()
                                }
                            } catch (e) {
                                // Ignore json parse errors for partial chunks
                            }
                        }
                    }
                }
            }

        } catch (error: any) {
            toast.error(error.message || '上传过程中发生错误')
        } finally {
            setUploading(false)
            setProgress(0)
        }
    }

    const onDragOver = (e: React.DragEvent) => {
        e.preventDefault()
        setDragActive(true)
    }

    const onDragLeave = (e: React.DragEvent) => {
        e.preventDefault()
        setDragActive(false)
    }

    const onDrop = (e: React.DragEvent) => {
        e.preventDefault()
        setDragActive(false)
        if (e.dataTransfer.files && e.dataTransfer.files[0]) {
            handleUpload(e.dataTransfer.files[0])
        }
    }

    const [references, setReferences] = useState<any[]>([])
    const [loading, setLoading] = useState(true)

    // Fetch references on load
    useEffect(() => {
        fetchReferences()
    }, [])

    const fetchReferences = async () => {
        const supabase = await import('@/lib/supabase/client').then(mod => mod.createClient())
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return

        const { data, error } = await supabase
            .from('references_kb')
            .select('id, title, summary, created_at')
            .eq('user_id', user.id)
            .order('created_at', { ascending: false })

        if (error) {
            toast.error('无法加载资料列表')
        } else {
            setReferences(data || [])
        }
        setLoading(false)
    }

    const handleDelete = async (id: string, e: React.MouseEvent) => {
        e.stopPropagation() // Prevent card click
        if (!confirm('确定要删除这个文档吗？')) return

        const supabase = await import('@/lib/supabase/client').then(mod => mod.createClient())
        const { error } = await supabase.from('references_kb').delete().eq('id', id)

        if (error) {
            toast.error('删除失败')
        } else {
            toast.success('文档已删除')
            fetchReferences()
        }
    }

    return (
        <div className="container max-w-5xl mx-auto p-6 space-y-8">
            <header>
                <h1 className="text-3xl font-bold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-blue-700 to-purple-700">
                    AI 资料库
                </h1>
                <p className="text-muted-foreground mt-2">
                    构建您的私人知识库。上传教材或笔记，AI 将自动解析并用于回答问题。
                </p>
            </header>

            {/* Upload Area */}
            <Card
                className={`border-dashed border-2 transition-colors cursor-pointer ${dragActive ? 'border-primary bg-primary/5' : 'border-gray-200'
                    }`}
                onDragOver={onDragOver}
                onDragLeave={onDragLeave}
                onDrop={onDrop}
            >
                <CardContent className="flex flex-col items-center justify-center py-12 space-y-4">
                    <div className="p-4 bg-slate-100 rounded-full">
                        {uploading ? (
                            <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
                        ) : (
                            <Database className="w-8 h-8 text-slate-600" />
                        )}
                    </div>
                    <div className="text-center w-full max-w-md">
                        <h3 className="text-lg font-semibold">
                            {uploading ? '正在 AI 解析中...' : '上传 PDF 资料'}
                        </h3>
                        {uploading ? (
                            <div className="mt-4 space-y-2">
                                <div className="w-full bg-secondary h-2.5 rounded-full overflow-hidden">
                                    <div
                                        className="bg-blue-600 h-full transition-all duration-300 ease-out"
                                        style={{ width: `${progress}%` }}
                                    ></div>
                                </div>
                                <p className="text-xs text-muted-foreground animate-pulse">
                                    {progressMessage || '正在启动引擎...'} ({progress}%)
                                </p>
                            </div>
                        ) : (
                            <p className="text-sm text-muted-foreground mt-1 mx-auto">
                                支持 PDF、MinerU 导出的 ZIP (推荐)，或单个 MD 文件 (无图片)。
                            </p>
                        )}
                    </div>
                    {!uploading && (
                        <div className="relative">
                            <input
                                type="file"
                                accept=".pdf,.zip,.md"
                                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                                onChange={(e) => e.target.files && handleUpload(e.target.files[0])}
                            />
                            <Button>选择文件</Button>
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* References List */}
            <div className="space-y-4">
                <div className="flex items-center justify-between">
                    <h2 className="text-xl font-semibold flex items-center gap-2">
                        <FileText className="w-5 h-5 text-primary" />
                        已收录文档 ({references.length})
                    </h2>
                    <Button variant="ghost" size="sm" onClick={fetchReferences} disabled={loading}>
                        刷新列表
                    </Button>
                </div>

                {loading ? (
                    <div className="flex justify-center py-8">
                        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                    </div>
                ) : references.length === 0 ? (
                    <Card className="bg-slate-50 border-none shadow-inner opacity-70">
                        <CardHeader>
                            <CardTitle className="text-base text-gray-500">暂无文档</CardTitle>
                            <CardDescription>上传第一个文档开始构建知识库</CardDescription>
                        </CardHeader>
                    </Card>
                ) : (
                    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                        {references.map((item) => (
                            <Card
                                key={item.id}
                                className="group hover:shadow-lg transition-all cursor-pointer border-l-4 border-l-transparent hover:border-l-blue-600"
                                onClick={() => router.push(`/references/${item.id}`)}
                            >
                                <CardHeader className="pb-2">
                                    <div className="flex justify-between items-start">
                                        <CardTitle className="text-base line-clamp-1 group-hover:text-blue-600 transition-colors">
                                            {item.title || '无标题文档'}
                                        </CardTitle>
                                        <div className="opacity-0 group-hover:opacity-100 transition-opacity">
                                            {/* Stop propagation is handled in handleDelete */}
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                className="h-6 w-6 text-slate-400 hover:text-red-500"
                                                onClick={(e) => handleDelete(item.id, e)}
                                            >
                                                <span className="sr-only">Delete</span>
                                                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18" /><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" /><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" /></svg>
                                            </Button>
                                        </div>
                                    </div>
                                    <CardDescription className="text-xs">
                                        {new Date(item.created_at).toLocaleDateString()}
                                    </CardDescription>
                                </CardHeader>
                                <CardContent>
                                    <p className="text-sm text-muted-foreground line-clamp-3 h-[60px]">
                                        {item.summary || '暂无摘要'}
                                    </p>
                                    <div className="mt-4 flex items-center gap-2 text-xs text-blue-600 font-medium opacity-0 group-hover:opacity-100 transition-opacity translate-y-2 group-hover:translate-y-0 duration-300">
                                        <MessageSquare className="w-3 h-3" />
                                        点击阅读与提问
                                    </div>
                                </CardContent>
                            </Card>
                        ))}
                    </div>
                )}
            </div>
        </div>
    )
}
