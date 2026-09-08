import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import API from "../api/axios";

const SERVICES = [
  { icon: "🍽", title: "Restaurant", desc: "On-site restaurant serving quality meals for guests throughout their stay." },
  { icon: "🚗", title: "Parking", desc: "Convenient on-site parking available for all hostel guests." },
  { icon: "📶", title: "Free High-Speed WiFi", desc: "Complimentary high-speed WiFi throughout the entire hostel." },
  { icon: "📺", title: "TV", desc: "In-room television available in every room." },
  { icon: "🧹", title: "Daily Housekeeping", desc: "Professional housekeeping service every day for all rooms." },
];

const STATIC_IMAGES = {
  "standard-ilpd": "/rooms/standard-ilpd.jpg",
  "vip-ilpd": "/rooms/vip-ilpd.jpg",
  "vvip-ilpd": "/rooms/vvip-ilpd.jpg",
  "standard-outside": "/rooms/standard-outside.jpg",
  "vip-outside": "/rooms/vip-outside.jpg",
  "vvip-outside": "/rooms/vvip-outside.jpg",
};

export default function Home({ user }) {
  const [rooms, setRooms] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    API.get("/rooms")
      .then(({ data }) => {
        setRooms(data);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const getRoomImage = (category, accommodationType) => {
    const room = rooms.find(
      (r) => r.category === category && r.accommodationType === accommodationType
    );
    if (room?.images?.length > 0 && room.images[0]) {
      return room.images[0];
    }
    const type = accommodationType === "ilpd_building" ? "ilpd" : "outside";
    const key = `${category.toLowerCase()}-${type}`;
    return STATIC_IMAGES[key] || `/rooms/${category.toLowerCase()}-${type}.jpg`;
  };

  const getRoomCount = (category, accommodationType) => {
    return rooms.filter(
      (r) => r.category === category && r.accommodationType === accommodationType
    ).length;
  };

  const getRoomPrice = (category, accommodationType) => {
    const room = rooms.find(
      (r) => r.category === category && r.accommodationType === accommodationType
    );
    return room?.price || 0;
  };

  const getTotalRoomsByType = (accommodationType) => {
    return rooms.filter(r => r.accommodationType === accommodationType).length;
  };

  const getCategories = (accommodationType) => {
    const uniqueCategories = [...new Set(
      rooms
        .filter(r => r.accommodationType === accommodationType)
        .map(r => r.category)
    )];
    return uniqueCategories.length > 0 ? uniqueCategories : ["Standard", "VIP", "VVIP"];
  };

  if (loading) {
    return (
      <div style={{ 
        minHeight: "100vh", 
        display: "flex", 
        alignItems: "center", 
        justifyContent: "center",
        fontSize: "18px",
        color: "#666"
      }}>
        Loading rooms...
      </div>
    );
  }

  return (
    <div style={{ fontFamily: "'Inter', sans-serif" }}>

      {/* HERO */}
      <div style={styles.hero}>
        <div style={styles.heroContent}>
          <div style={styles.heroBadge}>🇷🇼 Nyanza, Southern Province, Rwanda</div>
          <h1 style={styles.heroTitle}>WELCOME TO<br /><span style={{ color: "#b8860b" }}>ILPD HOSTEL</span></h1>
          <p style={styles.heroSub}>Experience comfort redefined in the heart of Nyanza, Rwanda. Book online, pay securely and skip the reception queue entirely.</p>
          <div style={styles.heroBtns}>
            <Link to={user ? (user.role === "admin" ? "/admin" : "/rooms") : "/register"}><button style={styles.primaryBtn}>{user?.role === "admin" ? "🏨 Go to Admin Dashboard" : "🏨 Book Your Room Now"}</button></Link>
            <a href="#rooms"><button style={styles.outlineBtn}>Explore Rooms ↓</button></a>
          </div>
          <div style={styles.heroStats}>
            {[
              [rooms.length || "128", "Rooms"],
              ["24/7", "Service"],
              ["0min", "Queue Time"],
            ].map(([val, label]) => (
              <div key={label} style={styles.heroStat}>
                <span style={{ fontSize: "24px", fontWeight: "800", color: "#b8860b" }}>{val}</span>
                <span style={{ fontSize: "12px", color: "#ccc", marginTop: "2px" }}>{label}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ABOUT */}
      <div style={styles.section}>
        <div className="container" style={styles.aboutGrid}>
          <div style={styles.aboutBox}>
            <h3 style={{ color: "#b8860b", fontWeight: "700", fontSize: "20px" }}>ILPD Hostel</h3>
            <p style={{ color: "#fff", fontSize: "14px", marginTop: "8px" }}>Nyanza, Rwanda 🇷🇼</p>
            <div style={styles.aboutBadge}>
              <span style={{ fontSize: "28px", fontWeight: "800", color: "#b8860b" }}>15+</span>
              <span style={{ fontSize: "12px", color: "#666" }}>Years of Excellence</span>
            </div>
          </div>
          <div>
            <div style={styles.sectionLabel}>About Us</div>
            <h2 style={styles.sectionTitle}>ILPD Hostel<br />Contact & Campus Info</h2>
            <p style={{ color: "#666", lineHeight: "1.8", marginBottom: "12px" }}>The Institute of Legal Practice and Development (ILPD) main campus is located on Avenue des Sports in Nyanza, Southern Province, Rwanda, about 95 km from Kigali.</p>
            <p style={{ color: "#666", lineHeight: "1.8", marginBottom: "12px" }}>📍 Avenue des Sports, P.O. Box 49, Nyanza, Southern Province, Rwanda</p>
            <p style={{ color: "#666", lineHeight: "1.8", marginBottom: "12px" }}>✉️ info@ilpd.ac.rw &nbsp;|&nbsp; 📞 +250 788 891 482</p>
            <p style={{ color: "#666", lineHeight: "1.8", marginBottom: "24px" }}>🎓 Academic Registrar: registrar@ilpd.ac.rw / +250 788 306 034</p>
            <div style={styles.aboutFeatures}>
              {["✅ No Queue Check-in", "✅ Online Booking", "✅ Secure Payment", "✅ 24/7 Support"].map((f) => (
                <span key={f} style={styles.aboutFeature}>{f}</span>
              ))}
            </div>
            <Link to="/register"><button style={{ ...styles.primaryBtn, marginTop: "24px" }}>Get Started →</button></Link>
          </div>
        </div>
      </div>

      {/* HOW IT WORKS */}
      <div style={{ ...styles.section, background: "#f8f9fa" }}>
        <div className="container">
          <div style={{ textAlign: "center" }}>
            <div style={styles.sectionLabel}>Simple Process</div>
            <h2 style={{ ...styles.sectionTitle, textAlign: "center" }}>How It Works</h2>
            <p style={styles.sectionSub}>Book your stay in 4 simple steps — no queue, no hassle</p>
          </div>
          <div style={styles.stepsGrid}>
            {[
              { step: "01", icon: "📝", title: "Create Account", desc: "Register with your name, email and phone number in seconds." },
              { step: "02", icon: "🏨", title: "Choose Category", desc: "Select Standard, VIP or VVIP and pick your dates." },
              { step: "03", icon: "💳", title: "Pay Securely", desc: "Pay online via Stripe with your credit or debit card. 100% secure." },
              { step: "04", icon: "⚡", title: "Admin Allocates Room", desc: "After payment, the admin assigns you an available room number. No queue at reception!" },
            ].map(({ step, icon, title, desc }) => (
              <div key={step} style={styles.stepCard}>
                <div style={styles.stepNum}>{step}</div>
                <div style={{ fontSize: "36px", marginBottom: "14px" }}>{icon}</div>
                <h3 style={{ fontWeight: "700", fontSize: "17px", marginBottom: "10px" }}>{title}</h3>
                <p style={{ color: "#666", fontSize: "14px", lineHeight: "1.6" }}>{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ROOMS */}
      <div id="rooms" style={styles.section}>
        <div className="container">
          <div style={{ textAlign: "center" }}>
            <div style={styles.sectionLabel}>Accommodation</div>
            <h2 style={{ ...styles.sectionTitle, textAlign: "center" }}>Choose Your Accommodation</h2>
            <p style={styles.sectionSub}>Browse our available rooms. Photos show actual rooms uploaded by our team.</p>
          </div>

          {/* ILPD Building — Main House */}
          {rooms.filter(r => r.accommodationType === "ilpd_building").length > 0 && (
            <div style={{ ...styles.roomLocation, marginTop: "28px" }}>
              <div style={styles.locationHeader}>
                <div>
                  <h3 style={styles.locationTitle}>🏛️ ILPD Building — Main House</h3>
                  <p style={styles.locationSub}>
                    {getTotalRoomsByType("ilpd_building")} rooms · billed per night · {getCategories("ilpd_building").join(", ")}
                  </p>
                </div>
                <Link to="/rooms"><button style={styles.primaryBtn}>View Main House Rooms →</button></Link>
              </div>
              <div style={styles.photoGrid}>
                {getCategories("ilpd_building").map((category) => {
                  const count = getRoomCount(category, "ilpd_building");
                  const price = getRoomPrice(category, "ilpd_building");
                  const image = getRoomImage(category, "ilpd_building");
                  
                  return (
                    <div key={category} style={styles.photoCard}>
                      <div style={styles.imageWrapper}>
                        <img 
                          src={image} 
                          alt={`${category} room in ILPD Main House`} 
                          style={styles.locationPhoto}
                          onError={(e) => {
                            const fallback = STATIC_IMAGES[`${category.toLowerCase()}-ilpd`] || `/rooms/${category.toLowerCase()}-ilpd.jpg`;
                            e.target.src = fallback;
                          }}
                        />
                      </div>
                      <div style={styles.photoBody}>
                        <strong>{category}</strong>
                        <span>{count} rooms · {price.toLocaleString()} RWF/night</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Outside Hostel Block */}
          {rooms.filter(r => r.accommodationType === "outside_hostel").length > 0 && (
            <div style={{ ...styles.roomLocation, marginTop: "28px" }}>
              <div style={styles.locationHeader}>
                <div>
                  <h3 style={styles.locationTitle}>🏨 Outside Hostel Block</h3>
                  <p style={styles.locationSub}>
                    {getTotalRoomsByType("outside_hostel")} rooms · {getCategories("outside_hostel").join(", ")}
                  </p>
                </div>
                <Link to="/rooms"><button style={styles.primaryBtn}>View Outside Block Rooms →</button></Link>
              </div>
              <div style={styles.photoGrid}>
                {getCategories("outside_hostel").map((category) => {
                  const count = getRoomCount(category, "outside_hostel");
                  const price = getRoomPrice(category, "outside_hostel");
                  const image = getRoomImage(category, "outside_hostel");
                  
                  return (
                    <div key={category} style={styles.photoCard}>
                      <div style={styles.imageWrapper}>
                        <img 
                          src={image} 
                          alt={`${category} room in Outside Hostel Block`} 
                          style={styles.locationPhoto}
                          onError={(e) => {
                            const fallback = STATIC_IMAGES[`${category.toLowerCase()}-outside`] || `/rooms/${category.toLowerCase()}-outside.jpg`;
                            e.target.src = fallback;
                          }}
                        />
                      </div>
                      <div style={styles.photoBody}>
                        <strong>{category}</strong>
                        <span>{count} rooms · {price.toLocaleString()} RWF/month</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* If no rooms exist */}
          {rooms.length === 0 && (
            <div style={{ ...styles.roomLocation, marginTop: "28px" }}>
              <div style={styles.locationHeader}>
                <div>
                  <h3 style={styles.locationTitle}>🏛️ ILPD Building — Main House</h3>
                  <p style={styles.locationSub}>88 rooms · billed per night · Standard, VIP and VVIP</p>
                </div>
                <Link to="/rooms"><button style={styles.primaryBtn}>View Main House Rooms →</button></Link>
              </div>
              <div style={styles.photoGrid}>
                {[
                  { name: "Standard", img: "/rooms/standard-ilpd.jpg", detail: "54 rooms · 35,000 RWF/night" },
                  { name: "VIP", img: "/rooms/vip-ilpd.jpg", detail: "32 rooms · 50,000 RWF/night" },
                  { name: "VVIP", img: "/rooms/vvip-ilpd.jpg", detail: "2 rooms · 100,000 RWF/night" },
                ].map(({ name, img, detail }) => (
                  <div key={name} style={styles.photoCard}>
                    <div style={styles.imageWrapper}>
                      <img src={img} alt={`${name} room`} style={styles.locationPhoto} />
                    </div>
                    <div style={styles.photoBody}>
                      <strong>{name}</strong>
                      <span>{detail}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* SERVICES */}
      <div style={{ ...styles.section, background: "#f8f9fa" }}>
        <div className="container">
          <div style={{ textAlign: "center" }}>
            <div style={styles.sectionLabel}>Amenities</div>
            <h2 style={{ ...styles.sectionTitle, textAlign: "center" }}>Hostel Services</h2>
            <p style={styles.sectionSub}>Everything you need for a perfect stay in Nyanza, Rwanda</p>
          </div>
          <div style={styles.servicesGrid}>
            {SERVICES.map(({ icon, title, desc }) => (
              <div key={title} style={styles.serviceCard}>
                <div style={styles.serviceIcon}>{icon}</div>
                <h4 style={{ fontWeight: "700", margin: "12px 0 8px", fontSize: "16px" }}>{title}</h4>
                <p style={{ color: "#666", fontSize: "13px", lineHeight: "1.6" }}>{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* CTA */}
      <div style={styles.cta}>
        <div className="container" style={{ textAlign: "center" }}>
          <h2 style={{ color: "#fff", fontSize: "36px", fontWeight: "800", marginBottom: "14px" }}>Ready to Experience ILPD Hostel?</h2>
          <p style={{ color: "rgba(255,255,255,0.85)", marginBottom: "32px", fontSize: "16px" }}>Join guests who skip the queue and enjoy seamless check-in at Nyanza's finest hostel.</p>
          <div style={{ display: "flex", gap: "16px", justifyContent: "center", flexWrap: "wrap" }}>
            <Link to={user ? (user.role === "admin" ? "/admin" : "/rooms") : "/register"}><button style={styles.primaryBtn}>{user?.role === "admin" ? "🏨 Go to Admin Dashboard" : "🏨 Book Your Stay Now"}</button></Link>
            <Link to="/login"><button style={styles.outlineBtn}>Login to Account</button></Link>
          </div>
        </div>
      </div>

      {/* FOOTER */}
      <footer style={styles.footer}>
        <div className="container">
          <div style={styles.footerGrid}>
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "12px" }}>
                <img src="/ILPD MARK.webp" alt="ILPD" style={{ height: "30px", objectFit: "contain" }} />
                <span style={styles.footerBrand}>ILPD Institution</span>
              </div>
              <p style={styles.footerDesc}>ILPD Institution in Nyanza, Rwanda, supporting education and community development with modern digital services.</p>
            </div>
            <div>
              <p style={styles.footerHeading}>Quick Links</p>
              {[["Home", "/"], ["Rooms", "/rooms"], ["Login", "/login"], ["Register", "/register"]].map(([label, href]) => (
                <p key={label} style={styles.footerLink}><a href={href} style={{ color: "#888", textDecoration: "none" }}>{label}</a></p>
              ))}
            </div>
            <div>
              <p style={styles.footerHeading}>Services</p>
              {["Restaurant", "Parking", "Free High-Speed WiFi", "TV", "Daily Housekeeping"].map((s) => (
                <p key={s} style={styles.footerLink}>{s}</p>
              ))}
            </div>
            <div>
              <p style={styles.footerHeading}>Contact Us</p>
              <p style={styles.footerLink}>📍 Avenue des Sports, Nyanza, Southern Province, Rwanda</p>
              <p style={styles.footerLink}>📞 +250 788 891 482</p>
              <p style={styles.footerLink}>✉️ info@ilpd.ac.rw</p>
              <p style={styles.footerLink}>🌐 www.ilpd.ac.rw</p>
            </div>
          </div>
          <div style={styles.footerBottom}>
            <p style={{ color: "#555", fontSize: "13px" }}>© 2024 ILPD Institution, Nyanza Rwanda. All rights reserved.</p>
            <p style={{ color: "#555", fontSize: "13px" }}>Made with ❤️ in Rwanda 🇷🇼</p>
          </div>
        </div>
      </footer>
    </div>
  );
}

// ✅ PERFECT BALANCE - Not too big, not too small, fully visible
const styles = {
  hero: { backgroundImage: "linear-gradient(160deg, rgba(15,30,60,0.60) 0%, rgba(10,20,45,0.45) 60%, rgba(184,134,11,0.12) 100%), url('/ILPD.webp')", backgroundSize: "cover", backgroundPosition: "center", backgroundRepeat: "no-repeat", minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: "40px 20px" },
  heroContent: { textAlign: "center", maxWidth: "750px" },
  heroBadge: { display: "inline-block", background: "rgba(184,134,11,0.25)", color: "#f0c040", border: "1px solid #b8860b", padding: "8px 20px", borderRadius: "25px", fontSize: "14px", fontWeight: "600", marginBottom: "24px" },
  heroTitle: { color: "#fff", fontSize: "58px", fontWeight: "800", lineHeight: "1.15", marginBottom: "20px" },
  heroSub: { color: "rgba(255,255,255,0.85)", fontSize: "17px", lineHeight: "1.8", marginBottom: "36px" },
  heroBtns: { display: "flex", gap: "16px", justifyContent: "center", flexWrap: "wrap", marginBottom: "48px" },
  primaryBtn: { background: "#b8860b", color: "#fff", border: "none", padding: "14px 32px", borderRadius: "8px", cursor: "pointer", fontWeight: "700", fontSize: "16px" },
  outlineBtn: { background: "transparent", color: "#fff", border: "2px solid rgba(255,255,255,0.6)", padding: "14px 32px", borderRadius: "8px", cursor: "pointer", fontWeight: "600", fontSize: "16px" },
  heroStats: { display: "flex", gap: "40px", justifyContent: "center", flexWrap: "wrap" },
  heroStat: { display: "flex", flexDirection: "column", alignItems: "center" },
  section: { padding: "80px 20px", background: "#fafaf8" },
  sectionLabel: { display: "inline-block", color: "#b8860b", border: "1px solid #b8860b", padding: "4px 14px", borderRadius: "20px", fontSize: "12px", fontWeight: "700", textTransform: "uppercase", letterSpacing: "1px", marginBottom: "14px" },
  sectionTitle: { fontSize: "34px", fontWeight: "800", marginBottom: "12px", color: "#1a1a2e" },
  sectionSub: { textAlign: "center", color: "#888", marginBottom: "48px", fontSize: "15px" },
  aboutGrid: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: "60px", alignItems: "center" },
  aboutBox: { background: "linear-gradient(135deg, #1a1a2e, #0f3460)", borderRadius: "16px", padding: "60px 40px", textAlign: "center", position: "relative" },
  aboutBadge: { position: "absolute", bottom: "-20px", right: "-20px", background: "#fff", borderRadius: "12px", padding: "16px 20px", boxShadow: "0 4px 20px rgba(0,0,0,0.12)", display: "flex", flexDirection: "column", alignItems: "center" },
  aboutFeatures: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" },
  aboutFeature: { background: "#f8f9fa", padding: "10px 14px", borderRadius: "8px", fontSize: "13px", fontWeight: "600" },
  stepsGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: "24px" },
  stepCard: { background: "#ffffff", borderRadius: "14px", padding: "32px 24px", textAlign: "center", boxShadow: "0 2px 20px rgba(0,0,0,0.06)", border: "1px solid #f0ede6" },
  stepNum: { display: "inline-block", background: "#b8860b", color: "#fff", padding: "6px 14px", borderRadius: "20px", fontSize: "13px", fontWeight: "800", marginBottom: "16px" },
  roomLocation: { background: "#fff", borderRadius: "16px", padding: "24px", border: "1px solid #f0ede6", boxShadow: "0 4px 24px rgba(0,0,0,0.05)" },
  locationHeader: { display: "flex", justifyContent: "space-between", alignItems: "center", gap: "20px", flexWrap: "wrap", marginBottom: "20px" },
  locationTitle: { fontSize: "22px", fontWeight: "800", marginBottom: "6px", color: "#1a1a2e" },
  locationSub: { color: "#666", fontSize: "13px", margin: 0 },
  
  // ✅ PERFECT BALANCE - Image wrapper with proper size
  imageWrapper: {
    width: "100%",
    height: "190px",  // ← PERFECT SIZE - Not too big, not too small
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#f8f9fa",
    borderRadius: "12px 12px 0 0",
    overflow: "hidden"
  },
  
  photoGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
    gap: "16px"
  },
  
  photoCard: {
    overflow: "hidden",
    borderRadius: "12px",
    border: "1px solid #f0ede6",
    background: "#fff",
    boxShadow: "0 2px 8px rgba(0,0,0,0.05)"
  },
  
  // ✅ Shows FULL image inside wrapper
  locationPhoto: {
    width: "100%",
    height: "100%",
    objectFit: "contain",
    display: "block"
  },
  
  photoBody: { 
    padding: "10px 12px 12px 12px", 
    display: "flex", 
    flexDirection: "column", 
    gap: "2px"
  },
  servicesGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: "20px" },
  serviceCard: { padding: "28px 20px", background: "#ffffff", borderRadius: "14px", textAlign: "center", boxShadow: "0 2px 14px rgba(0,0,0,0.05)", border: "1px solid #f0ede6" },
  serviceIcon: { fontSize: "36px", background: "#f8f9fa", width: "64px", height: "64px", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto" },
  cta: { backgroundImage: "linear-gradient(160deg, rgba(20,14,4,0.65), rgba(100,72,4,0.60)), url('/ILPD MARK.webp')", backgroundSize: "cover", backgroundPosition: "center", backgroundRepeat: "no-repeat", padding: "80px 20px" },
  footer: { background: "#111", padding: "60px 20px 30px" },
  footerGrid: { display: "grid", gridTemplateColumns: "2fr 1fr 1fr 1fr", gap: "40px", marginBottom: "40px" },
  footerBrand: { fontSize: "22px", fontWeight: "700", color: "#b8860b", marginBottom: "12px" },
  footerDesc: { color: "#666", fontSize: "13px", lineHeight: "1.7" },
  footerHeading: { color: "#fff", fontWeight: "700", marginBottom: "14px", fontSize: "15px" },
  footerLink: { color: "#888", fontSize: "13px", marginBottom: "8px" },
  footerBottom: { borderTop: "1px solid #222", paddingTop: "24px", display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: "10px" },
};