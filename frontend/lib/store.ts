"use client";

import { create } from "zustand";
import { isConnected, getAddress, requestAccess, setAllowed } from "@stellar/freighter-api";

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
      if (typeof window === "undefined") return;

      const connRes: any = await isConnected();
      const isConn = typeof connRes === "boolean" ? connRes : Boolean(connRes?.isConnected);

      if (isConn) {
        const addrRes: any = await getAddress();
        let addr: string | null = null;
        if (typeof addrRes === "string") {
          addr = addrRes;
        } else if (addrRes && addrRes.address) {
          addr = addrRes.address;
        }

        if (addr) {
          set({ address: addr, isConnected: true, error: null });
        }
      }
    } catch (err: any) {
      console.warn("Failed to auto-check wallet connection:", err);
    }
  },

  connectWallet: async () => {
    set({ isConnecting: true, error: null });
    try {
      if (typeof window === "undefined") {
        set({ isConnecting: false });
        return;
      }

      // Check if Freighter extension is installed
      const connRes: any = await isConnected();
      const isInstalled = typeof connRes === "boolean" ? connRes : Boolean(connRes?.isConnected);

      if (!isInstalled && !(window as any).freighter) {
        // Handle case where Freighter extension isn't detected or on mobile browser without extension
        // Provide clear feedback or demo fallback address if extension not present
        const promptInstall = confirm(
          "Freighter wallet extension was not detected in your browser.\n\nWould you like to install Freighter from freighter.app?"
        );
        if (promptInstall) {
          window.open("https://www.freighter.app/", "_blank");
        }
        set({
          error: "Freighter wallet extension not detected.",
          isConnecting: false,
        });
        return;
      }

      // Trigger permission popup in Freighter
      let accessRes: any = null;
      try {
        if (typeof requestAccess === "function") {
          accessRes = await requestAccess();
        } else if (typeof setAllowed === "function") {
          accessRes = await setAllowed();
        }
      } catch (reqErr: any) {
        console.warn("requestAccess failed or rejected:", reqErr);
      }

      // Retrieve public address
      const addrRes: any = await getAddress();
      let targetAddr: string | null = null;

      if (typeof accessRes === "string") {
        targetAddr = accessRes;
      } else if (accessRes && accessRes.address) {
        targetAddr = accessRes.address;
      } else if (typeof addrRes === "string") {
        targetAddr = addrRes;
      } else if (addrRes && addrRes.address) {
        targetAddr = addrRes.address;
      }

      if (targetAddr) {
        set({
          address: targetAddr,
          isConnected: true,
          isConnecting: false,
          error: null,
        });
      } else {
        set({
          error: "Wallet connection cancelled or address not retrieved.",
          isConnecting: false,
        });
      }
    } catch (err: any) {
      console.error("Wallet connection error:", err);
      set({
        error: err.message || "Failed to connect Freighter wallet.",
        isConnecting: false,
      });
    }
  },

  disconnectWallet: () => {
    set({ address: null, isConnected: false, error: null });
  },
}));
