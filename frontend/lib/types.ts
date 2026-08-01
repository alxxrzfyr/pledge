export enum ProjectState {
  Funded = 0,
  InProgress = 1,
  Completed = 2,
  Flagged = 3,
}

export enum MilestoneState {
  PendingSubmission = 0,
  PendingVerification = 1,
  Verified = 2,
  Rejected = 3,
}

export interface Milestone {
  id: number;
  desc: string;
  amount: string; // XLM or token amount formatted
  rawAmount: bigint;
  status: MilestoneState;
  proofCid: string;
  approvals: string[];
  rejections: string[];
}

export interface Project {
  id: number;
  name: string;
  lgu: string;
  contractor: string;
  verifiers: string[];
  milestones: Milestone[];
  status: ProjectState;
  flagCount: number;
  token: string;
  totalBudget: string;
}

export const MOCK_PROJECTS: Project[] = [
  {
    id: 1,
    name: "Barangay San Jose Health Center Expansion",
    lgu: "GBX7...LGU1",
    contractor: "GCON...BUILD",
    verifiers: ["GVER...ENG1", "GVER...BRGY2", "GVER...AUD3"],
    status: ProjectState.InProgress,
    flagCount: 0,
    token: "NATIVE",
    totalBudget: "500,000 XLM",
    milestones: [
      {
        id: 0,
        desc: "Site clearing and foundation excavation",
        amount: "150,000 XLM",
        rawAmount: 1500000000000n,
        status: MilestoneState.Verified,
        proofCid: "bafkreibm6f2qg7fptqsk2y43fzq6m4s4z6f5e2k1a3b5c7d9e0f1a2b3c4",
        approvals: ["GVER...ENG1", "GVER...BRGY2"],
        rejections: [],
      },
      {
        id: 1,
        desc: "Structural concrete pouring & steel framing",
        amount: "200,000 XLM",
        rawAmount: 2000000000000n,
        status: MilestoneState.PendingVerification,
        proofCid: "bafybeigdyrzt5sfp7udm7hu76uh7y26nf3efuylqabf3oclgtqy55fbzdi",
        approvals: ["GVER...ENG1"],
        rejections: [],
      },
      {
        id: 2,
        desc: "Roofing, electrical wiring & plumbing installation",
        amount: "150,000 XLM",
        rawAmount: 1500000000000n,
        status: MilestoneState.PendingSubmission,
        proofCid: "",
        approvals: [],
        rejections: [],
      },
    ],
  },
  {
    id: 2,
    name: "Poblacion Farm-to-Market Road Concrete Paving",
    lgu: "GBX7...LGU1",
    contractor: "GCON...PAVE",
    verifiers: ["GVER...ENG1", "GVER...BRGY2", "GVER...AUD3"],
    status: ProjectState.Funded,
    flagCount: 0,
    token: "NATIVE",
    totalBudget: "1,200,000 XLM",
    milestones: [
      {
        id: 0,
        desc: "Subgrade preparation & aggregate base course",
        amount: "400,000 XLM",
        rawAmount: 4000000000000n,
        status: MilestoneState.PendingSubmission,
        proofCid: "",
        approvals: [],
        rejections: [],
      },
      {
        id: 1,
        desc: "Portland cement concrete pavement pouring (2.5 km)",
        amount: "800,000 XLM",
        rawAmount: 8000000000000n,
        status: MilestoneState.PendingSubmission,
        proofCid: "",
        approvals: [],
        rejections: [],
      },
    ],
  },
  {
    id: 3,
    name: "Santa Cruz Solar-Powered Drainage Pump Station",
    lgu: "GBX7...LGU1",
    contractor: "GCON...HYDRO",
    verifiers: ["GVER...ENG1", "GVER...BRGY2", "GVER...AUD3"],
    status: ProjectState.Flagged,
    flagCount: 3,
    token: "NATIVE",
    totalBudget: "750,000 XLM",
    milestones: [
      {
        id: 0,
        desc: "Pump housing structure and concrete basin",
        amount: "250,000 XLM",
        rawAmount: 2500000000000n,
        status: MilestoneState.Rejected,
        proofCid: "QmZTR5b9EGv24b6z6yB56zS5P8W82a5c531",
        approvals: [],
        rejections: ["GVER...ENG1", "GVER...AUD3"],
      },
      {
        id: 1,
        desc: "Solar array installation & inverter testing",
        amount: "500,000 XLM",
        rawAmount: 5000000000000n,
        status: MilestoneState.PendingSubmission,
        proofCid: "",
        approvals: [],
        rejections: [],
      },
    ],
  },
];
