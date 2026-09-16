import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import API from "../api/axios";

function PasswordInput({ value, onChange, autoFocus }) {
  const [visible, setVisible] = useState(false);
  return (
    <div style={{ position: "relative" }}>
      <input
        type={visible ? "text" : "password"}
        value={value}
        onChange={onChange}
        autoFocus={autoFocus}
        style={{ ...inp, paddingRight: "42px" }}
      />
      <span
        onClick={() => setVisible((v) => !v)}
        title={visible ? "Hide password" : "Show password"}
        style={{
          position: "absolute",
          top: "50%",
          right: "12px",
          transform: "translateY(-50%)",
          cursor: "pointer",
          fontSize: "16px",
          color: visible ? "#b8860b" : "#888",
          userSelect: "none",
        }}
      >
        👁
      </span>
    </div>
  );
}

export default function Account({ user, logout }) {
  const navigate = useNavigate();

  const [pwForm, setPwForm] = useState({ current: "", next: "", confirm: "" });
  const [pwMsg, setPwMsg] = useState("");
  const [pwErr, setPwErr] = useState("");
  const [pwSaving, setPwSaving] = useState(false);

  const [showDelete, setShowDelete] = useState(false);
  const [deletePassword, setDeletePassword] = useState("");
  const [deleteErr, setDeleteErr] = useState("");
  const [deleteSaving, setDeleteSaving] = useState(false);

  const handleChangePassword = async (e) => {
    e.preventDefault();
    setPwMsg(""); setPwErr("");
    if (!pwForm.current || !pwForm.next || !pwForm.confirm) return setPwErr("Please fill in all fields.");
    if (pwForm.next.length < 6) return setPwErr("New password must be at least 6 characters.");
    if (pwForm.next !== pwForm.confirm) return setPwErr("New password and confirmation do not match.");
    setPwSaving(true);
    try {
      await API.put("/auth/change-password", { currentPassword: pwForm.current, newPassword: pwForm.next });
      setPwMsg("Password updated successfully.");
      setPwForm({ current: "", next: "", confirm: "" });
    } catch (err) {
      setPwErr(err.response?.data?.message || "Could not update password.");
    } finally {
      setPwSaving(false);
    }
  };

  const handleDelete = async (e) => {
    e.preventDefault();
    setDeleteErr("");
    if (!deletePassword) return setDeleteErr("Please enter your password.");
    setDeleteSaving(true);
    try {
      await API.delete("/auth/delete-account", { data: { password: deletePassword } });
      logout();
      navigate("/");
    } catch (err) {
      setDeleteErr(err.response?.data?.message || "Could not delete account.");
    } finally {
      setDeleteSaving(false);
    }
  };

  return (
    <div style={{ minHeight: "calc(100vh - 72px)", background: "#f8f9fa", padding: "48px 20px" }}>
      <div className="container" style={{ maxWidth: "640px" }}>
        <h1 style={{ fontSize: "28px", fontWeight: "800", marginBottom: "6px" }}>My Account</h1>
        <p style={{ color: "#666", marginBottom: "32px" }}>Manage your password and account settings</p>

        <div style={{ background: "#fff", borderRadius: "12px", border: "1px solid #eee", padding: "20px", marginBottom: "24px" }}>
          <h3 style={{ margin: "0 0 12px" }}>Profile</h3>
          <p style={{ margin: "4px 0", fontSize: "14px" }}><strong>Name:</strong> {user?.name}</p>
          <p style={{ margin: "4px 0", fontSize: "14px" }}><strong>Email:</strong> {user?.email}</p>
          <p style={{ margin: "4px 0", fontSize: "14px" }}><strong>Role:</strong> {user?.role}</p>
        </div>

        <div style={{ background: "#fff", borderRadius: "12px", border: "1px solid #eee", padding: "20px", marginBottom: "24px" }}>
          <h3 style={{ margin: "0 0 16px" }}>Change Password</h3>
          <form onSubmit={handleChangePassword}>
            <label style={lbl}>Current password</label>
            <PasswordInput value={pwForm.current} onChange={(e) => setPwForm({ ...pwForm, current: e.target.value })} />

            <label style={lbl}>New password</label>
            <PasswordInput value={pwForm.next} onChange={(e) => setPwForm({ ...pwForm, next: e.target.value })} />

            <label style={lbl}>Confirm new password</label>
            <PasswordInput value={pwForm.confirm} onChange={(e) => setPwForm({ ...pwForm, confirm: e.target.value })} />

            {pwMsg && <p style={{ color: "#276749", fontSize: "13px", marginTop: "10px" }}>✅ {pwMsg}</p>}
            {pwErr && <p style={{ color: "#c53030", fontSize: "13px", marginTop: "10px" }}>⚠️ {pwErr}</p>}

            <button type="submit" disabled={pwSaving} style={{ ...btn, marginTop: "14px" }}>
              {pwSaving ? "Saving..." : "Update Password"}
            </button>
          </form>
        </div>

        <div style={{ background: "#fff5f5", borderRadius: "12px", border: "1px solid #fed7d7", padding: "20px" }}>
          <h3 style={{ margin: "0 0 8px", color: "#9b2c2c" }}>Danger Zone</h3>
          <p style={{ color: "#666", fontSize: "13px", marginBottom: "16px" }}>
            Deleting your account will remove your access permanently. Your booking history stays for the hostel's records.
          </p>
          <button
            onClick={() => { setShowDelete(true); setDeleteErr(""); setDeletePassword(""); }}
            style={{ background: "#c53030", color: "#fff", border: "none", padding: "10px 18px", borderRadius: "8px", cursor: "pointer", fontWeight: "700", fontSize: "14px" }}
          >
            Delete My Account
          </button>
        </div>
      </div>

      {showDelete && (
        <div style={overlay} onClick={() => setShowDelete(false)}>
          <div style={modal} onClick={(e) => e.stopPropagation()}>
            <h3 style={{ marginTop: 0, color: "#9b2c2c" }}>Delete Account?</h3>
            <p style={{ color: "#444", fontSize: "14px", lineHeight: "1.6" }}>
              This cannot be undone. Enter your password to confirm.
            </p>
            <form onSubmit={handleDelete}>
              <label style={lbl}>Password</label>
              <PasswordInput value={deletePassword} onChange={(e) => setDeletePassword(e.target.value)} autoFocus />
              {deleteErr && <p style={{ color: "#c53030", fontSize: "13px", marginTop: "10px" }}>⚠️ {deleteErr}</p>}
              <div style={{ display: "flex", gap: "10px", marginTop: "16px" }}>
                <button type="button" onClick={() => setShowDelete(false)} style={{ ...btn, background: "#f0f0f0", color: "#333" }}>Cancel</button>
                <button type="submit" disabled={deleteSaving} style={{ ...btn, background: "#c53030" }}>{deleteSaving ? "Deleting..." : "Delete My Account"}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

const lbl = { display: "block", fontSize: "13px", fontWeight: "600", marginTop: "12px", marginBottom: "4px", color: "#444" };
const inp = { width: "100%", padding: "10px", borderRadius: "8px", border: "1px solid #ddd", fontSize: "14px", boxSizing: "border-box" };
const btn = { background: "#b8860b", color: "#fff", border: "none", padding: "10px 18px", borderRadius: "8px", cursor: "pointer", fontWeight: "700", fontSize: "14px" };
const overlay = { position: "fixed", inset: 0, background: "rgba(0,0,0,0.55)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 3000, padding: "20px" };
const modal = { background: "#fff", borderRadius: "12px", padding: "24px", width: "100%", maxWidth: "440px" };