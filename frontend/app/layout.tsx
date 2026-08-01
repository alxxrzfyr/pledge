import type { Metadata } from "next";
import "./globals.css";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { Providers } from "@/components/Providers";

export const metadata: Metadata = {
  title: "Pledge — Public Infrastructure Fund Tracker",
  description:
    "Verifiable infrastructure escrow smart contracts powered by Stellar Soroban.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body className="bg-[#040406] text-[#f4f4f5] font-sans min-h-[100dvh] flex flex-col justify-between antialiased mesh-gradient-bg selection:bg-white selection:text-black">
        <Providers>
          <div>
            <Navbar />
            <main className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 pt-24 sm:pt-28 pb-24 sm:pb-32">
              {children}
            </main>
          </div>
          <Footer />
        </Providers>
      </body>
    </html>
  );
}
