import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const sdkMocks = vi.hoisted(() => {
  const serverInstance = {
    getContractData: vi.fn(),
    getAccount: vi.fn(),
    prepareTransaction: vi.fn(),
    sendTransaction: vi.fn(),
    getTransaction: vi.fn(),
  };

  function ServerCtor(this: any) {
    return serverInstance;
  }

  return {
    serverInstance,
    ServerCtor,
    scValToNative: vi.fn(),
    nativeToScVal: vi.fn((v: unknown) => v),
    xdr: {
      ScVal: {
        scvVec: vi.fn((v: unknown) => v),
        scvSymbol: vi.fn((v: unknown) => v),
        scvU32: vi.fn((v: unknown) => v),
        scvBool: vi.fn((v: unknown) => v),
      },
    },
    Contract: vi.fn().mockImplementation(function Contract(this: any) {
      this.call = vi.fn();
    }),
    TransactionBuilder: Object.assign(
      vi.fn().mockImplementation(function TransactionBuilder(this: any) {
        this.addOperation = vi.fn(() => this);
        this.setTimeout = vi.fn(() => this);
        this.build = vi.fn(() => ({ toXDR: () => "BUILT_TX_XDR" }));
      }),
      { fromXDR: vi.fn() }
    ),
    Address: vi.fn().mockImplementation(function Address(this: any, addr: string) {
      this.toScVal = () => addr;
    }),
  };
});

vi.mock("@stellar/stellar-sdk", () => ({
  rpc: { Server: sdkMocks.ServerCtor },
  scValToNative: sdkMocks.scValToNative,
  nativeToScVal: sdkMocks.nativeToScVal,
  xdr: sdkMocks.xdr,
  Contract: sdkMocks.Contract,
  TransactionBuilder: sdkMocks.TransactionBuilder,
  Address: sdkMocks.Address,
}));

const freighterMocks = vi.hoisted(() => ({
  signTransaction: vi.fn(),
}));

vi.mock("@stellar/freighter-api", () => freighterMocks);

describe("lib/soroban", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    localStorage.clear();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  describe("demo mode (no NEXT_PUBLIC_REGISTRY_CONTRACT_ID configured)", () => {
    beforeEach(() => {
      vi.stubEnv("NEXT_PUBLIC_REGISTRY_CONTRACT_ID", "");
    });

    it("reports DEMO_MODE as true", async () => {
      const soroban = await import("@/lib/soroban");
      expect(soroban.DEMO_MODE).toBe(true);
    });

    it("createProjectOnChain never calls the Soroban RPC server and returns a demo-prefixed reference", async () => {
      const soroban = await import("@/lib/soroban");

      const txRef = await soroban.createProjectOnChain(
        "GFUNDER",
        "Test Project",
        "GCONTRACTOR",
        ["GV1", "GV2", "GV3"],
        ["Phase 1"],
        [1000],
        "GTOKEN"
      );

      expect(txRef).toMatch(/^demo-/);
      expect(sdkMocks.serverInstance.getAccount).not.toHaveBeenCalled();
      expect(sdkMocks.serverInstance.prepareTransaction).not.toHaveBeenCalled();
    });

    it("createProjectOnChain persists the new project so getAllProjects reflects it immediately", async () => {
      const soroban = await import("@/lib/soroban");

      await soroban.createProjectOnChain(
        "GFUNDER",
        "Demo Bridge",
        "GCONTRACTOR",
        ["GV1", "GV2", "GV3"],
        ["Phase 1"],
        [500],
        "GTOKEN"
      );

      const projects = await soroban.getAllProjects();
      expect(projects.some((p) => p.name === "Demo Bridge")).toBe(true);
    });

    it("getProjectById throws for a project id that does not exist in the demo store", async () => {
      const soroban = await import("@/lib/soroban");
      await expect(soroban.getProjectById(9999)).rejects.toThrow(/not found/i);
    });
  });

  describe("live mode (NEXT_PUBLIC_REGISTRY_CONTRACT_ID configured)", () => {
    beforeEach(() => {
      vi.stubEnv("NEXT_PUBLIC_REGISTRY_CONTRACT_ID", "CCONTRACTREGISTRYID");
    });

    it("reports DEMO_MODE as false", async () => {
      const soroban = await import("@/lib/soroban");
      expect(soroban.DEMO_MODE).toBe(false);
    });

    it("propagates an RPC submission error instead of silently falling back to a fake tx hash", async () => {
      const soroban = await import("@/lib/soroban");

      sdkMocks.serverInstance.getAccount.mockResolvedValue({ accountId: () => "GFUNDER" });
      sdkMocks.serverInstance.prepareTransaction.mockResolvedValue({
        toXDR: () => "PREPARED_XDR",
      });
      freighterMocks.signTransaction.mockResolvedValue({ signedTxXdr: "SIGNED_XDR" });
      sdkMocks.TransactionBuilder.fromXDR.mockReturnValue("PARSED_TX");
      sdkMocks.serverInstance.sendTransaction.mockResolvedValue({
        status: "ERROR",
        errorResult: "insufficient fee",
      });

      await expect(
        soroban.createProjectOnChain(
          "GFUNDER",
          "Real Project",
          "GCONTRACTOR",
          ["GV1", "GV2", "GV3"],
          ["Phase 1"],
          [1000],
          "GTOKEN"
        )
      ).rejects.toThrow(/insufficient fee/);
    });

    it("propagates a Freighter signing rejection instead of returning a fabricated success", async () => {
      const soroban = await import("@/lib/soroban");

      sdkMocks.serverInstance.getAccount.mockResolvedValue({ accountId: () => "GFUNDER" });
      sdkMocks.serverInstance.prepareTransaction.mockResolvedValue({
        toXDR: () => "PREPARED_XDR",
      });
      freighterMocks.signTransaction.mockRejectedValue(new Error("User declined access"));

      await expect(
        soroban.flagProjectOnChain("GCITIZEN", 1)
      ).rejects.toThrow(/declined/);

      // Local demo store must not have been mutated by a failed live-mode call.
      expect(sdkMocks.serverInstance.sendTransaction).not.toHaveBeenCalled();
    });

    it("returns the real transaction hash on a successful submission", async () => {
      const soroban = await import("@/lib/soroban");

      sdkMocks.serverInstance.getAccount.mockResolvedValue({ accountId: () => "GVERIFIER" });
      sdkMocks.serverInstance.prepareTransaction.mockResolvedValue({
        toXDR: () => "PREPARED_XDR",
      });
      freighterMocks.signTransaction.mockResolvedValue({ signedTxXdr: "SIGNED_XDR" });
      sdkMocks.TransactionBuilder.fromXDR.mockReturnValue("PARSED_TX");
      sdkMocks.serverInstance.sendTransaction.mockResolvedValue({
        status: "PENDING",
        hash: "abc123realhash",
      });
      sdkMocks.serverInstance.getTransaction.mockResolvedValue({ status: "SUCCESS" });

      const txHash = await soroban.verifyMilestoneOnChain("GVERIFIER", 1, 0, true);
      expect(txHash).toBe("abc123realhash");
    });
  });
});
