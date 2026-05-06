import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Navbar } from "@/components/Navbar";
import Providers from "@/components/Providers";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "predict.io | Decentralized Prediction Markets on Stellar",
  description: "Predict the future and earn rewards on the fastest decentralized prediction market platform built on Stellar Soroban.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body className={`${inter.className} min-h-screen bg-background font-sans antialiased`}>
        <Providers>
          <div className="relative flex min-h-screen flex-col">
            <Navbar />
            <main className="flex-1 container mx-auto px-4 py-8">
              {children}
            </main>
            <footer className="border-t py-6 md:py-0">
              <div className="container flex flex-col items-center justify-between gap-4 md:h-24 md:flex-row">
                <p className="text-center text-sm leading-loose text-muted-foreground md:text-left">
                  Built on Stellar Soroban. © 2026 predict.io
                </p>
              </div>
            </footer>
          </div>
        </Providers>
      </body>
    </html>
  );
}
