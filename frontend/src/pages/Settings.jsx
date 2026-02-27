import React, { useState, useEffect } from 'react';
import api from '../utils/axios';
import { Save, RefreshCw, Mail, Bell, Clock, Shield } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import toast from 'react-hot-toast';

const Settings = () => {
  const { user } = useAuth();

  const [settings, setSettings] = useState({
    recognition_threshold: 0.6,
    processing_interval: 2,
    working_hours_start: '09:00',
    working_hours_end: '18:00',
    late_threshold: '09:15',
    enable_notifications: true,
    email_enabled: false,
    smtp_server: 'smtp.gmail.com',
    smtp_port: 587,
    email_user: '',
    email_password: '',
    email_sender: 'attendance@system.com',
    max_storage_days: 90,
    backup_frequency: 24
  });

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchSettings();
  }, [user]);

  const fetchSettings = async () => {
    try {
      const response = await api.get('http://localhost:5000/api/ai/settings');
      setSettings(response.data);
    } catch (error) {
      toast.error('Failed to fetch settings');
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setSettings(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);

    try {
      await api.post('http://localhost:5000/api/ai/settings', settings);
      toast.success('Settings saved successfully');
    } catch (error) {
      toast.error('Failed to save settings');
    } finally {
      setSaving(false);
    }
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
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Settings</h1>
        <p className="text-gray-600 mt-2">Configure system preferences</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="card">
          <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
            <Shield className="w-5 h-5 mr-2 text-primary-600" />
            Recognition Settings
          </h2>
          
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Recognition Threshold: {settings.recognition_threshold}
              </label>
              <input
                type="range"
                name="recognition_threshold"
                min="0.3"
                max="0.9"
                step="0.05"
                value={settings.recognition_threshold}
                onChange={handleChange}
                className="w-full"
              />
              <p className="text-xs text-gray-500 mt-1">
                Lower = stricter matching, Higher = more tolerant
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Processing Interval (frames): {settings.processing_interval}
              </label>
              <input
                type="range"
                name="processing_interval"
                min="1"
                max="5"
                step="1"
                value={settings.processing_interval}
                onChange={handleChange}
                className="w-full"
              />
            </div>
          </div>
        </div>

        <div className="card">
          <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
            <Clock className="w-5 h-5 mr-2 text-primary-600" />
            Working Hours
          </h2>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Start Time
              </label>
              <input
                type="time"
                name="working_hours_start"
                value={settings.working_hours_start}
                onChange={handleChange}
                className="input-field"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                End Time
              </label>
              <input
                type="time"
                name="working_hours_end"
                value={settings.working_hours_end}
                onChange={handleChange}
                className="input-field"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Late Threshold
              </label>
              <input
                type="time"
                name="late_threshold"
                value={settings.late_threshold}
                onChange={handleChange}
                className="input-field"
              />
            </div>
          </div>
        </div>

        <div className="card">
          <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
            <Mail className="w-5 h-5 mr-2 text-primary-600" />
            Email Configuration
          </h2>
          
          <div className="space-y-4">
            <div className="flex items-center">
              <input
                type="checkbox"
                name="email_enabled"
                id="email_enabled"
                checked={settings.email_enabled}
                onChange={handleChange}
                className="h-4 w-4 text-primary-600 rounded"
              />
              <label htmlFor="email_enabled" className="ml-2 text-sm text-gray-700">
                Enable Email Notifications
              </label>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  SMTP Server
                </label>
                <input
                  type="text"
                  name="smtp_server"
                  value={settings.smtp_server}
                  onChange={handleChange}
                  className="input-field"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  SMTP Port
                </label>
                <input
                  type="number"
                  name="smtp_port"
                  value={settings.smtp_port}
                  onChange={handleChange}
                  className="input-field"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Email User
                </label>
                <input
                  type="email"
                  name="email_user"
                  value={settings.email_user}
                  onChange={handleChange}
                  className="input-field"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Email Password
                </label>
                <input
                  type="password"
                  name="email_password"
                  value={settings.email_password}
                  onChange={handleChange}
                  className="input-field"
                />
              </div>
            </div>
          </div>
        </div>

        <div className="card">
          <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
            <Bell className="w-5 h-5 mr-2 text-primary-600" />
            Notifications
          </h2>
          
          <div className="space-y-4">
            <div className="flex items-center">
              <input
                type="checkbox"
                name="enable_notifications"
                id="enable_notifications"
                checked={settings.enable_notifications}
                onChange={handleChange}
                className="h-4 w-4 text-primary-600 rounded"
              />
              <label htmlFor="enable_notifications" className="ml-2 text-sm text-gray-700">
                Enable Desktop Notifications
              </label>
            </div>
          </div>
        </div>

        <div className="card">
          <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
            <RefreshCw className="w-5 h-5 mr-2 text-primary-600" />
            System Settings
          </h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Max Storage Days
              </label>
              <input
                type="number"
                name="max_storage_days"
                value={settings.max_storage_days}
                onChange={handleChange}
                min="30"
                max="365"
                className="input-field"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Backup Frequency (hours)
              </label>
              <input
                type="number"
                name="backup_frequency"
                value={settings.backup_frequency}
                onChange={handleChange}
                min="1"
                max="168"
                className="input-field"
              />
            </div>
          </div>
        </div>

        <div className="flex justify-end">
          <button
            type="submit"
            disabled={saving}
            className="btn-primary flex items-center space-x-2"
          >
            {saving ? (
              <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
            ) : (
              <Save size={20} />
            )}
            <span>{saving ? 'Saving...' : 'Save Settings'}</span>
          </button>
        </div>
      </form>
    </div>
  );
};

export default Settings;