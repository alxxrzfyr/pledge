"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useWalletStore } from "@/lib/store";
import { createProjectOnChain } from "@/lib/soroban";
import { Plus, Trash, ShieldCheck, Vault, ArrowUpRight, Spinner } from "@phosphor-icons/react";

interface MilestoneInput {
  desc: string;
  amount: string;
}

export default function CreateProjectPage() {
  const router = useRouter();
  const { address, isConnected, connectWallet } = useWalletStore();

  const [name, setName] = useState("");
  const [contractor, setContractor] = useState("");
  const [verifiers, setVerifiers] = useState<string[]>(["", "", ""]);
  const [milestones, setMilestones] = useState<MilestoneInput[]>([
    { desc: "Phase 1: Site clearing and foundation excavation", amount: "50000" },
    { desc: "Phase 2: Structural concrete pouring and framing", amount: "100000" },
  ]);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);

  const totalBudget = milestones.reduce((sum, m) => sum + (parseFloat(m.amount) || 0), 0);

  const addMilestone = () => {
    setMilestones([...milestones, { desc: "", amount: "" }]);
  };

  const removeMilestone = (idx: number) => {
    if (milestones.length <= 1) return;
    setMilestones(milestones.filter((_, i) => i !== idx));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isConnected || !address) {
      alert("Please connect your Freighter wallet first.");
      return;
    }

    setIsSubmitting(true);
    setStatusMsg("Building atomic escrow transaction on Soroban...");

    try {
      const milestoneDescs = milestones.map((m) => m.desc);
      const milestoneAmounts = milestones.map((m) => Math.round((parseFloat(m.amount) || 0) * 10000000));
      const dummyToken = "CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMWAACNHB4B6QZ";

      await createProjectOnChain(
        address,
        name,
        contractor,
        verifiers,
        milestoneDescs,
        milestoneAmounts,
        dummyToken
      );

      setStatusMsg("Project created! Escrow budget locked into Treasury.");
      setTimeout(() => {
        router.push("/");
      }, 1500);
    } catch (err: any) {
      setStatusMsg(`Error: ${err.message}`);
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6 sm:space-y-8">
      {/* Header */}
      <div className="space-y-2 sm:space-y-3 border-b border-white/10 pb-4 sm:pb-6">
        <h1 className="text-2xl sm:text-5xl font-extrabold tracking-tight text-white leading-tight">
          Create Infrastructure Project
        </h1>
        <p className="text-white/60 text-xs sm:text-sm max-w-[60ch]">
          Define milestone payment schedule and lock total project budget into the Soroban Treasury escrow contract.
        </p>
      </div>

      {/* Double-Bezel Form Container */}
      <div className="p-1.5 sm:p-2 bg-white/5 border border-white/10 rounded-[2rem] sm:rounded-[2.5rem] ambient-glow">
        <form onSubmit={handleSubmit} className="bg-[#07070a] rounded-[calc(2rem-0.4rem)] sm:rounded-[calc(2.5rem-0.5rem)] p-4 sm:p-8 space-y-5 sm:space-y-6 inner-bezel-shadow border border-white/5">
          {/* Project Title */}
          <div className="space-y-1.5">
            <label className="block text-[11px] sm:text-xs font-semibold text-white/80 uppercase tracking-wider">
              Project Title
            </label>
            <input
              type="text"
              required
              placeholder="e.g. Barangay San Jose Health Center Expansion"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full bg-white/5 border border-white/10 rounded-2xl px-3.5 sm:px-4 py-2.5 sm:py-3 text-xs sm:text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-white/30 transition-all"
            />
          </div>

          {/* Contractor Address */}
          <div className="space-y-1.5">
            <label className="block text-[11px] sm:text-xs font-semibold text-white/80 uppercase tracking-wider">
              Contractor Wallet Address
            </label>
            <input
              type="text"
              required
              placeholder="G..."
              value={contractor}
              onChange={(e) => setContractor(e.target.value)}
              className="w-full bg-white/5 border border-white/10 rounded-2xl px-3.5 sm:px-4 py-2.5 sm:py-3 font-mono text-xs sm:text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-white/30 transition-all"
            />
          </div>

          {/* 3 Verifiers */}
          <div className="space-y-3 bg-black/40 p-4 sm:p-5 rounded-2xl border border-white/5">
            <div className="flex items-center gap-2 text-[11px] sm:text-xs font-semibold text-white uppercase tracking-wider">
              <ShieldCheck size={16} className="text-emerald-400 shrink-0" />
              <span>Independent Verifiers (Exactly 3)</span>
            </div>

            {[0, 1, 2].map((idx) => (
              <div key={idx} className="space-y-1">
                <label className="block text-[11px] text-white/50 font-medium">
                  Verifier #{idx + 1} Address
                </label>
                <input
                  type="text"
                  required
                  placeholder={`G... (Verifier ${idx + 1})`}
                  value={verifiers[idx]}
                  onChange={(e) => {
                    const updated = [...verifiers];
                    updated[idx] = e.target.value;
                    setVerifiers(updated);
                  }}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 font-mono text-xs text-white placeholder:text-white/30 focus:outline-none focus:border-white/30"
                />
              </div>
            ))}
          </div>

          {/* Milestone Schedule */}
          <div className="space-y-3 sm:space-y-4 bg-black/40 p-4 sm:p-5 rounded-2xl border border-white/5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5 text-[11px] sm:text-xs font-semibold text-white uppercase tracking-wider">
                <Vault size={16} className="text-emerald-400 shrink-0" />
                <span>Milestone Schedule</span>
              </div>
              <button
                type="button"
                onClick={addMilestone}
                className="text-xs text-emerald-400 hover:text-emerald-300 font-semibold flex items-center gap-1 shrink-0"
              >
                <Plus size={14} /> Add
              </button>
            </div>

            {milestones.map((m, idx) => (
              <div key={idx} className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 bg-white/5 p-3 rounded-xl border border-white/5">
                <div className="flex items-center gap-2 flex-1 min-w-0">
                  <span className="text-xs font-mono font-bold text-white/40 w-5 shrink-0">#{idx + 1}</span>
                  <input
                    type="text"
                    required
                    placeholder="Milestone description..."
                    value={m.desc}
                    onChange={(e) => {
                      const updated = [...milestones];
                      updated[idx].desc = e.target.value;
                      setMilestones(updated);
                    }}
                    className="w-full bg-black/40 border border-white/10 rounded-lg px-2.5 py-1.5 text-xs text-white placeholder:text-white/30 focus:outline-none"
                  />
                </div>
                
                <div className="flex items-center gap-2">
                  <div className="flex-1 sm:w-32 flex items-center bg-black/40 border border-white/10 rounded-lg px-2.5">
                    <input
                      type="number"
                      required
                      placeholder="Amount"
                      value={m.amount}
                      onChange={(e) => {
                        const updated = [...milestones];
                        updated[idx].amount = e.target.value;
                        setMilestones(updated);
                      }}
                      className="w-full bg-transparent py-1 text-xs font-mono text-emerald-400 focus:outline-none"
                    />
                    <span className="text-[10px] text-white/40 font-mono shrink-0 ml-1">XLM</span>
                  </div>
                  {milestones.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeMilestone(idx)}
                      className="text-white/40 hover:text-rose-400 p-1 transition-colors shrink-0"
                    >
                      <Trash size={16} />
                    </button>
                  )}
                </div>
              </div>
            ))}

            <div className="flex items-center justify-between border-t border-white/10 pt-3 text-xs">
              <span className="text-white/50 font-medium">Total Escrow Budget</span>
              <span className="font-mono font-bold text-sm sm:text-base text-emerald-400">
                {totalBudget.toLocaleString()} XLM
              </span>
            </div>
          </div>

          {/* Submit Action Button */}
          {isConnected ? (
            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full rounded-full pl-5 sm:pl-6 pr-2 py-3 bg-white text-black font-semibold text-xs sm:text-sm flex items-center justify-center gap-2.5 group hover:bg-white/90 active:scale-[0.98] transition-all shadow-xl disabled:opacity-50"
            >
              {isSubmitting ? (
                <>
                  <Spinner size={16} className="animate-spin text-black shrink-0" />
                  <span>{statusMsg || "Creating..."}</span>
                </>
              ) : (
                <>
                  <span className="truncate">Deploy & Escrow {totalBudget.toLocaleString()} XLM</span>
                  <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-black/10 flex items-center justify-center text-black group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform shrink-0">
                    <ArrowUpRight size={14} weight="bold" />
                  </div>
                </>
              )}
            </button>
          ) : (
            <button
              type="button"
              onClick={connectWallet}
              className="w-full rounded-full py-3 bg-white/10 text-white font-semibold text-xs sm:text-sm hover:bg-white/20 border border-white/10 transition-all"
            >
              Connect Wallet to Deploy
            </button>
          )}
        </form>
      </div>
    </div>
  );
}
