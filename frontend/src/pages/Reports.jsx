import React, { useState, useEffect, useMemo } from "react";
import api from '../utils/axios';
import DatePicker from "react-datepicker";
import { Bar, Pie, Line } from "react-chartjs-2";
import { Download, Calendar } from "lucide-react";
import { useAuth } from "../contexts/AuthContext";
import toast from "react-hot-toast";

const Reports = () => {
  const { user } = useAuth();

  const [startDate, setStartDate] = useState(
    new Date(new Date().setDate(1))
  );
  const [endDate, setEndDate] = useState(new Date());
  const [reportData, setReportData] = useState(null);
  const [loading, setLoading] = useState(false);

  const generateReport = async () => {
    setLoading(true);
    try {
      const res = await api.get(
        `http://localhost:5000/api/attendance/range?startDate=${
          startDate.toISOString().split("T")[0]
        }&endDate=${endDate.toISOString().split("T")[0]}`
      );

      // 🔥 FIX 1: Group the flat array response by date
      const records = res.data || [];

      // GROUP DATA BY DATE
      const grouped = records.reduce((acc, item) => {
        const date = item.date;
        if (!acc[date]) acc[date] = [];
        acc[date].push(item);
        return acc;
      }, {});

      setReportData({
        grouped,
        total: records.length,
      });
    } catch {
      toast.error("Failed to generate report");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setReportData(null);
    generateReport();
  }, [user]);

  const exportReport = async (format) => {
    try {
      const res = await api.get(
        `http://localhost:5000/api/reports/${format}?startDate=${
          startDate.toISOString().split("T")[0]
        }&endDate=${endDate.toISOString().split("T")[0]}`,
        {
          responseType: "blob",
          withCredentials: true
        }
      );

      const url = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement("a");
      link.href = url;
      link.download = `attendance-report.${format}`;
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (err) {
      console.log(err);
      toast.error("Export failed");
    }
  };

  const grouped = reportData?.grouped || {};

  const departmentChart = useMemo(() => {
    const departments = {};

    Object.values(grouped).forEach((records) => {
      records.forEach((r) => {
        const dept = r.department || "Other";
        departments[dept] = (departments[dept] || 0) + 1;
      });
    });

    return {
      labels: Object.keys(departments),
      datasets: [
        {
          data: Object.values(departments),
          backgroundColor: [
            "#3b82f6",
            "#10b981",
            "#f59e0b",
            "#8b5cf6",
            "#ec4899",
          ],
        },
      ],
    };
  }, [grouped]);

  const dailyTrend = useMemo(() => {
    const dates = Object.keys(grouped).sort();

    return {
      labels: dates.map((d) =>
        new Date(d).toLocaleDateString()
      ),
      datasets: [
        {
          label: "Daily Attendance",
          data: dates.map((d) => grouped[d].length),
          borderColor: "#3b82f6",
          backgroundColor: "rgba(59,130,246,0.1)",
          tension: 0.4,
          fill: true,
        },
      ],
    };
  }, [grouped]);

  const statusChart = useMemo(() => {
    const counts = {
      "On Time": 0,
      "Present": 0,
      "Late": 0,
      "Early": 0,
    };

    Object.values(grouped).forEach((records) => {
      records.forEach((r) => {
        if (counts[r.status] !== undefined) {
          counts[r.status]++;
        }
      });
    });

    const labels = Object.keys(counts).filter(
      (k) => counts[k] > 0
    );

    return {
      labels,
      datasets: [
        {
          data: labels.map((l) => counts[l]),
          backgroundColor: [
            "#10b981",
            "#3b82f6",
            "#f59e0b",
            "#6366f1",
          ],
        },
      ],
    };
  }, [grouped]);

  if (loading)
    return (
      <div className="flex justify-center h-64 items-center">
        Loading...
      </div>
    );

  const totalDays = Object.keys(grouped).length || 1;

  return (
    <div className="space-y-6">
      <div className="flex justify-between">
        <h1 className="text-3xl font-bold">Reports</h1>

        <div className="flex gap-3">
          <button
            onClick={() => exportReport("excel")}
            className="btn-secondary"
          >
            <Download size={18} /> Excel
          </button>

          <button
            onClick={() => exportReport("pdf")}
            className="btn-secondary"
          >
            <Download size={18} /> PDF
          </button>
        </div>
      </div>

      <div className="card flex justify-between">
        <div className="flex gap-4 items-center">
          <Calendar size={18} />
          <DatePicker
            selected={startDate}
            onChange={setStartDate}
            className="input-field"
          />
          to
          <DatePicker
            selected={endDate}
            onChange={setEndDate}
            className="input-field"
          />
        </div>

        <button onClick={generateReport} className="btn-primary">
          Generate
        </button>
      </div>

      {reportData && (
        <>
          <div className="grid grid-cols-4 gap-4">
            <Summary title="Total Records" value={reportData.total || 0} />
            <Summary title="Days Covered" value={totalDays} />
            <Summary
              title="Unique Users"
              value={
                new Set(
                  Object.values(grouped)
                    .flat()
                    .map((r) => r.userId)
                ).size
              }
            />
            {/* 🔥 FIX 2: Prevent division by zero */}
            <Summary
              title="Avg Daily"
              value={
                totalDays > 0
                  ? (reportData.total / totalDays).toFixed(1)
                  : 0
              }
            />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* 🔥 FIX 3: Safely render charts only when data exists */}
            <ChartCard title="Daily Trend">
              {dailyTrend.labels.length > 0 ? (
                <Line data={dailyTrend} />
              ) : (
                <p className="text-gray-400 text-center py-8">No data available</p>
              )}
            </ChartCard>

            <ChartCard title="Status Distribution">
              {statusChart.labels.length > 0 ? (
                <Pie data={statusChart} />
              ) : (
                <p className="text-gray-400 text-center py-8">No data available</p>
              )}
            </ChartCard>

            <ChartCard title="Department Breakdown" full>
              {departmentChart.labels.length > 0 ? (
                <Bar data={departmentChart} />
              ) : (
                <p className="text-gray-400 text-center py-8">No data available</p>
              )}
            </ChartCard>
          </div>
        </>
      )}
    </div>
  );
};

const Summary = ({ title, value }) => (
  <div className="bg-gray-50 p-4 rounded-lg">
    <p className="text-sm text-gray-500">{title}</p>
    <p className="text-2xl font-bold">{value}</p>
  </div>
);

const ChartCard = ({ title, children, full }) => (
  <div className={`bg-white p-4 rounded-lg border ${full ? "lg:col-span-2" : ""}`}>
    <h3 className="font-semibold mb-4">{title}</h3>
    {children}
  </div>
);

export default Reports;