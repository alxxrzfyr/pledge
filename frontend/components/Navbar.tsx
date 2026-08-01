"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useWalletStore } from "@/lib/store";
import { PledgeLogo } from "./PledgeLogo";
import { ArrowUpRight, SignOut, List, X } from "@phosphor-icons/react";

export function Navbar() {
  const pathname = usePathname();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const { address, isConnected, isConnecting, connectWallet, disconnectWallet } =
    useWalletStore();

  const truncateAddress = (addr: string) => {
    return `${addr.slice(0, 4)}...${addr.slice(-4)}`;
  };

  return (
    <header className="fixed top-3 sm:top-6 left-1/2 -translate-x-1/2 z-50 w-[96%] max-w-5xl">
      {/* Floating Glass Island Pill Nav */}
      <div className="bg-[#060609]/85 backdrop-blur-2xl border border-white/15 rounded-3xl sm:rounded-full px-3 sm:px-4 py-2 sm:py-2.5 flex items-center justify-between shadow-[0_20px_50px_rgba(0,0,0,0.85)] transition-all duration-500 ease-fluid">
        {/* Brand Logo & Name: Pledge */}
        <Link href="/" className="flex items-center gap-2.5 sm:gap-3 group pl-0.5 sm:pl-1">
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-emerald-400/20 via-teal-500/20 to-blue-500/20 border border-white/20 flex items-center justify-center text-emerald-400 group-hover:scale-105 transition-transform shrink-0">
            <PledgeLogo size={18} />
          </div>
          <span className="font-extrabold text-sm sm:text-base tracking-tight text-white uppercase">
            Pledge
          </span>
        </Link>

        {/* Desktop Navigation Links */}
        <nav className="hidden md:flex items-center gap-1.5 font-medium text-xs">
          <Link
            href="/"
            className={`px-4 py-1.5 rounded-full transition-all duration-300 ${
              pathname === "/"
                ? "bg-white/15 text-white font-semibold shadow-[inset_0_1px_1px_rgba(255,255,255,0.2)]"
                : "text-white/70 hover:text-white hover:bg-white/5"
            }`}
          >
            Dashboard
          </Link>
          <Link
            href="/create"
            className={`px-4 py-1.5 rounded-full transition-all duration-300 ${
              pathname === "/create"
                ? "bg-white/15 text-white font-semibold shadow-[inset_0_1px_1px_rgba(255,255,255,0.2)]"
                : "text-white/70 hover:text-white hover:bg-white/5"
            }`}
          >
            Create Project
          </Link>
        </nav>

        {/* Desktop Wallet Action */}
        <div className="hidden md:flex items-center gap-2">
          {isConnected && address ? (
            <>
              <div className="flex items-center gap-2 bg-white/5 border border-white/15 px-3.5 py-1.5 rounded-full text-xs font-mono text-white/90">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                <span>{truncateAddress(address)}</span>
              </div>
              <button
                onClick={disconnectWallet}
                title="Disconnect Wallet"
                className="w-8 h-8 rounded-full bg-white/5 border border-white/15 flex items-center justify-center text-white/70 hover:text-white hover:bg-white/10 transition-colors"
              >
                <SignOut size={14} />
              </button>
            </>
          ) : (
            <button
              onClick={connectWallet}
              disabled={isConnecting}
              className="rounded-full pl-4 pr-1.5 py-1.5 bg-white text-black font-semibold text-xs flex items-center gap-2.5 group hover:bg-white/90 active:scale-[0.98] transition-all shadow-lg disabled:opacity-50"
            >
              <span>{isConnecting ? "Connecting..." : "Connect Wallet"}</span>
              <div className="w-6 h-6 rounded-full bg-black/10 flex items-center justify-center text-black group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform">
                <ArrowUpRight size={14} weight="bold" />
              </div>
            </button>
          )}
        </div>

        {/* Mobile Hamburger Toggle Button */}
        <button
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          className="md:hidden w-8 h-8 sm:w-9 sm:h-9 rounded-full bg-white/10 border border-white/15 flex items-center justify-center text-white transition-all active:scale-95 shrink-0"
          aria-label="Toggle Navigation Menu"
        >
          {mobileMenuOpen ? <X size={16} /> : <List size={16} />}
        </button>
      </div>

      {/* Mobile Drawer Overlay */}
      {mobileMenuOpen && (
        <div className="md:hidden mt-2 bg-[#09090e]/95 backdrop-blur-3xl border border-white/15 rounded-3xl p-4 sm:p-5 shadow-2xl space-y-3 animate-in fade-in slide-in-from-top-4 duration-300">
          <nav className="flex flex-col gap-1.5">
            <Link
              href="/"
              onClick={() => setMobileMenuOpen(false)}
              className={`px-3.5 py-2.5 rounded-2xl text-xs sm:text-sm font-semibold transition-all ${
                pathname === "/"
                  ? "bg-white/15 text-white"
                  : "text-white/70 hover:bg-white/5"
              }`}
            >
              Dashboard
            </Link>
            <Link
              href="/create"
              onClick={() => setMobileMenuOpen(false)}
              className={`px-3.5 py-2.5 rounded-2xl text-xs sm:text-sm font-semibold transition-all ${
                pathname === "/create"
                  ? "bg-white/15 text-white"
                  : "text-white/70 hover:bg-white/5"
              }`}
            >
              Create Project
            </Link>
          </nav>

          <div className="pt-2 border-t border-white/10 flex flex-col gap-2">
            {isConnected && address ? (
              <div className="flex items-center justify-between bg-white/5 p-2.5 rounded-2xl border border-white/10">
                <div className="flex items-center gap-1.5 text-xs font-mono text-white min-w-0">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse shrink-0" />
                  <span className="truncate">{truncateAddress(address)}</span>
                </div>
                <button
                  onClick={() => {
                    disconnectWallet();
                    setMobileMenuOpen(false);
                  }}
                  className="text-xs font-semibold text-rose-400 hover:text-rose-300 shrink-0 ml-2"
                >
                  Disconnect
                </button>
              </div>
            ) : (
              <button
                onClick={() => {
                  connectWallet();
                  setMobileMenuOpen(false);
                }}
                disabled={isConnecting}
                className="w-full rounded-2xl py-2.5 bg-white text-black font-semibold text-xs flex items-center justify-center gap-2 active:scale-[0.98] transition-all"
              >
                <span>{isConnecting ? "Connecting..." : "Connect Freighter"}</span>
                <ArrowUpRight size={14} weight="bold" />
              </button>
            )}
          </div>
        </div>
      )}
    </header>
  );
}
