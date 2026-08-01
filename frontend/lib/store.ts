"use client";

import { create } from "zustand";
import { isConnected, getAddress } from "@stellar/freighter-api";

interface WalletState {
  address: string | null;
  isConnected: boolean;
  isConnecting: boolean;
  error: string | null;
  connectWallet: () => Promise<void>;
  disconnectWallet: () => void;
  checkConnection: () => Promise<void>;
}

export const useWalletStore = create<WalletState>((set) => ({
  address: null,
  isConnected: false,
  isConnecting: false,
  error: null,

  checkConnection: async () => {
    try {
      if (await isConnected()) {
        const addrRes = await getAddress();
        if (addrRes && addrRes.address) {
          set({ address: addrRes.address, isConnected: true, error: null });
        }
      }
    } catch (err: any) {
      console.error("Failed to check wallet connection:", err);
    }
  },

  connectWallet: async () => {
    set({ isConnecting: true, error: null });
    try {
      const connected = await isConnected();
      if (!connected) {
        set({
          error: "Freighter wallet extension is not installed or detected.",
          isConnecting: false,
        });
        return;
      }
      const addrRes = await getAddress();
      if (addrRes && addrRes.address) {
        set({
          address: addrRes.address,
          isConnected: true,
          isConnecting: false,
          error: null,
        });
      } else if (addrRes && typeof addrRes === "string") {
        set({
          address: addrRes,
          isConnected: true,
          isConnecting: false,
          error: null,
        });
      } else {
        set({
          error: "Failed to retrieve address from Freighter.",
          isConnecting: false,
        });
      }
    } catch (err: any) {
      set({
        error: err.message || "Failed to connect wallet",
        isConnecting: false,
      });
    }
  },

  disconnectWallet: () => {
    set({ address: null, isConnected: false, error: null });
  },
}));
