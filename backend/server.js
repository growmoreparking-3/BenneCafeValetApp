require("dotenv").config();
const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
const http = require("http");
const socketIo = require("socket.io");
const path = require("path");

const app = express();

// ✅ REQUIRED for Render / reverse proxy (fix express-rate-limit X-Forwarded-For error)
app.set("trust proxy", 1);

const server = http.createServer(app);

// ✅ Email Service (Brevo API mode)
const emailService = require("./services/emailService");

// ✅ Socket.io setup
const io = socketIo(server, {
  cors: {
    origin: process.env.FRONTEND_URL || "https://growmoreapp2-0.onrender.com",
    methods: ["GET", "POST"],
    credentials: true,
  },
});

// ✅ Middleware
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        ...helmet.contentSecurityPolicy.getDefaultDirectives(),
        "script-src": ["'self'", "'unsafe-inline'", "https://checkout.razorpay.com"],
        "frame-src": ["'self'", "https://api.razorpay.com", "https://checkout.razorpay.com"],
        "connect-src": ["'self'", "https://api.razorpay.com", "wss:", "ws:", "https://api.brevo.com"],
        "img-src": ["'self'", "data:", "https://*.razorpay.com", "blob:"],
      },
    },
  })
);

app.use(
  cors({
    origin: [process.env.FRONTEND_URL, "https://growmoreapp2-0.onrender.com"].filter(Boolean),
    credentials: true,
  })
);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ✅ Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 200, // increased slightly
  standardHeaders: true,
  legacyHeaders: false,
});
app.use("/api/", limiter);

// ✅ MongoDB Connection
mongoose
  .connect(process.env.MONGODB_URI)
  .then(() => console.log("✓ MongoDB Connected"))
  .catch((err) => console.error("MongoDB Connection Error:", err));

// ✅ Make io accessible to routes
app.set("io", io);

// ✅ Socket.io connection handling
io.on("connection", (socket) => {
  console.log("New client connected:", socket.id);

  socket.on("join-driver", (driverId) => {
    socket.join(`driver-${driverId}`);
    console.log(`Driver ${driverId} joined`);
  });

  socket.on("join-customer", (customerId) => {
    socket.join(`customer-${customerId}`);
    console.log(`Customer ${customerId} joined`);
  });

  socket.on("join-supervisor", (supervisorId) => {
    socket.join(`supervisor-${supervisorId}`);
    socket.join("supervisors");
    console.log(`Supervisor ${supervisorId} joined`);
  });

  socket.on("disconnect", () => {
    console.log("Client disconnected:", socket.id);
  });
});

// ✅ Routes
app.use("/api/auth", require("./routes/auth"));
app.use("/api/bookings", require("./routes/bookings"));
app.use("/api/users", require("./routes/users"));
app.use("/api/admin", require("./routes/admin"));
app.use("/api/venues", require("./routes/venues"));
app.use("/api/payment", require("./routes/payment"));

// ✅ Serve uploaded images
const { UPLOAD_PATH } = require("./config/imageUpload");
app.use("/uploads", express.static(UPLOAD_PATH));

// ✅ Health check
app.get("/api/health", (req, res) => {
  res.json({ status: "OK", message: "growmore API is running ✅" });
});

// ✅ TEST WHATSAPP (ChatMitra)
app.get("/api/test-whatsapp", async (req, res) => {
  try {
    const whatsappService = require("./services/whatsappService");
    const phone = req.query.phone;
    const otp = req.query.otp || '123456';

    if (!phone) {
      return res.status(400).json({
        success: false,
        message: "Please provide ?phone=9876543210",
        enabled: whatsappService.enabled,
        apiUrl: process.env.CHATMITRA_API_URL || 'NOT SET',
        apiKeySet: !!process.env.CHATMITRA_API_KEY
      });
    }

    const result = await whatsappService.sendOTP(phone, otp);
    res.json({ success: true, result });
  } catch (err) {
    console.error("Test WhatsApp Error:", err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// ✅ TEST EMAIL API (Brevo API mode)
app.get("/api/test-email", async (req, res) => {
  try {
    const to = req.query.to || process.env.TEST_EMAIL_TO;

    if (!to) {
      return res.status(400).json({
        success: false,
        message: "Please provide ?to=email@example.com OR set TEST_EMAIL_TO in env",
      });
    }

    const result = await emailService.sendEmail(
      to,
      "Test Email from Render ✅",
      "<h2>Hello from Render</h2><p>Brevo API Email system is working!</p>"
    );

    res.json({ success: true, result });
  } catch (err) {
    console.error("Test Email Error:", err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// ✅ Serve React frontend in production (Render fix)
if (process.env.NODE_ENV === "production") {
  // CRA build path: /frontend/build
  const buildPath = path.join(__dirname, "..", "frontend", "build");

  // Serve static React files
  app.use(express.static(buildPath));

  // React Router support
  app.get("*", (req, res) => {
    // Skip API routes
    if (req.path.startsWith("/api")) {
      return res.status(404).json({ message: "API endpoint not found" });
    }

    res.sendFile(path.join(buildPath, "index.html"));
  });
}

// ✅ Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({
    message: "Something went wrong!",
    error: process.env.NODE_ENV === "development" ? err.message : undefined,
  });
});

// ✅ Start server
const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`✓ Server running on port ${PORT}`);
});
