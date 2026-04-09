import type { Metadata } from "next";
import "./globals.css";
import { Sidebar } from "@/components/layout/Sidebar";
import { AdminHeader } from "@/components/layout/Header";

export const metadata: Metadata = {
  title: "Admin - Future Technology",
  description: "Admin panel for Future Technology e-commerce platform",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className="h-full" suppressHydrationWarning>
      <body className="min-h-full bg-muted/30" suppressHydrationWarning>
        <Sidebar />
        <div className="lg:ml-64 min-h-screen flex flex-col">
          <AdminHeader />
          <main className="flex-1 p-4 md:p-6">{children}</main>
        </div>
      </body>
    </html>
  );
}
