"use client";

import { useCallback, useEffect, useState } from "react";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import dynamic from "next/dynamic";
import { PublicKey } from "@solana/web3.js";

import {
  getVaultPda,
  LAMPORTS_PER_SOL,
  toLamports,
  initVaultOnChain,
  sendTipOnChain,
  withdrawOnChain,
} from "../lib/tipJarClient";

const WalletMultiButtonDynamic = dynamic(
  async () =>
    (await import("@solana/wallet-adapter-react-ui")).WalletMultiButton,
  { ssr: false }
);


export default function Home() {
  const { connection } = useConnection();
  const wallet = useWallet();

  const [vaultAddress, setVaultAddress] = useState<string | null>(null);
  const [vaultBalance, setVaultBalance] = useState<number | null>(null);

  const [recipient, setRecipient] = useState("");
  const [tipAmount, setTipAmount] = useState("");
  const [withdrawAmount, setWithdrawAmount] = useState("");

  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const fetchVaultData = useCallback(async () => {
    if (!wallet.publicKey) return;

    const [vaultPda] = getVaultPda(wallet.publicKey);
    setVaultAddress(vaultPda.toBase58());

    const balanceLamports = await connection.getBalance(vaultPda);
    if (balanceLamports === 0) {
      setVaultBalance(null);
    } else {
      setVaultBalance(balanceLamports / LAMPORTS_PER_SOL);
    }
  }, [wallet.publicKey, connection]);

  useEffect(() => {
    fetchVaultData();
  }, [fetchVaultData]);

  const handleInitVault = async () => {
  if (!wallet.publicKey) return;
  setLoading(true);
  setMessage(null);

  try {
    await initVaultOnChain(connection, wallet);
    setMessage("Vault initialized on devnet ✅");
    await fetchVaultData();
  } catch (err: any) {
    console.error(err);
    const msg: string = err?.message || "";

    if (
      msg.includes("already in use") ||
      msg.includes("Allocate") ||
      msg.includes("custom program error: 0x0")
    ) {
      setMessage("Your vault is already initialized ✅");
    } else {
      setMessage(msg || "Failed to init vault");
    }
  } finally {
    setLoading(false);
  }
};

  const handleSendTip = async () => {
  if (!wallet.publicKey) return;
  setLoading(true);
  setMessage(null);

  try {
    const recipientPubkey = new PublicKey(recipient);
    const sol = parseFloat(tipAmount);
    if (isNaN(sol) || sol <= 0) throw new Error("Invalid amount");

    const amountLamports = toLamports(sol);

    await sendTipOnChain(connection, wallet, recipientPubkey, amountLamports);
    setMessage(`Sent ${sol} SOL tip 💸`);
    await fetchVaultData();
  } catch (err: any) {
    console.error(err);
    const msg: string = err?.message || "";

    if (msg.includes("custom program error: 0x1770") || msg.includes("6000")) {
      setMessage("Amount must be greater than zero.");
    } else if (
      msg.includes("insufficient funds") ||
      msg.includes("Insufficient funds")
    ) {
      setMessage("You don't have enough SOL to send this tip.");
    } else if (msg.includes("custom program error: 0x1772") || msg.includes("6002")) {
      setMessage("The vault does not have enough funds for this operation.");
    } else {
      setMessage(msg || "Failed to send tip.");
    }
  } finally {
    setLoading(false);
  }
};

  const handleWithdraw = async () => {
  if (!wallet.publicKey) return;
  setLoading(true);
  setMessage(null);

  try {
    const sol = parseFloat(withdrawAmount);
    if (isNaN(sol) || sol <= 0) throw new Error("Invalid amount");

    const amountLamports = toLamports(sol);

    await withdrawOnChain(connection, wallet, amountLamports);
    setMessage(`Withdrew ${sol} SOL from your vault ✅`);
    await fetchVaultData();
  } catch (err: any) {
    console.error(err);
    const msg: string = err?.message || "";

    if (msg.includes("custom program error: 0x1770") || msg.includes("6000")) {
      setMessage("Amount must be greater than zero.");
    } else if (msg.includes("custom program error: 0x1772") || msg.includes("6002")) {
      setMessage("Your vault does not have enough funds to withdraw that amount.");
    } else if (msg.includes("custom program error: 0x1771") || msg.includes("6001")) {
      setMessage("You are not authorized to withdraw from this vault.");
    } else {
      setMessage(msg || "Failed to withdraw.");
    }
  } finally {
    setLoading(false);
  }
};

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100 flex flex-col items-center p-6">
      <div className="w-full max-w-xl space-y-6">
        <header className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">Solana Tip Jar</h1>
          <WalletMultiButtonDynamic />
        </header>

        {!wallet.connected ? (
          <p className="mt-4">
            Connect your wallet to create a vault, send tips, and withdraw.
          </p>
        ) : (
          <>
            <section className="border border-slate-800 rounded-xl p-4 space-y-2 bg-slate-900/60">
              <h2 className="font-semibold text-lg">My Vault</h2>
              <p className="text-xs break-all">
                <span className="font-semibold">Vault PDA:</span>{" "}
                {vaultAddress ?? "No vault yet"}
              </p>
              <p>
                <span className="font-semibold">Vault balance (SOL):</span>{" "}
                {vaultBalance ?? "—"}
              </p>
              <button
                onClick={handleInitVault}
                disabled={loading}
                className="mt-2 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 disabled:opacity-50"
              >
                Init My Vault
              </button>
            </section>

            <section className="border border-slate-800 rounded-xl p-4 space-y-2 bg-slate-900/60">
              <h2 className="font-semibold text-lg">Send Tip</h2>
              <input
                type="text"
                placeholder="Recipient wallet address"
                value={recipient}
                onChange={(e) => setRecipient(e.target.value)}
                className="w-full border border-slate-700 bg-slate-950 rounded px-2 py-1 text-sm"
              />
              <input
                type="number"
                placeholder="Amount in SOL"
                value={tipAmount}
                onChange={(e) => setTipAmount(e.target.value)}
                className="w-full border border-slate-700 bg-slate-950 rounded px-2 py-1 text-sm"
              />
              <button
                onClick={handleSendTip}
                disabled={loading}
                className="mt-2 px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50"
              >
                Send Tip
              </button>
            </section>

            <section className="border border-slate-800 rounded-xl p-4 space-y-2 bg-slate-900/60">
              <h2 className="font-semibold text-lg">Withdraw</h2>
              <input
                type="number"
                placeholder="Amount in SOL"
                value={withdrawAmount}
                onChange={(e) => setWithdrawAmount(e.target.value)}
                className="w-full border border-slate-700 bg-slate-950 rounded px-2 py-1 text-sm"
              />
              <button
                onClick={handleWithdraw}
                disabled={loading}
                className="mt-2 px-4 py-2 rounded-lg bg-purple-600 hover:bg-purple-500 disabled:opacity-50"
              >
                Withdraw
              </button>
            </section>

            {message && (
              <div className="border border-slate-700 rounded-xl p-3 bg-slate-900/80">
                {message}
              </div>
            )}
          </>
        )}
      </div>
    </main>
  );
}
