import React, { useEffect, useState, useCallback } from "react";
import { Link, useNavigate } from "react-router-dom";
import API from "../api/axios";

const fmt = (n) => `${Number(n || 0).toLocaleString()} RWF`;

const refundedAmount = (booking) => (booking?.paymentTransactions || []).reduce((sum, tx) => sum + Math.max(0, Number(tx.refundedAmount || 0)), 0);

const myBookingsLabels = {
  rating: "Rating",
  comments: "Comments",
};

const STATUS_COLORS = {
  pending: { bg: "#fefcbf", color: "#744210" },
  confirmed: { bg: "#c6f6d5", color: "#276749" },
  "checked-in": { bg: "#bee3f8", color: "#2a69ac" },
  "checked-out": { bg: "#e2e8f0", color: "#4a5568" },
  cancelled: { bg: "#fed7d7", color: "#9b2c2c" },
  rejected: { bg: "#fed7d7", color: "#9b2c2c" },
};

const STATUS_ICONS = {
  pending: "⏳",
  confirmed: "✅",
  "checked-in": "🏨",
  "checked-out": "👋",
  cancelled: "❌",
  rejected: "🚫",
};

const DELETABLE_STATUSES = ["checked-out", "cancelled", "rejected"];

function Toast({ message, onClose }) {
  useEffect(() => {
    const t = setTimeout(onClose, 3500);
    return () => clearTimeout(t);
  }, [onClose]);

  return (
    <div style={styles.toast}>
      <span>{message}</span>
      <button onClick={onClose} style={styles.toastClose}>✕</button>
    </div>
  );
}

export default function MyBookings() {
  const navigate = useNavigate();
  const [confirmDialog, setConfirmDialog] = useState(null); // { message, onConfirm }
  const askConfirm = (message, onConfirm) => setConfirmDialog({ message, onConfirm });
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null);
  const [reviewForm, setReviewForm] = useState({ rating: 5, comments: "" });
  const [reviewLoading, setReviewLoading] = useState(false);
  const [toasts, setToasts] = useState([]);
  const [policy, setPolicy] = useState({ cancellationDeadlineDays: 7, refundRule: "", editRule: "", checkoutRule: "" });
  const [editingBooking, setEditingBooking] = useState(null);
  const [expandedGroups, setExpandedGroups] = useState({});
  const [editForm, setEditForm] = useState({ checkIn: "", checkOut: "" });
  const [editLoading, setEditLoading] = useState(false);
  const [extendingBooking, setExtendingBooking] = useState(null);
  const [extendCheckOut, setExtendCheckOut] = useState("");
  const [extendLoading, setExtendLoading] = useState(false);
  const [dismissedReminders, setDismissedReminders] = useState({});

  const addToast = useCallback((msg) => {
    const id = Date.now();
    setToasts((prev) => [...prev, { id, msg }]);
  }, []);

  const removeToast = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  useEffect(() => {
    API.get("/bookings/policy").then(({ data }) => setPolicy(data)).catch(() => {});
    const updateSessionId = new URLSearchParams(window.location.search).get("booking_update_session_id");
    const load = updateSessionId
      ? API.post("/bookings/confirm-update", { sessionId: updateSessionId }).then(({ data }) => addToast(data.message))
      : Promise.resolve();
    load.catch((err) => addToast(err.response?.data?.message || "Unable to confirm the booking update."))
      .finally(() => {
        API.get("/bookings/my")
          .then(({ data }) => setBookings(data))
          .catch((err) => addToast(err.response?.data?.message || "Could not load your bookings. Please try reloading the page."))
          .finally(() => setLoading(false));
      });
  }, [addToast]);

  useEffect(() => {
    const handleFocus = () => {
      API.get("/bookings/my").then(({ data }) => {
        setBookings(data);
        if (selected) {
          const latest = data.find((b) => b._id === selected._id);
          setSelected(latest || null);
        }
      }).catch(() => {});
    };
    window.addEventListener("focus", handleFocus);
    return () => window.removeEventListener("focus", handleFocus);
  }, [selected]);

  const duration = (b) => b.billingPeriod === "night" ? Math.max(1, Math.ceil((new Date(b.checkOut) - new Date(b.checkIn)) / 86400000)) : Number(b.billingMonths || 1);
  const durationLabel = (b) => b.billingPeriod === "night" ? "night" : "month";

  const refreshBookings = async () => {
    try {
      const { data } = await API.get("/bookings/my");
      setBookings(data);
      if (selected) {
        const latest = data.find((b) => b._id === selected._id);
        setSelected(latest || null);
      }
    } catch (err) {
      addToast(err.response?.data?.message || "Could not refresh your bookings list. Try reloading the page.");
    }
  };

  const openEdit = (booking, e) => {
    e?.stopPropagation();
    setEditingBooking(booking);
    setEditForm({
      checkIn: new Date(booking.checkIn).toISOString().slice(0, 10),
      checkOut: new Date(booking.checkOut).toISOString().slice(0, 10),
    });
  };

  const submitEdit = async () => {
    if (!editingBooking) return;
    setEditLoading(true);
    try {
      const { data } = await API.put(`/bookings/${editingBooking._id}/edit`, editForm);
      if (data.action === "payment_required" && data.sessionUrl) {
        window.location.href = data.sessionUrl;
        return;
      }
      addToast(data.message || "Booking updated successfully.");
      setEditingBooking(null);
      await refreshBookings();
    } catch (err) {
      addToast(err.response?.data?.message || "Unable to update booking.");
    } finally {
      setEditLoading(false);
    }
  };

  const openExtend = (booking, e) => {
    e?.stopPropagation();
    setExtendingBooking(booking);
    setExtendCheckOut(new Date(booking.checkOut).toISOString().slice(0, 10));
  };

  const submitExtend = async () => {
    if (!extendingBooking) return;
    setExtendLoading(true);
    try {
      const { data } = await API.put(`/bookings/${extendingBooking._id}/extend`, { checkOut: extendCheckOut });
      if (data.action === "payment_required" && data.sessionUrl) {
        window.location.href = data.sessionUrl;
        return;
      }
      addToast(data.message || "Stay updated successfully.");
      setExtendingBooking(null);
      await refreshBookings();
    } catch (err) {
      addToast(err.response?.data?.message || "Unable to update stay dates.");
    } finally {
      setExtendLoading(false);
    }
  };

  // Reminders: check-in/check-out approaching or arrived, computed from
  // whatever is already loaded — no extra request needed.
  const reminders = (() => {
    const now = new Date();
    const daysBetween = (a, b) => Math.ceil((a - b) / 86400000);
    const items = [];
    for (const b of bookings) {
      if (dismissedReminders[b._id]) continue;
      if (b.status === "confirmed") {
        const daysToCheckIn = daysBetween(new Date(b.checkIn), now);
        if (daysToCheckIn <= 0) {
          items.push({ id: b._id, booking: b, tone: "urgent", text: `Your check-in date for Room ${b.room?.roomNumber || b.category} has arrived. Our team will check you in when you arrive — or adjust your dates below if your plans changed.`, showExtend: true });
        } else if (daysToCheckIn <= 3) {
          items.push({ id: b._id, booking: b, tone: "notice", text: `Check-in for Room ${b.room?.roomNumber || b.category} is coming up in ${daysToCheckIn} day${daysToCheckIn === 1 ? "" : "s"}.`, showExtend: false });
        }
      }
      if (b.status === "checked-in") {
        const daysToCheckOut = daysBetween(new Date(b.checkOut), now);
        if (daysToCheckOut <= 0) {
          items.push({ id: b._id, booking: b, tone: "urgent", text: `Your check-out date for Room ${b.room?.roomNumber} has arrived. Our team will check you out when you're ready to leave — or extend your stay below if you'd like to stay longer.`, showExtend: true });
        } else if (daysToCheckOut <= 2) {
          items.push({ id: b._id, booking: b, tone: "notice", text: `Check-out for Room ${b.room?.roomNumber} is coming up in ${daysToCheckOut} day${daysToCheckOut === 1 ? "" : "s"}. Want to stay longer?`, showExtend: true });
        }
      }
    }
    return items;
  })();

  const cancelBooking = (id, e) => {
    e?.stopPropagation();
    askConfirm(`Cancel this booking? Client cancellations must be made at least ${policy.cancellationDeadlineDays} day${policy.cancellationDeadlineDays === 1 ? "" : "s"} before check-in.`, () => cancelBookingConfirmed(id));
  };

  const cancelBookingConfirmed = async (id) => {
    try {
      const { data } = await API.post(`/bookings/${id}/cancel`);
      addToast(data.message);
      await refreshBookings();
    } catch (err) {
      addToast(err.response?.data?.message || "Unable to cancel booking.");
    }
  };

  const deleteBooking = (id, e) => {
    e?.stopPropagation();
    askConfirm("Remove this booking from your history? This can't be undone.", () => deleteBookingConfirmed(id));
  };

  const deleteBookingConfirmed = async (id) => {
    try {
      await API.delete(`/bookings/${id}/history`);
      setBookings((prev) => prev.filter((b) => b._id !== id));
      if (selected?._id === id) setSelected(null);
      addToast("Booking removed from your history.");
    } catch (err) {
      addToast(err.response?.data?.message || "Unable to delete this booking.");
    }
  };

  const submitReview = async (bookingId) => {
    setReviewLoading(true);
    try {
      await API.post("/surveys", { bookingId, rating: reviewForm.rating, comments: reviewForm.comments });
      addToast("Thank you for your review!");
      setReviewForm({ rating: 5, comments: "" });
      await refreshBookings();
    } catch (err) {
      addToast(err.response?.data?.message || "Unable to submit review.");
    } finally {
      setReviewLoading(false);
    }
  };

  if (loading) return <div style={styles.center}><p>Loading your bookings...</p></div>;

  if (bookings.length === 0) return (
    <div style={styles.center}>
      <div className="card" style={{ textAlign: "center", padding: "50px", maxWidth: "400px" }}>
        <p style={{ fontSize: "50px" }}>🏨</p>
        <h3 style={{ margin: "16px 0 8px" }}>No Bookings Yet</h3>
        <p style={{ color: "#666", marginBottom: "24px" }}>You haven't made any bookings. Browse our rooms and book your stay!</p>
        <Link to="/rooms"><button className="btn btn-primary" style={{ width: "100%" }}>Browse Rooms</button></Link>
      </div>
    </div>
  );

  return (
    <div className="container" style={{ padding: "40px 20px" }}>
      {/* Toast stack */}
      <div style={styles.toastStack}>
        {toasts.map(({ id, msg }) => (
          <Toast key={id} message={msg} onClose={() => removeToast(id)} />
        ))}
      </div>

      {confirmDialog && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.55)", zIndex: 4000, display: "flex", alignItems: "center", justifyContent: "center", padding: "20px" }} onClick={() => setConfirmDialog(null)}>
          <div style={{ background: "#fff", width: "min(420px, 100%)", borderRadius: "14px", padding: "22px" }} onClick={(e) => e.stopPropagation()}>
            <p style={{ margin: "0 0 20px", fontSize: "14px", color: "#333" }}>{confirmDialog.message}</p>
            <div style={{ display: "flex", gap: "10px", justifyContent: "flex-end" }}>
              <button className="btn btn-secondary" onClick={() => setConfirmDialog(null)}>Cancel</button>
              <button className="btn btn-primary" onClick={() => { const action = confirmDialog.onConfirm; setConfirmDialog(null); action(); }}>Confirm</button>
            </div>
          </div>
        </div>
      )}

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "24px", flexWrap: "wrap", gap: "12px" }}>
        <div>
          <h2 style={{ fontSize: "28px", fontWeight: "700" }}>My Bookings</h2>
          <p style={{ color: "#666", marginTop: "4px" }}>You have {bookings.length} booking{bookings.length > 1 ? "s" : ""}</p>
          <p style={{ color: "#777", fontSize: "12px", marginTop: "6px" }}>Cancellation: {policy.cancellationDeadlineDays} day{policy.cancellationDeadlineDays === 1 ? "" : "s"} before check-in.</p>
        </div>
        <Link to="/rooms"><button className="btn btn-primary">+ New Booking</button></Link>
      </div>

      {reminders.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: "10px", marginBottom: "22px" }}>
          {reminders.map((r) => (
            <div key={r.id} style={{
              display: "flex", justifyContent: "space-between", alignItems: "center", gap: "12px", flexWrap: "wrap",
              padding: "12px 16px", borderRadius: "10px",
              background: r.tone === "urgent" ? "#fff5f5" : "#fffaf0",
              border: `1px solid ${r.tone === "urgent" ? "#feb2b2" : "#fbd38d"}`,
            }}>
              <span style={{ fontSize: "13px", color: r.tone === "urgent" ? "#9b2c2c" : "#7c5a10" }}>
                {r.tone === "urgent" ? "⏰" : "📅"} {r.text}
              </span>
              <div style={{ display: "flex", gap: "8px", flexShrink: 0 }}>
                {r.showExtend && (
                  <button className="btn btn-secondary" style={{ padding: "5px 12px", fontSize: "12px" }} onClick={() => openExtend(r.booking)}>
                    Adjust dates
                  </button>
                )}
                <button onClick={() => setDismissedReminders((prev) => ({ ...prev, [r.id]: true }))} style={{ background: "none", border: "none", cursor: "pointer", color: "#999", fontSize: "16px", lineHeight: 1 }} title="Dismiss">✕</button>
              </div>
            </div>
          ))}
        </div>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
        {(() => {
          const renderCard = (b) => (
            <div key={b._id} className="card" style={styles.bookingCard} onClick={() => setSelected(b)}>
              <div style={styles.roomInfo}>
                <div style={styles.roomIcon}>🏨</div>
                <div>
                  <p style={{ fontWeight: "700", fontSize: "18px" }}>
                    {b.room?.roomNumber ? `Room ${b.room.roomNumber}` : `${b.room?.category || b.category || "Room"} (Pending Allocation)`}
                  </p>
                  <p style={{ color: "#b8860b", fontSize: "13px", fontWeight: "600" }}>
                    {b.room?.category || b.category}
                  </p>
                </div>
              </div>
              <div style={styles.bookingDetails}>
                <div style={styles.detailItem}>
                  <span style={styles.detailLabel}>Check-in</span>
                  <span style={styles.detailValue}>{new Date(b.checkIn).toDateString()}</span>
                </div>
                <div style={styles.detailItem}>
                  <span style={styles.detailLabel}>Check-out</span>
                  <span style={styles.detailValue}>{new Date(b.checkOut).toDateString()}</span>
                </div>
                <div style={styles.detailItem}>
                  <span style={styles.detailLabel}>Duration</span>
                  <span style={styles.detailValue}>{duration(b)} {durationLabel(b)}{duration(b) > 1 ? "s" : ""}</span>
                </div>
                <div style={styles.detailItem}>
                  <span style={styles.detailLabel}>Total Paid</span>
                  <span style={{ ...styles.detailValue, color: "#b8860b", fontWeight: "700" }}>{fmt(b.totalPrice)}</span>
                </div>
                {refundedAmount(b) > 0 && (
                  <div style={styles.detailItem}>
                    <span style={styles.detailLabel}>Refunded Amount</span>
                    <span style={{ ...styles.detailValue, color: "#276749", fontWeight: "700" }}>{fmt(refundedAmount(b))}</span>
                  </div>
                )}
              </div>
              <div style={styles.statusSection}>
                <span style={{ background: STATUS_COLORS[b.status]?.bg, color: STATUS_COLORS[b.status]?.color, padding: "6px 14px", borderRadius: "20px", fontSize: "13px", fontWeight: "600" }}>
                  {STATUS_ICONS[b.status]} {b.status.charAt(0).toUpperCase() + b.status.slice(1)}
                </span>
                <span style={{ background: b.paymentStatus === "paid" ? "#c6f6d5" : "#fed7d7", color: b.paymentStatus === "paid" ? "#276749" : "#9b2c2c", padding: "6px 14px", borderRadius: "20px", fontSize: "13px", fontWeight: "600" }}>
                  💳 {b.paymentStatus.charAt(0).toUpperCase() + b.paymentStatus.slice(1)}
                </span>
                {["pending", "confirmed"].includes(b.status) && (
                  <button onClick={(e) => cancelBooking(b._id, e)} title="Cancel booking"
                    style={{ background: "none", border: "1px solid #f6ad55", color: "#9c4221", borderRadius: "8px", padding: "5px 10px", fontSize: "12px", cursor: "pointer" }}>
                    ❌ Cancel
                  </button>
                )}
                {DELETABLE_STATUSES.includes(b.status) && (
                  <button onClick={(e) => deleteBooking(b._id, e)} title="Remove from history"
                    style={{ background: "none", border: "1px solid #fc8181", color: "#c53030", borderRadius: "8px", padding: "5px 10px", fontSize: "12px", cursor: "pointer" }}>
                    🗑️ Delete
                  </button>
                )}
                {b.status === "pending" && !b.room && (
                  <button onClick={(e) => openEdit(b, e)} title="Edit booking dates"
                    style={{ background: "none", border: "1px solid #4299e1", color: "#2b6cb0", borderRadius: "8px", padding: "5px 10px", fontSize: "12px", cursor: "pointer" }}>
                    ✏️ Update
                  </button>
                )}
                {["pending", "confirmed", "checked-in"].includes(b.status) && (
                  <button onClick={(e) => { e.stopPropagation(); navigate(`/support?bookingId=${b._id}`); }} title="Contact support about this booking"
                    style={{ background: "none", border: "1px solid #805ad5", color: "#553c9a", borderRadius: "8px", padding: "5px 10px", fontSize: "12px", cursor: "pointer" }}>
                    📨 Support
                  </button>
                )}
                <span style={styles.viewDetails}>View Details →</span>
              </div>
            </div>
          );

          // Group repeat stays in the same room (or same category, if a room
          // hasn't been assigned yet) so they appear once with an expandable
          // history, instead of as separate cards each time.
          const groups = new Map();
          for (const b of bookings) {
            const key = b.room?._id ? `room:${b.room._id}` : `cat:${b.category}:${b.accommodationType}`;
            if (!groups.has(key)) groups.set(key, []);
            groups.get(key).push(b);
          }

          return [...groups.entries()].map(([key, group]) => {
            if (group.length === 1) return renderCard(group[0]);
            const sorted = [...group].sort((a, b) => new Date(b.checkIn) - new Date(a.checkIn));
            const latest = sorted[0];
            const isExpanded = !!expandedGroups[key];
            return (
              <div key={key} className="card" style={{ ...styles.bookingCard, cursor: "default" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", cursor: "pointer" }} onClick={() => setExpandedGroups((prev) => ({ ...prev, [key]: !prev[key] }))}>
                  <div style={styles.roomInfo}>
                    <div style={styles.roomIcon}>🏨</div>
                    <div>
                      <p style={{ fontWeight: "700", fontSize: "18px" }}>
                        {latest.room?.roomNumber ? `Room ${latest.room.roomNumber}` : `${latest.room?.category || latest.category || "Room"} (Pending Allocation)`}
                      </p>
                      <p style={{ color: "#b8860b", fontSize: "13px", fontWeight: "600" }}>
                        {group.length} stays booked in this room
                      </p>
                    </div>
                  </div>
                  <span style={{ fontWeight: "700", color: "#666" }}>{isExpanded ? "▲ Hide stays" : "▼ Show all stays"}</span>
                </div>
                {isExpanded && (
                  <div style={{ display: "flex", flexDirection: "column", gap: "12px", marginTop: "14px" }}>
                    {sorted.map(renderCard)}
                  </div>
                )}
              </div>
            );
          });
        })()}
      </div>

      {editingBooking && (
        <div style={styles.modalOverlay} onClick={() => !editLoading && setEditingBooking(null)}>
          <div className="card" style={styles.modal} onClick={(e) => e.stopPropagation()}>
            <h3 style={{ marginBottom: "8px" }}>✏️ Update Booking</h3>
            <p style={{ color: "#666", fontSize: "13px", marginBottom: "18px" }}>Edit your dates while the booking is pending and no room has been assigned.</p>
            <div style={{ display: "grid", gap: "14px" }}>
              <div>
                <label style={{ display: "block", fontSize: "12px", fontWeight: "700", marginBottom: "5px" }}>Check-in</label>
                <input type="date" value={editForm.checkIn} onChange={(e) => setEditForm((f) => ({ ...f, checkIn: e.target.value }))} style={{ width: "100%", marginBottom: 0 }} />
              </div>
              <div>
                <label style={{ display: "block", fontSize: "12px", fontWeight: "700", marginBottom: "5px" }}>Check-out</label>
                <input type="date" value={editForm.checkOut} onChange={(e) => setEditForm((f) => ({ ...f, checkOut: e.target.value }))} style={{ width: "100%", marginBottom: 0 }} />
              </div>
              <div style={{ display: "flex", gap: "10px", justifyContent: "flex-end" }}>
                <button className="btn btn-secondary" onClick={() => setEditingBooking(null)} disabled={editLoading}>Cancel</button>
                <button className="btn btn-primary" onClick={submitEdit} disabled={editLoading}>{editLoading ? "Updating..." : "Save Changes"}</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {extendingBooking && (
        <div style={styles.modalOverlay} onClick={() => !extendLoading && setExtendingBooking(null)}>
          <div className="card" style={styles.modal} onClick={(e) => e.stopPropagation()}>
            <h3 style={{ marginBottom: "8px" }}>📅 Extend or Reduce Stay</h3>
            <p style={{ color: "#666", fontSize: "13px", marginBottom: "18px" }}>
              Room {extendingBooking.room?.roomNumber} · Currently checked out on {new Date(extendingBooking.checkOut).toDateString()}.
              Choose a new check-out date — if it's later you'll pay the difference, if it's earlier the unused portion is refunded automatically where possible.
            </p>
            <div style={{ display: "grid", gap: "14px" }}>
              <div>
                <label style={{ display: "block", fontSize: "12px", fontWeight: "700", marginBottom: "5px" }}>New check-out date</label>
                <input type="date" value={extendCheckOut} onChange={(e) => setExtendCheckOut(e.target.value)} style={{ width: "100%", marginBottom: 0 }} />
              </div>
              <div style={{ display: "flex", gap: "10px", justifyContent: "flex-end" }}>
                <button className="btn btn-secondary" onClick={() => setExtendingBooking(null)} disabled={extendLoading}>Cancel</button>
                <button className="btn btn-primary" onClick={submitExtend} disabled={extendLoading}>{extendLoading ? "Saving..." : "Save Changes"}</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {selected && (
        <div style={styles.modalOverlay} onClick={() => setSelected(null)}>
          <div className="card" style={styles.modal} onClick={(e) => e.stopPropagation()}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
              <h3>Booking Details</h3>
              <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
                {["pending", "confirmed"].includes(selected.status) && (
                  <button onClick={(e) => cancelBooking(selected._id, e)}
                    style={{ background: "none", border: "1px solid #f6ad55", color: "#9c4221", borderRadius: "8px", padding: "6px 12px", fontSize: "13px", cursor: "pointer" }}>
                    ❌ Cancel booking
                  </button>
                )}
                {DELETABLE_STATUSES.includes(selected.status) && (
                  <button onClick={(e) => deleteBooking(selected._id, e)}
                    style={{ background: "none", border: "1px solid #fc8181", color: "#c53030", borderRadius: "8px", padding: "6px 12px", fontSize: "13px", cursor: "pointer" }}>
                    🗑️ Delete from history
                  </button>
                )}
                {selected.status === "pending" && !selected.room && (
                  <button onClick={(e) => openEdit(selected, e)}
                    style={{ background: "none", border: "1px solid #4299e1", color: "#2b6cb0", borderRadius: "8px", padding: "6px 12px", fontSize: "13px", cursor: "pointer" }}>
                    ✏️ Update
                  </button>
                )}
                <button onClick={() => setSelected(null)} style={{ background: "none", border: "none", fontSize: "20px", cursor: "pointer" }}>✕</button>
              </div>
            </div>
            <div style={styles.detailsGrid}>
              {[
                ["⭐ Category", selected.room?.category || selected.category],
                ["🏨 Room Number", selected.room?.roomNumber ? `Room ${selected.room.roomNumber}` : "Pending admin allocation"],
                ["📅 Check-in", new Date(selected.checkIn).toDateString()],
                ["📅 Check-out", new Date(selected.checkOut).toDateString()],
                ["🌙 Duration", `${duration(selected)} ${durationLabel(selected)}${duration(selected) > 1 ? "s" : ""}`],
                ["💳 Total Paid", fmt(selected.totalPrice)],
                ...(refundedAmount(selected) > 0 ? [["↩️ Refunded Amount", fmt(refundedAmount(selected))]] : []),
                ["📋 Booking Status", `${STATUS_ICONS[selected.status]} ${selected.status}`],
                ["💳 Payment Status", selected.paymentStatus],
                ["📆 Booked On", new Date(selected.createdAt).toDateString()],
              ].map(([label, value]) => (
                <div key={label} style={styles.detailRow}>
                  <span style={styles.detailRowLabel}>{label}</span>
                  <span style={styles.detailRowValue}>{value}</span>
                </div>
              ))}
            </div>

            {selected.occupants?.length > 0 && (
              <div style={{ marginTop: "16px", padding: "14px", background: "#f8f9fa", borderRadius: "10px", border: "1px solid #e2e8f0" }}>
                <h4 style={{ margin: "0 0 10px", fontSize: "15px" }}>👥 People in this booking</h4>
                {selected.occupants.map((o, i) => (
                  <div key={o._id || i} style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "8px", padding: "8px 0", borderBottom: "1px solid #eee", fontSize: "13px" }}>
                    <span><strong>{o.name || `Person ${i + 1}`}</strong></span>
                    <span>{o.room?.roomNumber ? `Room ${o.room.roomNumber}` : "Room pending"}</span>
                    <span>{o.status}</span>
                  </div>
                ))}
              </div>
            )}

            {selected.status === "pending" && (
              <div style={{ marginTop: "16px", padding: "14px", background: "#fefcbf", borderRadius: "8px", fontSize: "13px", color: "#744210" }}>
                ⏳ Your booking is pending. The admin will allocate a room number to you shortly.
              </div>
            )}

            {selected.status === "confirmed" && (
              <div style={{ marginTop: "16px", padding: "16px", background: "#f0fff4", borderRadius: "12px", border: "1px solid #b2f5ea" }}>
                <h4 style={{ margin: "0 0 8px", color: "#276749", fontSize: "15px" }}>Room Allocated — Awaiting Arrival</h4>
                <p style={{ fontSize: "13px", color: "#4a5568", marginBottom: 0 }}>The admin will record your check-in when you arrive.</p>
              </div>
            )}

            {selected.status === "checked-in" && (
              <div style={{ marginTop: "16px", padding: "16px", background: "#ebf8ff", borderRadius: "12px", border: "1px solid #bee3f8" }}>
                <h4 style={{ margin: "0 0 8px", color: "#2b6cb0", fontSize: "15px" }}>Currently Checked In</h4>
                <p style={{ fontSize: "13px", color: "#4a5568", marginBottom: 0 }}>You are currently residing in your room. Check-out will be recorded directly by the hostel admin when you leave.</p>
              </div>
            )}

            {selected.status === "checked-out" && !selected.reviewed && (
              <div style={{ marginTop: "20px", padding: "18px", background: "#fff7f0", borderRadius: "14px", border: "1px solid #fae1d8" }}>
                <h4 style={{ margin: 0, marginBottom: "12px", fontSize: "16px" }}>How was your stay?</h4>
                <div style={{ display: "grid", gap: "12px" }}>
                  <label style={{ fontSize: "13px", fontWeight: "700" }}>{myBookingsLabels.rating}</label>
                  <select value={reviewForm.rating} onChange={(e) => setReviewForm({ ...reviewForm, rating: Number(e.target.value) })}
                    style={{ padding: "10px", borderRadius: "10px", border: "1px solid #d1d5db" }}>
                    {[5, 4, 3, 2, 1].map((s) => <option key={s} value={s}>{s} star{s > 1 ? "s" : ""}</option>)}
                  </select>
                  <label style={{ fontSize: "13px", fontWeight: "700" }}>{myBookingsLabels.comments}</label>
                  <textarea rows="4" value={reviewForm.comments} onChange={(e) => setReviewForm({ ...reviewForm, comments: e.target.value })}
                    style={{ width: "100%", padding: "10px", borderRadius: "10px", border: "1px solid #d1d5db" }}
                    placeholder="Tell us what you liked or what could be better." />
                  <button onClick={() => submitReview(selected._id)} disabled={reviewLoading}
                    style={{ background: "#2b6cb0", color: "#fff", border: "none", borderRadius: "10px", padding: "12px", cursor: "pointer", fontWeight: "700" }}>
                    {reviewLoading ? "Submitting..." : "Submit Review"}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

const styles = {
  toastStack: { position: "fixed", top: "80px", right: "20px", zIndex: 9999, display: "flex", flexDirection: "column", gap: "10px" },
  toast: { background: "#1a1a2e", color: "#fff", padding: "14px 18px", borderRadius: "10px", fontSize: "14px", fontWeight: "600", boxShadow: "0 4px 20px rgba(0,0,0,0.25)", display: "flex", alignItems: "center", gap: "12px", minWidth: "260px", maxWidth: "380px" },
  toastClose: { background: "none", border: "none", color: "#fff", cursor: "pointer", fontSize: "16px", marginLeft: "auto" },
  center: { minHeight: "calc(100vh - 60px)", display: "flex", alignItems: "center", justifyContent: "center", padding: "20px" },
  bookingCard: { cursor: "pointer", transition: "box-shadow 0.2s", background: "#fffdf9", border: "1px solid #f0ede6" },
  roomInfo: { display: "flex", alignItems: "center", gap: "14px", marginBottom: "16px" },
  roomIcon: { fontSize: "36px", background: "#f5f0e8", borderRadius: "10px", padding: "10px", lineHeight: 1 },
  bookingDetails: { display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))", gap: "12px", marginBottom: "16px", padding: "16px", background: "#faf7f2", borderRadius: "8px" },
  detailItem: { display: "flex", flexDirection: "column", gap: "4px" },
  detailLabel: { fontSize: "11px", color: "#999", textTransform: "uppercase", fontWeight: "600" },
  detailValue: { fontSize: "14px", fontWeight: "600", color: "#1a1a2e" },
  statusSection: { display: "flex", gap: "10px", alignItems: "center", flexWrap: "wrap" },
  viewDetails: { marginLeft: "auto", color: "#b8860b", fontSize: "13px", fontWeight: "600" },
  modalOverlay: { position: "fixed", inset: 0, background: "rgba(15,20,40,0.55)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 200, padding: "20px" },
  modal: { width: "100%", maxWidth: "500px", maxHeight: "90vh", overflowY: "auto", background: "#fffdf9", borderRadius: "14px", padding: "24px", border: "1px solid #f0ede6" },
  detailsGrid: { display: "flex", flexDirection: "column", gap: "2px" },
  detailRow: { display: "flex", justifyContent: "space-between", padding: "10px 0", borderBottom: "1px solid #f5f0e8", fontSize: "14px" },
  detailRowLabel: { color: "#777" },
  detailRowValue: { fontWeight: "600", color: "#1a1a2e" },
};
