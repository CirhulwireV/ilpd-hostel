import React, { useState } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import Navbar from "./components/Navbar";
import Home from "./pages/Home";
import Login from "./pages/Login";
import Register from "./pages/Register";
import Rooms from "./pages/Rooms";
import BookingSuccess from "./pages/BookingSuccess";
import MyBookings from "./pages/MyBookings";
import AdminDashboard from "./pages/AdminDashboard";
import Support from "./pages/Support";

export default function App() {
  const [user, setUser] = useState(() => {
    try { return JSON.parse(localStorage.getItem("user")) || null; }
    catch { localStorage.clear(); return null; }
  });

  const login = (userData, token) => {
    localStorage.setItem("user", JSON.stringify(userData));
    localStorage.setItem("token", token);
    setUser(userData);
  };

  const logout = () => {
    localStorage.clear();
    setUser(null);
  };

  return (
    <BrowserRouter>
      <Navbar user={user} logout={logout} />
      <Routes>
        <Route path="/" element={<Home user={user} />} />
        {/* CHANGED: Redirect directly to rooms/admin instead of Home */}
        <Route path="/login" element={!user ? <Login login={login} /> : <Navigate to={user?.role === "admin" ? "/admin" : "/rooms"} replace />} />
        <Route path="/register" element={!user ? <Register login={login} /> : <Navigate to="/" />} />
        <Route path="/rooms" element={user ? (user.role !== "admin" ? <Rooms user={user} /> : <Navigate to="/admin" replace />) : <Navigate to="/login" replace />} />
        <Route path="/booking-success" element={user ? (user.role !== "admin" ? <BookingSuccess /> : <Navigate to="/admin" replace />) : <Navigate to="/login" replace />} />
        <Route path="/my-bookings" element={user ? (user.role !== "admin" ? <MyBookings /> : <Navigate to="/admin" replace />) : <Navigate to="/login" replace />} />
        <Route path="/support" element={user ? (user.role !== "admin" ? <Support /> : <Navigate to="/admin" replace />) : <Navigate to="/login" replace />} />
        <Route path="/admin" element={user?.role === "admin" ? <AdminDashboard /> : <Navigate to="/" />} />
      </Routes>
    </BrowserRouter>
  );
}
