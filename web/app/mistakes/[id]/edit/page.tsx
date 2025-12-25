'use client'

import { useEffect, useState, use } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Card, CardContent } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { toast } from 'sonner'
import 'katex/dist/katex.min.css'
import Latex from 'react-latex-next'

export default function EditMistakePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)

  const [record, setRecord] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [analyzing, setAnalyzing] = useState(false)

  // Form States
  const [questionText, setQuestionText] = useState('')
  const [subject, setSubject] = useState('Other')
  const [errorType, setErrorType] = useState('Other')
  const [userAnswer, setUserAnswer] = useState('')
  const [correctAnswer, setCorrectAnswer] = useState('')
  const [aiAnalysis, setAiAnalysis] = useState('')

  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    fetchMistake()
  }, [id])

  const fetchMistake = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const { data, error } = await supabase
      .from('mistakes')
      .select('*')
      .eq('id', id)
      .eq('user_id', user.id)
      .single()

    if (error || !data) {
      toast.error('找不到记录')
      router.push('/dashboard')
      return
    }

    setRecord(data)

    // Fill form if data exists
    if (data.question_text) setQuestionText(data.question_text)
    if (data.subject) setSubject(data.subject)
    if (data.error_type) setErrorType(data.error_type)
    if (data.user_answer) setUserAnswer(data.user_answer)
    if (data.correct_answer) setCorrectAnswer(data.correct_answer)
    if (data.ai_analysis) setAiAnalysis(data.ai_analysis)

    // If status is 'analyzing' and question_text is empty, trigger AI automatically
    if (data.status === 'analyzing' && !data.question_text) {
      triggerAnalysis(data.original_image)
    }

    setLoading(false)
  }

  const triggerAnalysis = async (imageUrl: string) => {
    setAnalyzing(true)
    toast.info('正在请求 AI 分析...')
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const res = await fetch('/api/analyze-mistake', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.access_token}`
        },
        body: JSON.stringify({ imageUrl })
      })
      const result = await res.json()

      if (result.error) throw new Error(result.error)

      // Auto-fill form
      if (result.question_text) setQuestionText(result.question_text)
      if (result.subject) setSubject(result.subject)
      if (result.error_type) setErrorType(result.error_type)
      if (result.ai_analysis) setAiAnalysis(result.ai_analysis)

      toast.success('AI 分析完成，请核对')
    } catch (e: any) {
      toast.error('AI 分析失败: ' + e.message)
    } finally {
      setAnalyzing(false)
    }
  }

  const handleSave = async () => {
    const { error } = await supabase
      .from('mistakes')
      .update({
        question_text: questionText,
        subject,
        error_type: errorType,
        user_answer: userAnswer,
        correct_answer: correctAnswer,
        ai_analysis: aiAnalysis,
        status: 'active', // Mark as ready for review
        updated_at: new Date().toISOString()
      })
      .eq('id', id)

    if (error) {
      toast.error(error.message)
    } else {
      toast.success('已入库！进入复习队列')
      router.push('/dashboard')
    }
  }

  if (loading) return <div>加载中...</div>

  return (
    <div className="container mx-auto p-4 flex gap-6 h-[calc(100vh-100px)]">
      {/* Left: Image & Preview */}
      <div className="w-1/2 flex flex-col gap-4 overflow-y-auto">
        <Card>
          <CardContent className="p-4">
            <img src={record?.original_image} className="w-full rounded-md" alt="Source" />
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4 bg-slate-50 min-h-[200px]">
            <Label className="mb-2 block text-gray-500">LaTeX 预览</Label>
            <div className="prose prose-sm">
              <Latex>{questionText || '(空)'}</Latex>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Right: Form */}
      <div className="w-1/2 flex flex-col gap-4 overflow-y-auto pr-2 pb-20">
        <div className="flex justify-between items-center">
          <h1 className="text-xl font-bold">人工核对 (HITL)</h1>
          <Button onClick={() => triggerAnalysis(record.original_image)} disabled={analyzing} variant="outline" size="sm">
            {analyzing ? '分析中...' : '重试 AI'}
          </Button>
        </div>

        <div className="space-y-2">
          <Label>题目文本 (支持 LaTeX)</Label>
          <Textarea
            value={questionText}
            onChange={e => setQuestionText(e.target.value)}
            className="font-mono min-h-[150px]"
            placeholder="在此输入 OCR 结果或题目详情"
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>科目</Label>
            <Select value={subject} onValueChange={setSubject}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="Math">数学</SelectItem>
                <SelectItem value="DataStructures">数据结构</SelectItem>
                <SelectItem value="CompOrg">计组</SelectItem>
                <SelectItem value="OS">操作系统</SelectItem>
                <SelectItem value="Network">计算机网络</SelectItem>
                <SelectItem value="Other">其他</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>错误类型</Label>
            <Select value={errorType} onValueChange={setErrorType}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="Concept">概念混淆</SelectItem>
                <SelectItem value="Calculation">计算失误</SelectItem>
                <SelectItem value="Logic">思路卡壳</SelectItem>
                <SelectItem value="Carelessness">审题不清</SelectItem>
                <SelectItem value="Other">其他</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="space-y-2">
          <Label>AI 分析</Label>
          <Textarea
            value={aiAnalysis}
            onChange={e => setAiAnalysis(e.target.value)}
            rows={5}
            placeholder="AI 的分析结果将显示在这里"
          />
        </div>

        <Button onClick={handleSave} className="w-full mt-4 bg-green-600 hover:bg-green-700">
          确认入库
        </Button>
      </div>
    </div>
  )
}
