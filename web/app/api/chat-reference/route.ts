import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { pipeline, env } from '@xenova/transformers'
import * as dns from 'dns'

// FIX 1: Force IPv4 for DeepSeek API
try { dns.setDefaultResultOrder('ipv4first') } catch (e) { }

// FIX 2: Use domestic mirror for Xenova (embedding model download)
env.remoteHost = 'https://hf-mirror.com/'
env.allowLocalModels = false

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
        console.log('[1/5] Checking Embedding Pipeline...')
        if (!extractor) {
            console.log('[1.1/5] Initializing Xenova Pipeline (this may download model)...')
            // Use quantized model for speed
            extractor = await pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2');
            console.log('[1.2/5] Pipeline Ready')
        }

        console.log('[2/5] Extracting embedding...')
        const output = await extractor(lastMessage, { pooling: 'mean', normalize: true });
        console.log('[2/5] Embedding done')
        const embedding = Array.from(output.data); // Convert to JS array

        // 2. Search Chunks (RPC call)
        console.log('[3/5] Querying Supabase RPC...')
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
        console.log(`[3.1/5] Found ${chunks?.length || 0} chunks`)

        // ... (Context construction omitted for brevity, keeping existing logic) ...
        // 3. Construct Context
        let contextText = ""
        if (chunks && chunks.length > 0) {
            contextText = chunks.map((c: any) => {
                const content = c.chunk_content || c.content;
                const meta = c.chunk_metadata || c.metadata;
                const source = meta?.chapter ? `[章节: ${meta.chapter}]` : '';
                return `--- Fragment ${source} ---\n${content}\n`
            }).join('\n')
        }

        // 4. Call LLM
        const systemPrompt = `
        你是一名考研助教。请基于以下提供的【知识库片段】回答用户的问题。
        
        【知识库片段】:
        ${contextText}
        `

        const apiMessages = [
            { role: 'system', content: systemPrompt },
            ...messages // Pass user history
        ]

        console.log(`[4/5] Calling DeepSeek API (${LLM_BASE_URL})...`)

        // Create custom agent to force IPv4 (Node 18+ fetch workaround)
        // const { Agent } = require('https');
        // const agent = new Agent({ family: 4 });

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
            }),
            // agent: agent // Not supported in standard fetch stats, relying on DNS hack
        })

        console.log(`[4.1/5] API Response Status: ${response.status}`)

        if (!response.ok) {
            const err = await response.text()
            throw new Error(`LLM API Error: ${err}`)
        }

        // 5. Stream Response
        console.log('[5/5] Streaming response...')
        return new NextResponse(response.body, {
            headers: { 'Content-Type': 'text/event-stream' }
        })

    } catch (error: any) {
        console.error('Chat error:', error)
        return NextResponse.json({ error: error.message }, { status: 500 })
    }
}
