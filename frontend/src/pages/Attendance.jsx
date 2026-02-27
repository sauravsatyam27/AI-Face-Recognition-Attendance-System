import React, { useState, useEffect } from 'react';
import api from "../utils/axios";
import { Calendar, Download, Filter } from 'lucide-react';
import DatePicker from 'react-datepicker';
import "react-datepicker/dist/react-datepicker.css";
import toast from 'react-hot-toast';
import { useSocket } from "../contexts/SocketContext";
import { useAuth } from "../contexts/AuthContext";

const Attendance = () => {
  const { socket } = useSocket();
  const { user } = useAuth();

  const [attendance, setAttendance] = useState([]);
  const [loading, setLoading] = useState(true);
  const [startDate, setStartDate] = useState(new Date());
  const [endDate, setEndDate] = useState(new Date());
  const [filter, setFilter] = useState('today');

  useEffect(() => {
    setAttendance([]);
    fetchAttendance();
  }, [filter, startDate, endDate, user]);

  useEffect(() => {
    if (!socket) return;

    const handleAttendanceMarked = () => {
      console.log("🔄 Attendance auto refresh triggered by socket");
      fetchAttendance();
    };

    socket.on("attendance_marked", handleAttendanceMarked);

    return () => {
      socket.off("attendance_marked", handleAttendanceMarked);
    };
  }, [socket]);

  const fetchAttendance = async () => {
    try {
      let url = '/attendance/today';

      if (filter === 'range') {
        url = `/attendance/range?startDate=${startDate.toISOString().split('T')[0]}&endDate=${endDate.toISOString().split('T')[0]}`;
      }

      const response = await api.get(url, {
        headers: { "Cache-Control": "no-cache" }
      });
      
      setAttendance(filter === 'range' ? response.data : response.data.attendance || []);
      console.log("✅ Attendance data refreshed");
    } catch (error) {
      toast.error('Failed to fetch attendance');
    } finally {
      setLoading(false);
    }
  };

  const exportToExcel = async () => {
    try {
      const response = await api.get(
        `/reports/excel?startDate=${startDate.toISOString().split('T')[0]}&endDate=${endDate.toISOString().split('T')[0]}`,
        { responseType: 'blob' }
      );
      
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `attendance-${startDate.toISOString().split('T')[0]}-to-${endDate.toISOString().split('T')[0]}.xlsx`);
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (error) {
      toast.error('Failed to export');
    }
  };

  const exportToPDF = async () => {
    try {
      const response = await api.get(
        `/reports/pdf?startDate=${startDate.toISOString().split('T')[0]}&endDate=${endDate.toISOString().split('T')[0]}`,
        { responseType: 'blob' }
      );
      
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `attendance-${startDate.toISOString().split('T')[0]}-to-${endDate.toISOString().split('T')[0]}.pdf`);
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (error) {
      toast.error('Failed to export');
    }
  };

  const getStatusBadge = (status) => {
    const styles = {
      'On Time': 'bg-green-100 text-green-800',
      'Present': 'bg-green-100 text-green-800',
      'Late': 'bg-yellow-100 text-yellow-800',
      'Early': 'bg-blue-100 text-blue-800',
      'Absent': 'bg-red-100 text-red-800'
    };
    return styles[status] || 'bg-gray-100 text-gray-800';
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Attendance</h1>
          <p className="text-gray-600 mt-2">View and manage attendance records</p>
        </div>
        <div className="flex items-center space-x-3">
          <button
            onClick={exportToExcel}
            className="btn-secondary flex items-center space-x-2"
          >
            <Download size={20} />
            <span>Excel</span>
          </button>
          <button
            onClick={exportToPDF}
            className="btn-secondary flex items-center space-x-2"
          >
            <Download size={20} />
            <span>PDF</span>
          </button>
        </div>
      </div>

      <div className="card">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center space-x-4">
            <select
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              className="input-field w-40"
            >
              <option value="today">Today</option>
              <option value="range">Date Range</option>
            </select>

            {filter === 'range' && (
              <div className="flex items-center space-x-3">
                <DatePicker
                  selected={startDate}
                  onChange={date => setStartDate(date)}
                  className="input-field w-32"
                  dateFormat="yyyy-MM-dd"
                />
                <span>to</span>
                <DatePicker
                  selected={endDate}
                  onChange={date => setEndDate(date)}
                  className="input-field w-32"
                  dateFormat="yyyy-MM-dd"
                />
              </div>
            )}
          </div>

          <button
            onClick={fetchAttendance}
            className="btn-primary flex items-center space-x-2"
          >
            <Filter size={20} />
            <span>Apply Filter</span>
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b">
                <th className="text-left py-3 px-4 text-sm font-medium text-gray-600">Date</th>
                <th className="text-left py-3 px-4 text-sm font-medium text-gray-600">Time</th>
                <th className="text-left py-3 px-4 text-sm font-medium text-gray-600">User ID</th>
                <th className="text-left py-3 px-4 text-sm font-medium text-gray-600">Name</th>
                <th className="text-left py-3 px-4 text-sm font-medium text-gray-600">Department</th>
                <th className="text-left py-3 px-4 text-sm font-medium text-gray-600">Status</th>
                <th className="text-left py-3 px-4 text-sm font-medium text-gray-600">Confidence</th>
              </tr>
            </thead>
            <tbody>
              {attendance.map((record, index) => (
                <tr key={index} className="border-b hover:bg-gray-50">
                  <td className="py-3 px-4 text-sm text-gray-900">
                    {record.date || new Date(record.timestamp).toLocaleDateString()}
                  </td>
                  <td className="py-3 px-4 text-sm text-gray-900">
                    {record.time || new Date(record.timestamp).toLocaleTimeString()}
                  </td>
                  <td className="py-3 px-4 text-sm text-gray-900">{record.userId}</td>
                  <td className="py-3 px-4 text-sm text-gray-900">{record.name}</td>
                  <td className="py-3 px-4 text-sm text-gray-600">{record.department || '-'}</td>
                  <td className="py-3 px-4">
                    <span className={`px-2 py-1 text-xs font-medium rounded-full ${getStatusBadge(record.status)}`}>
                      {record.status}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-sm text-gray-600">
                    {record.confidence ? `${(record.confidence * 100).toFixed(1)}%` : 'N/A'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {attendance.length === 0 && (
            <div className="text-center py-8">
              <Calendar className="w-12 h-12 text-gray-400 mx-auto mb-3" />
              <p className="text-gray-500">No attendance records found</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Attendance;