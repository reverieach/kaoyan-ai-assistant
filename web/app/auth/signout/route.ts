import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

export async function POST() {
    const supabase = await createClient()
    await supabase.auth.signOut()
    redirect('/auth/signin')
}

// Also handle GET for direct navigation
export async function GET() {
    const supabase = await createClient()
    await supabase.auth.signOut()
    redirect('/auth/signin')
}
