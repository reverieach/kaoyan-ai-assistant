'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

export default function SignupPage() {
    const [email, setEmail] = useState('')
    const [password, setPassword] = useState('')
    const [loading, setLoading] = useState(false)
    const [envError, setEnvError] = useState<string | null>(null)
    const router = useRouter()

    // Safe Supabase Initialization
    let supabase: any = null
    try {
        supabase = createClient()
    } catch (e: any) {
        console.error("Supabase Client Init Error:", e)
        // We defer setting state to useEffect to avoid hydration mismatch if it throws differently on server/client
    }

    useEffect(() => {
        try {
            createClient()
        } catch (e: any) {
            setEnvError(e.message || "Environment Variables Missing")
        }
    }, [])

    const handleRegister = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!supabase) {
            alert("系统初始化失败，请检查服务器环境变量")
            return
        }
        setLoading(true)

        const { error } = await supabase.auth.signUp({
            email,
            password,
        })

        if (error) {
            alert(error.message)
        } else {
            alert('注册成功！请检查邮箱验证或直接登录')
            router.push('/auth/login')
        }
        setLoading(false)
    }

    if (envError) {
        return (
            <div className="flex items-center justify-center min-h-screen bg-red-50 p-4">
                <div className="bg-white p-6 rounded shadow text-red-600">
                    <h2 className="font-bold text-lg mb-2">系统配置错误</h2>
                    <p>无法连接数据库，原因：{envError}</p>
                    <p className="text-sm text-gray-500 mt-2">请确保服务器已配置 NEXT_PUBLIC_SUPABASE_URL</p>
                </div>
            </div>
        )
    }

    return (
        <div className="flex items-center justify-center min-h-screen bg-gray-100">
            <Card className="w-[350px]">
                <CardHeader>
                    <CardTitle>注册新账号 (Signup)</CardTitle>
                    <CardDescription>创建你的 11408 学习档案</CardDescription>
                </CardHeader>
                <CardContent>
                    <form onSubmit={handleRegister}>
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
                    </form>
                </CardContent>
                <CardFooter className="flex justify-between flex-col gap-2">
                    <Button className="w-full" onClick={handleRegister} disabled={loading}>
                        {loading ? '注册中...' : '注册'}
                    </Button>
                    <Link href="/auth/login" className="text-sm text-blue-500 hover:underline">
                        已有账号？去登录
                    </Link>
                </CardFooter>
            </Card>
        </div>
    )
}
