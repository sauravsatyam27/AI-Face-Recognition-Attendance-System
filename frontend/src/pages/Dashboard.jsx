import React, { useEffect, useState } from "react";
import api from '../utils/axios';
import { Users, CalendarCheck, Clock, TrendingUp } from "lucide-react";
import { useSocket } from "../contexts/SocketContext";
import { useAuth } from "../contexts/AuthContext";
import toast from "react-hot-toast";

const Dashboard = () => {
  const { socket } = useSocket();
  const { user } = useAuth();

  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    total: 0,
    present: 0,
    late: 0,
    early: 0
  });

  const [recentAttendance, setRecentAttendance] = useState([]);

  /* ================= LOAD DASHBOARD ================= */
  useEffect(() => {
    resetDashboard();
    fetchTodayAttendance();
  }, [user]);

  const resetDashboard = () => {
    setStats({
      total: 0,
      present: 0,
      late: 0,
      early: 0
    });
    setRecentAttendance([]);
  };

  /* ================= FETCH DATA ================= */
  const fetchTodayAttendance = async () => {
    try {
      setLoading(true);
      const res = await api.get('/attendance/today');
      setStats(res.data.stats || {});
      setRecentAttendance(res.data.attendance || []);
    } catch (err) {
      console.error(err);
      toast.error("Failed to load dashboard");
    } finally {
      setLoading(false);
    }
  };

  /* ================= LIVE SOCKET UPDATE ================= */
  useEffect(() => {
    if (!socket) return;

    const handleAttendance = () => {
      fetchTodayAttendance();
    };

    socket.on("attendance_marked", handleAttendance);

    return () => {
      socket.off("attendance_marked", handleAttendance);
    };
  }, [socket]);

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">
          Dashboard
        </h1>
        <p className="text-gray-600 mt-2">
          Today's attendance overview
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <StatCard
          title="Total Marked"
          value={stats.total}
          icon={<Users />}
          color="bg-blue-500"
        />
        <StatCard
          title="Present"
          value={stats.present}
          icon={<CalendarCheck />}
          color="bg-green-500"
        />
        <StatCard
          title="Late"
          value={stats.late}
          icon={<Clock />}
          color="bg-yellow-500"
        />
        <StatCard
          title="Early"
          value={stats.early}
          icon={<TrendingUp />}
          color="bg-purple-500"
        />
      </div>

      <div className="card">
        <h2 className="text-lg font-semibold mb-4">
          Recent Attendance
        </h2>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b">
                <th className="py-3 px-4 text-left">User</th>
                <th className="py-3 px-4 text-left">Department</th>
                <th className="py-3 px-4 text-left">Time</th>
                <th className="py-3 px-4 text-left">Status</th>
              </tr>
            </thead>

            <tbody>
              {recentAttendance.map((item, i) => (
                <tr key={i} className="border-b hover:bg-gray-50">
                  <td className="py-3 px-4">{item.name}</td>
                  <td className="py-3 px-4">{item.department}</td>
                  <td className="py-3 px-4">{item.time}</td>
                  <td className="py-3 px-4">
                    <span
                      className={`px-3 py-1 rounded-full text-sm ${
                        item.status === "On Time"
                          ? "bg-green-100 text-green-700"
                          : item.status === "Late"
                          ? "bg-yellow-100 text-yellow-700"
                          : "bg-blue-100 text-blue-700"
                      }`}
                    >
                      {item.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {recentAttendance.length === 0 && (
            <p className="text-center text-gray-500 py-6">
              No attendance marked today
            </p>
          )}
        </div>
      </div>
    </div>
  );
};

const StatCard = ({ title, value, icon, color }) => (
  <div className="card flex items-center justify-between">
    <div>
      <p className="text-gray-600 text-sm">{title}</p>
      <h3 className="text-2xl font-bold mt-1">{value}</h3>
    </div>
    <div className={`${color} text-white p-3 rounded-lg`}>
      {icon}
    </div>
  </div>
);

export default Dashboard;