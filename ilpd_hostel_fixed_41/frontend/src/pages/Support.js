import React, { useEffect, useState } from "react";
import API from "../api/axios";
import { Link } from "react-router-dom";

const supportLabels = {
  relatedBooking: "Related Booking (optional)",
  subject: "Subject",
  message: "Message",
  rating: "Rating",
  comments: "Comments",
};

export default function Support() {
  const [bookings, setBookings] = useState([]);
  const [myConcerns, setMyConcerns] = useState([]);
  const preselectedId = new URLSearchParams(window.location.search).get("bookingId") || "";
  const [concern, setConcern] = useState({ bookingId: preselectedId, subject: "", message: "" });
  const [survey, setSurvey] = useState({ bookingId: "", rating: 5, comments: "" });
  const [surveyQuestions, setSurveyQuestions] = useState([]);
  const [answers, setAnswers] = useState({});
  const [status, setStatus] = useState({ concern: "", survey: "", error: "" });

  const loadMyConcerns = () => {
    API.get("/concerns/my").then(({ data }) => setMyConcerns(data)).catch(() => {});
  };

  useEffect(() => {
    const loadSupportData = async () => {
      try {
        const { data: bookingData } = await API.get("/bookings/my");
        setBookings(bookingData);
      } catch {
        setBookings([]);
      }
    };

    loadSupportData();
    loadMyConcerns();
    API.get("/surveys/questions/active").then(({ data }) => setSurveyQuestions(data)).catch(() => {});
  }, []);

  const handleConcernSubmit = async (e) => {
    e.preventDefault();
    setStatus({ concern: "", survey: "", error: "" });
    try {
      await API.post("/concerns", concern);
      setStatus({ concern: "Your concern has been submitted. The manager will respond soon.", survey: "", error: "" });
      setConcern({ bookingId: "", subject: "", message: "" });
      loadMyConcerns();
    } catch (err) {
      setStatus({ concern: "", survey: "", error: err.response?.data?.message || "Unable to submit concern." });
    }
  };

  const handleSurveySubmit = async (e) => {
    e.preventDefault();
    setStatus({ concern: "", survey: "", error: "" });
    try {
      const answersPayload = surveyQuestions.map((q) => ({ question: q.text, answer: answers[q._id] || "" }));
      await API.post("/surveys", { ...survey, answers: answersPayload });
      setStatus({ concern: "", survey: "Thank you for your feedback!", error: "" });
      setSurvey({ bookingId: "", rating: 5, comments: "" });
      setAnswers({});
    } catch (err) {
      setStatus({ concern: "", survey: "", error: err.response?.data?.message || "Unable to submit survey." });
    }
  };

  return (
    <div className="container" style={{ padding: "40px 20px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: "20px", marginBottom: "32px" }}>
        <div>
          <h2 style={{ fontSize: "32px", fontWeight: "700" }}>Guest Support</h2>
          <p style={{ color: "#666", marginTop: "8px" }}>Submit a concern or share your satisfaction survey with the ILPD hostel manager.</p>
        </div>
        <Link to="/my-bookings"><button className="btn btn-primary">View My Bookings</button></Link>
      </div>

      <div style={{ marginBottom: "32px", background: "#fffdf9", border: "1px solid #f0ede6", borderRadius: "16px", padding: "24px" }}>
        <h3 style={{ marginBottom: "16px" }}>Contact & Campus Information</h3>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: "24px" }}>
          <div>
            <p style={{ fontWeight: "700", color: "#b8860b", marginBottom: "8px", fontSize: "14px" }}>Contact Details</p>
            <p style={{ fontSize: "14px", color: "#444", marginBottom: "6px" }}>📍 Avenue des Sports, P.O. Box 49, Nyanza, Southern Province, Rwanda</p>
            <p style={{ fontSize: "14px", color: "#444", marginBottom: "6px" }}>✉️ General: <a href="mailto:info@ilpd.ac.rw">info@ilpd.ac.rw</a></p>
            <p style={{ fontSize: "14px", color: "#444", marginBottom: "6px" }}>📞 Public Relations: +250 788 891 482</p>
            <p style={{ fontSize: "14px", color: "#444", marginBottom: "6px" }}>🎓 Academic Registrar: <a href="mailto:registrar@ilpd.ac.rw">registrar@ilpd.ac.rw</a> / +250 788 306 034</p>
            <p style={{ fontSize: "14px", color: "#444" }}>🌐 <a href="https://www.ilpd.ac.rw/home" target="_blank" rel="noopener noreferrer">www.ilpd.ac.rw</a></p>
          </div>
          <div>
            <p style={{ fontWeight: "700", color: "#b8860b", marginBottom: "8px", fontSize: "14px" }}>Campus Information</p>
            <p style={{ fontSize: "14px", color: "#444", marginBottom: "6px" }}><strong>Main Campus:</strong> Nyanza, Southern Province — about 95 km from Kigali, reachable via Volcano Express or Horizon Express from Kigali's Nyabugogo park.</p>
            <p style={{ fontSize: "14px", color: "#444", marginBottom: "6px" }}><strong>Kigali Office:</strong> Kiyovu, Nyarugenge, Kigali — for evening and weekend programs.</p>
            <p style={{ fontSize: "14px", color: "#444" }}><strong>Programs Offered:</strong> Postgraduate programs, Diploma in Legal Practice, Diploma in Legislative Drafting, and short professional courses.</p>
          </div>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: "24px" }}>
        <div style={{ background: "#fffdf9", border: "1px solid #f0ede6", borderRadius: "16px", padding: "24px" }}>
          <h3 style={{ marginBottom: "18px" }}>Submit a Concern</h3>
          <p style={{ color: "#555", marginBottom: "16px", fontSize: "14px" }}>Send details about your room, stay, or any issue that needs customer care attention.</p>
          <form onSubmit={handleConcernSubmit}>
            <label style={{ fontSize: "13px", fontWeight: "600", color: "#444" }}>{supportLabels.relatedBooking}</label>
            <select value={concern.bookingId} onChange={(e) => setConcern({ ...concern, bookingId: e.target.value })}>
              <option value="">None</option>
              {bookings.map((b) => (
                <option key={b._id} value={b._id}>{`${b.room?.roomNumber ? `Room ${b.room.roomNumber}` : b.category} • ${new Date(b.checkIn).toDateString()}`}</option>
              ))}
            </select>
            <label style={{ fontSize: "13px", fontWeight: "600", color: "#444" }}>{supportLabels.subject}</label>
            <input value={concern.subject} onChange={(e) => setConcern({ ...concern, subject: e.target.value })} required />
            <label style={{ fontSize: "13px", fontWeight: "600", color: "#444" }}>{supportLabels.message}</label>
            <textarea rows="5" value={concern.message} onChange={(e) => setConcern({ ...concern, message: e.target.value })} required style={{ width: "100%", padding: "10px 14px", borderRadius: "8px", border: "1px solid #ddd", resize: "vertical" }} />
            <button type="submit" className="btn btn-primary" style={{ width: "100%", marginTop: "12px" }}>Submit Concern</button>
          </form>
        </div>

        <div style={{ background: "#fffdf9", border: "1px solid #f0ede6", borderRadius: "16px", padding: "24px" }}>
          <h3 style={{ marginBottom: "18px" }}>Customer Satisfaction Survey</h3>
          <p style={{ color: "#555", marginBottom: "16px", fontSize: "14px" }}>Share how your stay was so we can improve the ILPD hostel experience.</p>
          <form onSubmit={handleSurveySubmit}>
            <label style={{ fontSize: "13px", fontWeight: "600", color: "#444" }}>{supportLabels.relatedBooking}</label>
            <select value={survey.bookingId} onChange={(e) => setSurvey({ ...survey, bookingId: e.target.value })} required>
              <option value="">Select a completed booking</option>
              {bookings.filter((b) => b.status === "checked-out").map((b) => (
                <option key={b._id} value={b._id}>{`${b.room?.roomNumber ? `Room ${b.room.roomNumber}` : b.category} • ${new Date(b.checkIn).toDateString()}`}</option>
              ))}
            </select>
            <label style={{ fontSize: "13px", fontWeight: "600", color: "#444" }}>{supportLabels.rating}</label>
            <select value={survey.rating} onChange={(e) => setSurvey({ ...survey, rating: Number(e.target.value) })}>
              {[5, 4, 3, 2, 1].map((value) => (
                <option key={value} value={value}>{`${value} Star${value > 1 ? "s" : ""}`}</option>
              ))}
            </select>
            <label style={{ fontSize: "13px", fontWeight: "600", color: "#444" }}>{supportLabels.comments}</label>
            <textarea rows="5" value={survey.comments} onChange={(e) => setSurvey({ ...survey, comments: e.target.value })} style={{ width: "100%", padding: "10px 14px", borderRadius: "8px", border: "1px solid #ddd", resize: "vertical" }} />
            {surveyQuestions.map((q) => (
              <div key={q._id} style={{ marginTop: "14px" }}>
                <label style={{ fontSize: "13px", fontWeight: "600", color: "#444" }}>{q.text}</label>
                <textarea rows="2" value={answers[q._id] || ""} onChange={(e) => setAnswers((prev) => ({ ...prev, [q._id]: e.target.value }))} style={{ width: "100%", padding: "10px 14px", borderRadius: "8px", border: "1px solid #ddd", resize: "vertical" }} />
              </div>
            ))}
            <button type="submit" className="btn btn-primary" style={{ width: "100%", marginTop: "12px" }} disabled={!survey.bookingId}>Submit Survey</button>
          </form>
        </div>
      </div>

      {myConcerns.length > 0 && (
        <div style={{ marginTop: "32px", background: "#fffdf9", border: "1px solid #f0ede6", borderRadius: "16px", padding: "24px" }}>
          <h3 style={{ marginBottom: "16px" }}>Your Concerns & Responses</h3>
          <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
            {myConcerns.map((c) => (
              <div key={c._id} style={{ border: "1px solid #eee", borderRadius: "10px", padding: "14px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start", gap: "10px", flexWrap: "wrap" }}>
                  <strong>{c.subject}</strong>
                  <span style={{ background: c.status === "open" ? "#fefcbf" : "#c6f6d5", color: c.status === "open" ? "#744210" : "#276749", padding: "3px 10px", borderRadius: "20px", fontSize: "12px", fontWeight: "600" }}>
                    {c.status === "open" ? "Awaiting response" : "Responded"}
                  </span>
                </div>
                <p style={{ color: "#555", fontSize: "14px", margin: "8px 0" }}>{c.message}</p>
                {c.response ? (
                  <div style={{ background: "#f0fff4", border: "1px solid #c6f6d5", borderRadius: "8px", padding: "10px 12px", marginTop: "8px" }}>
                    <p style={{ fontSize: "12px", fontWeight: "700", color: "#276749", margin: "0 0 4px" }}>Manager's response:</p>
                    <p style={{ fontSize: "14px", color: "#333", margin: 0 }}>{c.response}</p>
                  </div>
                ) : (
                  <p style={{ fontSize: "13px", color: "#999", fontStyle: "italic" }}>No response yet — the manager will reply here soon.</p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {status.error && <div style={{ marginTop: "24px", color: "#b91c1c" }}>{status.error}</div>}
      {status.concern && <div style={{ marginTop: "24px", color: "#276749" }}>{status.concern}</div>}
      {status.survey && <div style={{ marginTop: "24px", color: "#276749" }}>{status.survey}</div>}
    </div>
  );
}
