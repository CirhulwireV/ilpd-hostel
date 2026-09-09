require("dotenv").config();
const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const helmet = require("helmet");
const { apiLimiter } = require("./middleware/rateLimiter");

const app = express();

app.use(helmet());

// ✅ FIXED CORS - Allow Vercel frontend and Render backend
app.use(cors({
  origin: [
    'https://ilpd-hostel-app.vercel.app',
    'https://ilpd-hostel-1.onrender.com',
    'http://localhost:3000'
  ],
  credentials: true
}));

app.use("/api/bookings/webhook", express.raw({ type: "application/json" }));
app.use((req, res, next) => {
  if (req.originalUrl === "/api/bookings/webhook") return next();
  express.json({ limit: "5mb" })(req, res, next);
});

// The app runs behind the AWS Elastic Beanstalk reverse proxy in production.
// Trust one proxy hop so rate limiting sees the real client IP.
app.set("trust proxy", 1);

// General protection for every API route.
app.use("/api", apiLimiter);

app.use("/api/auth", require("./routes/auth"));
app.use("/api/rooms", require("./routes/rooms"));
app.use("/api/bookings", require("./routes/bookings"));
app.use("/api/concerns", require("./routes/concerns"));
app.use("/api/surveys", require("./routes/surveys"));
app.use("/api/monitoring", require("./routes/monitoring"));
app.use("/api/location-settings", require("./routes/locationSettings"));
app.use("/api/hostel-structure", require("./routes/hostelStructure"));
const uploadRoutes = require('./routes/upload');
app.use('/api/upload', uploadRoutes);

app.get("/", (req, res) => res.json({ message: "ILPD Hostel API Running" }));
app.get("/health", (req, res) => res.status(200).json({ status: "ok" }));

const requiredProductionEnv = ["MONGO_URI", "JWT_SECRET", "CLIENT_URL", "STRIPE_SECRET_KEY", "STRIPE_WEBHOOK_SECRET"];
if (process.env.NODE_ENV === "production") {
  const missing = requiredProductionEnv.filter((key) => !process.env[key]);
  if (missing.length) {
    console.error(`Missing required production environment variables: ${missing.join(", ")}`);
    process.exit(1);
  }
}

mongoose.connect(process.env.MONGO_URI)
  .then(() => {
    console.log("MongoDB connected");
    const server = app.listen(process.env.PORT || 5000, () => console.log(`Server running on port ${process.env.PORT || 5000}`));
    // Configure Node's HTTP server, not the Express app object.
    // This gives legitimate DB/payment operations enough time to finish.
    server.requestTimeout = 60000;
    server.headersTimeout = 65000;
    server.keepAliveTimeout = 5000;
  })
  .catch((err) => {
    console.error("MongoDB connection failed:", err);
    process.exit(1);
  });