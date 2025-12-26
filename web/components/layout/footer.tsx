'use client'

import Link from 'next/link'
import { Github, Mail } from 'lucide-react'

export function Footer() {
    const currentYear = new Date().getFullYear()

    return (
        <footer className="w-full border-t bg-gray-50/50 py-4 mt-auto">
            <div className="container mx-auto px-4 flex flex-col items-center gap-3">
                {/* Social Links */}
                <div className="flex items-center gap-4">
                    <Link
                        href="https://github.com/reverieach"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-gray-500 hover:text-gray-700 transition-colors"
                        title="GitHub"
                    >
                        <Github className="w-5 h-5" />
                    </Link>
                    <Link
                        href="mailto:reverie-ach@outlook.com"
                        className="text-gray-500 hover:text-gray-700 transition-colors"
                        title="Email"
                    >
                        <Mail className="w-5 h-5" />
                    </Link>
                </div>

                {/* Copyright & ICP */}
                <div className="flex flex-col sm:flex-row items-center gap-1 sm:gap-2 text-sm text-gray-500">
                    <span>© {currentYear} 27考研助手</span>
                    <span className="hidden sm:inline">|</span>
                    <Link
                        href="https://beian.miit.gov.cn/"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="hover:text-gray-700 hover:underline"
                    >
                        皖ICP备2025088917号-1
                    </Link>
                </div>
            </div>
        </footer>
    )
}
