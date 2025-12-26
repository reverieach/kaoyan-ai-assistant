'use client'

import { useState, useMemo } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { Checkbox } from '@/components/ui/checkbox'
import { Search, Filter, ArrowUpDown } from 'lucide-react'
import Link from 'next/link'
import Latex from 'react-latex-next'

interface Mistake {
    id: string
    question_text: string
    subject: string
    knowledge_tags: string[]
    error_type: string
    mastery_level: number
    created_at: string
}

interface Props {
    initialMistakes: Mistake[]
    subject: string
    initialSearch?: string
}

export function MistakeListClient({ initialMistakes, subject, initialSearch = '' }: Props) {
    const [searchQuery, setSearchQuery] = useState(initialSearch)
    const [selectedTags, setSelectedTags] = useState<Set<string>>(new Set())
    const [selectedErrorTypes, setSelectedErrorTypes] = useState<Set<string>>(new Set())
    const [sortBy, setSortBy] = useState<'importance' | 'newest'>('importance')

    // 1. Compute available tags and error types from the current dataset
    const { allTags, errorTypeCounts } = useMemo(() => {
        const tags = new Map<string, number>()
        const types = new Map<string, number>()

        initialMistakes.forEach(m => {
            m.knowledge_tags?.forEach(t => tags.set(t, (tags.get(t) || 0) + 1))
            const type = m.error_type || 'Uncategorized'
            types.set(type, (types.get(type) || 0) + 1)
        })

        return {
            allTags: Array.from(tags.entries()).sort((a, b) => b[1] - a[1]), // Sort by frequency
            errorTypeCounts: Array.from(types.entries())
        }
    }, [initialMistakes])

    // 2. Filter and Sort logic
    const filteredMistakes = useMemo(() => {
        return initialMistakes.filter(m => {
            // Text Search (Match Question OR Tags)
            if (searchQuery) {
                const q = searchQuery.toLowerCase()
                const matchText = m.question_text?.toLowerCase().includes(q)
                const matchTag = m.knowledge_tags?.some(t => t.toLowerCase().includes(q))
                if (!matchText && !matchTag) return false
            }
            // Tags Filter (AND logic: must have at least one of the selected tags if any selected? Or OR logic?)
            // Usually "OR" within tags is friendlier, or "AND" for strict narrowing.
            // Let's go with "AND" for Drill Down (must match ALL selected tags) - NO, that's too strict.
            // Let's go with "OR" (match ANY selected tag).
            if (selectedTags.size > 0) {
                const hasTag = m.knowledge_tags?.some(t => selectedTags.has(t))
                if (!hasTag) return false
            }
            // Error Type Filter
            if (selectedErrorTypes.size > 0) {
                if (!selectedErrorTypes.has(m.error_type)) return false
            }
            return true
        }).sort((a, b) => {
            if (sortBy === 'importance') {
                // Low mastery = High importance
                return (a.mastery_level || 0) - (b.mastery_level || 0)
            } else {
                // Newest first
                return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
            }
        })
    }, [initialMistakes, searchQuery, selectedTags, selectedErrorTypes, sortBy])

    const toggleTag = (tag: string) => {
        const next = new Set(selectedTags)
        if (next.has(tag)) next.delete(tag)
        else next.add(tag)
        setSelectedTags(next)
    }

    const toggleErrorType = (type: string) => {
        const next = new Set(selectedErrorTypes)
        if (next.has(type)) next.delete(type)
        else next.add(type)
        setSelectedErrorTypes(next)
    }

    return (
        <div className="flex flex-col md:flex-row gap-6">
            {/* Sidebar Filters */}
            <aside className="w-full md:w-64 space-y-6 shrink-0">
                <div className="space-y-4">
                    <h3 className="font-semibold flex items-center gap-2">
                        <Filter className="w-4 h-4" />
                        知识点过滤器
                    </h3>
                    <div className="flex flex-wrap gap-2">
                        {allTags.map(([tag, count]) => (
                            <Badge
                                key={tag}
                                variant={selectedTags.has(tag) ? "default" : "outline"}
                                className="cursor-pointer hover:opacity-80 transition-opacity"
                                onClick={() => toggleTag(tag)}
                            >
                                {tag} <span className="ml-1 opacity-70 text-[10px]">{count}</span>
                            </Badge>
                        ))}
                    </div>
                    {allTags.length === 0 && <p className="text-sm text-gray-500">该科目暂无标签</p>}
                </div>

                <div className="space-y-3">
                    <h3 className="font-semibold text-sm text-gray-700">错误类型</h3>
                    {errorTypeCounts.map(([type, count]) => (
                        <div key={type} className="flex items-center space-x-2">
                            <Checkbox
                                id={type}
                                checked={selectedErrorTypes.has(type)}
                                onCheckedChange={() => toggleErrorType(type)}
                            />
                            <label htmlFor={type} className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                                {type} ({count})
                            </label>
                        </div>
                    ))}
                </div>
            </aside>

            {/* Main Content */}
            <main className="flex-1 space-y-4">
                {/* Search & Sort Bar */}
                <div className="flex gap-4">
                    <div className="relative flex-1">
                        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-gray-500" />
                        <Input
                            placeholder="搜索题目关键词..."
                            className="pl-9"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                        />
                    </div>
                    <Select value={sortBy} onValueChange={(v: any) => setSortBy(v)}>
                        <SelectTrigger className="w-[180px]">
                            <ArrowUpDown className="w-4 h-4 mr-2" />
                            <SelectValue placeholder="排序" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="importance">按重要度 (不熟优先)</SelectItem>
                            <SelectItem value="newest">按录入时间</SelectItem>
                        </SelectContent>
                    </Select>
                </div>

                {/* List */}
                <div className="space-y-4">
                    {filteredMistakes.length === 0 ? (
                        <div className="text-center py-12 text-gray-500">
                            没有找到符合条件的错题
                        </div>
                    ) : (
                        filteredMistakes.map(mistake => (
                            <Card key={mistake.id} className="hover:shadow transition-shadow">
                                <CardContent className="p-4 flex gap-4">
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2 mb-2">
                                            <Badge variant="secondary" className="text-xs">
                                                {mistake.error_type}
                                            </Badge>
                                            <span className="text-xs text-gray-400">
                                                掌握度: {mistake.mastery_level}/10
                                            </span>
                                            {mistake.knowledge_tags?.map(t => (
                                                <span key={t} className="text-xs text-blue-500 bg-blue-50 px-1 rounded">#{t}</span>
                                            ))}
                                        </div>
                                        <div className="line-clamp-2 prose prose-sm max-h-[3rem] overflow-hidden text-sm">
                                            <Latex>{mistake.question_text || '(无文本)'}</Latex>
                                        </div>
                                    </div>
                                    <Link href={`/mistakes/${mistake.id}`}>
                                        <Button variant="outline" size="sm">查看</Button>
                                    </Link>
                                </CardContent>
                            </Card>
                        ))
                    )}
                </div>
            </main>
        </div>
    )
}
