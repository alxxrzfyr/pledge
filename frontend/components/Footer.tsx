import { PledgeLogo } from "./PledgeLogo";
import { ArrowUpRight } from "@phosphor-icons/react/dist/ssr";

export function Footer() {
  return (
    <footer className="w-full border-t border-white/10 py-16 bg-[#040406] text-xs text-white/60">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col md:flex-row items-center justify-between gap-8">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-full bg-white/5 border border-white/10 flex items-center justify-center text-emerald-400 shrink-0">
            <PledgeLogo size={20} />
          </div>
          <div>
            <p className="font-bold text-white tracking-tight text-sm">
              Pledge Protocol
            </p>
            <p className="text-white/50 text-xs">
              Every peso tracked, every milestone verified on Stellar Soroban smart contracts.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-6 font-medium">
          <a
            href="https://soroban.stellar.org"
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-1 hover:text-white transition-colors group"
          >
            <span>Soroban Network</span>
            <ArrowUpRight size={14} className="group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
          </a>
          <a
            href="https://freighter.app"
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-1 hover:text-white transition-colors group"
          >
            <span>Freighter Wallet</span>
            <ArrowUpRight size={14} className="group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
          </a>
        </div>
      </div>
    </footer>
  );
}
