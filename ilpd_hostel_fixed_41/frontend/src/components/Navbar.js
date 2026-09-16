import React, { useState, useEffect } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";

export default function Navbar({ user, logout }) {
  const navigate = useNavigate();
  const location = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => { setMenuOpen(false); }, [location.pathname]);

  const handleLogout = () => {
    logout();
    setMenuOpen(false);
    navigate("/");
  };

  const goToSection = (id) => (e) => {
    e.preventDefault();
    setMenuOpen(false);
    const scroll = () => {
      const el = document.getElementById(id);
      if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
    };
    if (location.pathname !== "/") {
      navigate("/");
      setTimeout(scroll, 150);
    } else {
      scroll();
    }
  };

  const isActive = (path) => location.pathname === path;

  return (
    <nav style={styles.nav}>
      <div className="container" style={styles.inner}>

        <Link to="/" style={styles.brand} onClick={() => setMenuOpen(false)}>
          <img src="/cp.png" alt="ILPD" style={styles.brandImg} />
          <span style={styles.brandText}>ILPD HOSTEL</span>
        </Link>

        <div className="navbar-center" style={styles.centerLinks}>
          <a href="/#about" onClick={goToSection("about")} style={styles.link}>About Us</a>
          <span style={styles.dot}>·</span>
          <a href="/#rooms" onClick={goToSection("rooms")} style={styles.link}>Accommodation</a>
          <span style={styles.dot}>·</span>
          <a href="/#services" onClick={goToSection("services")} style={styles.link}>Services</a>
          <span style={styles.dot}>·</span>
          <a href="/#contact" onClick={goToSection("contact")} style={styles.link}>Contact Us</a>
        </div>

        <div className="navbar-auth" style={styles.auth}>
          {user ? (
            <>
              {user.role !== "admin" && (
                <Link to="/my-bookings" style={{ ...styles.link, ...(isActive("/my-bookings") ? styles.linkActive : {}) }}>
                  My Bookings
                </Link>
              )}
              {user.role === "admin" && (
                <Link to="/admin" style={{ ...styles.link, ...(isActive("/admin") ? styles.linkActive : {}) }}>
                  Admin
                </Link>
              )}
              <Link to="/account" style={{ ...styles.link, ...(isActive("/account") ? styles.linkActive : {}) }}>
                Account
              </Link>
              <button className="btn btn-primary" onClick={handleLogout} style={styles.logoutBtn}>
                Logout
              </button>
            </>
          ) : (
            <>
              <Link to="/login" style={{ ...styles.link, ...(isActive("/login") ? styles.linkActive : {}) }}>
                Login
              </Link>
              <Link to="/register">
                <button className="btn btn-primary" style={styles.registerBtn}>Register</button>
              </Link>
            </>
          )}
        </div>

        <button
          className="navbar-hamburger"
          onClick={() => setMenuOpen((v) => !v)}
          aria-label="Toggle menu"
          style={styles.hamburger}
        >
          {menuOpen ? "✕" : "☰"}
        </button>
      </div>

      {menuOpen && (
        <div style={styles.mobileMenu}>
          <a href="/#about" onClick={goToSection("about")} style={styles.mobileLink}>About Us</a>
          <a href="/#rooms" onClick={goToSection("rooms")} style={styles.mobileLink}>Accommodation</a>
          <a href="/#services" onClick={goToSection("services")} style={styles.mobileLink}>Services</a>
          <a href="/#contact" onClick={goToSection("contact")} style={styles.mobileLink}>Contact Us</a>

          <div style={styles.mobileDivider} />

          {user ? (
            <>
              {user.role !== "admin" && (
                <Link to="/my-bookings" onClick={() => setMenuOpen(false)} style={styles.mobileLink}>My Bookings</Link>
              )}
              {user.role === "admin" && (
                <Link to="/admin" onClick={() => setMenuOpen(false)} style={styles.mobileLink}>Admin Dashboard</Link>
              )}
              <Link to="/account" onClick={() => setMenuOpen(false)} style={styles.mobileLink}>Account</Link>
              <button onClick={handleLogout} style={styles.mobileLogout}>Logout</button>
            </>
          ) : (
            <>
              <Link to="/login" onClick={() => setMenuOpen(false)} style={styles.mobileLink}>Login</Link>
              <Link to="/register" onClick={() => setMenuOpen(false)} style={styles.mobileRegister}>Register</Link>
            </>
          )}
        </div>
      )}

      <style>{`
        .navbar-hamburger { display: none; }
        @media (max-width: 900px) {
          .navbar-center, .navbar-auth { display: none !important; }
          .navbar-hamburger { display: flex !important; }
        }
      `}</style>
    </nav>
  );
}

const styles = {
  nav: { background: "#1a1a2e", minHeight: "72px", position: "sticky", top: 0, zIndex: 100, boxShadow: "0 2px 12px rgba(0,0,0,0.15)" },
  inner: { display: "flex", justifyContent: "space-between", alignItems: "center", gap: "16px", width: "100%", minHeight: "72px", padding: "10px 0" },
  brand: { color: "#b8860b", fontSize: "20px", fontWeight: "700", display: "flex", alignItems: "center", textDecoration: "none", whiteSpace: "nowrap", lineHeight: 1, gap: "10px", padding: "4px 0", flexShrink: 0 },
  brandImg: { height: "40px", width: "auto", objectFit: "contain", display: "block" },
  brandText: { fontSize: "18px" },
  centerLinks: { display: "flex", alignItems: "center", gap: "14px", flex: 1, justifyContent: "center" },
  auth: { display: "flex", alignItems: "center", gap: "16px", whiteSpace: "nowrap" },
  link: { color: "#fff", fontSize: "14px", fontWeight: "500", textDecoration: "none" },
  linkActive: { color: "#b8860b" },
  dot: { color: "#ffffff", fontSize: "14px", fontWeight: "500", opacity: 0.9, userSelect: "none" },
  logoutBtn: { padding: "8px 16px", fontSize: "13px" },
  registerBtn: { padding: "8px 16px", fontSize: "13px" },
  hamburger: {
    background: "transparent",
    border: "1px solid rgba(255,255,255,0.3)",
    color: "#fff",
    fontSize: "22px",
    width: "44px",
    height: "44px",
    borderRadius: "8px",
    cursor: "pointer",
    alignItems: "center",
    justifyContent: "center",
    padding: 0,
  },
  mobileMenu: {
    background: "#252540",
    borderTop: "1px solid rgba(184,134,11,0.3)",
    padding: "12px 16px 20px",
    display: "flex",
    flexDirection: "column",
    gap: "4px",
  },
  mobileLink: {
    color: "#fff",
    fontSize: "15px",
    fontWeight: "500",
    textDecoration: "none",
    padding: "14px 8px",
    borderBottom: "1px solid rgba(255,255,255,0.08)",
  },
  mobileDivider: { height: "1px", background: "rgba(184,134,11,0.4)", margin: "8px 0" },
  mobileLogout: {
    background: "#b8860b",
    color: "#fff",
    border: "none",
    padding: "14px 8px",
    fontSize: "15px",
    fontWeight: "700",
    borderRadius: "8px",
    cursor: "pointer",
    marginTop: "8px",
    textAlign: "center",
  },
  mobileRegister: {
    background: "#b8860b",
    color: "#fff",
    padding: "14px 8px",
    fontSize: "15px",
    fontWeight: "700",
    borderRadius: "8px",
    textDecoration: "none",
    marginTop: "8px",
    textAlign: "center",
    display: "block",
  },
};