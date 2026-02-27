const express = require("express");
const router = express.Router();

const {
  markAttendance,
  getTodayAttendance,
  getAttendanceRange,
  getUserAttendance,
  getStatistics
} = require("../controllers/attendanceController");

const { authMiddleware } = require("../middleware/auth");

/* ================= ATTENDANCE ================= */

// AI + Admin marking
router.post("/mark", markAttendance);

// Today attendance (protected)
router.get("/today", authMiddleware, getTodayAttendance);

// Range attendance
router.get("/range", authMiddleware, getAttendanceRange);

// Single user history
router.get("/user/:userId", authMiddleware, getUserAttendance);

// Statistics
router.get("/stats", authMiddleware, getStatistics);

module.exports = router;