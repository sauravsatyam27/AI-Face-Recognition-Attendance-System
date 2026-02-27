const express = require("express");

module.exports = (io) => {
  const router = express.Router();

  router.post('/ai-result', async (req, res) => {
  try {
    const io = req.app.get('io');

    const {
      ownerId,
      name,
      userId,
      department,
      confidence,
      status
    } = req.body;

    console.log("✅ AI RESULT RECEIVED:", name, ownerId);

    const payload = {
      success: true,
      ownerId,
      name,
      userId,
      department,
      confidence,
      status,
      timestamp: new Date()
    };

    // ⭐ VERY IMPORTANT — send ONLY to that admin
    io.to(ownerId).emit("attendance_marked", payload);
    io.to(ownerId).emit("recognition_result", payload);

    res.json({ success: true });

  } catch (err) {
    console.error("AI RESULT ERROR:", err);
    res.status(500).json({ error: "AI result failed" });
  }
});

  return router;
};