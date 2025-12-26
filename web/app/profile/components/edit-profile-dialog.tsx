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
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import { useRouter } from 'next/navigation'

interface Props {
    user: any
    trigger?: React.ReactNode
}

export function EditProfileDialog({ user, trigger }: Props) {
    const [open, setOpen] = useState(false)
    const [fullName, setFullName] = useState(user?.user_metadata?.full_name || '')
    const [avatarFile, setAvatarFile] = useState<File | null>(null)
    const [uploading, setUploading] = useState(false)
    const supabase = createClient()
    const router = useRouter()

    const handleUpdate = async () => {
        setUploading(true)
        let avatarUrl = user?.user_metadata?.avatar_url

        try {
            // Upload Avatar if changed
            if (avatarFile) {
                const fileExt = avatarFile.name.split('.').pop()
                const fileName = `${user.id}-${Math.random()}.${fileExt}`

                const { error: uploadError } = await supabase.storage
                    .from('avatars')
                    .upload(`${fileName}`, avatarFile, { upsert: true })

                if (uploadError) throw new Error('头像上传失败: ' + uploadError.message)

                const { data: { publicUrl } } = supabase.storage
                    .from('avatars')
                    .getPublicUrl(fileName)

                avatarUrl = publicUrl
            }

            const { error: updateError } = await supabase.auth.updateUser({
                data: {
                    full_name: fullName,
                    avatar_url: avatarUrl
                }
            })

            if (updateError) throw updateError

            toast.success('个人资料已更新')
            setOpen(false)
            setAvatarFile(null)
            router.refresh()
        } catch (error: any) {
            toast.error(error.message || '更新失败')
        } finally {
            setUploading(false)
        }
    }

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                {trigger || <Button variant="outline" size="sm">编辑资料</Button>}
            </DialogTrigger>
            <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                    <DialogTitle>编辑个人资料</DialogTitle>
                    <DialogDescription>
                        在这里修改您的头像和昵称。
                    </DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                    <div className="grid grid-cols-4 items-center gap-4">
                        <Label className="text-right">头像</Label>
                        <div className="col-span-3">
                            <input
                                type="file"
                                accept="image/*"
                                onChange={(e) => e.target.files && setAvatarFile(e.target.files[0])}
                                className="text-sm text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-violet-50 file:text-violet-700 hover:file:bg-violet-100"
                            />
                        </div>
                    </div>
                    <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="name" className="text-right">
                            昵称
                        </Label>
                        <Input
                            id="name"
                            value={fullName}
                            onChange={(e) => setFullName(e.target.value)}
                            className="col-span-3"
                        />
                    </div>
                    {/* Email is read-only */}
                    <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="email" className="text-right">
                            邮箱
                        </Label>
                        <Input
                            id="email"
                            value={user?.email}
                            disabled
                            className="col-span-3 bg-gray-100 cursor-not-allowed"
                        />
                    </div>
                </div>
                <DialogFooter>
                    <Button onClick={handleUpdate} disabled={uploading}>
                        {uploading ? '保存中...' : '保存更改'}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}
