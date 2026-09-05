import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/lib/auth-context";
import Script from 'next/script';

// Inter font configuration
const inter = Inter({ 
  subsets: ["latin"],
  variable: "--font-sans",
});

// Define metadata for PWA and App
export const metadata: Metadata = {
  description: "Construction Estimate & Deed Drafting System",
  manifest: "/manifest.json",
  icons: {
    icon: '/logo.jpg',
  },
};

// Recommended approach for viewport configuration in Next.js 14+
export const viewport: Viewport = {
  themeColor: "#2563eb",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={inter.variable}>
      <head>
        {/* Service Worker Registration Script */}
        <Script
          id="sw-registration"
          strategy="afterInteractive"
          dangerouslySetInnerHTML={{
            __html: `
              if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
                window.addEventListener('load', () => {
                  navigator.serviceWorker.register('/sw.js')
                    .then((reg) => console.log('Service Worker registered!', reg))
                    .catch((err) => console.log('Service Worker failed', err));
                });
              }
            `,
          }}
        />
      </head>
      <body className="h-full w-full font-sans">
        <AuthProvider>
          {children}
        </AuthProvider>
      </body>
    </html>
  );
}