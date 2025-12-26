import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/sonner"
import { AppSidebar } from "@/components/layout/sidebar"
import { Footer } from "@/components/layout/footer"

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "27考研助手",
  description: "基于AI的考研复习助手，支持错题管理、智能复习和资料问答",
  icons: {
    icon: "/icon.png",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <div className="flex flex-col min-h-screen bg-background text-foreground">
          <div className="flex flex-1">
            <AppSidebar />
            <main className="flex-1 w-full relative z-0">
              {children}
            </main>
          </div>
          <Footer />
        </div>
        <Toaster />
      </body>
    </html>
  );
}
