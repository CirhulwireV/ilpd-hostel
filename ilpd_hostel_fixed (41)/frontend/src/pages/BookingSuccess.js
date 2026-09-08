import React, { useEffect, useState, useRef } from "react";
import { useSearchParams, Link } from "react-router-dom";
import API from "../api/axios";

export default function BookingSuccess() {
  const [searchParams] = useSearchParams();
  const [booking, setBooking] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const confirmed = useRef(false);

  useEffect(() => {
    const sessionId = searchParams.get("session_id");
    if (sessionId && !confirmed.current) {
      confirmed.current = true;
      API.post("/bookings/confirm", { sessionId })
        .then(({ data }) => setBooking(data))
        .catch((err) => {
          console.error("Booking confirmation failed:", err);
          const backendMessage = err?.response?.data?.message;
          setError(backendMessage || "Could not confirm booking. Please contact support.");
        })
        .finally(() => setLoading(false));
    } else if (!sessionId) {
      setLoading(false);
    }
  }, [searchParams]);

  const duration = booking ? (booking.billingPeriod === "night" ? Math.max(1, Math.ceil((new Date(booking.checkOut) - new Date(booking.checkIn)) / 86400000)) : Number(booking.billingMonths || 1)) : 0;
  const durationLabel = booking?.billingPeriod === "night" ? "night" : "month";

  if (loading) return (
    <div style={styles.center}>
      <div style={{ textAlign: "center" }}>
        <p style={{ fontSize: "40px" }}>⏳</p>
        <p style={{ color: "#666", marginTop: "12px" }}>Confirming your booking...</p>
      </div>
    </div>
  );

  if (error) return (
    <div style={styles.center}>
      <div style={{ ...styles.card, textAlign: "center" }}>
        <p style={{ fontSize: "40px" }}>❌</p>
        <p style={{ color: "#e53e3e", margin: "12px 0" }}>{error}</p>
        <Link to="/my-bookings"><button style={styles.primaryBtn}>View My Bookings</button></Link>
      </div>
    </div>
  );

  if (!booking) return null;

  return (
    <div style={styles.center}>
      <div style={styles.card}>
        <div style={styles.successBanner}>
          <p style={{ fontSize: "50px" }}>🎉</p>
          <h2 style={{ color: "#fff", fontSize: "24px", fontWeight: "700", margin: "10px 0 6px" }}>Booking Confirmed!</h2>
          <p style={{ color: "rgba(255,255,255,0.85)", fontSize: "14px" }}>Payment confirmed! The admin will allocate your room number shortly.</p>
        </div>

        <div style={styles.cardBody}>
          <div style={styles.roomHighlight}>
            <div style={{ fontSize: "40px" }}>🏨</div>
            <div>
              <p style={{ fontWeight: "700", fontSize: "20px" }}>
                {booking.room?.roomNumber ? `Room ${booking.room.roomNumber}` : `${booking.room?.category || booking.category} (Pending Allocation)`}
              </p>
              <p style={{ color: "#b8860b", fontWeight: "600" }}>
                {booking.room?.category || booking.category}
              </p>
            </div>
          </div>

          <div style={styles.detailsGrid}>
            {[
              ["📅 Check-in", new Date(booking.checkIn).toDateString()],
              ["📅 Check-out", new Date(booking.checkOut).toDateString()],
              ["🌙 Duration", `${duration} ${durationLabel}${duration > 1 ? "s" : ""}`],
              ["💳 Total Paid", `${Number(booking.totalPrice || 0).toLocaleString()} RWF`],
              ["📋 Status", booking.status],
              ["🔖 Payment", booking.paymentStatus],
              ["📆 Booked On", new Date(booking.createdAt).toDateString()],
            ].map(([label, value]) => (
              <div key={label} style={styles.detailRow}>
                <span style={{ color: "#666", fontSize: "13px" }}>{label}</span>
                <span style={{ fontWeight: "600", fontSize: "14px" }}>{value}</span>
              </div>
            ))}
          </div>

          <div style={styles.instructions}>
            <p style={{ fontWeight: "700", marginBottom: "10px" }}>📌 What to do next:</p>
            {[
              "The admin will assign your room number shortly",
              "You will see your room number in My Bookings once allocated",
              "Visit the hostel with your booking confirmation",
              "No need to queue at reception",
            ].map((step, i) => (
              <p key={i} style={{ fontSize: "13px", marginBottom: "6px" }}>✅ {step}</p>
            ))}
          </div>

          <div style={{ display: "flex", gap: "10px", marginTop: "20px" }}>
            <Link to="/my-bookings" style={{ flex: 1 }}>
              <button style={{ ...styles.primaryBtn, width: "100%" }}>View My Bookings</button>
            </Link>
            <Link to="/rooms" style={{ flex: 1 }}>
              <button style={{ ...styles.yellowBtn, width: "100%" }}>Book Another Room</button>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

const styles = {
  center: { minHeight: "calc(100vh - 60px)", display: "flex", alignItems: "center", justifyContent: "center", padding: "20px", background: "linear-gradient(160deg, #f5f0e8, #eef2f7)" },
  card: { width: "100%", maxWidth: "520px", background: "#fffdf9", borderRadius: "16px", overflow: "hidden", boxShadow: "0 4px 32px rgba(0,0,0,0.07)", border: "1px solid #f0ede6" },
  successBanner: { background: "linear-gradient(135deg, #1e6b45, #2d9e68)", padding: "30px 24px", textAlign: "center" },
  cardBody: { padding: "24px" },
  roomHighlight: { display: "flex", gap: "16px", alignItems: "center", background: "#faf7f2", borderRadius: "10px", padding: "16px", marginBottom: "20px" },
  detailsGrid: { display: "flex", flexDirection: "column", gap: "2px", marginBottom: "16px" },
  detailRow: { display: "flex", justifyContent: "space-between", padding: "9px 0", borderBottom: "1px solid #f5f0e8" },
  instructions: { background: "#f0faf4", border: "1px solid #b8e8cc", borderRadius: "8px", padding: "14px" },
  primaryBtn: { background: "linear-gradient(135deg, #c9960d, #a87a0a)", color: "#fff", border: "none", padding: "12px", borderRadius: "8px", cursor: "pointer", fontWeight: "700", fontSize: "14px" },
  outlineBtn: { background: "#fffdf9", color: "#1a1a2e", border: "1px solid #e8e2d9", padding: "12px", borderRadius: "8px", cursor: "pointer", fontWeight: "600", fontSize: "14px" },
  yellowBtn: { background: "#f0c040", color: "#1a1a2e", border: "1px solid #d9a900", padding: "12px", borderRadius: "8px", cursor: "pointer", fontWeight: "700", fontSize: "14px" },
};
