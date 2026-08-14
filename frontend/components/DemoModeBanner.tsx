import { DEMO_MODE } from "@/lib/soroban";
import { WarningCircle } from "@phosphor-icons/react/dist/ssr";

/**
 * Visible banner shown whenever no Registry contract ID is configured.
 * In this state every "on-chain" action in lib/soroban.ts is actually
 * writing to browser localStorage only; nothing is submitted to Soroban.
 * This must stay impossible to miss so users never mistake local demo
 * state for a real escrowed transaction.
 */
export function DemoModeBanner() {
  if (!DEMO_MODE) return null;

  return (
    <div
      role="status"
      className="w-full bg-amber-500/15 border-b border-amber-500/30 text-amber-200 text-xs sm:text-sm"
    >
      <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-2 flex items-center gap-2 justify-center text-center">
        <WarningCircle size={16} weight="bold" className="shrink-0" />
        <span>
          Demo Mode: no Registry contract configured. Wallet actions are simulated locally and are
          not submitted to Soroban.
        </span>
      </div>
    </div>
  );
}
