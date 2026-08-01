import {
  rpc,
  scValToNative,
  nativeToScVal,
  xdr,
  Contract,
  TransactionBuilder,
  Address,
} from "@stellar/stellar-sdk";
import { signTransaction } from "@stellar/freighter-api";
import { Project, Milestone, ProjectState, MilestoneState, MOCK_PROJECTS } from "./types";

export const SOROBAN_RPC_URL =
  process.env.NEXT_PUBLIC_SOROBAN_RPC_URL || "https://soroban-testnet.stellar.org";
export const NETWORK_PASSPHRASE =
  process.env.NEXT_PUBLIC_NETWORK_PASSPHRASE || "Test SDF Network ; September 2015";
export const REGISTRY_CONTRACT_ID =
  process.env.NEXT_PUBLIC_REGISTRY_CONTRACT_ID || "";
export const TREASURY_CONTRACT_ID =
  process.env.NEXT_PUBLIC_TREASURY_CONTRACT_ID || "";

export const server = new rpc.Server(SOROBAN_RPC_URL);

/**
 * Helper to extract signed XDR string safely from Freighter API response
 */
function getSignedXdr(signRes: any): string {
  if (typeof signRes === "string") return signRes;
  if (signRes && typeof signRes === "object") {
    if (signRes.signedTxXdr) return signRes.signedTxXdr;
    if (signRes.signedTx) return signRes.signedTx;
    if (signRes.error) throw new Error(signRes.error);
  }
  throw new Error("Failed to sign transaction with Freighter");
}

/**
 * Fetch project details from Soroban RPC or fallback to MOCK_PROJECTS
 */
export async function getProjectById(id: number): Promise<Project> {
  if (!REGISTRY_CONTRACT_ID) {
    const mock = MOCK_PROJECTS.find((p) => p.id === id);
    if (mock) return mock;
    throw new Error(`Project ${id} not found`);
  }

  try {
    const tx = await server.getContractData(
      REGISTRY_CONTRACT_ID,
      xdr.ScVal.scvVec([
        xdr.ScVal.scvSymbol("Project"),
        xdr.ScVal.scvU32(id),
      ]),
      "persistent" as any
    );

    if (tx && (tx as any).val) {
      const val = (tx as any).val.contractData ? (tx as any).val.contractData().val() : (tx as any).val;
      const native = scValToNative(val as xdr.ScVal);
      return parseProjectNative(native);
    }
  } catch (err) {
    console.warn(`RPC fetch for project ${id} failed, returning mock fallback:`, err);
  }

  const mock = MOCK_PROJECTS.find((p) => p.id === id);
  if (mock) return mock;
  throw new Error(`Project ${id} not found`);
}

/**
 * Fetch all projects list from Soroban RPC or fallback to MOCK_PROJECTS
 */
export async function getAllProjects(): Promise<Project[]> {
  if (!REGISTRY_CONTRACT_ID) {
    return MOCK_PROJECTS;
  }

  try {
    const countTx = await server.getContractData(
      REGISTRY_CONTRACT_ID,
      xdr.ScVal.scvSymbol("ProjectCount"),
      "instance" as any
    );

    if (countTx && (countTx as any).val) {
      const val = (countTx as any).val.contractData ? (countTx as any).val.contractData().val() : (countTx as any).val;
      const count = scValToNative(val as xdr.ScVal) as number;
      const projects: Project[] = [];
      for (let i = 1; i <= count; i++) {
        try {
          const proj = await getProjectById(i);
          projects.push(proj);
        } catch (e) {
          console.error(`Failed loading project ${i}`, e);
        }
      }
      if (projects.length > 0) return projects;
    }
  } catch (err) {
    console.warn("RPC fetch for all projects failed, using mock data:", err);
  }

  return MOCK_PROJECTS;
}

/**
 * Real Soroban Contract Invocation: Create Project
 */
export async function createProjectOnChain(
  funder: string,
  name: string,
  contractor: string,
  verifiers: string[],
  milestonesDesc: string[],
  milestonesAmounts: number[],
  tokenAddress: string
): Promise<string> {
  if (!REGISTRY_CONTRACT_ID) {
    await new Promise((resolve) => setTimeout(resolve, 2000));
    return "simulated_tx_hash";
  }

  const contract = new Contract(REGISTRY_CONTRACT_ID);
  const account = await server.getAccount(funder);

  const tx = new TransactionBuilder(account, {
    fee: "10000",
    networkPassphrase: NETWORK_PASSPHRASE,
  })
    .addOperation(
      contract.call(
        "create_project",
        new Address(funder).toScVal(),
        nativeToScVal(name),
        new Address(contractor).toScVal(),
        nativeToScVal(verifiers.map((v) => new Address(v))),
        nativeToScVal(milestonesDesc),
        nativeToScVal(milestonesAmounts),
        new Address(tokenAddress).toScVal()
      )
    )
    .setTimeout(30)
    .build();

  const preparedTx = await server.prepareTransaction(tx);
  const signRes = await signTransaction(preparedTx.toXDR(), {
    networkPassphrase: NETWORK_PASSPHRASE,
  });

  const signedXdr = getSignedXdr(signRes);
  const sendRes = await server.sendTransaction(
    TransactionBuilder.fromXDR(signedXdr, NETWORK_PASSPHRASE)
  );

  if (sendRes.status === "PENDING") {
    let getRes = await server.getTransaction(sendRes.hash);
    while (getRes.status === "NOT_FOUND") {
      await new Promise((resolve) => setTimeout(resolve, 1000));
      getRes = await server.getTransaction(sendRes.hash);
    }
    return sendRes.hash;
  }

  throw new Error("Transaction submission failed");
}

/**
 * Real Soroban Contract Invocation: Submit Proof
 */
export async function submitProofOnChain(
  contractor: string,
  projectId: number,
  milestoneId: number,
  evidenceIpfsCid: string
): Promise<string> {
  if (!REGISTRY_CONTRACT_ID) {
    await new Promise((resolve) => setTimeout(resolve, 1500));
    return "simulated_tx_hash";
  }

  const contract = new Contract(REGISTRY_CONTRACT_ID);
  const account = await server.getAccount(contractor);

  const tx = new TransactionBuilder(account, {
    fee: "10000",
    networkPassphrase: NETWORK_PASSPHRASE,
  })
    .addOperation(
      contract.call(
        "submit_proof",
        new Address(contractor).toScVal(),
        nativeToScVal(projectId),
        nativeToScVal(milestoneId),
        nativeToScVal(evidenceIpfsCid)
      )
    )
    .setTimeout(30)
    .build();

  const preparedTx = await server.prepareTransaction(tx);
  const signRes = await signTransaction(preparedTx.toXDR(), {
    networkPassphrase: NETWORK_PASSPHRASE,
  });

  const signedXdr = getSignedXdr(signRes);
  const sendRes = await server.sendTransaction(
    TransactionBuilder.fromXDR(signedXdr, NETWORK_PASSPHRASE)
  );
  return sendRes.hash;
}

/**
 * Real Soroban Contract Invocation: Verify Milestone Vote (Approve / Reject)
 */
export async function verifyMilestoneOnChain(
  verifier: string,
  projectId: number,
  milestoneId: number,
  approve: boolean
): Promise<string> {
  if (!REGISTRY_CONTRACT_ID) {
    await new Promise((resolve) => setTimeout(resolve, 1500));
    return "simulated_tx_hash";
  }

  const contract = new Contract(REGISTRY_CONTRACT_ID);
  const account = await server.getAccount(verifier);

  const tx = new TransactionBuilder(account, {
    fee: "10000",
    networkPassphrase: NETWORK_PASSPHRASE,
  })
    .addOperation(
      contract.call(
        "verify_milestone",
        new Address(verifier).toScVal(),
        nativeToScVal(projectId),
        nativeToScVal(milestoneId),
        nativeToScVal(approve)
      )
    )
    .setTimeout(30)
    .build();

  const preparedTx = await server.prepareTransaction(tx);
  const signRes = await signTransaction(preparedTx.toXDR(), {
    networkPassphrase: NETWORK_PASSPHRASE,
  });

  const signedXdr = getSignedXdr(signRes);
  const sendRes = await server.sendTransaction(
    TransactionBuilder.fromXDR(signedXdr, NETWORK_PASSPHRASE)
  );
  return sendRes.hash;
}

/**
 * Real Soroban Contract Invocation: Flag Project
 */
export async function flagProjectOnChain(
  caller: string,
  projectId: number
): Promise<string> {
  if (!REGISTRY_CONTRACT_ID) {
    await new Promise((resolve) => setTimeout(resolve, 1500));
    return "simulated_tx_hash";
  }

  const contract = new Contract(REGISTRY_CONTRACT_ID);
  const account = await server.getAccount(caller);

  const tx = new TransactionBuilder(account, {
    fee: "10000",
    networkPassphrase: NETWORK_PASSPHRASE,
  })
    .addOperation(
      contract.call(
        "flag_project",
        new Address(caller).toScVal(),
        nativeToScVal(projectId)
      )
    )
    .setTimeout(30)
    .build();

  const preparedTx = await server.prepareTransaction(tx);
  const signRes = await signTransaction(preparedTx.toXDR(), {
    networkPassphrase: NETWORK_PASSPHRASE,
  });

  const signedXdr = getSignedXdr(signRes);
  const sendRes = await server.sendTransaction(
    TransactionBuilder.fromXDR(signedXdr, NETWORK_PASSPHRASE)
  );
  return sendRes.hash;
}

function parseProjectNative(native: any): Project {
  const milestones: Milestone[] = (native.milestones || []).map((m: any) => ({
    id: Number(m.id),
    desc: String(m.description || m.desc),
    amount: `${(Number(m.amount) / 10000000).toLocaleString()} XLM`,
    rawAmount: BigInt(m.amount),
    status: Number(m.status) as MilestoneState,
    proofCid: String(m.evidence_ipfs_cid || m.proof_cid || ""),
    approvals: (m.approvals || []).map(String),
    rejections: (m.rejections || []).map(String),
  }));

  const totalRaw = milestones.reduce((sum, m) => sum + m.rawAmount, BigInt(0));

  return {
    id: Number(native.id),
    name: String(native.name),
    lgu: String(native.funder || native.lgu),
    contractor: String(native.contractor),
    verifiers: (native.verifiers || []).map(String),
    milestones,
    status: Number(native.status) as ProjectState,
    flagCount: Number(native.flag_count || 0),
    token: String(native.token),
    totalBudget: `${(Number(totalRaw) / 10000000).toLocaleString()} XLM`,
  };
}
