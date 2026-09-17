import React, { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import API from "../api/axios";

const fmt = (n) => `${Number(n || 0).toLocaleString()} RWF`;

export default function Cart({ user }) {
  const navigate = useNavigate();
  const [cart, setCart] = useState({ items: [] });
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");
  const [confirmDialog, setConfirmDialog] = useState(null);
  const askConfirm = (message, onConfirm) => setConfirmDialog({ message, onConfirm });

  const loadCart = () => {
    if (!user) { setLoading(false); return; }
    API.get("/cart")
      .then(({ data }) => { setCart(data); setLoading(false); })
      .catch(() => setLoading(false));
  };

  useEffect(() => { loadCart(); /* eslint-disable-next-line */ }, [user]);

  const removeItemConfirmed = async (itemId) => {
    setMsg(""); setErr("");
    try {
      const { data } = await API.delete(`/cart/items/${itemId}`);
      setCart(data);
      setMsg("Item removed.");
    } catch (e) {
      setErr(e.response?.data?.message || "Could not remove item.");
    }
  };

  const removeItem = (itemId) => {
    const item = cart.items.find((i) => String(i._id) === String(itemId));
    const label = item ? `${item.blockName || item.category || "this item"}` : "this item";
    askConfirm(`Remove ${label} from your cart?`, () => removeItemConfirmed(itemId));
  };

  const clearCartConfirmed = async () => {
    setMsg(""); setErr("");
    try {
      const { data } = await API.delete("/cart");
      setCart(data);
      setMsg("Cart cleared.");
    } catch (e) {
      setErr(e.response?.data?.message || "Could not clear cart.");
    }
  };

  const clearCart = () => {
    if (!cart.items.length) return;
    askConfirm(`Remove all ${cart.items.length} item${cart.items.length > 1 ? "s" : ""} from your cart?`, clearCartConfirmed);
  };

  const itemTotal = (item) => {
    const nights = item.billingType === "per_night"
      ? Math.max(1, Math.ceil((new Date(item.checkOut) - new Date(item.checkIn)) / 86400000))
      : (() => {
          const start = new Date(item.checkIn);
          const end = new Date(item.checkOut);
          let m = (end.getUTCFullYear() - start.getUTCFullYear()) * 12 + (end.getUTCMonth() - start.getUTCMonth());
          const ann = new Date(start);
          ann.setUTCDate(1);
          ann.setUTCMonth(ann.getUTCMonth() + m);
          const lastDay = new Date(Date.UTC(ann.getUTCFullYear(), ann.getUTCMonth() + 1, 0)).getUTCDate();
          ann.setUTCDate(Math.min(start.getUTCDate(), lastDay));
          if (ann < end) m += 1;
          return Math.max(1, m);
        })();
    return (item.priceAtAdd || 0) * nights * (item.numberOfOccupants || 1);
  };

  const subtotal = cart.items.reduce((sum, it) => sum + itemTotal(it), 0);

  if (!user) {
    return (
      <div style={{ background: "#eaeded", minHeight: "calc(100vh - 72px)", padding: "24px 16px" }}>
        <div className="container">
          <div style={{ background: "#fff", borderRadius: "8px", padding: "32px 24px", display: "flex", alignItems: "center", gap: "32px", flexWrap: "wrap" }}>
            <div style={{ fontSize: "64px", lineHeight: 1 }}>🛒</div>
            <div>
              <h2 style={{ margin: "0 0 12px", fontSize: "22px" }}>Your ILPD Hostel cart is empty</h2>
              <p style={{ margin: "0 0 16px", color: "#555" }}>
                <Link to="/rooms" style={{ color: "#007185", textDecoration: "none" }}>Browse rooms</Link>
              </p>
              <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
                <Link to="/login"><button className="btn btn-primary">Sign in to your account</button></Link>
                <Link to="/register"><button className="btn btn-secondary">Sign up now</button></Link>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div style={{ minHeight: "60vh", display: "flex", alignItems: "center", justifyContent: "center", color: "#666" }}>
        Loading cart...
      </div>
    );
  }

  if (!cart.items?.length) {
    return (
      <div style={{ background: "#eaeded", minHeight: "calc(100vh - 72px)", padding: "24px 16px" }}>
        <div className="container">
          <div style={{ background: "#fff", borderRadius: "8px", padding: "32px 24px", display: "flex", alignItems: "center", gap: "32px", flexWrap: "wrap" }}>
            <div style={{ fontSize: "64px", lineHeight: 1 }}>🛒</div>
            <div>
              <h2 style={{ margin: "0 0 12px", fontSize: "22px" }}>Your ILPD Hostel cart is empty</h2>
              <p style={{ margin: "0 0 16px", color: "#555" }}>
                <Link to="/rooms" style={{ color: "#007185", textDecoration: "none" }}>Browse rooms to add them to your cart</Link>
              </p>
              <Link to="/rooms"><button className="btn btn-primary">Shop Rooms</button></Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ background: "#eaeded", minHeight: "calc(100vh - 72px)", padding: "24px 16px" }}>
      <div className="container" style={{ maxWidth: "1100px" }}>
        {msg && <p style={{ color: "#276749", marginBottom: "12px" }}>✅ {msg}</p>}
        {err && <p style={{ color: "#c53030", marginBottom: "12px" }}>⚠️ {err}</p>}

        {confirmDialog && (
          <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.55)", zIndex: 4000, display: "flex", alignItems: "center", justifyContent: "center", padding: "20px" }} onClick={() => setConfirmDialog(null)}>
            <div style={{ background: "#fff", width: "min(420px, 100%)", borderRadius: "14px", padding: "22px" }} onClick={(e) => e.stopPropagation()}>
              <p style={{ margin: "0 0 20px", fontSize: "14px", color: "#333", whiteSpace: "pre-wrap" }}>{confirmDialog.message}</p>
              <div style={{ display: "flex", gap: "10px", justifyContent: "flex-end" }}>
                <button className="btn btn-secondary" onClick={() => setConfirmDialog(null)}>Cancel</button>
                <button className="btn btn-primary" onClick={() => { const action = confirmDialog.onConfirm; setConfirmDialog(null); action(); }}>Confirm</button>
              </div>
            </div>
          </div>
        )}

        <div style={{ display: "grid", gridTemplateColumns: "1fr 320px", gap: "20px", alignItems: "start" }} className="cart-grid">
          <div style={{ background: "#fff", borderRadius: "8px", padding: "20px 24px" }}>
            <h1 style={{ margin: "0 0 4px", fontSize: "26px", fontWeight: "500" }}>Shopping Cart</h1>
            <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: "8px" }}>
              <span style={{ color: "#888", fontSize: "13px" }}>Price</span>
            </div>
            <hr style={{ border: "none", borderTop: "1px solid #ddd", margin: "0 0 16px" }} />

            {cart.items.map((item, i) => {
              const nights = item.billingType === "per_night"
                ? Math.max(1, Math.ceil((new Date(item.checkOut) - new Date(item.checkIn)) / 86400000))
                : "1";
              const periodLabel = item.billingType === "per_night" ? "night" : "month";
              return (
                <div key={item._id || i} style={{ display: "flex", gap: "16px", paddingBottom: "20px", marginBottom: "20px", borderBottom: "1px solid #eee", flexWrap: "wrap" }}>
                  <div style={{ width: "120px", minWidth: "100px", height: "120px", background: "#f8f9fa", borderRadius: "8px", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "40px" }}>
                    🏨
                  </div>
                  <div style={{ flex: 1, minWidth: "220px" }}>
                    <h3 style={{ margin: "0 0 4px", fontSize: "18px", fontWeight: "600" }}>
                      {item.category} · {item.blockName || "Block"}
                    </h3>
                    <p style={{ margin: "0 0 4px", color: "#555", fontSize: "13px" }}>
                      📅 {new Date(item.checkIn).toLocaleDateString()} → {new Date(item.checkOut).toLocaleDateString()}
                    </p>
                    <p style={{ margin: "0 0 4px", color: "#555", fontSize: "13px" }}>
                      👥 {item.numberOfOccupants} occupant{item.numberOfOccupants > 1 ? "s" : ""}
                    </p>
                    <p style={{ margin: "0 0 10px", color: "#007185", fontSize: "13px", fontWeight: "600" }}>
                      In stock — reserved for you
                    </p>
                    <button
                      onClick={() => removeItem(item._id)}
                      style={{ background: "none", border: "none", color: "#007185", cursor: "pointer", padding: 0, fontSize: "13px", textDecoration: "underline" }}
                    >
                      Delete
                    </button>
                  </div>
                  <div style={{ textAlign: "right", minWidth: "130px" }}>
                    <div style={{ fontWeight: "700", fontSize: "16px", color: "#111" }}>{fmt(itemTotal(item))}</div>
                    <div style={{ fontSize: "12px", color: "#888", marginTop: "4px" }}>
                      {fmt(item.priceAtAdd)} × {nights} {periodLabel}{nights !== 1 && periodLabel !== "1" ? "s" : ""} × {item.numberOfOccupants}
                    </div>
                  </div>
                </div>
              );
            })}

            <div style={{ textAlign: "right", color: "#555", fontSize: "14px" }}>
              Subtotal ({cart.items.length} item{cart.items.length > 1 ? "s" : ""}):&nbsp;
              <strong style={{ fontSize: "18px", color: "#b12704" }}>{fmt(subtotal)}</strong>
            </div>

            <div style={{ marginTop: "12px", textAlign: "right" }}>
              <button className="btn btn-secondary" onClick={clearCart}>
                Clear cart
              </button>
            </div>
          </div>

          <div style={{ background: "#fff", borderRadius: "8px", padding: "20px", position: "sticky", top: "90px" }}>
            <p style={{ margin: "0 0 12px", fontSize: "16px" }}>
              Subtotal ({cart.items.length} item{cart.items.length > 1 ? "s" : ""}):{" "}
              <strong style={{ color: "#b12704" }}>{fmt(subtotal)}</strong>
            </p>
            <button className="btn btn-primary" style={{ width: "100%", padding: "12px" }} onClick={() => navigate("/rooms")}>
              Proceed to Book
            </button>
            <p style={{ margin: "12px 0 0", fontSize: "12px", color: "#888", lineHeight: "1.5" }}>
              💡 To confirm your booking, open a room and complete payment. Your cart items are saved.
            </p>
          </div>
        </div>
      </div>

      <style>{`
        @media (max-width: 800px) {
          .cart-grid { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </div>
  );
}
