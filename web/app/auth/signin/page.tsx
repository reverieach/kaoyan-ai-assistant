'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

export default function LoginPage() {
    const [email, setEmail] = useState('')
    const [password, setPassword] = useState('')
    const [loading, setLoading] = useState(false)
    const router = useRouter()
    const supabase = createClient()

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault()

        if (!email || !password) {
            alert('请填写邮箱和密码')
            return
        }

        setLoading(true)

        try {
            const { error } = await supabase.auth.signInWithPassword({
                email,
                password,
            })

            if (error) {
                alert(error.message)
                setLoading(false)
            } else {
                router.refresh()
                router.push('/dashboard')
                // 不调用 setLoading(false)，让按钮保持 loading 直到页面跳转
            }
        } catch (err: any) {
            alert(err.message || '登录失败')
            setLoading(false)
        }
    }

    return (
        <div className="flex items-center justify-center min-h-screen bg-gray-100 p-4">
            <Card className="w-full max-w-[350px]">
                <CardHeader>
                    <CardTitle>登录到 11408 助手</CardTitle>
                    <CardDescription>使用你的账号开始复习</CardDescription>
                </CardHeader>
                <CardContent>
                    <form onSubmit={handleLogin}>
                        <div className="grid w-full items-center gap-4">
                            <div className="flex flex-col space-y-1.5">
                                <Label htmlFor="email">邮箱</Label>
                                <Input id="email" placeholder="输入邮箱" value={email} onChange={(e) => setEmail(e.target.value)} />
                            </div>
                            <div className="flex flex-col space-y-1.5">
                                <Label htmlFor="password">密码</Label>
                                <Input id="password" type="password" placeholder="输入密码" value={password} onChange={(e) => setPassword(e.target.value)} />
                            </div>
                        </div>
                        {/* 暂时没有 Toaster，用 alert 代替 */}
                    </form>
                </CardContent>
                <CardFooter className="flex justify-between flex-col gap-2">
                    <Button className="w-full" onClick={handleLogin} disabled={loading}>
                        {loading ? '登录中...' : '登录'}
                    </Button>
                    <Link href="/auth/signup?v=2" prefetch={false} className="text-sm text-blue-500 hover:underline">
                        没有账号？去注册
                    </Link>
                </CardFooter>
            </Card>
        </div>
    )
}
