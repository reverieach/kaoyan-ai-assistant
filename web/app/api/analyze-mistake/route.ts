import { NextRequest, NextResponse } from 'next/server';
import { dify } from '@/lib/dify/client';
import { createClient } from '@supabase/supabase-js';

// 初始化服务端 Supabase Client，用于鉴权
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseAnonKey);

export async function POST(req: NextRequest) {
    try {
        // 1. Auth Check
        const authHeader = req.headers.get('Authorization');
        if (!authHeader) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        const { data: { user }, error: authError } = await supabase.auth.getUser(authHeader.replace('Bearer ', ''));
        if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        // 2. Parse Body (Image URL or Base64)
        // 这里我们假设前端已经把图片传到了 Supabase Storage，给了我们一个 URL
        const { imageUrl } = await req.json();
        if (!imageUrl) return NextResponse.json({ error: 'Missing imageUrl' }, { status: 400 });

        // 3. Call Dify Workflow
        // 如果没有配置 Dify Key，使用 Mock 数据
        if (!process.env.DIFY_API_KEY) {
            console.log('⚠️ No Dify API Key found, utilizing mock response.');
            await new Promise(resolve => setTimeout(resolve, 2000)); // Simulate delay
            return NextResponse.json({
                question_text: "Mock: 二重积分计算题...",
                ai_analysis: "Mock Analysis: 极坐标变换错误...",
                subject: "Math",
                error_type: "Calculation",
                knowledge_tags: ["二重积分", "极坐标"]
            });
        }

        // Real Dify Call
        // 注意：Dify 接收文件通常需要 file_id，或者如果是 URL 需要 Workflow 支持 URL 输入
        // 这里假设我们的 Workflow 定义了一个 'image_url' 的输入变量
        const result = await dify.runWorkflow({ image_url: imageUrl }, user.id);

        // Parse Dify Output key 'text' or specific keys from 'outputs'
        const workflowOutput = result.data.outputs;

        return NextResponse.json(workflowOutput);

    } catch (error: any) {
        console.error('Analyze Error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
