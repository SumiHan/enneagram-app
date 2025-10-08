"use client";
import "./globals.css";
import { ProgressProvider } from "@/lib/progress-context";
import { AuthProvider } from "@/lib/auth-context";
import { TopNav } from "@/components/TopNav";
import { usePathname } from "next/navigation";

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isAdminPage = pathname?.startsWith('/admin');
  
  return (
    <html lang="ko">
      <body className="text-slate-900">
        <AuthProvider>
          <ProgressProvider>
            <div className={`mx-auto p-4 sm:p-6 lg:p-8 ${isAdminPage ? 'max-w-7xl' : 'max-w-3xl'}`}>
              <TopNav />
              {children}
            </div>
          </ProgressProvider>
        </AuthProvider>
      </body>
    </html>
  );
}


