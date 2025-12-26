import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// 初始化服务端 Supabase Client，用于鉴权
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseAnonKey);

// LLM 配置
// LLM 配置 (错题分析专用 - 需支持 Vision, 如 BabelTower/Qwen-VL)
const LLM_BASE_URL = process.env.LLM_BASE_URL || 'https://api.deepseek.com';
const LLM_API_KEY = process.env.LLM_API_KEY!; // Must be set (BBT Key)
const LLM_MODEL_NAME = process.env.LLM_MODEL_NAME || 'deepseek-chat';

export async function POST(req: NextRequest) {
    try {
        // 1. Auth Check
        const authHeader = req.headers.get('Authorization');
        if (!authHeader) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        const { data: { user }, error: authError } = await supabase.auth.getUser(authHeader.replace('Bearer ', ''));
        if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        // 2. Parse Body (Image URL)
        const { imageUrl } = await req.json();
        if (!imageUrl) return NextResponse.json({ error: 'Missing imageUrl' }, { status: 400 });

        if (!LLM_API_KEY) {
            console.warn('⚠️ No LLM_API_KEY found, returning Mock data.');
            await new Promise(resolve => setTimeout(resolve, 1500));
            return NextResponse.json({
                question_text: "Mock Data: 这是一个测试题目...",
                ai_analysis: "Mock Analysis: 未配置 API Key，仅显示测试数据。",
                subject: "Other",
                error_type: "Carelessness",
                knowledge_tags: ["Mock", "Test"]
            });
        }

        // 3. Download Image & Convert to Base64 (Proxy)
        // Solves "Download timed out" and local network access issues
        console.log(`Downloading image for analysis: ${imageUrl}`);
        const imageRes = await fetch(imageUrl);
        if (!imageRes.ok) {
            throw new Error(`Failed to download image from Supabase: ${imageRes.statusText}`);
        }
        const imageArrayBuffer = await imageRes.arrayBuffer();
        const base64Image = Buffer.from(imageArrayBuffer).toString('base64');
        const mimeType = imageRes.headers.get('content-type') || 'image/jpeg';
        const dataUri = `data:${mimeType};base64,${base64Image}`;

        // 4. Construct System Prompt
        const systemPrompt = `
        你是一位计算机考研 (408) 的专家导师。
        任务：分析传入的题目图片。**图片中通常包含题目文本和用户的手写解答（可能是错误的）**。
        
        请输出纯 JSON 格式，包含以下字段：
        - question_text: **仅题目内容**的 OCR 识别结果。请忽略用户的手写痕迹。
        - user_answer: **识别图片中的用户手写解答过程**。如果只有选项，识别选项；如果有过程，识别过程。
        - ai_analysis: **AI 智能分析**。请客观、专业地指出用户的错误原因（对应 user_answer），并给出正确的解题思路。**不要毒舌，保持鼓励和专业**。
        - subject: 题目所属科目 (Math, DataStructures, CompOrg, OS, Network, Other)。
        - error_type: 错误类型 (Concept, Calculation, Logic, Carelessness)。
        - knowledge_tags: 3-5 个知识点标签 (数组)。
        
        **格式要求**：
        1. 公式务必使用 standard LaTeX 格式，并且两边必须用 $ 符号包裹 (例如 $\int x dx$)。
        2. 确保输出是可以解析的合法 JSON 字符串。
        `;

        // 5. Call LLM API (OpenAI Compatible)
        const payload = {
            model: LLM_MODEL_NAME,
            messages: [
                { role: "system", content: systemPrompt },
                {
                    role: "user",
                    content: [
                        { type: "text", text: "请分析这道错题：" },
                        {
                            type: "image_url",
                            image_url: { url: dataUri } // Send Base64 instead of URL
                        }
                    ]
                }
            ],
            response_format: { type: "json_object" }, // Try to enforce JSON mode if supported
            temperature: 0.2,
            max_tokens: 2000
        };

        console.log(`Calling LLM: ${LLM_BASE_URL} with model ${LLM_MODEL_NAME}`);

        const response = await fetch(`${LLM_BASE_URL}/chat/completions`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${LLM_API_KEY}`
            },
            body: JSON.stringify(payload)
        });

        if (!response.ok) {
            const errText = await response.text();
            throw new Error(`LLM API Error: ${response.status} - ${errText}`);
        }

        const data = await response.json();
        const content = data.choices?.[0]?.message?.content;

        if (!content) throw new Error('Empty response from LLM');

        // 5. Parse JSON Output
        let parsedResult;
        try {
            // Clean typical markdown code blocks ```json ... ```
            const cleanContent = content.replace(/^```json\s*/, '').replace(/\s*```$/, '').trim();
            parsedResult = JSON.parse(cleanContent);
        } catch (e) {
            console.error('JSON Parse Failed:', content);
            // Fallback object
            parsedResult = {
                question_text: "Parsed Error",
                ai_analysis: content, // Return raw text if parse fails
                subject: "Other",
                knowledge_tags: []
            };
        }

        return NextResponse.json(parsedResult);

    } catch (error: any) {
        console.error('Analyze Error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
