import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import API from "../api/axios";

const CATEGORY_DISPLAY = {
  Standard: { icon: "⭐", color: "#4a90d9", bg: "#e8f4fd", tag: "Best Value", desc: "Comfortable and cozy room with all essential amenities for a pleasant stay.", amenities: ["Bed", "TV", "Free WiFi", "Private Bathroom"] },
  VIP: { icon: "⭐⭐", color: "#b8860b", bg: "#fff8e6", tag: "Most Popular", desc: "Spacious room with premium furnishings and city views.", amenities: ["Bed", "TV", "Free WiFi", "Private Bathroom"] },
  VVIP: { icon: "⭐⭐⭐", color: "#7b2d8b", bg: "#f5e6ff", tag: "Ultra Luxury", desc: "Ultra-luxury room with panoramic views and premium service.", amenities: ["Bed", "TV", "Free WiFi", "Private Bathroom"] },
};

const fmt = (n) => `${Number(n || 0).toLocaleString()} RWF`;

export default function Rooms({ user }) {
  const navigate = useNavigate();
  const [booking, setBooking] = useState(null);
  const [showTerms, setShowTerms] = useState(null);
  const [termsAnswer, setTermsAnswer] = useState("");
  const [form, setForm] = useState({ checkIn: "", checkOut: "", numberOfOccupants: 1, occupantNames: [""] });
  const [blocks, setBlocks] = useState([]);
  const [selectedBlockName, setSelectedBlockName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [policy, setPolicy] = useState({ cancellationDeadlineDays: 7 });
  const [rates, setRates] = useState([]);
  const [ratesLoading, setRatesLoading] = useState(false);
  const [cartMsg, setCartMsg] = useState("");
  const [cartErr, setCartErr] = useState("");
  const [cartBusy, setCartBusy] = useState(false);

  const calculateMonths = (start, end) => {
    if (!start || !end) return 0;
    const startDate = new Date(`${start}T00:00:00Z`);
    const endDate = new Date(`${end}T00:00:00Z`);
    if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime()) || endDate <= startDate) return 0;
    let months = (endDate.getUTCFullYear() - startDate.getUTCFullYear()) * 12 + (endDate.getUTCMonth() - startDate.getUTCMonth());
    const anniversary = new Date(startDate);
    anniversary.setUTCDate(1);
    anniversary.setUTCMonth(anniversary.getUTCMonth() + months);
    const lastDay = new Date(Date.UTC(anniversary.getUTCFullYear(), anniversary.getUTCMonth() + 1, 0)).getUTCDate();
    anniversary.setUTCDate(Math.min(startDate.getUTCDate(), lastDay));
    if (anniversary < endDate) months += 1;
    return Math.max(1, months);
  };

  const stayNights = (() => {
    if (!form.checkIn || !form.checkOut) return 0;
    const a = new Date(`${form.checkIn}T00:00:00Z`);
    const b = new Date(`${form.checkOut}T00:00:00Z`);
    return b > a ? Math.ceil((b - a) / 86400000) : 0;
  })();
  const months = calculateMonths(form.checkIn, form.checkOut);

  const blockRates = rates.filter((r) => r.blockName === selectedBlockName);
  const selectedBlock = blocks.find((b) => b.name === selectedBlockName) || null;
  const selectedPeriod = selectedBlock?.billingType === "per_night" ? "night" : "month";
  const durationUnits = selectedPeriod === "night" ? stayNights : months;

  const cards = blockRates.map((r) => {
    const isFlat = r.usesCategories === false;
    const display = isFlat
      ? { icon: "🏨", color: "#b8860b", bg: "#fff8e6", tag: "Available", desc: `Comfortable room in ${r.blockName} with all essential amenities.`, amenities: ["Bed", "TV", "Free WiFi", "Private Bathroom"] }
      : (CATEGORY_DISPLAY[r.category] || { icon: "🏨", color: "#4a90d9", bg: "#e8f4fd", tag: "", desc: "", amenities: [] });
    return {
      key: `${r.blockName}-${r.category ?? "flat"}`,
      name: r.category ?? r.blockName,
      displayName: r.blockName,
      price: r.price,
      usesCategories: r.usesCategories,
      image: r.image || null,
      ...display,
    };
  });

  useEffect(() => {
    API.get("/bookings/policy").then(({ data }) => setPolicy(data)).catch(() => {});
    API.get("/hostel-structure/blocks").then(({ data }) => {
      const activeBlocks = (data || []).filter((b) => b.active !== false);
      setBlocks(activeBlocks);
      if (activeBlocks.length) setSelectedBlockName(activeBlocks[0].name);
    }).catch(() => setBlocks([]));
  }, []);

  useEffect(() => {
    let active = true;
    setRatesLoading(true);
    API.get("/rooms/rates")
      .then(({ data }) => { if (active) setRates(data || []); })
      .catch(() => { if (active) setRates([]); })
      .finally(() => { if (active) setRatesLoading(false); });
    return () => { active = false; };
  }, []);

  const addToCart = async (cat) => {
    setCartMsg(""); setCartErr("");
    if (!user) { navigate("/login"); return; }
    if (!form.checkIn || !form.checkOut || durationUnits <= 0) {
      setCartErr("Please choose check-in and check-out dates first.");
      return;
    }
    setCartBusy(true);
    try {
      await API.post("/cart/items", {
        category: cat.usesCategories === false ? undefined : cat.name,
        blockName: selectedBlockName,
        checkIn: form.checkIn,
        checkOut: form.checkOut,
        numberOfOccupants: form.numberOfOccupants,
        occupantNames: form.occupantNames,
      });
      setCartMsg(`${cat.displayName} added to cart.`);
      setTimeout(() => setCartMsg(""), 3000);
    } catch (err) {
      setCartErr(err.response?.data?.message || "Could not add to cart.");
    } finally {
      setCartBusy(false);
    }
  };

  const handleBook = async (e) => {
    e.preventDefault();
    if (durationUnits <= 0) return setError("Check-out must be after check-in");
    setLoading(true);
    setError("");
    try {
      const { data } = await API.post("/bookings", {
        blockName: selectedBlockName,
        category: booking?.usesCategories === false ? undefined : (booking?.name || undefined),
        checkIn: form.checkIn,
        checkOut: form.checkOut,
        numberOfOccupants: form.numberOfOccupants,
        occupantNames: form.occupantNames,
      });
      window.location.href = data.sessionUrl;
    } catch (err) {
      setError(err.response?.data?.message || "Booking failed. Please try again.");
      setLoading(false);
    }
  };

  return (
    <div style={{ background: "#f8f9fa", minHeight: "calc(100vh - 60px)" }}>
      <div style={styles.banner}>
        <h1 style={styles.bannerTitle}>Our Rooms</h1>
        <p style={styles.bannerSub}>Choose your block, pay securely, and the admin will allocate your room number — no queue at reception!</p>
      </div>

      <div className="container" style={{ padding: "40px 20px" }}>
        <div style={styles.infoBox}>
          ℹ️ <strong>Choose an accommodation block:</strong> Each block shows its actual room price, exactly what you'll be charged.
        </div>

        {blocks.length > 0 ? (
          <div style={{ display: "flex", gap: "10px", flexWrap: "wrap", marginBottom: "24px" }}>
            {blocks.map((block) => (
              <button key={block._id} type="button"
                onClick={() => setSelectedBlockName(block.name)}
                style={{ ...styles.locationBtn, ...(selectedBlockName === block.name ? styles.locationBtnActive : {}) }}>
                🏨 {block.name} · {block.billingType === "per_night" ? "per night" : "per month"}
              </button>
            ))}
          </div>
        ) : (
          <div style={{ ...styles.infoBox, background: "#fff8e6" }}>
            No accommodation blocks have been configured yet. Please contact the administrator.
          </div>
        )}

        {user && (
          <div style={{ background: "#fff", borderRadius: "12px", padding: "16px", marginBottom: "20px", border: "1px solid #eee" }}>
            <p style={{ margin: "0 0 10px", fontWeight: "700", fontSize: "14px" }}>📅 Choose your stay dates</p>
            <div style={{ display: "flex", gap: "12px", flexWrap: "wrap" }}>
              <div style={{ flex: 1, minWidth: "180px" }}>
                <label style={styles.label}>Check-in</label>
                <input type="date" value={form.checkIn} min={new Date().toISOString().split("T")[0]}
                  onChange={(e) => setForm({ ...form, checkIn: e.target.value })} />
              </div>
              <div style={{ flex: 1, minWidth: "180px" }}>
                <label style={styles.label}>Check-out</label>
                <input type="date" value={form.checkOut} min={form.checkIn || new Date().toISOString().split("T")[0]}
                  onChange={(e) => setForm({ ...form, checkOut: e.target.value })} />
              </div>
              <div style={{ flex: 1, minWidth: "150px" }}>
                <label style={styles.label}>Occupants</label>
                <input type="number" min="1" max="20" value={form.numberOfOccupants}
                  onChange={(e) => {
                    const count = Math.min(20, Math.max(1, Number(e.target.value || 1)));
                    const names = Array.from({ length: count }, (_, i) => form.occupantNames[i] || "");
                    setForm({ ...form, numberOfOccupants: count, occupantNames: names });
                  }} />
              </div>
            </div>
          </div>
        )}

        {cartMsg && <p style={{ color: "#276749", fontSize: "13px", marginBottom: "10px" }}>✅ {cartMsg}</p>}
        {cartErr && <p style={{ color: "#c53030", fontSize: "13px", marginBottom: "10px" }}>⚠️ {cartErr}</p>}

        <div style={{ margin: "0 0 16px", color: "#666", fontSize: "13px" }}>
          {ratesLoading ? "Loading rooms..." : "Room numbers are assigned by the admin after payment."}
        </div>

        {!ratesLoading && cards.length === 0 && (
          <div style={{ ...styles.infoBox, background: "#fff8e6" }}>
            No rooms configured for {selectedBlockName || "this block"} yet.
          </div>
        )}

        <div style={styles.grid}>
          {cards.map((cat) => (
            <div key={cat.key} style={styles.card}>
              <div style={{ position: "relative", height: "220px", background: "#eee", display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden" }}>
                {cat.image ? (
                  <img src={cat.image} alt={selectedBlockName} style={{ width: "100%", height: "100%", objectFit: "cover" }} onError={(e) => { e.target.style.display = "none"; }} />
                ) : (
                  <span style={{ fontSize: "42px", color: "#bbb" }}>🏨</span>
                )}
                <span style={{ ...styles.cardTag, background: cat.color }}>{cat.tag}</span>
                <span style={{ position: "absolute", top: "10px", left: "10px", background: "rgba(0,0,0,.65)", color: "#fff", fontSize: "11px", fontWeight: "700", padding: "4px 9px", borderRadius: "999px" }}>
                  🏨 {selectedBlockName}
                </span>
              </div>
              <div style={styles.cardBody}>
                <div style={styles.cardTop}>
                  <span style={{ fontWeight: "700", fontSize: "20px" }}>{cat.icon} {cat.displayName}</span>
                  {cat.usesCategories && <span style={{ ...styles.catBadge, background: cat.bg, color: cat.color }}>{cat.name}</span>}
                </div>
                <p style={{ color: "#555", fontSize: "14px", lineHeight: "1.6", margin: "10px 0" }}>{cat.desc}</p>
                <div style={styles.amenitiesRow}>{(cat.amenities || []).map((a) => <span key={a} style={styles.amenityTag}>{a}</span>)}</div>
                <div style={styles.cardFooter}>
                  <div>
                    <span style={styles.price}>{fmt(cat.price)}</span>
                    <span style={{ fontSize: "14px", color: "#333", fontWeight: "700" }}>{selectedPeriod === "night" ? "/night" : "/month"}</span>
                  </div>
                </div>
                <div style={{ display: "flex", gap: "8px", marginTop: "12px", flexWrap: "wrap" }}>
                  <button type="button" onClick={() => addToCart(cat)} disabled={cartBusy} style={{ flex: 1, background: "#fff", color: "#111", border: "1px solid #ccc", padding: "11px", borderRadius: "8px", cursor: "pointer", fontWeight: "700", fontSize: "14px" }}>🛒 Add to Cart</button>
                  <button onClick={() => { setShowTerms(cat); setTermsAnswer(""); }} style={{ flex: 1, background: "#b8860b", color: "#fff", border: "none", padding: "11px", borderRadius: "8px", cursor: "pointer", fontWeight: "700", fontSize: "14px" }}>Book Now →</button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {showTerms && (
        <div style={styles.overlay} onClick={() => setShowTerms(null)}>
          <div style={styles.modal} onClick={(e) => e.stopPropagation()}>
            <div style={styles.modalHeader}>
              <div>
                <h3 style={{ fontSize: "18px", fontWeight: "700" }}>📋 Booking Terms & Conditions</h3>
                <p style={{ color: "#888", fontSize: "13px" }}>Please read carefully before booking</p>
              </div>
              <button onClick={() => setShowTerms(null)} style={styles.closeBtn}>✕</button>
            </div>
            <div style={{ fontSize: "13px", color: "#444", lineHeight: "1.7", maxHeight: "330px", overflowY: "auto", paddingRight: "4px" }}>
              <p style={{ marginBottom: "12px" }}><strong>Booking:</strong> Payment is required in full. One client can book for several people.</p>
              <p style={{ marginBottom: "12px" }}><strong>Room:</strong> The admin assigns an available room after payment. A specific room number cannot be guaranteed before allocation.</p>
              <p style={{ marginBottom: "12px" }}><strong>Check-in & check-out:</strong> The admin records each occupant's arrival and departure.</p>
              <p style={{ marginBottom: "12px" }}><strong>Refunds:</strong> Eligible unused days are refunded according to the hostel refund policy.</p>
              <p style={{ marginBottom: "12px" }}><strong>Cancellation:</strong> At least {policy.cancellationDeadlineDays} day{policy.cancellationDeadlineDays === 1 ? "" : "s"} before check-in.</p>
              <p style={{ marginBottom: 0 }}><strong>Responsibility:</strong> Guests are responsible for hostel property and respectful conduct.</p>
            </div>
            <div style={{ marginTop: "20px", padding: "16px", background: "#f8f9fa", borderRadius: "10px", border: "1px solid #e2e8f0" }}>
              <p style={{ fontWeight: "700", fontSize: "14px", marginBottom: "12px" }}>Do you agree to these terms?</p>
              <div style={{ display: "flex", gap: "24px" }}>
                <label style={{ display: "flex", alignItems: "center", gap: "8px", cursor: "pointer", fontSize: "14px", fontWeight: "600" }}>
                  <input type="radio" name="terms" value="agree" checked={termsAnswer === "agree"} onChange={(e) => setTermsAnswer(e.target.value)} style={{ width: "16px", height: "16px", accentColor: "#276749" }} />
                  <span style={{ color: "#276749" }}>✅ I Agree</span>
                </label>
                <label style={{ display: "flex", alignItems: "center", gap: "8px", cursor: "pointer", fontSize: "14px", fontWeight: "600" }}>
                  <input type="radio" name="terms" value="disagree" checked={termsAnswer === "disagree"} onChange={(e) => setTermsAnswer(e.target.value)} style={{ width: "16px", height: "16px", accentColor: "#9b2c2c" }} />
                  <span style={{ color: "#9b2c2c" }}>❌ I Disagree</span>
                </label>
              </div>
              {termsAnswer === "disagree" && (
                <p style={{ color: "#9b2c2c", fontSize: "13px", marginTop: "10px" }}>You must agree to proceed.</p>
              )}
            </div>
            <div style={{ display: "flex", gap: "10px", marginTop: "16px" }}>
              <button
                style={{ ...styles.payBtn, opacity: termsAnswer === "agree" ? 1 : 0.4, cursor: termsAnswer === "agree" ? "pointer" : "not-allowed" }}
                disabled={termsAnswer !== "agree"}
                onClick={() => { setBooking(showTerms); setShowTerms(null); setError(""); }}
              >
                Continue to Booking →
              </button>
              <button type="button" onClick={() => setShowTerms(null)} style={styles.cancelBtn}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {booking && (
        <div style={styles.overlay} onClick={() => setBooking(null)}>
          <div style={styles.modal} onClick={(e) => e.stopPropagation()}>
            <div style={styles.modalHeader}>
              <div>
                <h3 style={{ fontSize: "18px", fontWeight: "700" }}>Book {booking.displayName || booking.name}</h3>
                <p style={{ color: "#888", fontSize: "13px" }}>A room will be assigned by admin after payment</p>
              </div>
              <button onClick={() => setBooking(null)} style={styles.closeBtn}>✕</button>
            </div>

            <div style={styles.bookingInfo}>
              <div style={styles.infoItem}><span>🛏️</span><span>Bed, TV, WiFi, Private Bathroom</span></div>
              <div style={styles.infoItem}><span>💰</span><span style={{ color: "#b8860b", fontWeight: "700" }}>{fmt(booking.price)}/{selectedPeriod}</span></div>
            </div>

            {error && <p style={{ color: "#e53e3e", fontSize: "13px", marginBottom: "12px" }}>{error}</p>}

            <form onSubmit={handleBook}>
              <div style={styles.formRow}>
                <div style={{ flex: 1, minWidth: "140px" }}>
                  <label style={styles.label}>📅 Check-in Date</label>
                  <input type="date" value={form.checkIn} min={new Date().toISOString().split("T")[0]}
                    onChange={(e) => setForm({ ...form, checkIn: e.target.value })} required />
                </div>
                <div style={{ flex: 1, minWidth: "140px" }}>
                  <label style={styles.label}>📅 Check-out Date</label>
                  <input type="date" value={form.checkOut} min={form.checkIn || new Date().toISOString().split("T")[0]}
                    onChange={(e) => setForm({ ...form, checkOut: e.target.value })} required />
                </div>
              </div>

              <div style={{ marginTop: "14px", padding: "14px", background: "#f8f9fa", borderRadius: "10px", border: "1px solid #e2e8f0" }}>
                <label style={styles.label}>👥 Number of people</label>
                <input type="number" min="1" max="20" value={form.numberOfOccupants}
                  onChange={(e) => { const count = Math.min(20, Math.max(1, Number(e.target.value || 1))); const names = Array.from({ length: count }, (_, i) => form.occupantNames[i] || ""); setForm({ ...form, numberOfOccupants: count, occupantNames: names }); }} required />
                <p style={{ fontSize: "12px", color: "#666", margin: "6px 0 10px" }}>One booking can cover several people.</p>
                <div style={{ display: "grid", gap: "8px" }}>
                  {form.occupantNames.map((name, i) => (
                    <input key={i} type="text" placeholder={`Person ${i + 1} full name`} value={name}
                      onChange={(e) => { const names = [...form.occupantNames]; names[i] = e.target.value; setForm({ ...form, occupantNames: names }); }} required />
                  ))}
                </div>
              </div>

              {durationUnits > 0 && (
                <div style={styles.totalBox}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "6px", fontSize: "13px", color: "#666" }}>
                    <span>{fmt(booking.price)} × {durationUnits} {selectedPeriod}{durationUnits > 1 ? "s" : ""} × {form.numberOfOccupants} people</span>
                    <span>{fmt(booking.price * durationUnits * Number(form.numberOfOccupants || 1))}</span>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", fontWeight: "700", fontSize: "16px" }}>
                    <span>Total</span>
                    <span style={{ color: "#b8860b" }}>{fmt(booking.price * durationUnits * Number(form.numberOfOccupants || 1))}</span>
                  </div>
                </div>
              )}

              <div style={{ display: "flex", gap: "10px", marginTop: "16px" }}>
                <button type="submit" style={styles.payBtn} disabled={loading}>
                  {loading ? "⏳ Redirecting..." : "💳 Pay & Confirm Booking"}
                </button>
                <button type="button" onClick={() => setBooking(null)} style={styles.cancelBtn}>Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

const styles = {
  banner: { backgroundImage: "linear-gradient(160deg, rgba(15,30,60,0.60), rgba(184,134,11,0.12)), url('/ILPD.webp')", backgroundSize: "cover", backgroundPosition: "center", backgroundRepeat: "no-repeat", padding: "60px 20px", textAlign: "center" },
  bannerTitle: { color: "#fff", fontSize: "36px", fontWeight: "700", marginBottom: "10px" },
  bannerSub: { color: "#ccc", fontSize: "16px", marginBottom: "30px" },
  infoBox: { background: "#e8f4fd", color: "#1a6fa8", padding: "14px 18px", borderRadius: "10px", fontSize: "14px", marginBottom: "32px", border: "1px solid #bee3f8" },
  locationBtn: { background: "#fff", border: "1px solid #d9dfe8", color: "#334155", padding: "10px 14px", borderRadius: "8px", cursor: "pointer", fontWeight: "600", fontSize: "13px" },
  locationBtnActive: { background: "#fff8e6", border: "1px solid #b8860b", color: "#7a5700" },
  grid: { display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 380px))", gap: "28px", justifyContent: "center" },
  card: { background: "#fffdf9", borderRadius: "14px", overflow: "hidden", boxShadow: "0 4px 24px rgba(0,0,0,0.07)", border: "1px solid #f0ede6" },
  cardTag: { position: "absolute", top: "12px", left: "12px", color: "#fff", padding: "4px 12px", borderRadius: "12px", fontSize: "12px", fontWeight: "700" },
  cardBody: { padding: "20px" },
  cardTop: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" },
  catBadge: { padding: "3px 10px", borderRadius: "12px", fontSize: "12px", fontWeight: "600" },
  amenitiesRow: { display: "flex", flexWrap: "wrap", gap: "5px", marginBottom: "14px" },
  amenityTag: { background: "#f5f5f5", color: "#555", padding: "3px 8px", borderRadius: "4px", fontSize: "11px" },
  cardFooter: { display: "flex", justifyContent: "space-between", alignItems: "center", borderTop: "1px solid #f0f0f0", paddingTop: "14px" },
  price: { fontSize: "24px", fontWeight: "700", color: "#1a1a2e", marginRight: "6px" },
  overlay: { position: "fixed", inset: 0, background: "rgba(0,0,0,0.65)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 300, padding: "20px" },
  modal: { background: "#fffdf9", borderRadius: "14px", width: "100%", maxWidth: "500px", maxHeight: "90vh", overflowY: "auto", padding: "24px", border: "1px solid #f0ede6" },
  modalHeader: { display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "16px" },
  closeBtn: { background: "#f5f5f5", border: "none", borderRadius: "50%", width: "32px", height: "32px", cursor: "pointer", fontSize: "16px" },
  bookingInfo: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px", background: "#f9f9f9", borderRadius: "8px", padding: "14px", marginBottom: "14px" },
  infoItem: { display: "flex", gap: "8px", fontSize: "13px", alignItems: "center" },
  formRow: { display: "flex", gap: "12px", flexWrap: "wrap" },
  label: { fontSize: "13px", fontWeight: "600", marginBottom: "6px", display: "block", color: "#444" },
  totalBox: { background: "#fff8e6", border: "1px solid #f0d080", borderRadius: "8px", padding: "14px", marginTop: "12px" },
  payBtn: { flex: 1, background: "#b8860b", color: "#fff", border: "none", padding: "13px", borderRadius: "8px", cursor: "pointer", fontWeight: "700", fontSize: "15px" },
  cancelBtn: { background: "#f5f5f5", border: "none", padding: "13px 20px", borderRadius: "8px", cursor: "pointer", fontWeight: "600" },
};