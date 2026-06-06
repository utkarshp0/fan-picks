import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { GuestSessionProvider } from "@/components/auth/guest-session-provider";
import { getAppBaseUrl } from "@/lib/share-metadata";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  applicationName: "Fan Picks",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Fan Picks",
  },
  title: "Fan Picks",
  description: "For fans who back their opinions.",
  metadataBase: new URL(getAppBaseUrl()),
  formatDetection: {
    telephone: false,
  },
  icons: {
    apple: "/icon.svg",
    icon: "/icon.svg",
    shortcut: "/icon.svg",
  },
  manifest: "/manifest.webmanifest",
};

export const viewport: Viewport = {
  themeColor: "#08090b",
  initialScale: 1,
  maximumScale: 1,
  width: "device-width",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      data-scroll-behavior="smooth"
      className={`${geistSans.variable} ${geistMono.variable} dark h-full antialiased`}
    >
      <body className="flex min-h-full flex-col">
        <GuestSessionProvider>{children}</GuestSessionProvider>
      </body>
    </html>
  );
}
