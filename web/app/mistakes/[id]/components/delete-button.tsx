'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Trash2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
    AlertDialogTrigger,
} from "@/components/ui/alert-dialog"

export function DeleteMistakeButton({ id }: { id: string }) {
    const [loading, setLoading] = useState(false)
    const router = useRouter()
    const supabase = createClient()

    const handleDelete = async () => {
        setLoading(true)
        const { error } = await supabase
            .from('mistakes')
            .delete()
            .eq('id', id)

        if (error) {
            toast.error("删除失败: " + error.message)
            setLoading(false)
        } else {
            toast.success("错题已删除")
            // Use window.location to force full reload and avoid client-side router issues
            window.location.href = '/mistakes'
        }
    }

    return (
        <AlertDialog>
            <AlertDialogTrigger asChild>
                <Button variant="destructive" size="sm" disabled={loading}>
                    <Trash2 className="w-4 h-4 mr-2" />
                    {loading ? "删除中..." : "删除"}
                </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
                <AlertDialogHeader>
                    <AlertDialogTitle>确认删除这道错题吗？</AlertDialogTitle>
                    <AlertDialogDescription>
                        此操作不可撤销。该题目将从你的错题本和复习计划中永久移除。
                    </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                    <AlertDialogCancel>取消</AlertDialogCancel>
                    <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                        确认删除
                    </AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
    )
}
