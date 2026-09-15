import React from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";

export default function Navbar({ user, logout }) {
  const navigate = useNavigate();
  const location = useLocation();

  const handleLogout = () => {
    logout();
    navigate("/");
  };

  const goToSection = (id) => (e) => {
    e.preventDefault();
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

        {/* LEFT — Logo → Home */}
        <Link to="/" style={styles.brand}>
          <img
            src="/cp.png"
            alt="ILPD"
            style={{
              height: "44px",
              width: "auto",
              objectFit: "contain",
              display: "block",
              marginRight: "10px",
            }}
          />
          <span>ILPD HOSTEL</span>
        </Link>

        {/* CENTER — Main links with dot separators */}
        <div style={styles.centerLinks}>
          <a href="/#about" onClick={goToSection("about")} style={styles.link}>About Us</a>
          <span style={styles.dot}>·</span>
          <a href="/#rooms" onClick={goToSection("rooms")} style={styles.link}>Accommodation</a>
          <span style={styles.dot}>·</span>
          <a href="/#services" onClick={goToSection("services")} style={styles.link}>Services</a>
          <span style={styles.dot}>·</span>
          <a href="/#contact" onClick={goToSection("contact")} style={styles.link}>Contact Us</a>
        </div>

        {/* RIGHT — Auth buttons */}
        <div style={styles.auth}>
          {user ? (
            <>
              {user.role !== "admin" && (
                <Link
                  to="/my-bookings"
                  style={{
                    ...styles.link,
                    ...(isActive("/my-bookings") ? styles.linkActive : {}),
                  }}
                >
                  My Bookings
                </Link>
              )}
              {user.role === "admin" && (
                <Link
                  to="/admin"
                  style={{
                    ...styles.link,
                    ...(isActive("/admin") ? styles.linkActive : {}),
                  }}
                >
                  Admin Dashboard
                </Link>
              )}
              <button className="btn btn-primary" onClick={handleLogout}>
                Logout
              </button>
            </>
          ) : (
            <>
              <Link
                to="/login"
                style={{
                  ...styles.link,
                  ...(isActive("/login") ? styles.linkActive : {}),
                }}
              >
                Login
              </Link>
              <Link to="/register">
                <button className="btn btn-primary">Register</button>
              </Link>
            </>
          )}
        </div>

      </div>
    </nav>
  );
}

const styles = {
  nav: {
    background: "#1a1a2e",
    minHeight: "72px",
    display: "flex",
    alignItems: "center",
    position: "sticky",
    top: 0,
    zIndex: 100,
    boxShadow: "0 2px 12px rgba(0,0,0,0.15)",
  },
  inner: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: "24px",
    width: "100%",
  },
  brand: {
    color: "#b8860b",
    fontSize: "20px",
    fontWeight: "700",
    display: "flex",
    alignItems: "center",
    textDecoration: "none",
    whiteSpace: "nowrap",
    lineHeight: 1,
    gap: "10px",
    padding: "4px 0",
    overflow: "visible",
  },
  centerLinks: {
    display: "flex",
    alignItems: "center",
    gap: "16px",
    flex: 1,
    justifyContent: "center",
  },
  auth: {
    display: "flex",
    alignItems: "center",
    gap: "20px",
    whiteSpace: "nowrap",
  },
  link: {
    color: "#fff",
    fontSize: "14px",
    fontWeight: "500",
    textDecoration: "none",
    transition: "color 0.2s",
  },
  linkActive: {
    color: "#b8860b",
  },
  dot: {
    color: "#ffffff",
    fontSize: "14px",
    fontWeight: "500",
    opacity: 0.9,
    userSelect: "none",
  },
};