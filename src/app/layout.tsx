import type { Metadata } from "next";
import NextTopLoader from "nextjs-toploader";
import "./globals.css";
import { Toaster } from "@/components/ui/sonner";
import { cn } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Admin - Future Technology",
  description: "Admin panel for Future Technology e-commerce platform",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="en"
      className={cn("h-full font-sans antialiased")}
      suppressHydrationWarning
    >
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          rel="preconnect"
          href="https://fonts.gstatic.com"
          crossOrigin="anonymous"
        />
        <link
          href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="min-h-full bg-muted/30" suppressHydrationWarning>
        <NextTopLoader
          color="#8b5cf6"
          height={4}
          showSpinner={false}
          crawlSpeed={300}
          speed={300}
          shadow="0 0 12px rgba(139, 92, 246, 0.6)"
          zIndex={9999}
          easing="ease"
        />
        {children}
        <Toaster />
      </body>
    </html>
  );
}
