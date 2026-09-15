import React from "react";
import { useNavigate, useLocation } from "react-router-dom";

export default function BackButton() {
  const navigate = useNavigate();
  const location = useLocation();

  if (location.pathname === "/") return null;

  const handleBack = () => {
    if (window.history.length > 1) navigate(-1);
    else navigate("/");
  };

  return (
    <button
      onClick={handleBack}
      title="Go back"
      style={{
        position: "fixed",
        bottom: "24px",      // ← was top
        right: "24px",       // ← was left
        zIndex: 900,
        display: "flex",
        alignItems: "center",
        gap: "6px",
        background: "rgba(26,26,46,0.92)",
        color: "#fff",
        border: "1px solid rgba(184,134,11,0.6)",
        borderRadius: "999px",
        padding: "10px 16px",
        fontSize: "13px",
        fontWeight: "600",
        cursor: "pointer",
        boxShadow: "0 4px 14px rgba(0,0,0,0.25)",
      }}
      onMouseEnter={(e) => { e.currentTarget.style.background = "#b8860b"; }}
      onMouseLeave={(e) => { e.currentTarget.style.background = "rgba(26,26,46,0.92)"; }}
    >
      <span style={{ fontSize: "16px", lineHeight: 1 }}>←</span>
      <span>Back</span>
    </button>
  );
}