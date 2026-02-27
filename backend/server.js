const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const compression = require('compression');
const dotenv = require('dotenv');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');
const aiEventRoutes = require('./routes/aiEventRoutes');
const cookieParser = require("cookie-parser");

// Load environment variables
dotenv.config();

// Import routes
const authRoutes = require('./routes/authRoutes');
const userRoutes = require('./routes/userRoutes');
const attendanceRoutes = require('./routes/attendanceRoutes');
const aiRoutes = require('./routes/aiRoutes');
const reportRoutes = require('./routes/reportRoutes');

const app = express();
const server = http.createServer(app);

/* ================= SOCKET.IO SETUP ================= */
const io = socketIo(server, {
  cors: {
    origin: [
      "http://localhost:3000",
      "http://localhost:5173",
      "https://ai-face-recognition-attendance-system.vercel.app"
    ],
    methods: ["GET", "POST"],
    credentials: true
  }
});

/* ================= MIDDLEWARE ================= */
app.use(
  helmet({
    crossOriginResourcePolicy: { policy: "cross-origin" }
  })
);

app.use(compression());


app.use(cors({
  origin: [
    "http://localhost:3000",
    "http://localhost:5173",
    "https://ai-face-recognition-attendance-system.vercel.app"
  ],
  credentials: true
}));

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));
app.use(morgan('dev'));

/* ================= STATIC FILES ================= */
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

/* ================= DATABASE ================= */
mongoose
  .connect(
    process.env.MONGODB_URI ||
      'mongodb://localhost:27017/face-recognition'
  )
  .then(() => console.log('✅ MongoDB connected'))
  .catch((err) =>
    console.error('❌ MongoDB connection error:', err)
  );

/* ================= SOCKET CONNECTION ================= */
io.on("connection", (socket) => {

  const ownerId = socket.handshake.auth?.ownerId;

  if (ownerId) {
    socket.join(ownerId);
    console.log("👤 Admin joined room:", ownerId);
  }

  socket.on("disconnect", () => {
    console.log("❌ Client disconnected:", socket.id);
  });

});


// Make socket accessible everywhere
app.set('io', io);

app.use(cookieParser());

/* ================= ROUTES ================= */
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/attendance', aiEventRoutes(io));
app.use('/api/ai', aiRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/attendance', attendanceRoutes);

/* ================= HEALTH CHECK ================= */
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    services: {
      mongodb:
        mongoose.connection.readyState === 1
          ? 'connected'
          : 'disconnected'
    }
  });
});

/* ================= ERROR HANDLER ================= */
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(err.status || 500).json({
    message: err.message || 'Internal server error',
    error:
      process.env.NODE_ENV === 'development' ? err : {}
  });
});

/* ================= 404 ================= */
app.use('*', (req, res) => {
  res.status(404).json({ message: 'Route not found' });
});

/* ================= SERVER START ================= */
const PORT = process.env.PORT || 5000;

server.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📡 WebSocket server ready`);
});

module.exports = { app, server };