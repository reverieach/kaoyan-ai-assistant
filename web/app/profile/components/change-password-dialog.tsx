'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Key } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'

export function ChangePasswordDialog() {
    const [open, setOpen] = useState(false)
    const [currentPassword, setCurrentPassword] = useState('')
    const [newPassword, setNewPassword] = useState('')
    const [confirmPassword, setConfirmPassword] = useState('')
    const [loading, setLoading] = useState(false)

    const handleChangePassword = async () => {
        // 验证输入
        if (!currentPassword) {
            toast.error('请输入当前密码')
            return
        }

        if (newPassword.length < 6) {
            toast.error('新密码至少需要6位')
            return
        }

        if (newPassword !== confirmPassword) {
            toast.error('两次输入的密码不一致')
            return
        }

        setLoading(true)

        try {
            const supabase = createClient()

            // 1. 获取当前用户
            const { data: { user }, error: userError } = await supabase.auth.getUser()
            if (userError || !user) {
                toast.error('登录状态已过期，请重新登录')
                window.location.href = '/auth/signin'
                return
            }

            // 2. 验证当前密码（通过重新登录验证）
            const { error: verifyError } = await supabase.auth.signInWithPassword({
                email: user.email!,
                password: currentPassword
            })

            if (verifyError) {
                toast.error('当前密码不正确')
                setLoading(false)
                return
            }

            // 3. 更新密码
            const { error: updateError } = await supabase.auth.updateUser({
                password: newPassword
            })

            if (updateError) {
                toast.error(updateError.message)
                setLoading(false)
                return
            }

            // 4. 成功后登出并跳转
            toast.success('密码修改成功，请重新登录')

            await supabase.auth.signOut()

            // 延迟跳转让 toast 显示
            setTimeout(() => {
                window.location.href = '/auth/signin'
            }, 1500)

        } catch (error: any) {
            toast.error(error.message || '修改失败')
            setLoading(false)
        }
    }

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button variant="outline" size="sm" className="gap-2">
                    <Key className="w-4 h-4" />
                    修改密码
                </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle>修改密码</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 py-4">
                    <div className="space-y-2">
                        <Label htmlFor="currentPassword">当前密码</Label>
                        <Input
                            id="currentPassword"
                            type="password"
                            placeholder="输入当前密码"
                            value={currentPassword}
                            onChange={(e) => setCurrentPassword(e.target.value)}
                        />
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="newPassword">新密码</Label>
                        <Input
                            id="newPassword"
                            type="password"
                            placeholder="输入新密码（至少6位）"
                            value={newPassword}
                            onChange={(e) => setNewPassword(e.target.value)}
                        />
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="confirmPassword">确认新密码</Label>
                        <Input
                            id="confirmPassword"
                            type="password"
                            placeholder="再次输入新密码"
                            value={confirmPassword}
                            onChange={(e) => setConfirmPassword(e.target.value)}
                        />
                    </div>
                </div>
                <div className="flex justify-end gap-2">
                    <Button variant="outline" onClick={() => setOpen(false)}>
                        取消
                    </Button>
                    <Button onClick={handleChangePassword} disabled={loading}>
                        {loading ? '处理中...' : '确认修改'}
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    )
}
