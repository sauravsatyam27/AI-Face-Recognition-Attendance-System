import React, { useEffect, useState } from "react";
import { useAuth } from "../contexts/AuthContext";
import api from "../utils/axios";
import toast from "react-hot-toast";

export default function Profile() {
  const { user } = useAuth();

  const [form, setForm] = useState({
    name: "",
    department: "",
    phone: "",
    email: "",
    userId: "",
  });

  const [saving, setSaving] = useState(false);

  /* ================= LOAD USER ================= */
  useEffect(() => {
    if (user) {
      setForm({
        name: user.name || "",
        department: user.department || "",
        phone: user.phone || "",
        email: user.email || "",
        userId: user.userId || "",
      });
    }
  }, [user]);

  /* ================= HANDLE CHANGE ================= */
  const handleChange = (e) => {
    setForm({
      ...form,
      [e.target.name]: e.target.value,
    });
  };

  /* ================= UPDATE PROFILE ================= */
  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);

    try {
      const res = await api.put("/auth/profile", {
        name: form.name,
        department: form.department,
        phone: form.phone,
      });

      toast.success(res.data.message || "Profile updated!");
    } catch (err) {
      toast.error(
        err.response?.data?.message || "Update failed"
      );
    } finally {
      setSaving(false);
    }
  };

  /* ================= UI ================= */
  return (
    <div className="max-w-3xl mx-auto">
      <div className="bg-white shadow rounded-lg p-6">
        <h2 className="text-2xl font-bold mb-6">
          👤 My Profile
        </h2>

        <form onSubmit={handleSubmit} className="space-y-4">
          
          {/* USER ID */}
          <div>
            <label className="block text-sm font-medium">
              User ID
            </label>
            <input
              value={form.userId}
              disabled
              className="w-full mt-1 p-2 border rounded bg-gray-100"
            />
          </div>

          {/* EMAIL */}
          <div>
            <label className="block text-sm font-medium">
              Email
            </label>
            <input
              value={form.email}
              disabled
              className="w-full mt-1 p-2 border rounded bg-gray-100"
            />
          </div>

          {/* NAME */}
          <div>
            <label className="block text-sm font-medium">
              Name
            </label>
            <input
              name="name"
              value={form.name}
              onChange={handleChange}
              className="w-full mt-1 p-2 border rounded"
              required
            />
          </div>

          {/* DEPARTMENT */}
          <div>
            <label className="block text-sm font-medium">
              Department
            </label>
            <input
              name="department"
              value={form.department}
              onChange={handleChange}
              className="w-full mt-1 p-2 border rounded"
            />
          </div>

          {/* PHONE */}
          <div>
            <label className="block text-sm font-medium">
              Phone
            </label>
            <input
              name="phone"
              value={form.phone}
              onChange={handleChange}
              className="w-full mt-1 p-2 border rounded"
            />
          </div>

          {/* SAVE BUTTON */}
          <button
            type="submit"
            disabled={saving}
            className="bg-blue-600 text-white px-6 py-2 rounded hover:bg-blue-700"
          >
            {saving ? "Saving..." : "Update Profile"}
          </button>
        </form>
      </div>
    </div>
  );
}