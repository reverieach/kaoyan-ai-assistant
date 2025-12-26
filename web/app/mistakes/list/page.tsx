import { createClient } from '@/lib/supabase/server'
import { MistakeListClient } from './components/mistake-list-client'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { ChevronLeft } from 'lucide-react'

export const dynamic = 'force-dynamic'

interface Props {
    searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}

export default async function MistakeListPage({ searchParams }: Props) {
    const params = await searchParams
    const subject = typeof params.subject === 'string' ? params.subject : ''

    if (!subject) {
        redirect('/mistakes')
    }

    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
        redirect('/auth/login')
    }

    // Fetch all active mistakes for this subject
    // We fetch logic fields: sorting and filtering will happen on client for better UX
    // Assuming < 1000 items per subject, client-side filtering is efficient enough
    const { data: mistakes } = await supabase
        .from('mistakes')
        .select('*')
        .eq('user_id', user.id)
        .eq('subject', subject)
        .eq('status', 'active')
        .order('mastery_level', { ascending: true }) // Default sort by importance
        .limit(200) // Safety limit

    // Friendly Name Map
    const SUBJECT_LABELS: Record<string, string> = {
        'Math': '高等数学',
        'DataStructures': '数据结构',
        'CompOrg': '计算机组成原理',
        'OS': '操作系统',
        'Network': '计算机网络',
        'Other': '其他科目'
    }

    const search = typeof params.search === 'string' ? params.search : ''

    return (
        <div className="container max-w-5xl mx-auto p-6 space-y-6">
            <div className="flex items-center gap-4 border-b pb-4">
                <Link href="/mistakes" className="text-muted-foreground hover:text-foreground">
                    <ChevronLeft className="w-6 h-6" />
                </Link>
                <div>
                    <h1 className="text-2xl font-bold tracking-tight">
                        {SUBJECT_LABELS[subject] || subject} - 错题库
                    </h1>
                    <p className="text-sm text-muted-foreground">
                        共找到 {mistakes?.length || 0} 道相关题目
                    </p>
                </div>
            </div>

            <MistakeListClient
                initialMistakes={mistakes || []}
                subject={subject}
                initialSearch={search}
            />
        </div>
    )
}
