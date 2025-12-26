'use client'

import { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { Camera, Upload, Zap, BrainCircuit } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'

export default function NewMistakePage() {
    const [imageFiles, setImageFiles] = useState<File[]>([])
    const [previewUrls, setPreviewUrls] = useState<string[]>([])
    const [uploading, setUploading] = useState(false)
    const [progress, setProgress] = useState({ current: 0, total: 0 })

    const fileInputRef = useRef<HTMLInputElement>(null)
    const router = useRouter()
    const supabase = createClient()

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = Array.from(e.target.files || [])
        if (files.length > 0) {
            // Append new files instead of replacing? Or replace?
            // Usually replace is cleaner for "retaking", but append is better for "batch".
            // Let's go with replace for now to keep UI simple, or append if user wants.
            // User asked for "batch upload", likely selecting multiple from gallery.
            setImageFiles(files)

            // Cleanup old previews
            previewUrls.forEach(url => URL.revokeObjectURL(url))
            const newPreviews = files.map(f => URL.createObjectURL(f))
            setPreviewUrls(newPreviews)
        }
    }

    // 1. 批量极速保存 (Batch Instant Save)
    const handleInstantSave = async () => {
        if (imageFiles.length === 0) return
        setUploading(true)
        setProgress({ current: 0, total: imageFiles.length })

        try {
            const { data: { user } } = await supabase.auth.getUser()
            if (!user) throw new Error('未登录')

            const { data: { session } } = await supabase.auth.getSession()
            const token = session?.access_token
            if (!token) throw new Error('认证失效')

            let successCount = 0

            // Upload sequentially to prevent Rate Limiting issues with the AI Service
            for (let i = 0; i < imageFiles.length; i++) {
                const file = imageFiles[i]
                const fileExt = file.name.split('.').pop()
                const fileName = `${Date.now()}_${i}.${fileExt}`

                try {
                    // A. Upload Image
                    const { error: uploadError } = await supabase.storage
                        .from('mistakes')
                        .upload(fileName, file)

                    if (uploadError) throw uploadError

                    const imageUrl = supabase.storage.from('mistakes').getPublicUrl(fileName).data.publicUrl

                    // B. Insert DB Record (Status: analyzing immediately)
                    const { data: record, error: dbError } = await supabase
                        .from('mistakes')
                        .insert({
                            user_id: user.id,
                            original_image: imageUrl,
                            status: 'analyzing',
                            subject: 'Other'
                        })
                        .select()
                        .single()

                    if (dbError) throw dbError

                    // C. Trigger Analysis
                    // We wait for it now (serial) to prevent rate limiting, or we could fire-and-forget 
                    // if we had a queue. But user wants reliability. Serial is best.

                    const response = await fetch('/api/analyze-mistake', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'Authorization': `Bearer ${token}`
                        },
                        body: JSON.stringify({ imageUrl: imageUrl })
                    })

                    if (!response.ok) {
                        const errData = await response.json().catch(() => ({}))
                        const msg = `[${response.status}] ${errData.error || response.statusText || 'Analysis Failed'}`
                        // eslint-disable-next-line no-console
                        // console.error('Auto-Analysis failed:', msg)
                        // Mark as pending/failed so user can retry later
                        await supabase.from('mistakes').update({ status: 'pending' }).eq('id', record.id)
                        toast.error(`自动分析失败 (${i + 1}/${imageFiles.length}): ${msg}`, { duration: 3000 })
                    } else {
                        const result = await response.json()
                        await supabase.from('mistakes').update({
                            status: 'review_needed',
                            question_text: result.question_text,
                            ai_analysis: result.ai_analysis,
                            subject: result.subject || 'Other',
                            error_type: result.error_type || 'Carelessness',
                            knowledge_tags: result.knowledge_tags || [],
                            user_answer: result.user_answer
                        }).eq('id', record.id)
                    }

                    successCount++
                    setProgress(prev => ({ ...prev, current: prev.current + 1 }))

                    // Delay for rate limit (polite 1s)
                    if (i < imageFiles.length - 1) {
                        await new Promise(r => setTimeout(r, 1000))
                    }

                } catch (err: any) {
                    // console.error('Upload cycle failed:', err)
                    toast.error(`图片 ${i + 1} 处理失败: ${err.message}`)
                }
            }

            toast.success(`处理完成！成功: ${successCount} / ${imageFiles.length}`)

            // Stay on page and reset form (Fix Navigation Logic)
            setImageFiles([])
            setPreviewUrls([])
            if (fileInputRef.current) fileInputRef.current.value = ''

            // Optional: Redirect to Pending if user wants to see them? 
            // User requested "Return current logic point", implying stay here to take more.
            // We can add a toast action to "View Pending".
            toast.message('已存入队列', {
                description: '您可以继续拍摄下一题',
                action: {
                    label: '去处理',
                    onClick: () => router.push('/mistakes/pending')
                }
            })

        } catch (error: any) {
            toast.error(error.message || '部分上传失败')
        } finally {
            setUploading(false)
            setProgress({ current: 0, total: 0 })
        }
    }

    // 2. 立即分析 (仅支持单张，多张时禁用或只取第一张)
    const handleAnalyzeNow = async () => {
        if (imageFiles.length === 0) return
        if (imageFiles.length > 1) {
            toast.warning('“立即分析”仅支持单张图片，请使用“极速保存”进行批量上传。')
            return
        }

        const imageFile = imageFiles[0]
        setUploading(true)

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
                    status: 'analyzing',
                    subject: 'Other'
                })
                .select()
                .single()

            if (dbError) throw dbError

            toast.info('保存成功，准备分析...')
            router.push(`/mistakes/${newRecord.id}/edit`) // Analyze redirects to edit

        } catch (error: any) {
            toast.error(error.message)
            setUploading(false)
        }
    }

    return (
        <div className="container max-w-md mx-auto p-4 space-y-6">
            <h1 className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-600 to-purple-600 bg-300%">
                拍照录题
            </h1>

            <Card className="border-2 border-dashed border-gray-300 hover:border-blue-500 transition-colors cursor-pointer relative"
                onClick={() => fileInputRef.current?.click()}>
                <CardContent className="flex flex-col items-center justify-center min-h-[300px] p-6">
                    {previewUrls.length > 0 ? (
                        <div className="grid grid-cols-2 gap-2 w-full">
                            {previewUrls.map((url, i) => (
                                <div key={i} className="relative aspect-square">
                                    <img src={url} alt={`Preview ${i}`} className="w-full h-full object-cover rounded-lg shadow-sm" />
                                    {i === 0 && previewUrls.length > 1 && (
                                        <div className="absolute top-1 left-1 bg-black/60 text-white text-xs px-2 py-1 rounded-full">
                                            封面
                                        </div>
                                    )}
                                </div>
                            ))}
                            <div className="absolute bottom-4 right-4 bg-primary text-primary-foreground px-3 py-1 rounded-full text-sm font-bold shadow-lg">
                                已选 {previewUrls.length} 张
                            </div>
                        </div>
                    ) : (
                        <div className="text-center space-y-4 text-gray-400">
                            <Camera className="w-16 h-16 mx-auto" />
                            <p>点击拍摄或批量上传</p>
                            <p className="text-xs text-muted-foreground">(支持多选)</p>
                        </div>
                    )}
                    <input
                        type="file"
                        ref={fileInputRef}
                        className="hidden"
                        accept="image/*"
                        multiple // Allow multiple files
                        // capture="environment" // Removing capture to allow gallery multi-select on mobile. Mobile browsers usually show "Camera" option anyway.
                        onChange={handleFileChange}
                    />
                </CardContent>
            </Card>

            {imageFiles.length > 0 && (
                <div className="grid grid-cols-2 gap-4">
                    <Button variant="outline" size="lg" className="h-16 flex flex-col gap-1" onClick={handleInstantSave} disabled={uploading}>
                        {uploading && progress.total > 0 ? (
                            <span className="text-xs">上传中 {progress.current}/{progress.total}</span>
                        ) : (
                            <>
                                <Zap className="w-5 h-5 text-yellow-500" />
                                <span className="text-xs">极速保存 ({imageFiles.length})</span>
                            </>
                        )}
                    </Button>

                    <Button
                        size="lg"
                        className="h-16 flex flex-col gap-1 bg-gradient-to-r from-blue-600 to-purple-600"
                        onClick={handleAnalyzeNow}
                        disabled={uploading || imageFiles.length > 1} // Disable analyze for batch
                    >
                        <BrainCircuit className="w-5 h-5" />
                        <span className="text-xs">
                            {imageFiles.length > 1 ? '仅单张可分析' : '立即分析 (AI)'}
                        </span>
                    </Button>
                </div>
            )}
        </div>
    )
}
