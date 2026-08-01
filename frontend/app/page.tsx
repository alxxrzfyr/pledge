"use client";

import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { getAllProjects } from "@/lib/soroban";
import { ProjectCard } from "@/components/ProjectCard";
import { ProjectState } from "@/lib/types";
import { MagnifyingGlass, ArrowUpRight } from "@phosphor-icons/react";
import Link from "next/link";

export default function HomePage() {
  const [activeTab, setActiveTab] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState<string>("");

  const { data: projects = [], isLoading } = useQuery({
    queryKey: ["projects"],
    queryFn: getAllProjects,
    refetchInterval: 5000,
  });

  const filteredProjects = useMemo(() => {
    return projects.filter((p) => {
      const matchesSearch =
        p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.contractor.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.lgu.toLowerCase().includes(searchQuery.toLowerCase());

      if (!matchesSearch) return false;

      if (activeTab === "in_progress") return p.status === ProjectState.InProgress;
      if (activeTab === "funded") return p.status === ProjectState.Funded;
      if (activeTab === "completed") return p.status === ProjectState.Completed;
      if (activeTab === "flagged") return p.status === ProjectState.Flagged;
      return true;
    });
  }, [projects, activeTab, searchQuery]);

  const stats = useMemo(() => {
    const totalProjects = projects.length;
    const completedProjects = projects.filter((p) => p.status === ProjectState.Completed).length;
    const totalFlags = projects.reduce((acc, p) => acc + p.flagCount, 0);
    return { totalProjects, completedProjects, totalFlags };
  }, [projects]);

  return (
    <div className="space-y-8 sm:space-y-16 py-2 sm:py-6">
      {/* Hero Section — Clean & Authentic */}
      <section className="p-1.5 sm:p-2 bg-white/5 border border-white/10 rounded-3xl sm:rounded-[2.5rem] ambient-glow relative overflow-hidden">
        <div className="bg-[#07070b] rounded-[calc(1.5rem-0.2rem)] sm:rounded-[calc(2.5rem-0.5rem)] p-4 sm:p-14 space-y-6 sm:space-y-8 inner-bezel-shadow relative overflow-hidden">
          {/* Ambient Lighting */}
          <div className="absolute -top-24 -right-24 w-96 h-96 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute -bottom-24 -left-24 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />

          <div className="max-w-3xl space-y-4 sm:space-y-6 relative z-10">
            <h1 className="text-2xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight text-white leading-[1.15] sm:leading-[1.1]">
              Every fund tracked. <br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-white via-emerald-200 to-emerald-400">
                Every milestone verified.
              </span>
            </h1>

            <p className="text-white/70 text-xs sm:text-base leading-relaxed max-w-[55ch]">
              Public infrastructure fund tracker on Stellar Soroban. Funds remain escrowed and only release upon 2-of-3 independent verification of physical work proof.
            </p>

            <div className="pt-1 sm:pt-2 flex items-center gap-3 flex-wrap">
              <Link
                href="/create"
                className="rounded-full pl-5 sm:pl-6 pr-2 py-2.5 sm:py-3 bg-white text-black font-semibold text-xs sm:text-sm flex items-center gap-2.5 sm:gap-3 group hover:bg-white/90 active:scale-[0.98] transition-all shadow-xl"
              >
                <span>Deploy Project</span>
                <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-black/10 flex items-center justify-center text-black group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform shrink-0">
                  <ArrowUpRight size={14} weight="bold" />
                </div>
              </Link>
            </div>
          </div>

          {/* Stats Bar */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-4 pt-4 sm:pt-8 border-t border-white/10 relative z-10">
            <div className="bg-white/5 p-2.5 sm:p-4 rounded-2xl border border-white/5">
              <span className="text-[11px] sm:text-xs text-white/50 font-medium block mb-0.5 sm:mb-1 truncate">
                Tracked Projects
              </span>
              <span className="text-lg sm:text-2xl font-extrabold font-mono text-white">{stats.totalProjects}</span>
            </div>

            <div className="bg-white/5 p-2.5 sm:p-4 rounded-2xl border border-white/5">
              <span className="text-[11px] sm:text-xs text-white/50 font-medium block mb-0.5 sm:mb-1 truncate">
                Fully Released
              </span>
              <span className="text-lg sm:text-2xl font-extrabold font-mono text-emerald-400">{stats.completedProjects}</span>
            </div>

            <div className="bg-white/5 p-2.5 sm:p-4 rounded-2xl border border-white/5">
              <span className="text-[11px] sm:text-xs text-white/50 font-medium block mb-0.5 sm:mb-1 truncate">
                Citizen Flags
              </span>
              <span className="text-lg sm:text-2xl font-extrabold font-mono text-rose-400">{stats.totalFlags}</span>
            </div>

            <div className="bg-white/5 p-2.5 sm:p-4 rounded-2xl border border-white/5">
              <span className="text-[11px] sm:text-xs text-white/50 font-medium block mb-0.5 sm:mb-1 truncate">
                Multisig Threshold
              </span>
              <span className="text-lg sm:text-2xl font-extrabold font-mono text-white">2-of-3</span>
            </div>
          </div>
        </div>
      </section>

      {/* Search & Filter Controls */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 sm:gap-4">
        {/* Search */}
        <div className="relative flex-1 w-full max-w-md">
          <MagnifyingGlass
            size={16}
            className="absolute left-3.5 top-1/2 -translate-y-1/2 text-white/40"
          />
          <input
            type="text"
            placeholder="Search projects, funders, contractors..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-white/5 border border-white/10 rounded-full pl-10 pr-4 py-2.5 text-xs text-white placeholder:text-white/40 focus:outline-none focus:border-white/30 transition-all backdrop-blur-xl"
          />
        </div>

        {/* Filter Buttons */}
        <div className="flex items-center gap-1 bg-white/5 p-1 rounded-2xl sm:rounded-full border border-white/10 overflow-x-auto no-scrollbar max-w-full">
          {[
            { id: "all", label: "All" },
            { id: "in_progress", label: "In Progress" },
            { id: "funded", label: "Funded" },
            { id: "completed", label: "Completed" },
            { id: "flagged", label: "Flagged" },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-3 sm:px-4 py-1.5 rounded-full text-[11px] sm:text-xs font-semibold transition-all whitespace-nowrap shrink-0 ${
                activeTab === tab.id
                  ? "bg-white text-black shadow-md"
                  : "text-white/60 hover:text-white hover:bg-white/10"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Projects Grid */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
          <div className="md:col-span-8 h-80 bg-white/5 border border-white/10 rounded-[2.2rem] animate-pulse" />
          <div className="md:col-span-4 h-80 bg-white/5 border border-white/10 rounded-[2.2rem] animate-pulse" />
        </div>
      ) : filteredProjects.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
          {filteredProjects.map((project, idx) => {
            let colSpan = "md:col-span-6";
            if (idx === 0 && filteredProjects.length > 1) colSpan = "md:col-span-8";
            else if (idx === 1 && filteredProjects.length > 1) colSpan = "md:col-span-4";

            return (
              <ProjectCard key={project.id} project={project} className={colSpan} />
            );
          })}
        </div>
      ) : (
        <div className="p-2 bg-white/5 border border-white/10 rounded-[2rem] max-w-md mx-auto text-center">
          <div className="bg-[#0a0a0d] rounded-[calc(2rem-0.5rem)] p-8 space-y-2 border border-white/5">
            <p className="text-white font-semibold">No matching projects found</p>
            <p className="text-xs text-white/50">Try adjusting your search terms or active filters.</p>
          </div>
        </div>
      )}
    </div>
  );
}
