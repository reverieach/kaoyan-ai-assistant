'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { notFound, useRouter } from 'next/navigation'
import ReactMarkdown from 'react-markdown'
import rehypeKatex from 'rehype-katex'
import remarkMath from 'remark-math'
import rehypeRaw from 'rehype-raw'
import 'katex/dist/katex.min.css'
import 'github-markdown-css/github-markdown.css'
import { Button } from '@/components/ui/button'
import { ArrowLeft, MessageSquare, BookOpen, List, Loader2 } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { toast } from 'sonner'
import { use } from 'react' // Next.js 15+

export default function ReferenceDetailPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = use(params)
    const [reference, setReference] = useState<any>(null)
    const [loading, setLoading] = useState(true)
    const [chatInput, setChatInput] = useState('')
    const [chatLoading, setChatLoading] = useState(false)
    const [messages, setMessages] = useState<{ role: string, content: string }[]>([])
    const router = useRouter()
    const supabase = createClient()
    const [toc, setToc] = useState<{ id: string, text: string, level: number }[]>([])

    // Parse TOC from content
    useEffect(() => {
        if (!reference?.content) return
        const lines = reference.content.split('\n')
        const newToc = []
        const slugCounts: Record<string, number> = {}

        for (const line of lines) {
            const match = line.match(/^(#{1,3})\s+(.+)$/)
            if (match) {
                const level = match[1].length
                const text = match[2].trim()
                // Simple slug generation
                let slug = text.toLowerCase().replace(/\s+/g, '-').replace(/[^\w\-\u4e00-\u9fa5]/g, '')
                if (!slug) slug = `section-${newToc.length}`

                // Handle duplicates
                if (slugCounts[slug]) {
                    slugCounts[slug]++
                    slug = `${slug}-${slugCounts[slug]}`
                } else {
                    slugCounts[slug] = 1
                }

                newToc.push({ id: slug, text, level })
            }
        }
        setToc(newToc)
    }, [reference])

    const scrollToSection = (id: string) => {
        const element = document.getElementById(id)
        if (element) {
            element.scrollIntoView({ behavior: 'smooth' })
        }
    }

    useEffect(() => {
        fetchReference()
    }, [id])

    const fetchReference = async () => {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return

        const { data, error } = await supabase
            .from('references_kb')
            .select('*')
            .eq('id', id)
            .single()

        if (error || !data) {
            notFound()
        } else {
            setReference(data)
        }
        setLoading(false)
    }

    const handleChat = async () => {
        if (!chatInput.trim() || chatLoading) return

        const userMsg = { role: 'user', content: chatInput.trim() }
        setMessages(prev => [...prev, userMsg])
        setChatInput('')
        setChatLoading(true)

        try {
            const response = await fetch('/api/chat-reference', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    docId: id,
                    messages: [...messages, userMsg]
                })
            })

            if (!response.ok) {
                const errData = await response.json().catch(() => ({}))
                throw new Error(errData.error || response.statusText || 'Request failed')
            }
            if (!response.body) throw new Error('No body')

            setMessages(prev => [...prev, { role: 'assistant', content: '' }])

            const reader = response.body.getReader()
            const decoder = new TextDecoder()
            let aiText = ''

            while (true) {
                const { done, value } = await reader.read()
                if (done) break

                const chunk = decoder.decode(value, { stream: true })
                const lines = chunk.split('\n')
                for (const line of lines) {
                    if (line.startsWith('data: ') && line !== 'data: [DONE]') {
                        try {
                            const json = JSON.parse(line.trim().substring(6))
                            const content = json.choices?.[0]?.delta?.content || ''
                            if (content) {
                                aiText += content
                                setMessages(prev => {
                                    const newHistory = [...prev]
                                    if (newHistory.length > 0) {
                                        newHistory[newHistory.length - 1] = { role: 'assistant', content: aiText }
                                    }
                                    return newHistory
                                })
                            }
                        } catch (e) { }
                    } else if (line.trim() && !line.startsWith('data: ')) {
                        aiText += line
                        setMessages(prev => {
                            const newHistory = [...prev]
                            if (newHistory.length > 0) {
                                newHistory[newHistory.length - 1] = { role: 'assistant', content: aiText }
                            }
                            return newHistory
                        })
                    }
                }
            }
        } catch (e: any) {
            console.error(e)
            toast.error(`请求失败: ${e.message}`)
        } finally {
            setChatLoading(false)
        }
    }

    if (loading) return <div className="p-8 flex items-center justify-center h-full text-muted-foreground"><Loader2 className="w-6 h-6 animate-spin mr-2" /> 加载文档中...</div>

    return (
        <div className="flex flex-col h-[calc(100vh-64px)] overflow-hidden bg-slate-50/30">
            {/* Top Banner - Compact */}
            <div className="bg-white border-b px-6 py-3 flex items-center justify-between shrink-0 h-14">
                <div className="flex items-center gap-3 overflow-hidden">
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => router.back()}>
                        <ArrowLeft className="w-4 h-4" />
                    </Button>
                    <h1 className="text-base font-semibold truncate max-w-md" title={reference.title}>
                        {reference.title}
                    </h1>
                </div>
                <div className="text-xs text-muted-foreground">
                    {new Date(reference.created_at).toLocaleDateString()}
                </div>
            </div>

            <div className="flex flex-1 overflow-hidden">
                {/* Left: TOC Sidebar */}
                <div className="hidden md:flex w-64 flex-col border-r bg-slate-50 overflow-y-auto shrink-0">
                    <div className="p-4 font-semibold text-sm text-slate-500 sticky top-0 bg-slate-50 z-10 flex items-center gap-2">
                        <List className="w-4 h-4" /> 目录
                    </div>
                    <div className="px-3 pb-8 space-y-1">
                        {toc.length === 0 && <div className="text-xs text-muted-foreground px-2">未检测到章节</div>}
                        {toc.map((item, index) => (
                            <button
                                key={index}
                                onClick={() => scrollToSection(item.id)}
                                className={`text-left w-full text-sm py-1.5 px-2 rounded hover:bg-slate-200/50 transition-colors truncate
                                    ${item.level === 1 ? 'font-medium text-slate-800' : 'text-slate-600'}
                                    ${item.level === 2 ? 'pl-4' : ''}
                                    ${item.level === 3 ? 'pl-8 text-xs' : ''}
                                `}
                                title={item.text}
                            >
                                {item.text}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Center: Content */}
                <div className="flex-1 overflow-y-auto bg-white relative">
                    <div className="max-w-3xl mx-auto px-8 py-10 min-h-full">
                        <div className="markdown-body">
                            <ReactMarkdown
                                remarkPlugins={[remarkMath]}
                                rehypePlugins={[rehypeKatex, rehypeRaw]}
                                components={{
                                    img: ({ node, ...props }: any) => (
                                        <div className="my-6">
                                            {/* eslint-disable-next-line @next/next/no-img-element */}
                                            <img
                                                {...props}
                                                className="rounded-lg shadow-sm max-w-full h-auto mx-auto border"
                                                alt={props.alt || 'img'}
                                            />
                                            {props.alt && (
                                                <p className="text-center text-xs text-muted-foreground mt-2 italic">
                                                    {props.alt}
                                                </p>
                                            )}
                                        </div>
                                    ),
                                    // Custom headers to add IDs for TOC
                                    h1: ({ node, children, ...props }: any) => {
                                        const text = String(children).replace(/\n/g, '')
                                        const slug = text.toLowerCase().replace(/\s+/g, '-').replace(/[^\w\-\u4e00-\u9fa5]/g, '')
                                        // Need to handle duplicates in render is hard without context, 
                                        // but usually exact match works for jump if unique enough.
                                        // We will rely on the verify same logic or just use text match?
                                        // Better strategy: try to match the toc id logic.
                                        // For now, let's just use strict slugify.
                                        // NOTE: This might have collision issues if not synced with TOC logic perfectly.
                                        // Alternative: Use a counter? No, render is pure.
                                        // Let's assume low collision for now or accept first match.
                                        return <h1 id={slug} {...props}>{children}</h1>
                                    },
                                    h2: ({ node, children, ...props }: any) => {
                                        const text = String(children).replace(/\n/g, '')
                                        const slug = text.toLowerCase().replace(/\s+/g, '-').replace(/[^\w\-\u4e00-\u9fa5]/g, '')
                                        return <h2 id={slug} {...props}>{children}</h2>
                                    },
                                    h3: ({ node, children, ...props }: any) => {
                                        const text = String(children).replace(/\n/g, '')
                                        const slug = text.toLowerCase().replace(/\s+/g, '-').replace(/[^\w\-\u4e00-\u9fa5]/g, '')
                                        return <h3 id={slug} {...props}>{children}</h3>
                                    },
                                    blockquote: ({ node, ...props }: any) => {
                                        const isAI = String(props.children).includes('[AI图解]')
                                        return (
                                            <blockquote
                                                {...props}
                                                className={`border-l-4 pl-4 py-2 my-4 ${isAI ? 'border-purple-500 bg-purple-50 text-purple-900 rounded-r' : 'border-gray-300'
                                                    }`}
                                            />
                                        )
                                    }
                                }}
                            >
                                {reference.content}
                            </ReactMarkdown>
                        </div>
                    </div>
                </div>

                {/* Right: Chat (Resized) */}
                <div className="hidden lg:flex w-[400px] flex-col border-l bg-slate-50/50 h-full shrink-0 shadow-[-1px_0_10px_rgba(0,0,0,0.03)] z-20">
                    <div className="p-4 border-b bg-white flex items-center gap-2 font-semibold text-purple-700 shadow-sm">
                        <MessageSquare className="w-5 h-5" />
                        AI 助教答疑
                    </div>

                    <div className="flex-1 overflow-y-auto p-4 space-y-4">
                        <div className="p-3 bg-purple-100 rounded-lg inline-block text-purple-900 text-sm shadow-sm">
                            已读取《{reference.title}》。有什么不懂的随时问我！
                        </div>
                        {messages.map((msg, i) => (
                            <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                                <div className={`p-3 rounded-xl max-w-[90%] whitespace-pre-wrap text-sm shadow-sm ${msg.role === 'user'
                                    ? 'bg-blue-600 text-white rounded-br-none'
                                    : 'bg-white text-slate-700 border rounded-bl-none'
                                    }`}>
                                    <ReactMarkdown components={{
                                        p: ({ children }) => <p className="mb-0">{children}</p>
                                    }}>
                                        {msg.content}
                                    </ReactMarkdown>
                                </div>
                            </div>
                        ))}
                        {chatLoading && (
                            <div className="flex justify-start">
                                <div className="bg-slate-100 p-2 rounded-lg text-xs text-muted-foreground animate-pulse flex items-center gap-1">
                                    <span className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce"></span>
                                    <span className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce delay-75"></span>
                                    <span className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce delay-150"></span>
                                </div>
                            </div>
                        )}
                    </div>

                    <div className="p-4 bg-white border-t">
                        <div className="flex gap-2 items-end bg-slate-100 p-2 rounded-xl border focus-within:ring-2 focus-within:ring-blue-100 transition-all">
                            <textarea
                                value={chatInput}
                                onChange={e => setChatInput(e.target.value)}
                                placeholder="输入问题 (Enter 发送, Shift+Enter 换行)..."
                                className="flex-1 bg-transparent border-none text-sm resize-none focus:outline-none max-h-32 min-h-[40px] py-2"
                                rows={1}
                                onKeyDown={e => {
                                    if (e.key === 'Enter' && !e.shiftKey) {
                                        e.preventDefault()
                                        handleChat()
                                    }
                                }}
                            />
                            <Button size="icon" className="h-9 w-9 shrink-0 mb-0.5" onClick={handleChat} disabled={chatLoading}>
                                <BookOpen className="w-4 h-4" />
                            </Button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}
