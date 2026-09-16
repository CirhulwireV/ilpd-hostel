import React, { useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import API from "../api/axios";

export default function CartIcon({ user }) {
  const [count, setCount] = useState(0);
  const location = useLocation();

  useEffect(() => {
    if (!user) { setCount(0); return; }
    API.get("/cart")
      .then(({ data }) => setCount(data.items?.length || 0))
      .catch(() => setCount(0));
  }, [user, location.pathname]);

  if (!user) return null;

  return (
    <Link to="/cart" style={{ display: "flex", alignItems: "flex-end", gap: "4px", color: "#fff", textDecoration: "none", position: "relative", padding: "4px 6px" }}>
      <div style={{ position: "relative", lineHeight: 1 }}>
        <svg width="34" height="34" viewBox="0 0 34 34" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ display: "block" }}>
          <path d="M3 8 L7 8 L11 24 L29 24 L32 12 L9 12" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none" />
          <circle cx="13" cy="29" r="1.8" fill="#fff" />
          <circle cx="27" cy="29" r="1.8" fill="#fff" />
        </svg>
        <span style={{ position: "absolute", top: "-4px", left: "-6px", background: "#f0c14b", color: "#111", borderRadius: "999px", minWidth: "20px", height: "20px", padding: "0 5px", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "12px", fontWeight: "800", boxShadow: "0 1px 3px rgba(0,0,0,0.3)", border: "1px solid #111" }}>
          {count}
        </span>
      </div>
      <span style={{ fontSize: "14px", fontWeight: "700", color: "#fff" }}>Cart</span>
    </Link>
  );
}
