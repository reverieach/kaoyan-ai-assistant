'use client'

import { usePathname } from 'next/navigation'
import Link from 'next/link'
import { cn } from '@/lib/utils'
import {
    LayoutDashboard,
    BookOpen,
    CheckCircle,
    PlusCircle,
    Layers,
    Database,
    Menu,
    LogOut,
    User
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet'
import { useState } from 'react'

const navItems = [
    { href: '/dashboard', label: '中控台', icon: LayoutDashboard },
    { href: '/mistakes', label: '错题库', icon: BookOpen },
    { href: '/review', label: '智能复习', icon: CheckCircle },
    { href: '/mistakes/new', label: '录入新题', icon: PlusCircle },
    { href: '/mistakes/pending', label: '待处理队列', icon: Layers },
    { href: '/references', label: 'AI 资料库', icon: Database },
]

export function AppSidebar() {
    const pathname = usePathname()
    const [open, setOpen] = useState(false)

    // Hide sidebar on auth pages
    if (pathname.startsWith('/auth')) return null

    const NavContent = () => (
        <div className="flex flex-col h-full py-4">
            <div className="px-6 py-2">
                <h2 className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-700 to-purple-700">
                    考研 AI 助手
                </h2>
                <p className="text-xs text-muted-foreground mt-1">Version 1.0.0</p>
            </div>

            <div className="flex-1 px-4 py-4 space-y-2">
                {navItems.map((item) => {
                    const isActive = pathname === item.href || (item.href !== '/dashboard' && pathname.startsWith(item.href.split('?')[0]))
                    return (
                        <Link
                            key={item.href}
                            href={item.href}
                            onClick={() => setOpen(false)}
                            className={cn(
                                "flex items-center gap-3 px-4 py-3 text-sm font-medium rounded-lg transition-colors",
                                isActive
                                    ? "bg-primary/10 text-primary hover:bg-primary/15"
                                    : "text-muted-foreground hover:bg-slate-100 hover:text-foreground"
                            )}
                        >
                            <item.icon className="w-5 h-5" />
                            {item.label}
                        </Link>
                    )
                })}
            </div>

            <div className="px-4 py-4 border-t">
                <Link
                    href="/profile"
                    className="flex items-center gap-3 px-4 py-3 text-sm font-medium text-muted-foreground hover:bg-slate-100 hover:text-foreground rounded-lg"
                >
                    <User className="w-5 h-5" />
                    个人中心
                </Link>
                <Link
                    href="/auth/logout" // Handle logout logic
                    className="flex items-center gap-3 px-4 py-3 text-sm font-medium text-red-500 hover:bg-red-50 rounded-lg"
                >
                    <LogOut className="w-5 h-5" />
                    退出登录
                </Link>
            </div>
        </div>
    )

    return (
        <>
            {/* Desktop Sidebar */}
            <aside className="hidden md:flex flex-col w-64 border-r h-screen sticky top-0 bg-background/95 backdrop-blur z-30">
                <NavContent />
            </aside>

            {/* Mobile Trigger */}
            <div className="md:hidden fixed top-4 left-4 z-50">
                <Sheet open={open} onOpenChange={setOpen}>
                    <SheetTrigger asChild>
                        <Button variant="outline" size="icon" className="shadow-md">
                            <Menu className="w-5 h-5" />
                        </Button>
                    </SheetTrigger>
                    <SheetContent side="left" className="p-0 w-72">
                        <NavContent />
                    </SheetContent>
                </Sheet>
            </div>
        </>
    )
}
