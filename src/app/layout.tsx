import type { Metadata } from "next";
import "./globals.css";
import { Toaster } from "@/components/ui/sonner";
import { Geist } from "next/font/google";
import { cn } from "@/lib/utils";

const geist = Geist({subsets:['latin'],variable:'--font-sans'});

export const metadata: Metadata = {
  title: "Admin - Future Technology",
  description: "Admin panel for Future Technology e-commerce platform",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={cn("h-full", "font-sans", geist.variable)} suppressHydrationWarning>
      <body className="min-h-full bg-muted/30" suppressHydrationWarning>
        {children}
        <Toaster />
      </body>
    </html>
  );
}
