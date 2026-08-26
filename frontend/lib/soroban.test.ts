import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

/**
 * Valid Stellar keys. createProjectOnChain now validates address shape via
 * StrKey before encoding, so placeholder strings like "GFUNDER" are rejected
 * up front. Using real keys keeps these tests exercising the RPC/signing
 * paths they are actually about.
 */
const FUNDER = "GAUDGZPASKQB3MIJU3AUHIFDMOU44DUEILIHAJMHT724MPLO2I5MQ74D";
const CONTRACTOR = "GCG62TUBIXKA553VGXHJRZQ7VTXI7X7X67QUIFJODOSRPVUWRN3TNC72";
const V1 = "GD4XTJOOFJEMN2X7NZIS62RPY3QUJPOERUJSODRK5Z3ACWTXABK6S7MD";
const V2 = "GC7R3I6P7NCM2TLWOURDJZ2UI5ZWCAMKP5PC43G7IOGUIOIB7DCDRETG";
const V3 = "GDM2GX7VT6GDOOS2C4TVR6RG73RI6G43ICLZRAOQZLBFUDNGWQVDOML2";
const CITIZEN = "GAAF2RPUL6JCSZP365TWTYWS6UUTQ6RH7245UYOALUDNGMMW4REXWEQQ";
const VERIFIER = "GA26IPU7PCSC7WNCA2XYYWOKF3TGP6UOSVZM4BDZ54DMSMUATKVN65K4";
const REGISTRY_ID = "CCZES3TPZTDVUEX3BVZOL7MT2JDPNCVVK6TTG6N2NZQLBQQYEIJESRDQ";
const TOKEN_ID = "CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC";

const sdkMocks = vi.hoisted(() => {
  const serverInstance = {
    getContractData: vi.fn(),
    getAccount: vi.fn(),
    prepareTransaction: vi.fn(),
    sendTransaction: vi.fn(),
    getTransaction: vi.fn(),
    simulateTransaction: vi.fn(),
  };

  function ServerCtor(this: any) {
    return serverInstance;
  }

  return {
    serverInstance,
    ServerCtor,
    isSimulationError: vi.fn(() => false),
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
    Account: vi.fn().mockImplementation(function Account(this: any, id: string) {
      this.accountId = () => id;
      this.sequenceNumber = () => "0";
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

// StrKey is a pure, dependency-free checksum validator, so the real
// implementation is used rather than a mock. Mocking it would defeat the
// purpose of the address-validation tests below.
vi.mock("@stellar/stellar-sdk", async () => {
  const actual =
    await vi.importActual<typeof import("@stellar/stellar-sdk")>("@stellar/stellar-sdk");
  return {
    rpc: {
      Server: sdkMocks.ServerCtor,
      Api: { isSimulationError: sdkMocks.isSimulationError },
    },
    StrKey: actual.StrKey,
    scValToNative: sdkMocks.scValToNative,
    nativeToScVal: sdkMocks.nativeToScVal,
    xdr: sdkMocks.xdr,
    Contract: sdkMocks.Contract,
    Account: sdkMocks.Account,
    TransactionBuilder: sdkMocks.TransactionBuilder,
    Address: sdkMocks.Address,
  };
});

const freighterMocks = vi.hoisted(() => ({
  signTransaction: vi.fn(),
}));

vi.mock("@stellar/freighter-api", () => freighterMocks);

describe("lib/soroban", () => {
  it("exposes Registry entry points with names matching the Soroban contract", async () => {
    const soroban = await import("@/lib/soroban");

    expect(soroban.REGISTRY_METHODS).toEqual({
      getProject: "get_project",
      getProjectCount: "get_project_count",
      createProject: "create_project",
      submitProof: "submit_proof",
      verifyMilestone: "verify_milestone",
      flagProject: "flag_project",
    });
  });

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
        FUNDER,
        "Test Project",
        CONTRACTOR,
        [V1, V2, V3],
        ["Phase 1"],
        [1000],
        TOKEN_ID
      );

      expect(txRef).toMatch(/^demo-/);
      expect(sdkMocks.serverInstance.getAccount).not.toHaveBeenCalled();
      expect(sdkMocks.serverInstance.prepareTransaction).not.toHaveBeenCalled();
    });

    it("createProjectOnChain persists the new project so getAllProjects reflects it immediately", async () => {
      const soroban = await import("@/lib/soroban");

      await soroban.createProjectOnChain(
        FUNDER,
        "Demo Bridge",
        CONTRACTOR,
        [V1, V2, V3],
        ["Phase 1"],
        [500],
        TOKEN_ID
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
      vi.stubEnv("NEXT_PUBLIC_REGISTRY_CONTRACT_ID", REGISTRY_ID);
    });

    it("reports DEMO_MODE as false", async () => {
      const soroban = await import("@/lib/soroban");
      expect(soroban.DEMO_MODE).toBe(false);
    });

    it("rejects a malformed funder address before contacting the RPC server", async () => {
      const soroban = await import("@/lib/soroban");

      await expect(
        soroban.createProjectOnChain(
          "GFUNDER",
          "Bad Address Project",
          CONTRACTOR,
          [V1, V2, V3],
          ["Phase 1"],
          [1000],
          TOKEN_ID
        )
      ).rejects.toThrow(/funder address is not a valid Stellar public key/i);

      expect(sdkMocks.serverInstance.getAccount).not.toHaveBeenCalled();
    });

    it("rejects an untrimmed verifier address rather than failing opaquely inside the SDK", async () => {
      const soroban = await import("@/lib/soroban");

      sdkMocks.serverInstance.getAccount.mockResolvedValue({ accountId: () => FUNDER });

      await expect(
        soroban.createProjectOnChain(
          FUNDER,
          "Whitespace Project",
          CONTRACTOR,
          [` ${V1} `, V2, "GNOTREAL"],
          ["Phase 1"],
          [1000],
          TOKEN_ID
        )
      ).rejects.toThrow(/verifier 3 address is not a valid Stellar public key/i);
    });

    it("propagates an RPC submission error instead of silently falling back to a fake tx hash", async () => {
      const soroban = await import("@/lib/soroban");

      sdkMocks.serverInstance.getAccount.mockResolvedValue({ accountId: () => FUNDER });
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
          FUNDER,
          "Real Project",
          CONTRACTOR,
          [V1, V2, V3],
          ["Phase 1"],
          [1000],
          TOKEN_ID
        )
      ).rejects.toThrow(/insufficient fee/);
    });

    it("propagates a Freighter signing rejection instead of returning a fabricated success", async () => {
      const soroban = await import("@/lib/soroban");

      sdkMocks.serverInstance.getAccount.mockResolvedValue({ accountId: () => FUNDER });
      sdkMocks.serverInstance.prepareTransaction.mockResolvedValue({
        toXDR: () => "PREPARED_XDR",
      });
      freighterMocks.signTransaction.mockRejectedValue(new Error("User declined access"));

      await expect(soroban.flagProjectOnChain(CITIZEN, 1)).rejects.toThrow(/declined/);

      // Local demo store must not have been mutated by a failed live-mode call.
      expect(sdkMocks.serverInstance.sendTransaction).not.toHaveBeenCalled();
    });

    it("reads the project count through get_project_count simulation, not raw ledger entries", async () => {
      const soroban = await import("@/lib/soroban");

      sdkMocks.serverInstance.simulateTransaction.mockResolvedValue({
        result: { retval: "RETVAL_SCVAL" },
      });
      sdkMocks.scValToNative.mockReturnValue(0);

      const projects = await soroban.getAllProjects();

      expect(projects).toEqual([]);
      expect(sdkMocks.serverInstance.simulateTransaction).toHaveBeenCalled();
      expect(sdkMocks.serverInstance.getContractData).not.toHaveBeenCalled();
    });

    it("surfaces a simulation error from the Registry contract", async () => {
      const soroban = await import("@/lib/soroban");

      sdkMocks.serverInstance.simulateTransaction.mockResolvedValue({
        error: "HostError: project not found",
      });
      sdkMocks.isSimulationError.mockReturnValue(true);

      await expect(soroban.getProjectById(42)).rejects.toThrow(/project not found/i);

      sdkMocks.isSimulationError.mockReturnValue(false);
    });

    it("returns the real transaction hash on a successful submission", async () => {
      const soroban = await import("@/lib/soroban");

      sdkMocks.serverInstance.getAccount.mockResolvedValue({ accountId: () => VERIFIER });
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

      const txHash = await soroban.verifyMilestoneOnChain(VERIFIER, 1, 0, true);
      expect(txHash).toBe("abc123realhash");
    });
  });
});
