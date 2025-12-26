import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { writeFile, mkdir, readFile, unlink, rm } from 'fs/promises'
import { join } from 'path'
import { exec } from 'child_process'
import { promisify } from 'util'
import { existsSync } from 'fs'

const execPromise = promisify(exec)

export async function POST(request: NextRequest) {
    console.log('Upload request received')
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    try {
        const formData = await request.formData()
        const file = formData.get('file') as File

        if (!file) {
            return NextResponse.json({ error: 'No file uploaded' }, { status: 400 })
        }

        // 1. Save PDF/Zip/MD to temp dir
        const bytes = await file.arrayBuffer()
        const buffer = Buffer.from(bytes)

        // Ensure temp dir exists
        const tempDir = join(process.cwd(), '.tmp', `upload_${Date.now()}`)
        await mkdir(tempDir, { recursive: true })

        // FIX: Use safe ASCII filename to avoid encoding issues with Python subprocess on Windows
        // Original filename is kept in file.name for DB title
        const originalExt = file.name.split('.').pop() || 'tmp'
        const safeFilename = `source_file.${originalExt}`
        const safePath = join(tempDir, safeFilename)

        await writeFile(safePath, buffer)
        console.log(`Saved File to ${safePath} (Original: ${file.name})`)

        // 2. Call Python script with Streaming Response
        const scriptPath = join(process.cwd(), '..', 'scripts', 'pdf_converter.py')

        // Spawn Python process
        // Spawn Python process
        const pythonCommand = process.env.PYTHON_PATH || 'python'
        const { spawn } = require('child_process')
        const pythonProcess = spawn(pythonCommand, [scriptPath, safePath, tempDir], {
            env: {
                ...process.env,
                API_KEY: process.env.KB_LLM_API_KEY || process.env.LLM_API_KEY,
                BASE_URL: process.env.KB_LLM_BASE_URL || 'https://api.deepseek.com',
                MODEL_NAME: process.env.KB_LLM_MODEL_NAME || 'deepseek-chat',
                PYTHONIOENCODING: 'utf-8', // Force UTF-8 for Windows
                PYTHONUNBUFFERED: '1' // Prevent buffering
            }
        })

        const encoder = new TextEncoder()

        const stream = new ReadableStream({
            async start(controller) {
                let accumulatedOutput = ''

                pythonProcess.stdout.on('data', (data: any) => {
                    const text = data.toString()
                    accumulatedOutput += text

                    // Check for progress markers (Real-time feedback)
                    const lines = text.split('\n')
                    for (const line of lines) {
                        if (line.startsWith('PROGRESS:')) {
                            try {
                                const progressJson = line.replace('PROGRESS:', '').trim()
                                const chunk = encoder.encode(`data: ${progressJson}\n\n`)
                                controller.enqueue(chunk)
                            } catch (e) { }
                        }
                    }
                })

                pythonProcess.stderr.on('data', (data: any) => {
                    console.error('Python Stderr:', data.toString())
                })

                pythonProcess.on('close', async (code: number) => {
                    const cleanup = async () => {
                        try { await rm(tempDir, { recursive: true, force: true }) } catch (e) { }
                    }

                    if (code !== 0) {
                        await cleanup()
                        // Try to parse error from output if possible
                        try {
                            const cleanOutput = accumulatedOutput.split('\n').filter(l => !l.startsWith('PROGRESS:') && l.trim().length > 0).join('')
                            const res = JSON.parse(cleanOutput)
                            if (res.error) {
                                controller.error(new Error(`Script Error: ${res.error}`))
                                return
                            }
                        } catch (e) { }

                        controller.error(new Error(`Python process exited with code ${code}`))
                        return
                    }

                    try {
                        // Filter out PROGRESS lines to get the clean JSON
                        const cleanJson = accumulatedOutput.split('\n')
                            .filter(l => !l.startsWith('PROGRESS:') && l.trim().length > 0)
                            .join('')

                        const result = JSON.parse(cleanJson)
                        if (result.error) {
                            controller.error(new Error(result.error))
                            return
                        }

                        // ... (Existing DB logic moved here) ...
                        // Since we are streaming, we can't easily return a final JSON in the stream 
                        // unless we define a protocol. 
                        // Let's create the completion event.

                        // --- DB Logic Start ---
                        // (We need to re-implement the DB saving here or call a helper)
                        let content = result.content as string
                        const images = result.images as { absolute_path: string, relative_path: string }[]

                        // Upload Images
                        controller.enqueue(encoder.encode(`data: {"message": "正在上传 ${images.length} 张图片到云端...", "progress": 90}\n\n`))

                        for (const img of images) {
                            try {
                                const imgBuffer = await readFile(img.absolute_path)
                                const fileExt = img.absolute_path.split('.').pop()
                                const fileName = `ref_${Date.now()}_${Math.random().toString(36).slice(2)}.${fileExt}`
                                const { error: uploadError } = await supabase.storage.from('reference_images').upload(fileName, imgBuffer, { contentType: `image/${fileExt === 'png' ? 'png' : 'jpeg'}`, upsert: true })
                                if (!uploadError) {
                                    const { data: { publicUrl } } = supabase.storage.from('reference_images').getPublicUrl(fileName)
                                    content = content.replaceAll(`(${img.relative_path})`, `(${publicUrl})`)
                                }
                            } catch (err) { }
                        }

                        // Save to DB
                        controller.enqueue(encoder.encode(`data: {"message": "正在保存到知识库...", "progress": 99}\n\n`))
                        const { error: dbError } = await supabase.from('references_kb').insert({
                            user_id: user.id,
                            title: file.name.replace('.pdf', ''),
                            content: content,
                            summary: 'Processed by AI'
                        })

                        if (dbError) throw new Error(dbError.message)

                        // [NEW] Save Chunks
                        const chunks = result.chunks as any[]
                        if (chunks && chunks.length > 0) {
                            console.log(`Upload: Saving ${chunks.length} chunks...`)
                            controller.enqueue(encoder.encode(`data: {"message": "正在保存 ${chunks.length} 个知识切片...", "progress": 99}\n\n`))

                            const referenceId = (await supabase.from('references_kb').select('id').eq('title', file.name.replace('.pdf', '')).order('created_at', { ascending: false }).limit(1).single()).data?.id

                            if (referenceId) {
                                // Batch insert (Supabase limit is usually fine for a few hundred chunks, need batching for large books)
                                // Let's batch by 100
                                const BATCH_SIZE = 50
                                for (let i = 0; i < chunks.length; i += BATCH_SIZE) {
                                    const batch = chunks.slice(i, i + BATCH_SIZE).map(c => ({
                                        doc_id: referenceId,
                                        content: c.content,
                                        metadata: c.metadata,
                                        embedding: c.embedding || null // Vector column accepts array or string/null
                                    }))

                                    const { error: chunkError } = await supabase.from('reference_chunks').insert(batch)
                                    if (chunkError) console.error('Chunk insert error:', chunkError)
                                }
                            }
                        }

                        // Cleanup
                        try { await import('fs/promises').then(fs => fs.rm(tempDir, { recursive: true, force: true })) } catch (e) { }

                        // Final Success Message
                        controller.enqueue(encoder.encode(`data: {"progress": 100, "message": "Done", "success": true}\n\n`))
                        controller.close()

                    } catch (e: any) {
                        controller.error(e)
                    }
                })
            }
        })

        return new NextResponse(stream, {
            headers: {
                'Content-Type': 'text/event-stream',
                'Cache-Control': 'no-cache',
                'Connection': 'keep-alive',
            },
        })

    } catch (error: any) {
        console.error('Upload handler error:', error)
        return NextResponse.json({ error: error.message }, { status: 500 })
    }
}
