import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Providers } from "./providers";
import { SiteHeader } from "@/components/site-header";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const title = "Voucher Optima | Voucher Savings Calculator";
const description =
  "Maximize voucher savings with Voucher Optima. Calculate optimal spending, compare store prices, and find the best final price in Vietnamese dong (VND).";
const siteUrl = process.env.SITE_URL;

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl || "http://localhost:3000"),
  title: { default: title, template: "%s | Voucher Optima" },
  description,
  applicationName: "Voucher Optima",
  ...(siteUrl ? { alternates: { canonical: "/" } } : {}),
  openGraph: {
    type: "website",
    siteName: "Voucher Optima",
    title,
    description,
    locale: "en_US",
    ...(siteUrl ? { url: "/" } : {}),
    images: [{
      url: "/social-preview.png",
      width: 1200,
      height: 630,
      alt: "Voucher Optima — maximize your voucher savings and compare prices in VND",
    }],
  },
  twitter: {
    card: "summary_large_image",
    title,
    description,
    images: [{ url: "/social-preview.png", alt: "Voucher Optima — Voucher Savings Calculator" }],
  },
  appleWebApp: { title: "Voucher Optima", capable: true, statusBarStyle: "default" },
};

export const viewport: Viewport = {
  themeColor: "#171717",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <Providers>
          <SiteHeader />
          {children}
        </Providers>
      </body>
    </html>
  );
}
