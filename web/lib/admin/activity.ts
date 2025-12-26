import { createClient } from '@/lib/supabase/server'

export type ActivityAction =
    | 'login'
    | 'logout'
    | 'upload_mistake'
    | 'analyze_mistake'
    | 'review_mistake'
    | 'upload_reference'
    | 'chat'
    | 'api_call'

interface ActivityMetadata {
    [key: string]: any
}

/**
 * 记录用户活动
 * 在关键操作处调用此函数
 */
export async function logActivity(
    userId: string,
    action: ActivityAction,
    metadata?: ActivityMetadata
) {
    try {
        const supabase = await createClient()

        await supabase.from('user_activity_logs').insert({
            user_id: userId,
            action_type: action,
            metadata: metadata || {}
        })
    } catch (error) {
        // 静默失败，不影响主业务
        console.error('[Activity Log Error]:', error)
    }
}

/**
 * 记录 API 调用
 */
export async function logApiCall(
    userId: string,
    apiName: string,
    options: {
        tokensUsed?: number
        costEstimate?: number
        durationMs?: number
        success?: boolean
        errorMessage?: string
    } = {}
) {
    try {
        const supabase = await createClient()

        await supabase.from('api_usage_logs').insert({
            user_id: userId,
            api_name: apiName,
            tokens_used: options.tokensUsed || 0,
            cost_estimate: options.costEstimate || 0,
            request_duration_ms: options.durationMs || 0,
            success: options.success !== false,
            error_message: options.errorMessage || null
        })
    } catch (error) {
        console.error('[API Log Error]:', error)
    }
}

/**
 * 检查用户是否是管理员
 */
export async function isAdmin(userId: string): Promise<boolean> {
    try {
        const supabase = await createClient()

        const { data, error } = await supabase
            .from('admins')
            .select('user_id')
            .eq('user_id', userId)
            .single()

        return !!data && !error
    } catch {
        return false
    }
}
