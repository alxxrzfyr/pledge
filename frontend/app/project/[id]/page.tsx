"use client";

import { use, useState, useSyncExternalStore } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  getProjectById,
  submitProofOnChain,
  verifyMilestoneOnChain,
  flagProjectOnChain,
} from "@/lib/soroban";
import { useWalletStore } from "@/lib/store";
import { MilestoneState, ProjectState } from "@/lib/types";
import {
  ShieldCheck,
  CheckCircle,
  XCircle,
  UploadSimple,
  Flag,
  FileText,
  ArrowUpRight,
  Vault,
  Spinner,
  Eye,
} from "@phosphor-icons/react";

interface EvidenceModalState {
  cid: string;
  desc: string;
  amount: string;
  fileName?: string;
  dataUrl?: string;
}

const emptySubscribe = () => () => {};
function useIsClient() {
  return useSyncExternalStore(
    emptySubscribe,
    () => true,
    () => false
  );
}

export default function ProjectDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const projectId = parseInt(id, 10);
  const queryClient = useQueryClient();

  const { address } = useWalletStore();
  const isClient = useIsClient();

  const [uploadingMilestoneId, setUploadingMilestoneId] = useState<number | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [txMessage, setTxMessage] = useState<string | null>(null);
  const [activeEvidence, setActiveEvidence] = useState<EvidenceModalState | null>(null);

  const activeAddress = address || "";

  const { data: project, isLoading, error } = useQuery({
    queryKey: ["project", projectId],
    queryFn: () => getProjectById(projectId),
    enabled: isClient,
    refetchInterval: 3000,
  });

  const submitProofMutation = useMutation({
    mutationFn: async ({ milestoneId, file }: { milestoneId: number; file: File }) => {
      setTxMessage("Uploading evidence photo/PDF to IPFS...");
      const formData = new FormData();
      formData.append("file", file);

      const res = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error || "Upload failed");

      setTxMessage(`Evidence pinned to IPFS (${data.cid.slice(0, 14)}...). Recording on Soroban...`);
      await submitProofOnChain(
        activeAddress,
        projectId,
        milestoneId,
        data.cid,
        data.fileName,
        data.dataUrl
      );
      return data;
    },
    onSuccess: () => {
      setTxMessage("Transaction confirmed! Proof hash & physical evidence recorded on-chain.");
      setTimeout(() => {
        setTxMessage(null);
        setUploadingMilestoneId(null);
        setSelectedFile(null);
        queryClient.invalidateQueries({ queryKey: ["project", projectId] });
      }, 1500);
    },
    onError: (err: any) => {
      setTxMessage(`Error: ${err.message}`);
    },
  });

  const voteMutation = useMutation({
    mutationFn: async ({ milestoneId, approve }: { milestoneId: number; approve: boolean }) => {
      setTxMessage(`Signing ${approve ? "Approve" : "Reject"} vote via Freighter (${activeAddress.slice(0, 8)}...)...`);
      await verifyMilestoneOnChain(activeAddress, projectId, milestoneId, approve);
    },
    onSuccess: () => {
      setTxMessage("Multisig vote registered on-chain!");
      setTimeout(() => {
        setTxMessage(null);
        queryClient.invalidateQueries({ queryKey: ["project", projectId] });
      }, 1500);
    },
    onError: (err: any) => {
      setTxMessage(`Error: ${err.message}`);
    },
  });

  const flagMutation = useMutation({
    mutationFn: async () => {
      setTxMessage("Signing public project audit flag on Soroban...");
      await flagProjectOnChain(activeAddress, projectId);
    },
    onSuccess: () => {
      setTxMessage("Project flagged on-chain for audit review!");
      setTimeout(() => {
        setTxMessage(null);
        queryClient.invalidateQueries({ queryKey: ["project", projectId] });
      }, 1500);
    },
    onError: (err: any) => {
      setTxMessage(`Error: ${err.message}`);
    },
  });

  if (isLoading) {
    return (
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="h-48 bg-white/5 border border-white/10 rounded-[2rem] animate-pulse" />
        <div className="h-64 bg-white/5 border border-white/10 rounded-[2rem] animate-pulse" />
      </div>
    );
  }

  if (error || !project) {
    return (
      <div className="p-2 bg-white/5 border border-white/10 rounded-[2rem] max-w-md mx-auto text-center">
        <div className="bg-[#0a0a0d] rounded-[calc(2rem-0.5rem)] p-8 space-y-2 border border-white/5">
          <h2 className="text-lg font-bold text-white">Project Not Found</h2>
          <p className="text-xs text-white/50">Requested project ID does not exist on Soroban Registry.</p>
        </div>
      </div>
    );
  }

  const isContractor = Boolean(activeAddress && activeAddress.toLowerCase() === project.contractor.toLowerCase());
  const isVerifier = Boolean(
    activeAddress && project.verifiers.some((v) => v.toLowerCase() === activeAddress.toLowerCase())
  );

  return (
    <div className="max-w-5xl mx-auto space-y-6 sm:space-y-10">
      {/* Header Info Card */}
      <section className="p-1.5 sm:p-2 bg-white/5 border border-white/10 rounded-[2rem] sm:rounded-[2.5rem] ambient-glow">
        <div className="bg-[#07070a] rounded-[calc(2rem-0.4rem)] sm:rounded-[calc(2.5rem-0.5rem)] p-4 sm:p-10 space-y-4 sm:space-y-6 inner-bezel-shadow border border-white/5">
          <div className="flex flex-col gap-3 border-b border-white/10 pb-4 sm:pb-6">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-mono text-xs text-white/60 font-semibold bg-white/5 px-2.5 py-0.5 rounded border border-white/10">
                Project #{project.id}
              </span>
              {project.status === ProjectState.Completed && (
                <span className="rounded-full px-3 py-1 text-xs font-bold bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
                  Completed & Released
                </span>
              )}
              {project.status === ProjectState.Flagged && (
                <span className="rounded-full px-3 py-1 text-xs font-medium bg-rose-500/15 text-rose-300 border border-rose-500/30">
                  Flagged ({project.flagCount} Flags)
                </span>
              )}
              {project.status === ProjectState.InProgress && (
                <span className="rounded-full px-3 py-1 text-xs font-medium bg-blue-500/15 text-blue-300 border border-blue-500/30">
                  In Progress
                </span>
              )}
              {project.status === ProjectState.Funded && (
                <span className="rounded-full px-3 py-1 text-xs font-medium bg-purple-500/15 text-purple-300 border border-purple-500/30">
                  Funded & Escrowed
                </span>
              )}
            </div>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <h1 className="text-xl sm:text-4xl font-extrabold text-white tracking-tight leading-tight">
                {project.name}
              </h1>
              <button
                onClick={() => flagMutation.mutate()}
                disabled={flagMutation.isPending}
                className="rounded-full px-4 py-2 bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 border border-rose-500/20 text-xs font-semibold flex items-center gap-2 transition-all disabled:opacity-50 self-start sm:self-auto shrink-0"
              >
                <Flag size={14} weight="bold" />
                <span>Flag Project ({project.flagCount})</span>
              </button>
            </div>
          </div>

          {/* Details Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
            <div className="bg-black/40 p-3 sm:p-4 rounded-2xl border border-white/5">
              <span className="text-xs text-white/40 block mb-1 font-medium">Escrowed Budget</span>
              <span className="text-lg sm:text-xl font-bold font-mono text-emerald-400">
                {project.totalBudget}
              </span>
            </div>
            <div className="bg-black/40 p-3 sm:p-4 rounded-2xl border border-white/5">
              <span className="text-xs text-white/40 block mb-1 font-medium">LGU Funder</span>
              <span className="font-mono text-white/80 block truncate text-[11px] sm:text-xs">{project.lgu}</span>
            </div>
            <div className="bg-black/40 p-3 sm:p-4 rounded-2xl border border-white/5">
              <span className="text-xs text-white/40 block mb-1 font-medium">Contractor</span>
              <span className="font-mono text-white/80 block truncate text-[11px] sm:text-xs">{project.contractor}</span>
            </div>
          </div>

          {/* Verifiers */}
          <div className="bg-black/40 p-3 sm:p-4 rounded-2xl border border-white/5 text-xs">
            <span className="text-xs text-white/40 block mb-2 font-semibold">
              Independent Verifiers (2-of-3 Multisig Threshold)
            </span>
            <div className="flex flex-col gap-2 font-mono">
              {project.verifiers.map((ver, idx) => {
                const isActive = ver.toLowerCase() === activeAddress.toLowerCase();
                return (
                  <div
                    key={idx}
                    className={`px-3 py-1.5 rounded-xl border text-[11px] sm:text-xs flex items-center justify-between transition-colors ${
                      isActive
                        ? "bg-emerald-500/15 border-emerald-500/40 text-emerald-300 font-bold"
                        : "bg-white/5 border-white/5 text-white/80"
                    }`}
                  >
                    <span className="truncate">v{idx + 1}: {ver}</span>
                    {isActive && <span className="text-[10px] uppercase font-bold text-emerald-400 shrink-0 ml-2">Active</span>}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </section>

      {/* Milestones Section */}
      <section className="space-y-4 sm:space-y-6">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center text-emerald-400 border border-white/10 shrink-0">
            <Vault size={16} weight="light" />
          </div>
          <h2 className="text-lg sm:text-2xl font-bold text-white tracking-tight">
            Milestones & Escrow Release Schedule
          </h2>
        </div>

        <div className="space-y-4">
          {project.milestones.map((milestone) => {
            const hasApproved = Boolean(activeAddress && milestone.approvals.some((a) => a.toLowerCase() === activeAddress.toLowerCase()));
            const hasRejected = Boolean(activeAddress && milestone.rejections.some((r) => r.toLowerCase() === activeAddress.toLowerCase()));
            const hasVoted = hasApproved || hasRejected;

            return (
              <div key={milestone.id} className="p-1.5 sm:p-2 bg-white/5 border border-white/10 rounded-[1.8rem] sm:rounded-[2rem] ambient-glow">
                <div className="bg-[#0a0a0d] rounded-[calc(1.8rem-0.4rem)] sm:rounded-[calc(2rem-0.5rem)] p-4 sm:p-6 space-y-4 border border-white/5">
                  <div className="flex flex-col gap-2 border-b border-white/10 pb-4">
                    <div className="flex items-start gap-3">
                      <span className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-white/10 border border-white/10 flex items-center justify-center font-mono font-bold text-xs text-white shrink-0">
                        #{milestone.id + 1}
                      </span>
                      <h3 className="font-bold text-white text-sm sm:text-base leading-snug">{milestone.desc}</h3>
                    </div>
                    <div className="flex flex-wrap items-center gap-2 pt-1">
                      <span className="font-mono font-bold text-emerald-400 text-sm">
                        {milestone.amount}
                      </span>
                      {milestone.status === MilestoneState.Verified && (
                        <span className="rounded-full px-2.5 py-0.5 text-xs font-bold bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
                          Verified & Released ({milestone.approvals.length}/2 Approvals)
                        </span>
                      )}
                      {milestone.status === MilestoneState.PendingVerification && (
                        <span className="rounded-full px-2.5 py-0.5 text-xs font-medium bg-amber-500/15 text-amber-300 border border-amber-500/30">
                          Pending Verification ({milestone.approvals.length}/2 Approvals)
                        </span>
                      )}
                      {milestone.status === MilestoneState.PendingSubmission && (
                        <span className="rounded-full px-2.5 py-0.5 text-xs font-medium bg-white/5 text-white/50 border border-white/10">
                          Awaiting Proof
                        </span>
                      )}
                      {milestone.status === MilestoneState.Rejected && (
                        <span className="rounded-full px-2.5 py-0.5 text-xs font-medium bg-rose-500/15 text-rose-300 border border-rose-500/30">
                          Rejected ({milestone.rejections.length}/2 Rejections)
                        </span>
                      )}
                    </div>
                  </div>

                  {/* IPFS Proof CID */}
                  {milestone.proofCid && (
                    <div className="bg-black/40 p-3 rounded-xl border border-white/5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs font-mono">
                      <div className="flex items-center gap-2 overflow-hidden w-full sm:w-auto">
                        <FileText size={16} className="text-emerald-400 shrink-0" />
                        <div className="flex flex-col min-w-0">
                          <span className="text-white/40 text-[10px] uppercase font-semibold">IPFS Evidence CID</span>
                          <span className="text-white/90 truncate font-bold">{milestone.proofCid}</span>
                        </div>
                      </div>
                      <button
                        onClick={() =>
                          setActiveEvidence({
                            cid: milestone.proofCid,
                            desc: milestone.desc,
                            amount: milestone.amount,
                            fileName: milestone.proofFileName,
                            dataUrl: milestone.proofFileDataUrl,
                          })
                        }
                        className="w-full sm:w-auto text-emerald-400 hover:text-emerald-300 flex items-center justify-center gap-1.5 font-semibold transition-colors bg-emerald-500/10 px-3.5 py-2 rounded-xl border border-emerald-500/20 shrink-0"
                      >
                        <Eye size={14} />
                        <span>Inspect Evidence</span>
                        <ArrowUpRight size={13} />
                      </button>
                    </div>
                  )}

                  {/* Action Buttons */}
                  <div className="pt-1">
                    {isContractor && milestone.status !== MilestoneState.Verified && (
                      <div className="flex flex-col gap-2">
                        {uploadingMilestoneId === milestone.id ? (
                          <div className="space-y-2 bg-white/5 p-3 rounded-xl border border-white/10">
                            <label className="block text-[11px] text-white/70 font-medium">
                              Select Physical Proof (Photo or PDF document):
                            </label>
                            <input
                              type="file"
                              accept="image/*,application/pdf"
                              onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
                              className="text-xs text-white/70 file:mr-3 file:py-1.5 file:px-4 file:rounded-full file:border-0 file:text-xs file:font-semibold file:bg-white file:text-black hover:file:bg-white/90 cursor-pointer w-full"
                            />
                            <div className="flex gap-2 pt-1">
                              <button
                                disabled={!selectedFile || submitProofMutation.isPending}
                                onClick={() =>
                                  selectedFile &&
                                  submitProofMutation.mutate({ milestoneId: milestone.id, file: selectedFile })
                                }
                                className="flex-1 rounded-full py-2 bg-emerald-500 text-black font-semibold text-xs hover:bg-emerald-400 transition-all disabled:opacity-50"
                              >
                                {submitProofMutation.isPending ? "Submitting..." : "Submit Proof"}
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  setUploadingMilestoneId(null);
                                  setSelectedFile(null);
                                }}
                                className="px-4 py-2 rounded-full bg-white/10 text-white text-xs font-semibold hover:bg-white/20 transition-all"
                              >
                                Cancel
                              </button>
                            </div>
                          </div>
                        ) : (
                          <button
                            onClick={() => setUploadingMilestoneId(milestone.id)}
                            className="w-full rounded-full pl-5 pr-2 py-2.5 bg-white text-black font-semibold text-xs flex items-center justify-center gap-3 group hover:bg-white/90 transition-all"
                          >
                            <span>Submit Work Proof</span>
                            <div className="w-6 h-6 rounded-full bg-black/10 flex items-center justify-center">
                              <UploadSimple size={13} weight="bold" />
                            </div>
                          </button>
                        )}
                      </div>
                    )}

                    {isVerifier && milestone.status === MilestoneState.PendingVerification && (
                      <div className="flex flex-col sm:flex-row gap-2">
                        {hasVoted ? (
                          <div className="w-full bg-white/5 border border-white/10 rounded-xl p-2.5 text-center text-xs text-white/60 font-mono">
                            You voted ({hasApproved ? "Approved" : "Rejected"}) for this milestone
                          </div>
                        ) : (
                          <>
                            <button
                              onClick={() => voteMutation.mutate({ milestoneId: milestone.id, approve: true })}
                              disabled={voteMutation.isPending}
                              className="flex-1 rounded-full py-2.5 bg-emerald-500 text-black font-semibold text-xs hover:bg-emerald-400 transition-all flex items-center justify-center gap-1.5 shadow-lg"
                            >
                              <CheckCircle size={15} weight="bold" />
                              <span>Approve Milestone ({milestone.approvals.length}/2)</span>
                            </button>
                            <button
                              onClick={() => voteMutation.mutate({ milestoneId: milestone.id, approve: false })}
                              disabled={voteMutation.isPending}
                              className="flex-1 rounded-full py-2.5 bg-rose-500/20 text-rose-300 border border-rose-500/30 font-semibold text-xs hover:bg-rose-500/30 transition-all flex items-center justify-center gap-1.5"
                            >
                              <XCircle size={15} weight="bold" />
                              <span>Reject</span>
                            </button>
                          </>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Evidence Inspection Modal */}
      {activeEvidence && (
        <div className="fixed inset-0 bg-black/85 backdrop-blur-xl z-50 flex items-center justify-center p-4">
          <div className="p-2 bg-white/10 border border-white/20 rounded-[2rem] max-w-xl w-full text-left shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="bg-[#0a0a0d] rounded-[calc(2rem-0.5rem)] p-5 sm:p-7 space-y-5 border border-white/10 relative">
              <button
                onClick={() => setActiveEvidence(null)}
                className="absolute top-5 right-5 text-white/50 hover:text-white transition-colors bg-white/5 p-2 rounded-full border border-white/10"
              >
                <XCircle size={20} />
              </button>

              <div>
                <div className="flex items-center gap-2 text-emerald-400 text-xs font-mono font-bold uppercase tracking-wider mb-1">
                  <ShieldCheck size={16} />
                  <span>On-Chain Evidence Inspection</span>
                </div>
                <h3 className="text-base sm:text-lg font-bold text-white leading-snug">{activeEvidence.desc}</h3>
                <p className="text-xs text-white/50 mt-1">
                  Milestone Release Value: <span className="text-emerald-400 font-mono font-bold">{activeEvidence.amount}</span>
                </p>
              </div>

              {/* Physical Evidence Photo / PDF Embedded Viewer */}
              {activeEvidence.dataUrl && (
                <div className="space-y-2 bg-black/60 p-3 rounded-2xl border border-white/10">
                  <div className="text-[11px] text-white/60 font-semibold uppercase tracking-wider flex items-center justify-between">
                    <span>Attached Physical Proof</span>
                    {activeEvidence.fileName && <span className="text-emerald-400 font-mono">{activeEvidence.fileName}</span>}
                  </div>
                  {activeEvidence.dataUrl.startsWith("data:image/") ? (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img
                      src={activeEvidence.dataUrl}
                      alt="Physical Work Proof Evidence"
                      className="max-h-72 w-full object-contain rounded-xl border border-white/10 bg-black"
                    />
                  ) : activeEvidence.dataUrl.startsWith("data:application/pdf") ? (
                    <iframe
                      src={activeEvidence.dataUrl}
                      title="PDF Evidence Document"
                      className="w-full h-72 rounded-xl border border-white/10 bg-white"
                    />
                  ) : (
                    <div className="p-4 bg-white/5 rounded-xl border border-white/10 text-center text-xs text-white/80 font-mono">
                      File: {activeEvidence.fileName || "Uploaded Evidence Document"}
                    </div>
                  )}
                </div>
              )}

              <div className="space-y-2 bg-white/5 p-4 rounded-xl border border-white/5 font-mono text-xs">
                <div className="text-white/40 uppercase text-[10px] tracking-wider font-semibold">
                  Cryptographic IPFS Address (CID)
                </div>
                <div className="text-white font-bold break-all bg-black/50 p-2.5 rounded-lg border border-white/10 text-[11px]">
                  {activeEvidence.cid}
                </div>
              </div>

              <div className="space-y-2">
                <div className="text-xs text-white/60 font-medium">Verified Gateway Resolution Links:</div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <a
                    href={`https://ipfs.io/ipfs/${activeEvidence.cid}`}
                    target="_blank"
                    rel="noreferrer"
                    className="p-3 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-semibold text-white flex items-center justify-between transition-colors"
                  >
                    <span>IPFS Public Gateway</span>
                    <ArrowUpRight size={14} className="text-emerald-400" />
                  </a>
                  <a
                    href={`https://dweb.link/ipfs/${activeEvidence.cid}`}
                    target="_blank"
                    rel="noreferrer"
                    className="p-3 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-semibold text-white flex items-center justify-between transition-colors"
                  >
                    <span>DWeb Gateway</span>
                    <ArrowUpRight size={14} className="text-emerald-400" />
                  </a>
                </div>
              </div>

              <div className="pt-2 text-center">
                <button
                  onClick={() => setActiveEvidence(null)}
                  className="w-full py-2.5 rounded-xl bg-white text-black font-bold text-xs hover:bg-white/90 transition-colors"
                >
                  Close Inspection Window
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Transaction Modal Overlay */}
      {txMessage && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-2xl z-50 flex items-center justify-center p-4">
          <div className="p-2 bg-white/10 border border-white/20 rounded-[2rem] max-w-sm w-full text-center shadow-2xl">
            <div className="bg-[#0a0a0d] rounded-[calc(2rem-0.5rem)] p-8 space-y-4 border border-white/10">
              <Spinner size={36} className="animate-spin text-emerald-400 mx-auto" />
              <p className="text-sm font-semibold text-white">{txMessage}</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
