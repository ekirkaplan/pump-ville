import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
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
  title: 'PumpVille - Interactive Crypto Village',
  description: 'Join the ultimate crypto village experience! Connect your Phantom wallet, explore PumpVille with your character, and chat with fellow token holders in real-time.',
  keywords: 'crypto, blockchain, solana, phantom wallet, NFT, gaming, metaverse, pump, village, token holders',
  authors: [{ name: 'PumpVille Team' }],
  creator: 'PumpVille',
  publisher: 'PumpVille',
  openGraph: {
    type: 'website',
    locale: 'en_US',
    title: 'PumpVille - Interactive Crypto Village',
    description: 'Explore PumpVille with your character and chat with fellow token holders!',
    siteName: 'PumpVille',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'PumpVille - Interactive Crypto Village',
    description: 'Join the ultimate crypto village experience on Solana blockchain!',
    creator: '@PumpVille',
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
    },
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <meta name="theme-color" content="#000000" />
        <link rel="icon" href="/favicon.ico" />
        <link rel="manifest" href="/manifest.json" />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
