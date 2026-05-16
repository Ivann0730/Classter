import { useState, useEffect } from "react";
import { BrowserWallet } from "@meshsdk/core";

const WALLET_KEY = "classter_teacher_wallet";

export function useTeacherWallet() {
  const [wallet, setWallet] = useState(null);
  const [walletAddress, setWalletAddress] = useState(() => {
    return localStorage.getItem(WALLET_KEY) || null;
  });
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState("");

  // Auto-reconnect on load if wallet was previously connected
  useEffect(() => {
    const savedAddress = localStorage.getItem(WALLET_KEY);
    if (savedAddress && window.cardano) {
      reconnectWallet(savedAddress);
    }
  }, []);

  const reconnectWallet = async (savedAddress) => {
    try {
      if (!window.cardano) return;
      const walletKey = window.cardano.lace ? "lace" : Object.keys(window.cardano)[0];
      const connectedWallet = await BrowserWallet.enable(walletKey);
      const addresses = await connectedWallet.getUsedAddresses();
      const addr = addresses.length > 0
        ? addresses[0]
        : (await connectedWallet.getUnusedAddresses())[0];

      if (addr === savedAddress || !savedAddress) {
        setWallet(connectedWallet);
        setWalletAddress(addr);
        localStorage.setItem(WALLET_KEY, addr);
      }
    } catch (e) {
      console.warn("Auto-reconnect failed:", e.message);
    }
  };

  const connectWallet = async () => {
    setError(""); setConnecting(true);
    try {
      if (!window.cardano) {
        setError("Lace wallet not found. Please install it from lace.io");
        setConnecting(false); return;
      }
      const walletKey = window.cardano.lace ? "lace" : Object.keys(window.cardano)[0];
      const connectedWallet = await BrowserWallet.enable(walletKey);
      const addresses = await connectedWallet.getUsedAddresses();
      const addr = addresses.length > 0
        ? addresses[0]
        : (await connectedWallet.getUnusedAddresses())[0];

      setWallet(connectedWallet);
      setWalletAddress(addr);
      localStorage.setItem(WALLET_KEY, addr);
    } catch (e) {
      setError("Wallet connection failed: " + e.message);
    }
    setConnecting(false);
  };

  const disconnectWallet = () => {
    setWallet(null);
    setWalletAddress(null);
    localStorage.removeItem(WALLET_KEY);
  };

  return { wallet, walletAddress, connecting, error, connectWallet, disconnectWallet };
}
