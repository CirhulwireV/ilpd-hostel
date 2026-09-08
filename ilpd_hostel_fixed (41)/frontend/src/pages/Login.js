import React, { useState } from "react";
import { Link } from "react-router-dom";
import API from "../api/axios";

const loginLabels = {
  emailAddress: "Email Address",
  password: "Password",
};

export default function Login({ login }) {
  const [form, setForm] = useState({ email: "", password: "" });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [redirecting, setRedirecting] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const { data } = await API.post("/auth/login", form);
      
      // Save to localStorage
      localStorage.setItem("user", JSON.stringify(data.user));
      localStorage.setItem("token", data.token);
      
      // Update parent state
      login(data.user, data.token);
      
      // Show redirecting overlay
      setRedirecting(true);
      
      // Force navigation after a brief delay to show the overlay
      setTimeout(() => {
        const redirectPath = data.user.role === "admin" ? "/admin" : "/rooms";
        window.location.href = redirectPath;
      }, 300);
      
    } catch (err) {
      setError(err.response?.data?.message || "Login failed. Check your email and password.");
      setLoading(false);
    }
  };

  return (
    <>
      {/* Loading Overlay - Shows during redirect */}
      {redirecting && (
        <div style={styles.overlay}>
          <div style={styles.overlayContent}>
            <div style={styles.spinner}>⏳</div>
            <h2 style={styles.overlayTitle}>Redirecting...</h2>
            <p style={styles.overlayText}>Taking you to your dashboard</p>
            <div style={styles.progressBar}>
              <div style={styles.progressFill}></div>
            </div>
          </div>
        </div>
      )}

      {/* Login Form */}
      <div style={styles.wrapper}>
        <div style={styles.card}>
          <div style={styles.header}>
            <p style={{ fontSize: "36px" }}>🏨</p>
            <h2 style={styles.title}>Welcome Back</h2>
            <p style={{ color: "#888", fontSize: "14px" }}>Login to your ILPD Hostel account</p>
          </div>
          {error && <div style={styles.errorBox}>{error}</div>}
          <form onSubmit={handleSubmit}>
            <label style={styles.label}>{loginLabels.emailAddress}</label>
            <input 
              type="email" 
              placeholder="your@email.com" 
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })} 
              required 
              disabled={redirecting}
            />
            <label style={styles.label}>{loginLabels.password}</label>
            <input 
              type="password" 
              placeholder="Enter your password" 
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })} 
              required 
              disabled={redirecting}
            />
            <button 
              style={{ ...styles.btn, opacity: (loading || redirecting) ? 0.7 : 1 }} 
              disabled={loading || redirecting}
            >
              {loading ? "⏳ Logging in..." : redirecting ? "🔄 Redirecting..." : "Login →"}
            </button>
          </form>
          <p style={styles.footer}>
            No account? <Link to="/register" style={{ color: "#b8860b", fontWeight: "600" }}>Register here</Link>
          </p>
        </div>
      </div>
    </>
  );
}

const styles = {
  // Overlay styles - covers the whole screen
  overlay: {
    position: "fixed",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(255, 255, 255, 0.95)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 9999,
    animation: "fadeIn 0.3s ease-in"
  },
  overlayContent: {
    textAlign: "center",
    padding: "40px"
  },
  spinner: {
    fontSize: "64px",
    marginBottom: "20px",
    animation: "spin 1s linear infinite"
  },
  overlayTitle: {
    fontSize: "28px",
    fontWeight: "700",
    color: "#1a1a2e",
    marginBottom: "10px"
  },
  overlayText: {
    fontSize: "16px",
    color: "#666",
    marginBottom: "30px"
  },
  progressBar: {
    width: "300px",
    height: "4px",
    backgroundColor: "#e0e0e0",
    borderRadius: "2px",
    overflow: "hidden",
    margin: "0 auto"
  },
  progressFill: {
    width: "100%",
    height: "100%",
    backgroundColor: "#b8860b",
    animation: "progress 0.5s ease-in-out"
  },
  wrapper: { 
    minHeight: "calc(100vh - 60px)", 
    display: "flex", 
    alignItems: "center", 
    justifyContent: "center", 
    background: "linear-gradient(160deg, #f5f0e8, #eef2f7)", 
    padding: "20px" 
  },
  card: { 
    background: "#fffdf9", 
    borderRadius: "16px", 
    padding: "36px", 
    width: "100%", 
    maxWidth: "420px", 
    boxShadow: "0 4px 32px rgba(0,0,0,0.07)", 
    border: "1px solid #f0ede6" 
  },
  header: { 
    textAlign: "center", 
    marginBottom: "28px" 
  },
  title: { 
    fontSize: "24px", 
    fontWeight: "700", 
    margin: "8px 0 4px", 
    color: "#1a1a2e" 
  },
  label: { 
    fontSize: "13px", 
    fontWeight: "600", 
    marginBottom: "6px", 
    display: "block", 
    color: "#555" 
  },
  btn: { 
    width: "100%", 
    background: "linear-gradient(135deg, #c9960d, #a87a0a)", 
    color: "#fff", 
    border: "none", 
    padding: "13px", 
    borderRadius: "8px", 
    cursor: "pointer", 
    fontWeight: "700", 
    fontSize: "15px", 
    marginTop: "4px" 
  },
  errorBox: { 
    background: "#fff5f5", 
    border: "1px solid #fecaca", 
    color: "#b91c1c", 
    padding: "12px", 
    borderRadius: "8px", 
    fontSize: "13px", 
    marginBottom: "16px" 
  },
  footer: { 
    textAlign: "center", 
    marginTop: "20px", 
    fontSize: "14px", 
    color: "#555" 
  },
};

// Add CSS animations
const styleSheet = document.createElement("style");
styleSheet.textContent = `
  @keyframes spin {
    0% { transform: rotate(0deg); }
    100% { transform: rotate(360deg); }
  }
  @keyframes fadeIn {
    0% { opacity: 0; }
    100% { opacity: 1; }
  }
  @keyframes progress {
    0% { width: 0%; }
    100% { width: 100%; }
  }
`;
document.head.appendChild(styleSheet);