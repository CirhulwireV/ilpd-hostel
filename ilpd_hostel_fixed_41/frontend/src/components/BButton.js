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
      aria-label="Go back"
      style={{
        position: "fixed",
        bottom: "24px",
        right: "24px",
        zIndex: 900,
        width: "44px",
        height: "44px",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "rgba(26,26,46,0.92)",
        color: "#fff",
        border: "1px solid rgba(184,134,11,0.6)",
        borderRadius: "50%",
        fontSize: "20px",
        fontWeight: "600",
        cursor: "pointer",
        boxShadow: "0 4px 14px rgba(0,0,0,0.25)",
      }}
      onMouseEnter={(e) => { e.currentTarget.style.background = "#b8860b"; }}
      onMouseLeave={(e) => { e.currentTarget.style.background = "rgba(26,26,46,0.92)"; }}
    >
      ←
    </button>
  );
}