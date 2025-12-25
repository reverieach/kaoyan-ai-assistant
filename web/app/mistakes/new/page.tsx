'use client'

import { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { Camera, Upload, Zap, BrainCircuit } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'

export default function NewMistakePage() {
    const [imageFile, setImageFile] = useState<File | null>(null)
    const [previewUrl, setPreviewUrl] = useState<string | null>(null)
    const [uploading, setUploading] = useState(false)

    const fileInputRef = useRef<HTMLInputElement>(null)
    const router = useRouter()
    const supabase = createClient()

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (file) {
            setImageFile(file)
            setPreviewUrl(URL.createObjectURL(file))
        }
    }

    // 1. 极速保存 (Instant Save) -> 存入 Storage + DB (Status: Pending)
    const handleInstantSave = async () => {
        if (!imageFile) return
        setUploading(true)

        try {
            // A. Upload Image
            const fileExt = imageFile.name.split('.').pop()
            const fileName = `${Date.now()}.${fileExt}`
            const { data: uploadData, error: uploadError } = await supabase.storage
                .from('mistakes')
                .upload(fileName, imageFile)

            if (uploadError) throw uploadError

            const imageUrl = supabase.storage.from('mistakes').getPublicUrl(fileName).data.publicUrl

            // B. Insert DB Record
            const { data: { user } } = await supabase.auth.getUser()
            if (!user) throw new Error('未登录')

            const { error: dbError } = await supabase
                .from('mistakes')
                .insert({
                    user_id: user.id,
                    original_image: imageUrl,
                    status: 'pending',
                    subject: 'Other' // Default
                })

            if (dbError) throw dbError

            toast.success('已存入待处理队列！')
            router.push('/dashboard')

        } catch (error: any) {
            toast.error(error.message || '上传失败')
        } finally {
            setUploading(false)
        }
    }

    // 2. 立即分析 (Analyze Now) -> 跳转到编辑页 (带上临时图片或先上传)
    // 这里我们采用先上传拿到 ID，然后跳转到详细编辑页触发分析的策略
    const handleAnalyzeNow = async () => {
        if (!imageFile) return
        setUploading(true)

        // (逻辑同上，但在跳转时带上 ID，让编辑页去调 API)
        // 简化起见，当前版本先复用上面的上传逻辑，区别是跳转目的地

        try {
            const fileExt = imageFile.name.split('.').pop()
            const fileName = `${Date.now()}.${fileExt}`
            const { error: uploadError } = await supabase.storage
                .from('mistakes')
                .upload(fileName, imageFile)

            if (uploadError) throw uploadError

            const imageUrl = supabase.storage.from('mistakes').getPublicUrl(fileName).data.publicUrl

            const { data: { user } } = await supabase.auth.getUser()
            if (!user) throw new Error('未登录')

            const { data: newRecord, error: dbError } = await supabase
                .from('mistakes')
                .insert({
                    user_id: user.id,
                    original_image: imageUrl,
                    status: 'analyzing', // 标记为正在分析
                    subject: 'Other'
                })
                .select()
                .single()

            if (dbError) throw dbError

            // 跳转到编辑/分析页 (后续实现 /mistakes/[id]/edit)
            toast.info('保存成功，准备分析...')
            router.push(`/mistakes/${newRecord.id}/edit`)

        } catch (error: any) {
            toast.error(error.message)
        } finally {
            setUploading(false)
        }
    }

    return (
        <div className="container max-w-md mx-auto p-4 space-y-6">
            <h1 className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-600 to-purple-600 bg-300%">
                拍照录题
            </h1>

            <Card className="border-2 border-dashed border-gray-300 hover:border-blue-500 transition-colors cursor-pointer"
                onClick={() => fileInputRef.current?.click()}>
                <CardContent className="flex flex-col items-center justify-center min-h-[300px] p-6">
                    {previewUrl ? (
                        <img src={previewUrl} alt="Preview" className="w-full h-auto rounded-lg shadow-md" />
                    ) : (
                        <div className="text-center space-y-4 text-gray-400">
                            <Camera className="w-16 h-16 mx-auto" />
                            <p>点击拍摄或上传错题</p>
                        </div>
                    )}
                    <input
                        type="file"
                        ref={fileInputRef}
                        className="hidden"
                        accept="image/*"
                        capture="environment" // 调用后置摄像头
                        onChange={handleFileChange}
                    />
                </CardContent>
            </Card>

            {imageFile && (
                <div className="grid grid-cols-2 gap-4">
                    <Button variant="outline" size="lg" className="h-16 flex flex-col gap-1" onClick={handleInstantSave} disabled={uploading}>
                        <Zap className="w-5 h-5 text-yellow-500" />
                        <span className="text-xs">极速保存 (稍后理)</span>
                    </Button>

                    <Button size="lg" className="h-16 flex flex-col gap-1 bg-gradient-to-r from-blue-600 to-purple-600" onClick={handleAnalyzeNow} disabled={uploading}>
                        <BrainCircuit className="w-5 h-5" />
                        <span className="text-xs">立即分析 (AI)</span>
                    </Button>
                </div>
            )}
        </div>
    )
}
