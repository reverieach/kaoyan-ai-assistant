
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { pipeline } from '@xenova/transformers'

// Initialize pipeline once (global scope in serverless/edge might be tricky, but works for Node runtime)
// For singleton in Next.js dev:
let extractor: any = null;

// LLM Config
const LLM_BASE_URL = process.env.KB_LLM_BASE_URL || process.env.LLM_BASE_URL || 'https://api.deepseek.com';
const LLM_API_KEY = process.env.KB_LLM_API_KEY || process.env.LLM_API_KEY!;
const LLM_MODEL_NAME = process.env.KB_LLM_MODEL_NAME || 'deepseek-chat';

export async function POST(request: NextRequest) {
    try {
        const { docId, messages } = await request.json()
        const lastMessage = messages[messages.length - 1].content

        if (!docId || !lastMessage) {
            return NextResponse.json({ error: 'Missing parameters' }, { status: 400 })
        }

        const supabase = await createClient()

        // 1. Generate Query Embedding
        if (!extractor) {
            // Use quantized model for speed
            extractor = await pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2');
        }

        const output = await extractor(lastMessage, { pooling: 'mean', normalize: true });
        const embedding = Array.from(output.data); // Convert to JS array

        // 2. Search Chunks (RPC call)
        const { data: chunks, error: searchError } = await supabase.rpc('match_reference_chunks', {
            query_embedding: embedding,
            match_threshold: 0.3, // Similarity threshold
            match_count: 5,
            filter_doc_id: docId
        })

        if (searchError) {
            console.error('Vector search error:', searchError)
            return NextResponse.json({ error: `Search failed: ${searchError.message}` }, { status: 500 })
        }

        console.log(`RAG Search: Found ${chunks?.length || 0} chunks for doc ${docId}`)

        // 3. Construct Context
        let contextText = ""

        if (chunks && chunks.length > 0) {
            contextText = chunks.map((c: any) => {
                // Compatible with both old (ambiguous) and new (chunk_*) fields just in case
                const content = c.chunk_content || c.content;
                const meta = c.chunk_metadata || c.metadata;

                const source = meta?.chapter ? `[章节: ${meta.chapter}]` : '';
                return `--- Fragment ${source} ---\n${content}\n`
            }).join('\n')
        } else {
            console.warn(`RAG Warning: No chunks found for query.`)
            contextText = "未找到相关文档片段，请尝试回答但不保证准确性。"
        }

        // 4. Call LLM
        const systemPrompt = `
        你是一名考研助教。请基于以下提供的【知识库片段】回答用户的问题。
        
        原则：
        1. **优先使用片段内容**作为依据。
        2. 如果片段中包含答案，请详细解释，并引用片段中的章节名称 (如 "根据章节...").
        3. 如果片段完全不相关，请诚实告知"资料库中未找到相关内容"，然后尝试用你的通用知识补充(需注明是通用知识)。
        4. 使用 Markdown 格式渲染公式 ($\LaTeX$)。

        【知识库片段】:
        ${contextText}
        `

        const apiMessages = [
            { role: 'system', content: systemPrompt },
            ...messages // Pass user history
        ]

        const response = await fetch(`${LLM_BASE_URL}/chat/completions`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${LLM_API_KEY}`
            },
            body: JSON.stringify({
                model: LLM_MODEL_NAME,
                messages: apiMessages,
                stream: true,
                temperature: 0.3
            })
        })

        if (!response.ok) {
            const err = await response.text()
            throw new Error(`LLM API Error: ${err}`)
        }

        // 5. Stream Response
        return new NextResponse(response.body, {
            headers: { 'Content-Type': 'text/event-stream' }
        })

    } catch (error: any) {
        console.error('Chat error:', error)
        return NextResponse.json({ error: error.message }, { status: 500 })
    }
}
