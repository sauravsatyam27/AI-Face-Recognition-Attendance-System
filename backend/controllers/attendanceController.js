const Attendance = require('../models/Attendance');
const User = require('../models/User');
const Log = require('../models/Log');

/* =====================================================
   MARK ATTENDANCE (AI + ADMIN SAFE + REALTIME)
===================================================== */
exports.markAttendance = async (req, res) => {
  try {
    const { userId, name, status, confidence, method, ownerId: bodyOwnerId } = req.body;

    if (!userId) {
      return res.status(400).json({ message: "userId is required" });
    }

    /* =====================================================
       OWNER RESOLUTION (🔥 MAIN FIX)
       Admin request → req.user.userId
       AI request    → req.body.ownerId
    ===================================================== */
    const ownerId = req.user?.userId || bodyOwnerId;

    if (!ownerId) {
      return res.status(400).json({
        message: "ownerId missing (AI or Admin not identified)"
      });
    }

    const today = new Date().toISOString().split('T')[0];
    const now = new Date();
    const time = now.toTimeString().split(' ')[0];

    /* =====================================================
       PREVENT DUPLICATE ATTENDANCE
    ===================================================== */
    const existing = await Attendance.findOne({
      ownerId,
      userId,
      date: today
    });

    if (existing) {
      return res.status(200).json({
        message: 'Attendance already marked',
        attendance: existing
      });
    }

    /* =====================================================
       FETCH USER DETAILS
    ===================================================== */
    const user = await User.findOne({ userId });

    const attendance = new Attendance({
      ownerId,
      userId,
      name: name || user?.name || 'Unknown',
      department: user?.department || 'General',
      timestamp: now,
      date: today,
      time,
      status: status || 'Present',
      confidence: confidence || 1.0,
      method: method || 'face'
    });

    await attendance.save();

    /* =====================================================
       UPDATE USER STATS
    ===================================================== */
    await User.findOneAndUpdate(
      { userId },
      {
        $inc: { totalAttendance: 1 },
        lastSeen: now
      }
    );

    /* =====================================================
       LOG EVENT
    ===================================================== */
    await Log.create({
      userId,
      event: 'ATTENDANCE_MARKED',
      details: { date: today, time, status }
    });

    /* =====================================================
       🔥 REALTIME SOCKET EMIT (FINAL FIX)
    ===================================================== */
    const io = req.app.get("io");

    console.log("📡 Emitting attendance_marked to room:", ownerId);

    io.to(ownerId).emit("attendance_marked", {
      success: true,
      userId,
      name: attendance.name,
      status: attendance.status,
      confidence: attendance.confidence,
      timestamp: now
    });

    /* =====================================================
       RESPONSE
    ===================================================== */
    res.status(201).json({
      message: 'Attendance marked successfully',
      attendance
    });

  } catch (error) {
    console.error('Mark attendance error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};


/* =====================================================
   TODAY ATTENDANCE
===================================================== */
exports.getTodayAttendance = async (req, res) => {
  try {
    const today = new Date().toISOString().split('T')[0];

    const attendance = await Attendance.find({
      ownerId: req.user.userId,
      date: today
    }).sort({ timestamp: -1 });

    const stats = {
      total: attendance.length,
      present: attendance.filter(a =>
        a.status === 'Present' || a.status === 'On Time'
      ).length,
      late: attendance.filter(a => a.status === 'Late').length,
      early: attendance.filter(a => a.status === 'Early').length
    };

    res.json({
      date: today,
      stats,
      attendance
    });

  } catch (error) {
    console.error('Get today attendance error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};


/* =====================================================
   RANGE ATTENDANCE
===================================================== */
exports.getAttendanceRange = async (req, res) => {
  try {
    const { startDate, endDate } = req.query;

    const attendance = await Attendance.find({
      ownerId: req.user.userId,
      date: { $gte: startDate, $lte: endDate }
    }).sort({ timestamp: -1 });

    res.json(attendance);

  } catch (error) {
    console.error('Get attendance range error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};


/* =====================================================
   USER ATTENDANCE
===================================================== */
exports.getUserAttendance = async (req, res) => {
  try {
    const { userId } = req.params;

    const attendance = await Attendance.find({
      ownerId: req.user.userId,
      userId
    }).sort({ timestamp: -1 });

    res.json({ userId, attendance });

  } catch (error) {
    console.error('Get user attendance error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};


/* =====================================================
   STATISTICS
===================================================== */
exports.getStatistics = async (req, res) => {
  try {
    const attendance = await Attendance.find({
      ownerId: req.user.userId
    });

    res.json({
      total: attendance.length
    });

  } catch (error) {
    console.error('Get statistics error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};