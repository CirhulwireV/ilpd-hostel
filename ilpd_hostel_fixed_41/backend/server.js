const dns = require("dns");
dns.setServers(["8.8.8.8", "1.1.1.1"]);

require("dotenv").config();
const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const helmet = require("helmet");
const { apiLimiter } = require("./middleware/rateLimiter");

const app = express();

app.use(helmet());

app.use(cors({
  origin: (origin, callback) => {
    if (!origin) return callback(null, true);
    const isLocal =
      /^https?:\/\/(localhost|127\.0\.0\.1|192\.168\.\d+\.\d+|10\.\d+\.\d+\.\d+|172\.(1[6-9]|2\d|3[01])\.\d+\.\d+)(:\d+)?$/
        .test(origin);
    const prodOrigins = [
      "https://ilpd-hostel-application.vercel.app",
      "https://ilpd-hostel-app.vercel.app",
      "https://ilpd-hostel-n.vercel.app",
    ];
    const isProd = prodOrigins.includes(origin);
    const isClientUrl = process.env.CLIENT_URL && origin === process.env.CLIENT_URL;
    if (isLocal || isProd || isClientUrl) return callback(null, true);
    console.warn("CORS blocked origin:", origin);
    return callback(new Error("Not allowed by CORS"));
  },
  credentials: true,
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
}));

app.use("/api/bookings/webhook", express.raw({ type: "application/json" }));
app.use((req, res, next) => {
  if (req.originalUrl === "/api/bookings/webhook") return next();
  express.json({ limit: "5mb" })(req, res, next);
});

app.set("trust proxy", 1);
app.use("/api", apiLimiter);

app.use("/api/auth", require("./routes/auth"));
app.use("/api/rooms", require("./routes/rooms"));
app.use("/api/bookings", require("./routes/bookings"));
app.use("/api/concerns", require("./routes/concerns"));
app.use("/api/surveys", require("./routes/surveys"));
app.use("/api/monitoring", require("./routes/monitoring"));
app.use("/api/location-settings", require("./routes/locationSettings"));
app.use("/api/hostel-structure", require("./routes/hostelStructure"));
app.use("/api/settings", require("./routes/settings"));
const uploadRoutes = require("./routes/upload");
app.use("/api/upload", uploadRoutes);

app.get("/", (req, res) => res.json({ message: "ILPD Hostel API Running" }));
app.get("/health", (req, res) => res.status(200).json({ status: "ok" }));

const requiredProductionEnv = [
  "MONGO_URI", "JWT_SECRET", "CLIENT_URL",
  "STRIPE_SECRET_KEY", "STRIPE_WEBHOOK_SECRET",
];
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
    const PORT = process.env.PORT || 5000;
    const server = app.listen(PORT, "0.0.0.0", () =>
      console.log(`Server running on port ${PORT}`)
    );
    server.requestTimeout = 60000;
    server.headersTimeout = 65000;
    server.keepAliveTimeout = 5000;
  })
  .catch((err) => {
    console.error("MongoDB connection failed:", err);
    process.exit(1);
  });