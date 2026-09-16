import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import API from "../api/axios";

const registerLabels = {
  fullName: "Full Name",
  emailAddress: "Email Address",
  phoneNumber: "Phone Number",
  password: "Password",
};

export default function Register({ login }) {
  const navigate = useNavigate();
  const [form, setForm] = useState({ name: "", nationalIdOrPassport: "", nationality: "", position: "", addressOrInstitution: "", purposeOfVisit: "", phone: "", email: "", password: "" });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (form.password.length < 6) return setError("Password must be at least 6 characters");
    setLoading(true);
    setError("");
    try {
      const { data } = await API.post("/auth/register", form);
      login(data.user, data.token);
      navigate("/rooms");
    } catch (err) {
      setError(err.response?.data?.message || "Registration failed. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={styles.wrapper}>
      <div style={styles.card}>
        <div style={styles.header}>
          <p style={{ fontSize: "36px" }}>🏨</p>
          <h2 style={styles.title}>Create Account</h2>
          <p style={{ color: "#888", fontSize: "14px" }}>Join ILPD Hostel and skip the queue</p>
        </div>
        {error && <div style={styles.errorBox}>{error}</div>}
        <form onSubmit={handleSubmit}>
          <label style={styles.label}>{registerLabels.fullName}</label>
          <input placeholder="John Doe" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
          <label style={styles.label}>National ID / Passport</label>
          <input placeholder="National ID or Passport number" value={form.nationalIdOrPassport} onChange={(e) => setForm({ ...form, nationalIdOrPassport: e.target.value })} required />
          <label style={styles.label}>Nationality</label>
          <input placeholder="Nationality" value={form.nationality} onChange={(e) => setForm({ ...form, nationality: e.target.value })} required />
          <label style={styles.label}>Position</label>
          <input placeholder="Position" value={form.position} onChange={(e) => setForm({ ...form, position: e.target.value })} required />
          <label style={styles.label}>Address / Institution</label>
          <input placeholder="Address or institution" value={form.addressOrInstitution} onChange={(e) => setForm({ ...form, addressOrInstitution: e.target.value })} required />
          <label style={styles.label}>Purpose of the Visit</label>
          <input placeholder="Purpose of the visit" value={form.purposeOfVisit} onChange={(e) => setForm({ ...form, purposeOfVisit: e.target.value })} required />
          <label style={styles.label}>{registerLabels.phoneNumber}</label>
          <input type="tel" placeholder="+250 7xx xxx xxx" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} required />
          <label style={styles.label}>{registerLabels.emailAddress}</label>
          <input type="email" placeholder="your@email.com" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required />
          <label style={styles.label}>{registerLabels.password}</label>
          <input type="password" placeholder="Min. 6 characters" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} required />
          <button style={{ ...styles.btn, opacity: loading ? 0.7 : 1 }} disabled={loading}>
            {loading ? "⏳ Creating account..." : "Create Account →"}
          </button>
        </form>
        <p style={styles.footer}>
          Have an account? <Link to="/login" style={{ color: "#b8860b", fontWeight: "600" }}>Login here</Link>
        </p>
      </div>
    </div>
  );
}

const styles = {
  wrapper: { minHeight: "calc(100vh - 60px)", display: "flex", alignItems: "center", justifyContent: "center", background: "linear-gradient(160deg, #f5f0e8, #eef2f7)", padding: "20px" },
  card: { background: "#fffdf9", borderRadius: "16px", padding: "36px", width: "100%", maxWidth: "420px", boxShadow: "0 4px 32px rgba(0,0,0,0.07)", border: "1px solid #f0ede6" },
  header: { textAlign: "center", marginBottom: "28px" },
  title: { fontSize: "24px", fontWeight: "700", margin: "8px 0 4px", color: "#1a1a2e" },
  label: { fontSize: "13px", fontWeight: "600", marginBottom: "6px", display: "block", color: "#555" },
  btn: { width: "100%", background: "linear-gradient(135deg, #c9960d, #a87a0a)", color: "#fff", border: "none", padding: "13px", borderRadius: "8px", cursor: "pointer", fontWeight: "700", fontSize: "15px", marginTop: "4px" },
  errorBox: { background: "#fff5f5", border: "1px solid #fecaca", color: "#b91c1c", padding: "12px", borderRadius: "8px", fontSize: "13px", marginBottom: "16px" },
  footer: { textAlign: "center", marginTop: "20px", fontSize: "14px", color: "#555" },
};
