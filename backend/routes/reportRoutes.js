const express = require('express');
const router = express.Router();
const Attendance = require('../models/Attendance');
const User = require('../models/User');
const { authMiddleware, adminMiddleware } = require('../middleware/auth');
const ExcelJS = require('exceljs');
const PDFDocument = require('pdfkit');

// Generate Excel report
router.get('/excel', authMiddleware,  async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    
    const attendance = await Attendance.find({
       ownerId: req.user.userId, 
      date: { $gte: startDate, $lte: endDate }
    }).sort({ timestamp: -1 });
    
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Attendance Report');
    
    worksheet.columns = [
      { header: 'Date', key: 'date', width: 15 },
      { header: 'Time', key: 'time', width: 10 },
      { header: 'User ID', key: 'userId', width: 15 },
      { header: 'Name', key: 'name', width: 20 },
      { header: 'Department', key: 'department', width: 15 },
      { header: 'Status', key: 'status', width: 10 },
      { header: 'Confidence', key: 'confidence', width: 12 }
    ];
    
    attendance.forEach(record => {
      worksheet.addRow({
        date: record.date,
        time: record.time,
        userId: record.userId,
        name: record.name,
        department: record.department,
        status: record.status,
        confidence: record.confidence ? `${(record.confidence * 100).toFixed(1)}%` : 'N/A'
      });
    });
    
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename=attendance-report-${startDate}-to-${endDate}.xlsx`);
    
    await workbook.xlsx.write(res);
    res.end();
  } catch (error) {
    console.error('Excel report error:', error);
    res.status(500).json({ message: 'Failed to generate report' });
  }
});

// Generate PDF report
router.get('/pdf', authMiddleware, async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    
    const attendance = await Attendance.find({
       ownerId: req.user.userId,
      date: { $gte: startDate, $lte: endDate }
    }).sort({ timestamp: -1 });
    
    const users = await User.find({
      ownerId: req.user.userId
    });
    
    const doc = new PDFDocument();
    
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=attendance-report-${startDate}-to-${endDate}.pdf`);
    
    doc.pipe(res);
    
    // Title
    doc.fontSize(20).text('Attendance Report', { align: 'center' });
    doc.moveDown();
    doc.fontSize(12).text(`Period: ${startDate} to ${endDate}`, { align: 'center' });
    doc.moveDown();
    
    // Summary
    doc.fontSize(14).text('Summary', { underline: true });
    doc.fontSize(12).text(`Total Records: ${attendance.length}`);
    doc.text(`Total Users: ${users.length}`);
    doc.text(`Present: ${attendance.filter(a => a.status === 'Present' || a.status === 'On Time').length}`);
    doc.text(`Late: ${attendance.filter(a => a.status === 'Late').length}`);
    doc.text(`Early: ${attendance.filter(a => a.status === 'Early').length}`);
    doc.moveDown();
    
    // Detailed records
    doc.fontSize(14).text('Detailed Records', { underline: true });
    doc.moveDown();
    
    let y = doc.y;
    attendance.slice(0, 50).forEach((record, i) => { // Limit to 50 records for PDF
      if (y > 700) {
        doc.addPage();
        y = 50;
      }
      
      doc.fontSize(10)
        .text(`${record.date} ${record.time} - ${record.name} (${record.userId}) - ${record.status}`, {
          continued: false
        });
      
      y = doc.y;
    });
    
    doc.end();
  } catch (error) {
    console.error('PDF report error:', error);
    res.status(500).json({ message: 'Failed to generate report' });
  }
});

module.exports = router;