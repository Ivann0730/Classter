javascript
import { useTeacherWallet } from "../hooks/useTeacherWallet";

export default function TeacherWalletBar() {
  const { wallet, walletAddress, connecting, error, connectWallet, disconnectWallet } = useTeacherWallet();

  return (
    <div style={{
      borderBottom: "1px solid #ddd", padding: "10px 28px",
      display: "flex", alignItems: "center", justifyContent: "space-between",
      background: "#fafafa", fontFamily: "Times New Roman", fontSize: 12
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <span style={{ fontWeight: "bold", letterSpacing: 1, textTransform: "uppercase", fontSize: 11 }}>
          Teacher Wallet
        </span>
        {walletAddress ? (
          <span style={{ padding: "2px 10px", border: "1px solid #000", fontSize: 10, fontFamily: "monospace", background: "#f0f0f0" }}>
            {walletAddress.slice(0, 14)}...{walletAddress.slice(-8)}
          </span>
        ) : (
          <span style={{ color: "#aaa", fontSize: 11 }}>Not connected</span>
        )}
        {walletAddress && (
          <span style={{ color: "#555", fontSize: 10 }}>
            ✓ Wallet cached — no need to reconnect each session
          </span>
        )}
      </div>

      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
        {error && <span style={{ color: "red", fontSize: 11 }}>✗ {error}</span>}
        {!walletAddress ? (
          <button
            onClick={connectWallet}
            disabled={connecting}
            style={{ padding: "6px 14px", background: "#000", color: "#fff", border: "none", fontFamily: "Times New Roman", fontSize: 12, fontWeight: "bold", cursor: "pointer", letterSpacing: 1 }}
          >
            {connecting ? "Connecting..." : "Connect Lace Wallet"}
          </button>
        ) : (
          <button
            onClick={disconnectWallet}
            style={{ padding: "6px 14px", background: "#fff", color: "#000", border: "1px solid #000", fontFamily: "Times New Roman", fontSize: 12, cursor: "pointer" }}
          >
            Disconnect
          </button>
        )}
      </div>
    </div>
  );
}
