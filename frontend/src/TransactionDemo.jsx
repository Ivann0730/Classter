import { useState } from "react";
import { BrowserWallet, Transaction } from "@meshsdk/core";

export default function TransactionDemo() {
  const [status, setStatus] = useState("idle"); // idle | connecting | building | signing | submitted | error
  const [txHash, setTxHash] = useState("");
  const [error, setError] = useState("");
  const [walletAddress, setWalletAddress] = useState("");

  const runDemo = async () => {
    setError(""); setTxHash(""); setWalletAddress("");

    try {
      // Step 1 — Connect wallet
      setStatus("connecting");
      if (!window.cardano) throw new Error("Lace wallet not found. Please install it.");
      const walletKey = window.cardano.lace ? "lace" : Object.keys(window.cardano)[0];
      const wallet = await BrowserWallet.enable(walletKey);
      const addresses = await wallet.getUsedAddresses();
      const addr = addresses.length > 0 ? addresses[0] : (await wallet.getUnusedAddresses())[0];
      setWalletAddress(addr);

      // Step 2 — Build transaction with metadata
      setStatus("building");
      const metadata = {
        app: "ClassTer",
        action: "attendance_checkin",
        student_id: "DEMO-001",
        class_id: "CS301",
        timestamp: new Date().toISOString(),
        network: "preprod",
      };

      const tx = new Transaction({ initiator: wallet })
        .setMetadata(674, metadata);

      const unsignedTx = await tx.build();

      // Step 3 — Sign (Lace popup appears here)
      setStatus("signing");
      const signedTx = await wallet.signTx(unsignedTx);

      // Step 4 — Submit to Cardano via MeshJS + Blockfrost
      const hash = await wallet.submitTx(signedTx);
      setTxHash(hash);
      setStatus("submitted");

    } catch (e) {
      setError(e.message);
      setStatus("error");
    }
  };

  const statusLabels = {
    idle: null,
    connecting: "Step 1/4 — Connecting Lace wallet...",
    building: "Step 2/4 — Building metadata transaction...",
    signing: "Step 3/4 — Waiting for Lace signature...",
    submitted: "Step 4/4 — Transaction submitted!",
    error: "Transaction failed.",
  };

  return (
    <div style={{ fontFamily: "Times New Roman", maxWidth: 560, margin: "60px auto", padding: 32, border: "1px solid #000" }}>
      <h2 style={{ borderBottom: "2px solid #000", paddingBottom: 10, marginBottom: 8 }}>
        Transaction Demo
      </h2>
      <p style={{ fontSize: 12, color: "#555", marginBottom: 24, lineHeight: 1.6 }}>
        Demonstrates basic transaction submission to the Cardano Preprod blockchain
        using <strong>MeshJS</strong> (open source SDK) and <strong>Blockfrost</strong> (provider API).
        Metadata is written permanently on-chain under CIP-20 label 674.
      </p>

      {/* Tech stack badges */}
      <div style={{ display: "flex", gap: 8, marginBottom: 24, flexWrap: "wrap" }}>
        {["MeshJS SDK", "Blockfrost API", "Cardano Preprod", "CIP-20 Metadata"].map(t => (
          <span key={t} style={{ padding: "3px 10px", border: "1px solid #000", fontSize: 11, fontWeight: "bold", letterSpacing: 0.5 }}>
            {t}
          </span>
        ))}
      </div>

      {/* Metadata preview */}
      <div style={{ background: "#f9f9f9", border: "1px solid #ddd", padding: 14, marginBottom: 24, fontSize: 11, fontFamily: "monospace" }}>
        <div style={{ fontSize: 11, fontWeight: "bold", fontFamily: "Times New Roman", marginBottom: 8, color: "#555", letterSpacing: 1 }}>
          METADATA PAYLOAD (Key 674)
        </div>
        <div>app: "ClassTer"</div>
        <div>action: "attendance_checkin"</div>
        <div>student_id: "DEMO-001"</div>
        <div>class_id: "CS301"</div>
        <div>timestamp: "{new Date().toISOString()}"</div>
        <div>network: "preprod"</div>
      </div>

      {/* Steps */}
      <div style={{ border: "1px solid #000", marginBottom: 24 }}>
        {[
          ["1", "Connect Lace Wallet", "CIP-30 browser wallet standard"],
          ["2", "Build Transaction", "MeshJS constructs metadata tx"],
          ["3", "Sign Transaction", "Lace signs with private key"],
          ["4", "Submit to Cardano", "Blockfrost broadcasts to Preprod"],
        ].map(([n, title, sub], i, arr) => (
          <div key={n} style={{
            display: "flex", alignItems: "center", gap: 14, padding: "10px 16px",
            borderBottom: i < arr.length - 1 ? "1px solid #eee" : "none",
            background: status === ["connecting","building","signing","submitted"][i] ? "#f9f9f9" : "#fff"
          }}>
            <div style={{
              width: 24, height: 24, borderRadius: "50%", border: "1.5px solid #000",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 11, fontWeight: "bold", flexShrink: 0,
              background: status === "submitted" ? "#000" : "#fff",
              color: status === "submitted" ? "#fff" : "#000",
            }}>{status === "submitted" ? "✓" : n}</div>
            <div>
              <div style={{ fontSize: 13, fontWeight: "bold" }}>{title}</div>
              <div style={{ fontSize: 11, color: "#777" }}>{sub}</div>
            </div>
            {status === ["connecting","building","signing"][i] && (
              <div style={{ marginLeft: "auto", fontSize: 11, color: "#555" }}>...</div>
            )}
          </div>
        ))}
      </div>

      {/* Status message */}
      {statusLabels[status] && (
        <div style={{ padding: "10px 14px", border: "1px solid #000", background: "#f9f9f9", fontSize: 12, marginBottom: 16, fontWeight: "bold" }}>
          {statusLabels[status]}
        </div>
      )}

      {/* Wallet address */}
      {walletAddress && (
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 11, color: "#555", marginBottom: 4, letterSpacing: 1, textTransform: "uppercase" }}>Connected Wallet</div>
          <div style={{ fontSize: 10, fontFamily: "monospace", wordBreak: "break-all", padding: "8px 12px", border: "1px solid #ddd", background: "#f9f9f9" }}>
            {walletAddress}
          </div>
        </div>
      )}

      {/* Submit button */}
      {status !== "submitted" && (
        <button
          onClick={runDemo}
          disabled={["connecting","building","signing"].includes(status)}
          style={{
            width: "100%", padding: 14, border: "2px solid #000",
            background: ["connecting","building","signing"].includes(status) ? "#555" : "#000",
            color: "#fff", fontFamily: "Times New Roman", fontSize: 13,
            fontWeight: "bold", letterSpacing: 2, cursor: ["connecting","building","signing"].includes(status) ? "not-allowed" : "pointer",
            textTransform: "uppercase", marginBottom: 12,
          }}
        >
          {["connecting","building","signing"].includes(status) ? "PROCESSING..." : "RUN TRANSACTION DEMO"}
        </button>
      )}

      {/* Success result */}
      {status === "submitted" && txHash && (
        <div style={{ padding: 16, border: "2px solid #000", background: "#f9f9f9" }}>
          <p style={{ fontWeight: "bold", marginBottom: 12, fontSize: 14 }}>
            ✓ Transaction successfully submitted to Cardano Preprod!
          </p>
          <div style={{ fontSize: 11, color: "#555", marginBottom: 4, letterSpacing: 1, textTransform: "uppercase" }}>Transaction Hash</div>
          <div style={{ fontSize: 10, fontFamily: "monospace", wordBreak: "break-all", padding: "8px 12px", border: "1px solid #ddd", background: "#fff", marginBottom: 12 }}>
            {txHash}
          </div>
          <a
            href={`https://preprod.cardanoscan.io/transaction/${txHash}`}
            target="_blank"
            rel="noreferrer"
            style={{ display: "block", padding: 12, background: "#000", color: "#fff", textAlign: "center", textDecoration: "none", fontWeight: "bold", fontSize: 12, letterSpacing: 1 }}
          >
            VIEW ON CARDANO EXPLORER →
          </a>
          <button
            onClick={() => { setStatus("idle"); setTxHash(""); setWalletAddress(""); }}
            style={{ width: "100%", marginTop: 8, padding: 10, background: "#fff", border: "1px solid #000", fontFamily: "Times New Roman", fontSize: 12, cursor: "pointer" }}
          >
            Run Again
          </button>
        </div>
      )}

      {/* Error */}
      {error && (
        <p style={{ color: "red", fontSize: 13, marginTop: 8 }}>✗ {error}</p>
      )}
    </div>
  );
}