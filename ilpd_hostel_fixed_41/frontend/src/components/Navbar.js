import React from "react";
import { Link, useNavigate } from "react-router-dom";

export default function Navbar({ user, logout }) {
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate("/");
  };

  return (
    <nav style={styles.nav}>
      <div className="container" style={styles.inner}>
        <Link to="/" style={styles.brand}>
          <img src="/ILPD MARK.webp" alt="ILPD" style={{ height: "36px", marginRight: "8px", verticalAlign: "middle" }} />
          <span>ILPD HOSTEL</span>
        </Link>
        <div style={styles.links}>
          {user ? (
            <>
              {user.role !== "admin" && <Link to="/rooms" style={styles.link}>Rooms</Link>}
              {user.role !== "admin" && <Link to="/my-bookings" style={styles.link}>My Bookings</Link>}
              {user.role === "admin" && <Link to="/admin" style={styles.link}>Admin</Link>}
              <button className="btn btn-primary" onClick={handleLogout}>Logout</button>
            </>
          ) : (
            <>
              <Link to="/login" style={styles.link}>Login</Link>
              <Link to="/register"><button className="btn btn-primary">Register</button></Link>
            </>
          )}
        </div>
      </div>
    </nav>
  );
}

const styles = {
  nav: { background: "#1a1a2e", padding: "14px 0", position: "sticky", top: 0, zIndex: 100 },
  inner: { display: "flex", justifyContent: "space-between", alignItems: "center" },
  brand: { color: "#b8860b", fontSize: "20px", fontWeight: "700", display: "flex", alignItems: "center", textDecoration: "none" },
  links: { display: "flex", alignItems: "center", gap: "20px" },
  link: { color: "#fff", fontSize: "14px" },
};
