const express = require('express');
const router = express.Router();
const User = require('../models/User');
const { authMiddleware, adminMiddleware } = require('../middleware/auth');
const axios = require("axios");

const AI_URL = process.env.AI_SERVICE_URL || "http://localhost:5001";

/* =====================================================
   GET ALL USERS (ADMIN OWN DATA ONLY)
===================================================== */
router.get('/', authMiddleware, adminMiddleware, async (req, res) => {
  try {

    const users = await User.find({
      ownerId: req.user.userId   // ⭐ ADMIN ISOLATION
    })
      .select('-password')
      .sort({ createdAt: -1 });

    res.json(users);

  } catch (error) {
    console.error("Get users error:", error);
    res.status(500).json({ message: 'Server error' });
  }
});

/* =====================================================
   GET SINGLE USER (SECURE)
===================================================== */
router.get('/:userId', authMiddleware, async (req, res) => {
  try {

    const user = await User.findOne({
      userId: req.params.userId,
      ownerId: req.user.userId   // ⭐ SECURITY CHECK
    }).select('-password');

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    res.json(user);

  } catch (error) {
    console.error("Get user error:", error);
    res.status(500).json({ message: 'Server error' });
  }
});

/* =====================================================
   UPDATE USER (ADMIN OWNERSHIP CHECK)
===================================================== */
router.put('/:userId', authMiddleware, adminMiddleware, async (req, res) => {
  try {

    const user = await User.findOne({
      userId: req.params.userId,
      ownerId: req.user.userId
    });

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const { name, department, email, phone, role } = req.body;

    if (name) user.name = name;
    if (department) user.department = department;
    if (email) user.email = email;
    if (phone) user.phone = phone;
    if (role) user.role = role;

    user.updatedAt = new Date();

    await user.save();

    res.json({
      message: 'User updated successfully',
      user
    });

  } catch (error) {
    console.error("Update user error:", error);
    res.status(500).json({ message: 'Server error' });
  }
});

/* =====================================================
   DELETE USER (FULL SAFE DELETE)
===================================================== */
router.delete('/:userId', authMiddleware, adminMiddleware, async (req, res) => {
  try {

    const user = await User.findOneAndDelete({
      userId: req.params.userId,
      ownerId: req.user.userId   // ⭐ PREVENT CROSS DELETE
    });

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Remove from AI service
    try {
      await axios.delete(`${AI_URL}/face/${req.params.userId}`);
    } catch (aiError) {
      console.error('AI delete error:', aiError.message);
    }

    res.json({ message: 'User deleted successfully' });

  } catch (error) {
    console.error("Delete user error:", error);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;