const jwt = require('jsonwebtoken');
const User = require('../models/User');
const Log = require('../models/Log');
const bcrypt = require("bcryptjs");

const generateToken = (user) => {
  return jwt.sign(
  {
    userId: user.userId,
    ownerId: user.ownerId,
    email: user.email,
    role: user.role
  },
  
    process.env.JWT_SECRET || 'your-secret-key',
    { expiresIn: '7d' }
  );
};

exports.register = async (req, res) => {
  try {
    const { name, email, password, department, phone, userId } = req.body;

    // Check if email already exists
    const existingEmail = await User.findOne({ email });
    if (existingEmail) {
      return res.status(400).json({
        message: "Email already registered"
      });
    }

    // Check if userId already exists
    const existingUserId = await User.findOne({ userId });
    if (existingUserId) {
      return res.status(400).json({
        message: "User ID already taken"
      });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create new user
    const newUser = new User({
      name,
      email,
      password: hashedPassword,
      department: department || 'General',
      phone: phone || '',
      userId,
      role: 'admin', // Set as admin by default
      totalAttendance: 0,
      createdAt: new Date(),
      updatedAt: new Date()
    });

    // IMPORTANT: Set ownerId to the user's own ID
    newUser.ownerId = newUser.userId;

    await newUser.save();

    // Create token
    const token = jwt.sign(
      { 
        userId: newUser.userId,
        _id: newUser._id,
        email: newUser.email,
        role: newUser.role 
      },
      process.env.JWT_SECRET || 'your-secret-key',
      { expiresIn: "7d" }
    );

    // Set cookie
    res.cookie("token", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: "lax",
      maxAge: 7 * 24 * 60 * 60 * 1000
    });

    console.log("✅ New user registered:", {
      userId: newUser.userId,
      ownerId: newUser.ownerId,
      name: newUser.name
    });

    res.status(201).json({
      success: true,
      message: "Registration successful",
      token,
      user: {
        userId: newUser.userId,
        name: newUser.name,
        email: newUser.email,
        department: newUser.department,
        role: newUser.role,
        ownerId: newUser.ownerId
      }
    });

  } catch (error) {
    console.error("❌ Register error:", error);
    res.status(500).json({
      success: false,
      message: "Server error during registration"
    });
  }
};

exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    const token = generateToken(user);

    res.cookie("token", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: "lax",
      maxAge: 7 * 24 * 60 * 60 * 1000
    });

    console.log("✅ User logged in:", {
      userId: user.userId,
      ownerId: user.ownerId,
      name: user.name
    });

    res.json({
      success: true,
      message: "Login successful",
      token,
      user: {
        userId: user.userId,
        name: user.name,
        email: user.email,
        department: user.department,
        role: user.role,
        ownerId: user.ownerId
      }
    });

  } catch (error) {
    console.error("❌ Login error:", error);
    res.status(500).json({ message: "Server error" });
  }
};

exports.getProfile = async (req, res) => {
  try {
    const user = await User.findOne({ userId: req.user.userId })
      .select('-password');
    
    res.json(user);
  } catch (error) {
    console.error('❌ Profile error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

exports.updateProfile = async (req, res) => {
  try {
    const { name, department, phone } = req.body;
    
    const user = await User.findOne({ userId: req.user.userId });
    
    if (name) user.name = name;
    if (department) user.department = department;
    if (phone) user.phone = phone;
    
    user.updatedAt = new Date();
    await user.save();
    
    res.json({
      message: 'Profile updated successfully',
      user: {
        userId: user.userId,
        name: user.name,
        email: user.email,
        department: user.department,
        phone: user.phone
      }
    });
  } catch (error) {
    console.error('❌ Update profile error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};