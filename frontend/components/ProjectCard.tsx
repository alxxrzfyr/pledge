import Link from "next/link";
import { Project, ProjectState, MilestoneState } from "@/lib/types";
import { ArrowUpRight, ShieldCheck, Vault, Clock, CheckCircle, Warning } from "@phosphor-icons/react/dist/ssr";

interface ProjectCardProps {
  project: Project;
  className?: string;
}

export function ProjectCard({ project, className = "" }: ProjectCardProps) {
  const verifiedCount = project.milestones.filter(
    (m) => m.status === MilestoneState.Verified
  ).length;
  const totalMilestones = project.milestones.length;
  const progressPct = totalMilestones > 0 ? (verifiedCount / totalMilestones) * 100 : 0;

  const renderStatusBadge = () => {
    switch (project.status) {
      case ProjectState.Funded:
        return (
          <span className="rounded-full px-3 py-1 text-xs font-medium bg-blue-500/15 text-blue-300 border border-blue-500/30 inline-flex items-center gap-1.5">
            <Vault size={14} weight="light" /> Funded
          </span>
        );
      case ProjectState.InProgress:
        return (
          <span className="rounded-full px-3 py-1 text-xs font-medium bg-amber-500/15 text-amber-300 border border-amber-500/30 inline-flex items-center gap-1.5">
            <Clock size={14} weight="light" /> In Progress
          </span>
        );
      case ProjectState.Completed:
        return (
          <span className="rounded-full px-3 py-1 text-xs font-bold bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 inline-flex items-center gap-1.5">
            <CheckCircle size={14} weight="light" /> Verified & Released
          </span>
        );
      case ProjectState.Flagged:
        return (
          <span className="rounded-full px-3 py-1 text-xs font-medium bg-rose-500/15 text-rose-300 border border-rose-500/30 inline-flex items-center gap-1.5">
            <Warning size={14} weight="light" /> Flagged ({project.flagCount})
          </span>
        );
    }
  };

  return (
    <div className={`p-1.5 sm:p-2 bg-white/5 border border-white/10 rounded-[1.8rem] sm:rounded-[2.2rem] ambient-glow transition-all duration-700 ease-fluid group ${className}`}>
      {/* Inner Core */}
      <div className="bg-[#09090d] rounded-[calc(1.8rem-0.4rem)] sm:rounded-[calc(2.2rem-0.5rem)] p-4 sm:p-6 space-y-4 sm:space-y-5 inner-bezel-shadow border border-white/5 flex flex-col justify-between h-full">
        <div>
          {/* Header Badges */}
          <div className="flex items-center justify-between gap-2 mb-3 flex-wrap">
            {renderStatusBadge()}
            <span className="font-mono text-xs font-semibold text-white/90 bg-white/5 px-2.5 py-1 rounded-full border border-white/10 shadow-sm shrink-0">
              {project.totalBudget}
            </span>
          </div>

          {/* Project Title */}
          <h3 className="text-base sm:text-xl font-bold text-white tracking-tight leading-snug group-hover:text-emerald-300 transition-colors mb-3">
            {project.name}
          </h3>

          {/* Addresses Meta Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs bg-black/40 p-3 rounded-2xl border border-white/5 mb-4">
            <div className="min-w-0">
              <span className="text-[11px] text-white/40 font-medium block mb-0.5">
                Funder
              </span>
              <span className="font-mono text-white/80 block truncate">{project.lgu}</span>
            </div>
            <div className="min-w-0">
              <span className="text-[11px] text-white/40 font-medium block mb-0.5">
                Contractor
              </span>
              <span className="font-mono text-white/80 block truncate">{project.contractor}</span>
            </div>
          </div>

          {/* Progress Bar */}
          <div className="space-y-1.5 mb-2">
            <div className="flex justify-between items-center text-xs">
              <span className="text-white/50 text-[11px] font-medium">Milestones</span>
              <span className="text-white font-mono font-semibold text-[11px]">
                {verifiedCount}/{totalMilestones} Verified
              </span>
            </div>
            <div className="w-full h-2 bg-white/10 rounded-full overflow-hidden p-0.5">
              <div
                className="h-full bg-gradient-to-r from-emerald-400 via-teal-400 to-cyan-400 rounded-full transition-all duration-700 ease-fluid shadow-[0_0_10px_rgba(16,185,129,0.5)]"
                style={{ width: `${progressPct}%` }}
              />
            </div>
          </div>
        </div>

        {/* Footer Button-in-Button */}
        <div className="flex items-center justify-between border-t border-white/10 pt-3.5 gap-2">
          <div className="flex items-center gap-1 text-xs text-white/40 min-w-0">
            <ShieldCheck size={14} weight="light" className="shrink-0" />
            <span className="text-[11px] font-mono truncate">{project.flagCount} Flags</span>
          </div>

          <Link
            href={`/project/${project.id}`}
            className="rounded-full pl-3 sm:pl-4 pr-1.5 py-1.5 bg-white/10 hover:bg-white text-white hover:text-black font-semibold text-xs flex items-center gap-1.5 transition-all active:scale-[0.98] shrink-0"
          >
            <span>Details</span>
            <div className="w-5 h-5 sm:w-6 sm:h-6 rounded-full bg-white/10 group-hover:bg-black/10 flex items-center justify-center transition-all group-hover:translate-x-0.5 group-hover:-translate-y-0.5 shrink-0">
              <ArrowUpRight size={12} weight="bold" />
            </div>
          </Link>
        </div>
      </div>
    </div>
  );
}
