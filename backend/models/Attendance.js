const mongoose = require('mongoose');

const attendanceSchema = new mongoose.Schema({
  userId: {
    type: String,
    required: true
  },
  name: {
    type: String,
    required: true
  },
  department: {
    type: String
  },
  timestamp: {
    type: Date,
    default: Date.now
  },

 ownerId: {
  type: String,
  required: true,
  index: true
},  
  date: {
    type: String,
    required: true
  },
  time: {
    type: String,
    required: true
  },
  status: {
    type: String,
    enum: ['Present', 'Late', 'Early', 'Absent', 'On Time'],
    default: 'Present'
  },
  confidence: {
    type: Number,
    min: 0,
    max: 1
  },
  method: {
    type: String,
    enum: ['face', 'manual'],
    default: 'face'
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

// Compound index for efficient queries
attendanceSchema.index({ userId: 1, date: 1 });
attendanceSchema.index({ date: 1 });
attendanceSchema.index({ department: 1, date: 1 });

module.exports = mongoose.model('Attendance', attendanceSchema);