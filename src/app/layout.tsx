import type { Metadata } from "next";
import { Inter } from "next/font/google"; // Geist ki jagah Inter use karein
import "./globals.css";
import { AuthProvider } from "@/lib/auth-context";

// Inter font configuration
const inter = Inter({ 
  subsets: ["latin"],
  variable: "--font-sans",
});

export const metadata: Metadata = {
  title: "LNT WITH AI 2.0",
  description: "Construction Estimate & Planning System",
  icons: {
    icon: '/logo.jpg',
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        {/* Yeh line add karna zaroori hai */}
        
      </head>
      <body className="h-full w-full">
        <AuthProvider>
          {children}
        </AuthProvider>
      </body>
    </html>
  );
}