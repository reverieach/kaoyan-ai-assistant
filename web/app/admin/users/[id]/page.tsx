'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ArrowLeft, Key, Trash2 } from 'lucide-react'
import Link from 'next/link'

interface Props {
    params: Promise<{ id: string }>
}

export default function AdminUserDetailPage({ params }: Props) {
    const [newPassword, setNewPassword] = useState('')
    const [loading, setLoading] = useState(false)
    const [message, setMessage] = useState('')
    const router = useRouter()

    const handleResetPassword = async () => {
        const { id } = await params
        if (!newPassword || newPassword.length < 6) {
            setMessage('密码至少6位')
            return
        }

        setLoading(true)
        setMessage('')

        try {
            const res = await fetch('/api/admin/reset-password', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ userId: id, newPassword })
            })

            const data = await res.json()

            if (res.ok) {
                setMessage('✅ 密码重置成功')
                setNewPassword('')
            } else {
                setMessage(`❌ ${data.error || '重置失败'}`)
            }
        } catch (error) {
            setMessage('❌ 网络错误')
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className="container max-w-2xl mx-auto p-4 sm:p-6 space-y-6">
            <header className="flex items-center gap-4 border-b pb-4">
                <Link href="/admin/users">
                    <Button variant="ghost" size="icon">
                        <ArrowLeft className="w-5 h-5" />
                    </Button>
                </Link>
                <div>
                    <h1 className="text-xl font-bold">用户详情</h1>
                </div>
            </header>

            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <Key className="w-5 h-5" />
                        重置密码
                    </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="space-y-2">
                        <Label htmlFor="password">新密码</Label>
                        <Input
                            id="password"
                            type="password"
                            placeholder="输入新密码（至少6位）"
                            value={newPassword}
                            onChange={(e) => setNewPassword(e.target.value)}
                        />
                    </div>

                    {message && (
                        <p className={`text-sm ${message.startsWith('✅') ? 'text-green-600' : 'text-red-600'}`}>
                            {message}
                        </p>
                    )}

                    <Button onClick={handleResetPassword} disabled={loading} className="w-full">
                        {loading ? '处理中...' : '重置密码'}
                    </Button>
                </CardContent>
            </Card>

            <Card className="border-red-200 bg-red-50">
                <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-red-600">
                        <Trash2 className="w-5 h-5" />
                        危险操作
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <p className="text-sm text-red-700 mb-4">
                        删除用户将同时删除其所有错题和资料数据，此操作不可逆！
                    </p>
                    <Button variant="destructive" disabled>
                        删除用户（暂未开放）
                    </Button>
                </CardContent>
            </Card>
        </div>
    )
}
