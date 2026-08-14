import { describe, it, expect, vi, beforeEach } from "vitest";

const freighterMocks = vi.hoisted(() => ({
  isConnected: vi.fn(),
  getAddress: vi.fn(),
  requestAccess: vi.fn(),
  setAllowed: vi.fn(),
}));

vi.mock("@stellar/freighter-api", () => freighterMocks);

// Imported after the mock so the store picks up the mocked module.
import { useWalletStore } from "@/lib/store";

const TEST_ADDRESS = "GDEMOADDRESSXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX";

function resetStore() {
  useWalletStore.setState({
    address: null,
    isConnected: false,
    isConnecting: false,
    error: null,
  });
}

describe("useWalletStore", () => {
  beforeEach(() => {
    resetStore();
    vi.clearAllMocks();
    // window is defined by jsdom, so simulate the extension being absent by default.
    // @ts-expect-error test-only stub
    delete (window as any).freighter;
  });

  it("starts disconnected with no address", () => {
    const state = useWalletStore.getState();
    expect(state.isConnected).toBe(false);
    expect(state.address).toBeNull();
    expect(state.error).toBeNull();
  });

  it("connects successfully and stores the returned address", async () => {
    freighterMocks.isConnected.mockResolvedValue(true);
    freighterMocks.requestAccess.mockResolvedValue({ address: TEST_ADDRESS });
    freighterMocks.getAddress.mockResolvedValue({ address: TEST_ADDRESS });

    await useWalletStore.getState().connectWallet();

    const state = useWalletStore.getState();
    expect(state.isConnected).toBe(true);
    expect(state.address).toBe(TEST_ADDRESS);
    expect(state.error).toBeNull();
    expect(state.isConnecting).toBe(false);
  });

  it("sets an error and stays disconnected when the extension is not detected", async () => {
    freighterMocks.isConnected.mockResolvedValue(false);
    // Prevent the confirm() dialog from throwing in jsdom.
    vi.spyOn(window, "confirm").mockReturnValue(false);

    await useWalletStore.getState().connectWallet();

    const state = useWalletStore.getState();
    expect(state.isConnected).toBe(false);
    expect(state.address).toBeNull();
    expect(state.error).toMatch(/not detected/i);
  });

  it("sets an error when the user cancels the connection and no address is returned", async () => {
    freighterMocks.isConnected.mockResolvedValue(true);
    freighterMocks.requestAccess.mockResolvedValue(null);
    freighterMocks.getAddress.mockResolvedValue(null);

    await useWalletStore.getState().connectWallet();

    const state = useWalletStore.getState();
    expect(state.isConnected).toBe(false);
    expect(state.address).toBeNull();
    expect(state.error).toMatch(/cancelled|not retrieved/i);
  });

  it("propagates a thrown error from the Freighter API into state.error", async () => {
    freighterMocks.isConnected.mockRejectedValue(new Error("extension crashed"));

    await useWalletStore.getState().connectWallet();

    const state = useWalletStore.getState();
    expect(state.isConnected).toBe(false);
    expect(state.error).toBe("extension crashed");
  });

  it("clears address, connection state, and error on disconnect", () => {
    useWalletStore.setState({
      address: TEST_ADDRESS,
      isConnected: true,
      error: "stale error",
    });

    useWalletStore.getState().disconnectWallet();

    const state = useWalletStore.getState();
    expect(state.address).toBeNull();
    expect(state.isConnected).toBe(false);
    expect(state.error).toBeNull();
  });

  it("checkConnection restores address when the wallet is already connected", async () => {
    freighterMocks.isConnected.mockResolvedValue(true);
    freighterMocks.getAddress.mockResolvedValue({ address: TEST_ADDRESS });

    await useWalletStore.getState().checkConnection();

    const state = useWalletStore.getState();
    expect(state.isConnected).toBe(true);
    expect(state.address).toBe(TEST_ADDRESS);
  });

  it("checkConnection leaves state untouched when not connected", async () => {
    freighterMocks.isConnected.mockResolvedValue(false);

    await useWalletStore.getState().checkConnection();

    const state = useWalletStore.getState();
    expect(state.isConnected).toBe(false);
    expect(state.address).toBeNull();
  });
});
