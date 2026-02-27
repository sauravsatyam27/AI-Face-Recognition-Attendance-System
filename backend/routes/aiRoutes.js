const express = require("express");
const router = express.Router();
const axios = require("axios");
const { authMiddleware } = require("../middleware/auth");
const User = require("../models/User");

const AI_URL = process.env.AI_SERVICE_URL || "http://localhost:5001";

/* =====================================================
   REGISTER FACE (ADMIN OWNERSHIP ADDED)
===================================================== */
router.post("/register-face", authMiddleware, async (req, res) => {
  try {
    const payload = {
      ...req.body,
      ownerId: req.user.userId // ⭐ attach admin owner
    };

    const response = await axios.post(
      `${AI_URL}/register-face`,
      payload
    );

    res.json(response.data);
  } catch (err) {
    console.error("Register face error:", err.message);
    res.status(500).json({ message: "AI service error" });
  }
});

/* =====================================================
   STREAM FRAME TO AI
===================================================== */
router.post("/stream", async (req, res) => {
  try {
    const response = await axios.post(
      `${AI_URL}/recognize-stream`,
      req.body
    );

    // return immediately (important for FPS)
    res.json(response.data);

  } catch (err) {
    console.error("AI stream error:", err.message);
    res.status(500).json({ message: "AI service error" });
  }
});

/* =====================================================
   GET KNOWN FACES (ADMIN ISOLATED)
===================================================== */


router.get("/known-faces", authMiddleware, async (req, res) => {
  try {
   const ownerId = req.user?.userId || req.body.ownerId; // ⭐ logged admin

    const response = await axios.get(`${AI_URL}/known-faces`, {
      params: { ownerId }   // ⭐ SEND OWNER ID
    });

    res.json(response.data);

  } catch (err) {
    console.error("Known faces error:", err.message);
    res.status(500).json({ message: "Failed to fetch users" });
  }
});


/* =====================================================
   START RECOGNITION
===================================================== */
router.post("/start", async (req, res) => {
  try {
    const response = await axios.post(
      `${AI_URL}/start-recognition`
    );
    res.json(response.data);
  } catch (err) {
    console.error("Start recognition error:", err.message);
    res.status(500).json({ message: "Failed to start recognition" });
  }
});

/* =====================================================
   STOP RECOGNITION
===================================================== */
router.post("/stop", async (req, res) => {
  try {
    const response = await axios.post(
      `${AI_URL}/stop-recognition`
    );
    res.json(response.data);
  } catch (err) {
    console.error("Stop recognition error:", err.message);
    res.status(500).json({ message: "Failed to stop recognition" });
  }
});

/* =====================================================
   GET AI SETTINGS
===================================================== */
router.get("/settings", async (req, res) => {
  try {
    const response = await axios.get(`${AI_URL}/settings`);
    res.json(response.data);
  } catch (err) {
    console.error("Settings fetch error:", err.message);
    res.status(500).json({ error: "Failed to fetch settings" });
  }
});

/* =====================================================
   UPDATE AI SETTINGS
===================================================== */
router.post("/settings", async (req, res) => {
  try {
    const response = await axios.post(
      `${AI_URL}/settings`,
      req.body
    );

    res.json(response.data);
  } catch (err) {
    console.error("Settings update error:", err.message);
    res.status(500).json({ error: "Failed to update settings" });
  }
});

/* =====================================================
   DELETE FACE (SECURE OWNER CHECK)
===================================================== */
router.delete("/face/:userId", authMiddleware, async (req, res) => {
  try {
    const { userId } = req.params;

    // delete from AI service
    const response = await axios.delete(
      `${AI_URL}/face/${userId}`
    );

    // delete only if owned by this admin
    await User.findOneAndDelete({
      userId,
      ownerId: req.user.userId
    });

    res.json(response.data);

  } catch (err) {
    console.error("Delete face error:", err.message);
    res.status(500).json({
      success: false,
      message: "Failed to delete user"
    });
  }
});

/* =====================================================
   SOCKET STREAM RESULT → FRONTEND
===================================================== */
router.post("/stream-result", async (req, res) => {
  try {
    const io = req.app.get("io");
    const result = req.body;

    const user = await User.findOne({
      userId: result.userId
    });

    const enrichedResult = {
      success: true,
      name: user?.name || result.name,
      userId: user?.userId,
      department: user?.department,
      confidence: result.confidence,
      status: result.status
    };

    io.emit("recognition_result", enrichedResult);

    res.json({ success: true });

  } catch (err) {
    console.error("Socket emit failed:", err);
    res.status(500).json({ message: "socket emit failed" });
  }
});

module.exports = router;