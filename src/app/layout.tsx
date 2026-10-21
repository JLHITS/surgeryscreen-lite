import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Toaster } from "@/components/ui/toaster";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const SITE_URL = process.env.SITE_URL || "http://localhost:3000";
const DESCRIPTION =
  "Free, open-source waiting-room slideshow for GP practices.";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "SurgeryScreen Lite",
    template: "%s · SurgeryScreen Lite",
  },
  description: DESCRIPTION,
  applicationName: "SurgeryScreen Lite",
  // Icons and the social image are picked up automatically from the
  // app/{icon,apple-icon,favicon,opengraph-image} files.
  openGraph: {
    type: "website",
    siteName: "SurgeryScreen Lite",
    title: "SurgeryScreen Lite",
    description: DESCRIPTION,
    url: "/",
  },
  twitter: {
    card: "summary_large_image",
    title: "SurgeryScreen Lite",
    description: DESCRIPTION,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full">
        {children}
        <Toaster />
      </body>
    </html>
  );
}
