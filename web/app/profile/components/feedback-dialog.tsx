'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog"
import { Textarea } from '@/components/ui/textarea'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import { Bug } from 'lucide-react'

export function FeedbackDialog() {
    const [open, setOpen] = useState(false)
    const [content, setContent] = useState('')
    const [loading, setLoading] = useState(false)
    const supabase = createClient()

    const handleSubmit = async () => {
        if (!content.trim()) return

        setLoading(true)
        const { data: { user } } = await supabase.auth.getUser()

        if (!user) {
            toast.error('请先登录')
            return
        }

        const { error } = await supabase
            .from('feedbacks')
            .insert({
                user_id: user.id,
                content: content,
                user_email: user.email // Optional convenience field
            })

        if (error) {
            toast.error('提交失败: ' + error.message)
        } else {
            toast.success('感谢您的反馈！我们会尽快处理。')
            setOpen(false)
            setContent('')
        }
        setLoading(false)
    }

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button variant="outline" className="w-full gap-2 border-dashed border-orange-300 bg-orange-50 text-orange-700 hover:bg-orange-100">
                    <Bug className="w-4 h-4" />
                    提交 Bug 或建议
                </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                    <DialogTitle>反馈与建议</DialogTitle>
                    <DialogDescription>
                        请描述您遇到的问题或改进建议，帮助我们做得更好。
                    </DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                    <Textarea
                        placeholder="例如：在上传错题时遇到了卡顿..."
                        value={content}
                        onChange={(e) => setContent(e.target.value)}
                        className="min-h-[150px]"
                    />
                </div>
                <DialogFooter>
                    <Button onClick={handleSubmit} disabled={loading || !content.trim()}>
                        {loading ? '提交中...' : '提交反馈'}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}
