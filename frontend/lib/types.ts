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
  proofFileName?: string;
  proofFileDataUrl?: string;
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

export const MOCK_PROJECTS: Project[] = [];
