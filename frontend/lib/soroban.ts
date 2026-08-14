import {
  rpc,
  scValToNative,
  nativeToScVal,
  xdr,
  Contract,
  TransactionBuilder,
  Address,
  Account,
  StrKey,
} from "@stellar/stellar-sdk";
import { signTransaction } from "@stellar/freighter-api";
import { Project, Milestone, ProjectState, MilestoneState, MOCK_PROJECTS } from "./types";

export const SOROBAN_RPC_URL =
  process.env.NEXT_PUBLIC_SOROBAN_RPC_URL || "https://soroban-testnet.stellar.org";
export const NETWORK_PASSPHRASE =
  process.env.NEXT_PUBLIC_NETWORK_PASSPHRASE || "Test SDF Network ; September 2015";
export const REGISTRY_CONTRACT_ID = process.env.NEXT_PUBLIC_REGISTRY_CONTRACT_ID || "";
export const TREASURY_CONTRACT_ID = process.env.NEXT_PUBLIC_TREASURY_CONTRACT_ID || "";

/**
 * Contract address of the native XLM Stellar Asset Contract on Testnet.
 *
 * This MUST match the token the Treasury contract was initialized with,
 * otherwise create_project's token transfer targets a different asset than
 * the one Treasury.release can pay out, and the escrow becomes unspendable.
 * Verified against the deployed Treasury via `Treasury.get_token()`:
 *   CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC
 *
 * Overridable so a Mainnet or custom-token deployment does not require a
 * code change. Defined here rather than inline in a component so the value
 * cannot drift between call sites.
 */
export const NATIVE_XLM_SAC =
  process.env.NEXT_PUBLIC_NATIVE_TOKEN_ID ||
  "CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC";

/**
 * True when `value` is a well-formed Stellar account public key (G...).
 * Checks the StrKey checksum, so a truncated or mistyped address is caught
 * before it reaches `new Address()`, which throws an opaque
 * "Unsupported address type" error that is hard to trace back to the input.
 */
export function isValidStellarAccount(value: string): boolean {
  try {
    return StrKey.isValidEd25519PublicKey(value.trim());
  } catch {
    return false;
  }
}

/**
 * True when `value` is a well-formed Soroban contract address (C...).
 */
export function isValidContractAddress(value: string): boolean {
  try {
    return StrKey.isValidContract(value.trim());
  } catch {
    return false;
  }
}

/**
 * DEMO_MODE is true whenever no Registry contract is configured. In that
 * case every "on-chain" action in this file operates purely on a local
 * browser store and returns a synthetic transaction reference, and every
 * caller-facing surface must make that fact visible to the user (see
 * useWalletStore / Navbar demo-mode banner). This is the ONLY situation in
 * which a synthetic result is returned; once a contract ID is configured,
 * every function below propagates real RPC/contract errors to the caller
 * instead of silently falling back to demo behavior.
 */
export const DEMO_MODE = !REGISTRY_CONTRACT_ID;

export const server = new rpc.Server(SOROBAN_RPC_URL);

/**
 * Local state persistence helpers, used only in DEMO_MODE or as a read-through
 * cache of on-chain data already fetched successfully via RPC.
 */
const LOCAL_STORAGE_KEY = "pledge_projects_v2";
let memoryProjects: Project[] | null = null;

function loadLocalProjects(): Project[] {
  if (typeof window !== "undefined") {
    const saved = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        const projects = parsed.map((p: any) => ({
          ...p,
          milestones: (p.milestones || []).map((m: any) => ({
            ...m,
            rawAmount: BigInt(m.rawAmount || "0"),
          })),
        }));
        memoryProjects = projects;
        return projects;
      } catch (e) {
        console.error("Failed to parse local projects from localStorage:", e);
      }
    } else {
      saveLocalProjects(MOCK_PROJECTS);
      memoryProjects = MOCK_PROJECTS;
      return MOCK_PROJECTS;
    }
  }
  return memoryProjects || MOCK_PROJECTS;
}

function saveLocalProjects(projects: Project[]): void {
  memoryProjects = projects;
  if (typeof window !== "undefined") {
    try {
      const serializable = projects.map((p) => ({
        ...p,
        milestones: p.milestones.map((m) => ({
          ...m,
          rawAmount: m.rawAmount.toString(),
        })),
      }));
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(serializable));
    } catch (e) {
      console.error("Failed to save local projects to localStorage:", e);
    }
  }
}

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
 * Wraps a promise with a timeout. Freighter's signTransaction can hang
 * indefinitely if the extension is missing, locked, or fails to inject its
 * content script (a known class of issue on some browsers), leaving the UI
 * stuck on a loading state with no error. This guarantees a rejection
 * instead of an infinite wait.
 */
function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  timeoutMessage: string
): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(timeoutMessage)), timeoutMs);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (err) => {
        clearTimeout(timer);
        reject(err);
      }
    );
  });
}

/**
 * Submits a signed transaction and polls until it settles. Throws on any
 * non-success terminal state instead of returning a placeholder result, so
 * callers can never mistake a failed submission for a successful one.
 */
async function submitAndAwaitTransaction(
  preparedTxXdr: string,
  errorContext: string
): Promise<string> {
  const SIGN_TIMEOUT_MS = 60_000; // Freighter must respond to the signing prompt within 60s.

  const signRes = await withTimeout(
    signTransaction(preparedTxXdr, { networkPassphrase: NETWORK_PASSPHRASE }),
    SIGN_TIMEOUT_MS,
    `${errorContext}: Freighter did not respond to the signing request within 60 seconds. Check that the Freighter extension is installed, unlocked, and not blocked by the browser.`
  );
  const signedXdr = getSignedXdr(signRes);

  const sendRes = await server.sendTransaction(
    TransactionBuilder.fromXDR(signedXdr, NETWORK_PASSPHRASE)
  );

  if (sendRes.status === "ERROR") {
    const detail =
      (sendRes as any).errorResultXdr ||
      (sendRes as any).errorResult ||
      "RPC rejected the transaction";
    throw new Error(`${errorContext}: ${detail}`);
  }

  if (sendRes.status !== "PENDING") {
    throw new Error(`${errorContext}: unexpected submission status "${sendRes.status}"`);
  }

  const POLL_INTERVAL_MS = 1000;
  const MAX_POLL_ATTEMPTS = 30; // ~30s timeout waiting for the ledger to close
  let getRes = await server.getTransaction(sendRes.hash);
  let attempts = 0;

  while (getRes.status === "NOT_FOUND" && attempts < MAX_POLL_ATTEMPTS) {
    await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
    getRes = await server.getTransaction(sendRes.hash);
    attempts += 1;
  }

  if (getRes.status === "NOT_FOUND") {
    throw new Error(
      `${errorContext}: transaction not confirmed after ${MAX_POLL_ATTEMPTS}s, check hash ${sendRes.hash} manually`
    );
  }

  if (getRes.status === "FAILED") {
    throw new Error(
      `${errorContext}: transaction failed during on-chain execution (hash ${sendRes.hash})`
    );
  }

  return sendRes.hash;
}

/**
 * Placeholder source account for read-only simulation.
 *
 * Simulating a contract call requires a source account to build a
 * transaction, but the RPC simulation endpoint never verifies that the
 * account exists or has a balance, and nothing is ever signed or submitted.
 * Using a fixed all-zero key keeps reads working for visitors who have no
 * wallet connected, which is required for the public "citizen" view.
 * Hardcoded rather than derived via Buffer so it does not pull a Node
 * polyfill into the browser bundle.
 */
const READ_ONLY_SOURCE = "GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF";

/**
 * Invoke a read-only contract function through RPC simulation and return the
 * decoded native result.
 *
 * Simulation is used rather than reading raw ledger entries via
 * getContractData because the contract's storage keys are `#[contracttype]`
 * enum variants. Those serialize as ScVec (even unit variants such as
 * `ProjectCount`), and instance-storage values are not standalone ledger
 * entries at all: they live inside the contract instance's storage map. Both
 * details are easy to encode incorrectly. Calling the contract's own
 * accessor functions instead keeps the frontend coupled to the contract's
 * public API, which is the interface the contract actually guarantees.
 */
async function simulateRead(functionName: string, ...args: xdr.ScVal[]): Promise<any> {
  const contract = new Contract(REGISTRY_CONTRACT_ID);
  const tx = new TransactionBuilder(new Account(READ_ONLY_SOURCE, "0"), {
    fee: "100000",
    networkPassphrase: NETWORK_PASSPHRASE,
  })
    .addOperation(contract.call(functionName, ...args))
    .setTimeout(30)
    .build();

  const sim = await withTimeout(
    server.simulateTransaction(tx),
    20_000,
    `Soroban RPC did not respond to the ${functionName} simulation within 20 seconds. Check that ${SOROBAN_RPC_URL} is reachable.`
  );

  if (rpc.Api.isSimulationError(sim)) {
    throw new Error(`Registry.${functionName} failed: ${sim.error}`);
  }

  const retval = sim.result?.retval;
  if (!retval) {
    throw new Error(`Registry.${functionName} returned no value`);
  }

  return scValToNative(retval);
}

/**
 * Fetch project details from the Registry contract's get_project function.
 * Falls back to the local demo store only when DEMO_MODE is active;
 * otherwise a real RPC failure is thrown so the UI can show an accurate
 * error rather than stale mock data.
 */
export async function getProjectById(id: number): Promise<Project> {
  if (DEMO_MODE) {
    const localFound = loadLocalProjects().find((p) => p.id === id);
    if (localFound) return localFound;
    throw new Error(`Project ${id} not found in local demo store`);
  }

  const native = await simulateRead("get_project", xdr.ScVal.scvU32(id));
  if (!native) {
    throw new Error(`Project ${id} not found on Registry contract`);
  }
  return parseProjectNative(native);
}

/**
 * Fetch all projects. In DEMO_MODE, reads from the local store only. In
 * live mode, reads the on-chain project count via get_project_count and
 * fetches each project by ID; a failure fetching the count is a real error,
 * not a silent fallback.
 */
export async function getAllProjects(): Promise<Project[]> {
  if (DEMO_MODE) {
    return [...loadLocalProjects()].sort((a, b) => b.id - a.id);
  }

  const count = Number(await simulateRead("get_project_count"));

  const projects: Project[] = [];
  for (let i = 1; i <= count; i++) {
    try {
      projects.push(await getProjectById(i));
    } catch (e) {
      // A single missing/corrupt project shouldn't fail the whole list,
      // but it is logged loudly rather than silently dropped.
      console.error(`Failed loading project ${i} from Registry contract:`, e);
    }
  }

  return projects.sort((a, b) => b.id - a.id);
}

/**
 * Create a project on-chain via the Registry contract's create_project
 * function. In DEMO_MODE, mutates the local store and returns a synthetic
 * reference clearly not tied to any real ledger. In live mode, any failure
 * (build, sign, submit, or on-chain execution) is thrown to the caller.
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
  let txHash: string;

  // Normalize before validating or encoding. A pasted address with trailing
  // whitespace is otherwise rejected deep inside `new Address()` with an
  // opaque "Unsupported address type" error that gives the user no way to
  // tell which of the five address fields was at fault.
  const funderAddr = funder.trim();
  const contractorAddr = contractor.trim();
  const verifierAddrs = verifiers.map((v) => v.trim());
  const descriptions = milestonesDesc.map((d) => d.trim());
  const token = tokenAddress.trim();

  const labelledAccounts: [string, string][] = [
    ["funder", funderAddr],
    ["contractor", contractorAddr],
    ["verifier 1", verifierAddrs[0] ?? ""],
    ["verifier 2", verifierAddrs[1] ?? ""],
    ["verifier 3", verifierAddrs[2] ?? ""],
  ];

  for (const [label, value] of labelledAccounts) {
    if (!value) {
      throw new Error(`The ${label} address is required.`);
    }
    if (!isValidStellarAccount(value)) {
      throw new Error(
        `The ${label} address is not a valid Stellar public key. It must start with "G" and be 56 characters long. Received: "${value}"`
      );
    }
  }

  if (!isValidContractAddress(token)) {
    throw new Error(
      `The escrow token address "${token}" is not a valid Soroban contract address. Check NEXT_PUBLIC_NATIVE_TOKEN_ID.`
    );
  }

  if (verifierAddrs.length !== 3) {
    throw new Error("Exactly 3 verifiers are required by the Registry contract.");
  }

  if (descriptions.length !== milestonesAmounts.length || descriptions.length === 0) {
    throw new Error("Each milestone needs both a description and an amount.");
  }

  descriptions.forEach((desc, i) => {
    if (!desc) {
      throw new Error(`Milestone ${i + 1} is missing a description.`);
    }
    if (!Number.isFinite(milestonesAmounts[i]) || milestonesAmounts[i] <= 0) {
      throw new Error(`Milestone ${i + 1} must have an amount greater than zero.`);
    }
  });

  if (DEMO_MODE) {
    txHash = `demo-${crypto.randomUUID()}`;
  } else {
    // Only meaningful in live mode: DEMO_MODE is defined as "no Registry
    // contract configured", so an empty ID here is expected, not an error.
    if (!isValidContractAddress(REGISTRY_CONTRACT_ID)) {
      throw new Error(
        `The Registry contract address "${REGISTRY_CONTRACT_ID}" is not a valid Soroban contract address. Check NEXT_PUBLIC_REGISTRY_CONTRACT_ID.`
      );
    }

    const verifiersScVal = xdr.ScVal.scvVec(verifierAddrs.map((v) => new Address(v).toScVal()));
    const descScVal = xdr.ScVal.scvVec(descriptions.map((d) => nativeToScVal(d)));
    const amountsScVal = xdr.ScVal.scvVec(
      milestonesAmounts.map((a) => nativeToScVal(BigInt(a), { type: "i128" }))
    );

    const contract = new Contract(REGISTRY_CONTRACT_ID);

    console.log("[Pledge] Fetching account from Soroban RPC...", funderAddr);
    const account = await withTimeout(
      server.getAccount(funderAddr),
      15_000,
      "Failed to fetch your account from Soroban RPC within 15 seconds. Check that the funder account is funded on Testnet and the RPC URL is reachable."
    );
    console.log("[Pledge] Account fetched OK. Building transaction...");

    let tx;
    try {
      tx = new TransactionBuilder(account, {
        fee: "100000",
        networkPassphrase: NETWORK_PASSPHRASE,
      })
        .addOperation(
          contract.call(
            "create_project",
            new Address(funderAddr).toScVal(),
            nativeToScVal(name.trim()),
            new Address(contractorAddr).toScVal(),
            verifiersScVal,
            descScVal,
            amountsScVal,
            new Address(token).toScVal()
          )
        )
        .setTimeout(30)
        .build();
    } catch (buildErr: any) {
      console.error("[Pledge] Transaction BUILD failed:", buildErr);
      throw new Error(`Failed to build transaction: ${buildErr.message}`);
    }

    console.log("[Pledge] Transaction built. Simulating on Soroban RPC (prepareTransaction)...");
    const preparedTx = await withTimeout(
      server.prepareTransaction(tx),
      30_000,
      "Soroban RPC did not respond to transaction simulation within 30 seconds. The contract may not exist at the configured address, or the RPC endpoint may be unreachable."
    );
    console.log("[Pledge] Simulation OK. Requesting Freighter signature...");

    txHash = await submitAndAwaitTransaction(preparedTx.toXDR(), "Project creation failed");
    console.log("[Pledge] Transaction confirmed:", txHash);
  }

  // Mirror the result into the local store so the UI reflects it immediately,
  // even in live mode (acts as a read-through cache pending the next RPC sync).
  const projects = loadLocalProjects();
  const newId = projects.length > 0 ? Math.max(...projects.map((p) => p.id)) + 1 : 1;

  const formattedMilestones: Milestone[] = descriptions.map((desc, i) => {
    const rawVal = BigInt(milestonesAmounts[i] || 0);
    const xlmAmount = (Number(rawVal) / 10000000).toLocaleString();
    return {
      id: i,
      desc,
      amount: `${xlmAmount} XLM`,
      rawAmount: rawVal,
      status: MilestoneState.PendingSubmission,
      proofCid: "",
      approvals: [],
      rejections: [],
    };
  });

  const totalRaw = formattedMilestones.reduce((sum, m) => sum + m.rawAmount, BigInt(0));
  const totalXlm = (Number(totalRaw) / 10000000).toLocaleString();

  const newProject: Project = {
    id: newId,
    name: name.trim(),
    lgu: funderAddr,
    contractor: contractorAddr,
    verifiers: verifierAddrs,
    milestones: formattedMilestones,
    status: ProjectState.Funded,
    flagCount: 0,
    token,
    totalBudget: `${totalXlm} XLM`,
  };

  projects.unshift(newProject);
  saveLocalProjects(projects);

  return txHash;
}

/**
 * Submit proof for a milestone via the Registry contract's submit_proof
 * function. Same DEMO_MODE / live-mode error-propagation contract as
 * createProjectOnChain above.
 */
export async function submitProofOnChain(
  contractor: string,
  projectId: number,
  milestoneId: number,
  evidenceIpfsCid: string,
  fileName?: string,
  dataUrl?: string
): Promise<string> {
  let txHash: string;

  if (DEMO_MODE) {
    txHash = `demo-${crypto.randomUUID()}`;
  } else {
    const contract = new Contract(REGISTRY_CONTRACT_ID);
    const account = await server.getAccount(contractor);

    const tx = new TransactionBuilder(account, {
      fee: "100000",
      networkPassphrase: NETWORK_PASSPHRASE,
    })
      .addOperation(
        contract.call(
          "submit_proof",
          new Address(contractor).toScVal(),
          xdr.ScVal.scvU32(projectId),
          xdr.ScVal.scvU32(milestoneId),
          nativeToScVal(evidenceIpfsCid)
        )
      )
      .setTimeout(30)
      .build();

    const preparedTx = await server.prepareTransaction(tx);
    txHash = await submitAndAwaitTransaction(preparedTx.toXDR(), "Proof submission failed");
  }

  const projects = loadLocalProjects();
  const proj = projects.find((p) => p.id === projectId);
  if (proj) {
    const milestone = proj.milestones.find((m) => m.id === milestoneId);
    if (milestone) {
      milestone.proofCid = evidenceIpfsCid;
      if (fileName) milestone.proofFileName = fileName;
      if (dataUrl) milestone.proofFileDataUrl = dataUrl;
      milestone.status = MilestoneState.PendingVerification;
    }
    if (proj.status === ProjectState.Funded) {
      proj.status = ProjectState.InProgress;
    }
    saveLocalProjects(projects);
  }

  return txHash;
}

/**
 * Cast an approve/reject vote on a milestone via the Registry contract's
 * verify_milestone function. Same DEMO_MODE / live-mode error-propagation
 * contract as createProjectOnChain above.
 */
export async function verifyMilestoneOnChain(
  verifier: string,
  projectId: number,
  milestoneId: number,
  approve: boolean
): Promise<string> {
  let txHash: string;

  if (DEMO_MODE) {
    txHash = `demo-${crypto.randomUUID()}`;
  } else {
    const contract = new Contract(REGISTRY_CONTRACT_ID);
    const account = await server.getAccount(verifier);

    const tx = new TransactionBuilder(account, {
      fee: "100000",
      networkPassphrase: NETWORK_PASSPHRASE,
    })
      .addOperation(
        contract.call(
          "verify_milestone",
          new Address(verifier).toScVal(),
          xdr.ScVal.scvU32(projectId),
          xdr.ScVal.scvU32(milestoneId),
          xdr.ScVal.scvBool(approve)
        )
      )
      .setTimeout(30)
      .build();

    const preparedTx = await server.prepareTransaction(tx);
    txHash = await submitAndAwaitTransaction(preparedTx.toXDR(), "Milestone verification failed");
  }

  const projects = loadLocalProjects();
  const proj = projects.find((p) => p.id === projectId);
  if (proj) {
    const milestone = proj.milestones.find((m) => m.id === milestoneId);
    if (milestone) {
      if (approve) {
        if (!milestone.approvals.some((a) => a.toLowerCase() === verifier.toLowerCase())) {
          milestone.approvals.push(verifier);
        }
        if (milestone.approvals.length >= 2) {
          milestone.status = MilestoneState.Verified;
        }
      } else {
        if (!milestone.rejections.some((r) => r.toLowerCase() === verifier.toLowerCase())) {
          milestone.rejections.push(verifier);
        }
        if (milestone.rejections.length >= 2) {
          milestone.status = MilestoneState.Rejected;
          if (proj.status !== ProjectState.Completed) {
            proj.status = ProjectState.Flagged;
          }
        }
      }
    }

    const allVerified = proj.milestones.every((m) => m.status === MilestoneState.Verified);
    if (allVerified) {
      proj.status = ProjectState.Completed;
    }

    saveLocalProjects(projects);
  }

  return txHash;
}

/**
 * Flag a project for public audit via the Registry contract's
 * flag_project function. Same DEMO_MODE / live-mode error-propagation
 * contract as createProjectOnChain above.
 */
export async function flagProjectOnChain(caller: string, projectId: number): Promise<string> {
  let txHash: string;

  if (DEMO_MODE) {
    txHash = `demo-${crypto.randomUUID()}`;
  } else {
    const contract = new Contract(REGISTRY_CONTRACT_ID);
    const account = await server.getAccount(caller);

    const tx = new TransactionBuilder(account, {
      fee: "100000",
      networkPassphrase: NETWORK_PASSPHRASE,
    })
      .addOperation(
        contract.call("flag_project", new Address(caller).toScVal(), xdr.ScVal.scvU32(projectId))
      )
      .setTimeout(30)
      .build();

    const preparedTx = await server.prepareTransaction(tx);
    txHash = await submitAndAwaitTransaction(preparedTx.toXDR(), "Flagging project failed");
  }

  const projects = loadLocalProjects();
  const proj = projects.find((p) => p.id === projectId);
  if (proj) {
    proj.flagCount += 1;
    if (proj.status !== ProjectState.Completed) {
      proj.status = ProjectState.Flagged;
    }
    saveLocalProjects(projects);
  }

  return txHash;
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
