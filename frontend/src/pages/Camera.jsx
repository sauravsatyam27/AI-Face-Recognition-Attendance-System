import React, { useRef, useState, useEffect, useCallback } from 'react';
import Webcam from 'react-webcam';
import api from '../utils/axios';
import { Camera as CameraIcon, Play, Square, UserPlus, AlertCircle, X } from 'lucide-react';
import toast from 'react-hot-toast';
import { useSocket } from '../contexts/SocketContext';

const MOBILE_CAM_ID = "mobile-ipcam";

const MOBILE_VIDEO_URL = "http://10.58.3.84:8080/video";
const MOBILE_SNAPSHOT_URL = "http://10.58.3.84:8080/shot.jpg";

//http://10.58.3.84:8080/

const Camera = () => {
  const webcamRef = useRef(null);
  const ipcamRef = useRef(null);
  // 🔥 FIX 3: Reusable canvas to prevent memory leak
  const canvasRef = useRef(document.createElement("canvas"));
  
  const [recognitionActive, setRecognitionActive] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [devices, setDevices] = useState([]);
  const [selectedDevice, setSelectedDevice] = useState('');
  const [showRegisterModal, setShowRegisterModal] = useState(false);
  
  // 🔥 FIX 2: Mobile frame refresh state
  const [mobileFrame, setMobileFrame] = useState(Date.now());
  
  const [registerForm, setRegisterForm] = useState({
    name: '',
    userId: '',
    department: '',
    email: '',
    phone: ''
  });

  const { socket, lastDetection } = useSocket();

  /* ================= CAMERA DEVICES ================= */
  useEffect(() => {
    const loadDevices = async () => {
      const devices = await navigator.mediaDevices.enumerateDevices();
      const cams = devices.filter(d => d.kind === 'videoinput');
      setDevices(cams);
      if (cams.length) setSelectedDevice(cams[0].deviceId);
    };
    loadDevices();
  }, []);

  /* ================= SOCKET EVENTS ================= */
  useEffect(() => {
    if (!socket) return;

    const handleRecognition = () => setProcessing(false);

    const handleAttendanceMarked = (data) => {
      setProcessing(false);
      toast.success(`${data.name} marked ${data.status}`);
    };

    socket.on('attendance_marked', handleAttendanceMarked);
    socket.on('recognition_result', handleRecognition);

    return () => {
      socket.off('attendance_marked', handleAttendanceMarked);
      socket.off('recognition_result', handleRecognition);
    };
  }, [socket]);

  /* ================= MOBILE FRAME REFRESH ================= */
  // 🔥 FIX 2: Changed from 500ms to 900ms to match capture cycle
  useEffect(() => {
    if (selectedDevice !== MOBILE_CAM_ID) return;

    const interval = setInterval(() => {
      setMobileFrame(Date.now());
    }, 900); // Refresh mobile frame every 900ms

    return () => clearInterval(interval);
  }, [selectedDevice]);

  /* ================= VISIBILITY SAFETY ================= */
  // 🔥 FIX 4: Auto-stop when tab is hidden
  useEffect(() => {
    const handleVisibility = () => {
      if (document.hidden && recognitionActive) {
        stopRecognition();
      }
    };

    document.addEventListener("visibilitychange", handleVisibility);
    return () => document.removeEventListener("visibilitychange", handleVisibility);
  }, [recognitionActive]);

  /* ================= FRAME CAPTURE ================= */
  // 🔥 FIX 1: Made async
  const captureFrame = useCallback(async () => {
    // 🚫 safety checks
    if (!recognitionActive || processing) return;

    let imageSrc = null;

    // 📱 MOBILE CAMERA
    if (selectedDevice === MOBILE_CAM_ID) {
      const img = ipcamRef.current;

      // 🔥 FIX 3: Better image load check
      if (!img || !img.complete || img.naturalWidth === 0) {
        setProcessing(false);
        return;
      }

      // 🔥 FIX 3: Reuse canvas instead of creating new one
      const canvas = canvasRef.current;
      canvas.width = img.naturalWidth || 1280;
      canvas.height = img.naturalHeight || 720;

      const ctx = canvas.getContext("2d");
      ctx.drawImage(img, 0, 0);

      imageSrc = canvas.toDataURL("image/jpeg");
    }
    // 💻 LAPTOP WEBCAM
    else {
      imageSrc = webcamRef.current?.getScreenshot();
    }

    if (!imageSrc) return;

    // 🔄 prevent multiple processing
    setProcessing(true);

    // 🔥 FIX 1: Proper async/await with timeout
    const timeout = setTimeout(() => {
      setProcessing(false);
    }, 3000);

    try {
      // 🔥 FIX 1: await the API call
      await api.post("/ai/stream", { image: imageSrc });
    } catch (e) {
      console.log("Stream error", e);
    } finally {
      clearTimeout(timeout);
      setProcessing(false);
    }

  }, [recognitionActive, processing, selectedDevice]);

  useEffect(() => {
    setProcessing(false);
  }, [selectedDevice]);

  // 🔥 FIX 1 & 4: Proper async loop with 1200ms delay
  useEffect(() => {
    if (!recognitionActive) return;

    let stopped = false;

    const loop = async () => {
      if (stopped) return;

      await captureFrame(); // Now properly waits
      setTimeout(loop, 700);
    };

    loop();

    return () => {
      stopped = true;
    };
  }, [recognitionActive, captureFrame]);

  /* ================= START / STOP ================= */
  const startRecognition = async () => {
    try {
      await api.post('/ai/start');
      setRecognitionActive(true);
      toast.success('Recognition started');
    } catch {
      toast.error('Failed to start recognition');
    }
  };

  const stopRecognition = async () => {
    try {
      await api.post('/ai/stop');
      setRecognitionActive(false);
      toast.success('Recognition stopped');
    } catch {
      toast.error('Failed to stop recognition');
    }
  };

  /* ================= REGISTER FACE ================= */
  const handleRegister = async (e) => {
    e.preventDefault();

    let imageSrc;

    if (selectedDevice === MOBILE_CAM_ID) {
      const img = ipcamRef.current;
      if (!img || img.naturalWidth === 0) {
        toast.error('Camera not ready');
        return;
      }

      // 🔥 FIX 3: Reuse canvas
      const canvas = canvasRef.current;
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;

      const ctx = canvas.getContext("2d");
      ctx.drawImage(img, 0, 0);

      imageSrc = canvas.toDataURL("image/jpeg");
    } else {
      imageSrc = webcamRef.current?.getScreenshot();
    }

    if (!imageSrc) {
      toast.error('Please capture your face');
      return;
    }

    try {
      const res = await api.post('/ai/register-face', {
        ...registerForm,
        image: imageSrc
      });

      if (res.data.success) {
        toast.success('Face registered successfully');
        setShowRegisterModal(false);

        setRegisterForm({
          name: '',
          userId: '',
          department: '',
          email: '',
          phone: ''
        });
      }
    } catch (err) {
      toast.error(err.response?.data?.error || 'Registration failed');
    }
  };

  /* ================= UI ================= */
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Camera</h1>
        <p className="text-gray-600 mt-2">Real-time face recognition</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* CAMERA */}
        <div className="lg:col-span-2">
          <div className="card">
            <div className="relative">
                {selectedDevice === MOBILE_CAM_ID ? (
                    <img
                      ref={ipcamRef}
                      id="ipcam-stream"
                      crossOrigin="anonymous"
                      src={MOBILE_VIDEO_URL}
                      alt="Mobile Camera"
                      className="w-full rounded-lg"
                    />
                ) : (
                  <Webcam
                    ref={webcamRef}
                    audio={false}
                    screenshotFormat="image/jpeg"
                    videoConstraints={{
                      deviceId: selectedDevice,
                      width: 1280,
                      height: 720
                    }}
                    className="w-full rounded-lg"
                  />
                )}
              
              {recognitionActive && (
                <div className="absolute top-4 right-4 bg-green-500 text-white px-3 py-1 rounded-full text-sm flex items-center">
                  <span className="animate-pulse mr-2">●</span>
                  Recording
                </div>
              )}
            </div>

            <div className="mt-4 flex items-center justify-between">
              <div className="flex items-center space-x-4">
                <select
                  value={selectedDevice}
                  onChange={(e) => setSelectedDevice(e.target.value)}
                  className="input-field w-64"
                >
                  {devices.map(device => (
                    <option key={device.deviceId} value={device.deviceId}>
                      {device.label || `Camera ${device.deviceId.slice(0, 5)}`}
                    </option>
                  ))}

                  <option value={MOBILE_CAM_ID}>
                    📱 Mobile Camera (IP Webcam)
                  </option>
                </select>

                {!recognitionActive ? (
                  <button
                    onClick={startRecognition}
                    className="btn-primary flex items-center space-x-2"
                  >
                    <Play size={20} />
                    <span>Start Recognition</span>
                  </button>
                ) : (
                  <button
                    onClick={stopRecognition}
                    className="btn-danger flex items-center space-x-2"
                  >
                    <Square size={20} />
                    <span>Stop Recognition</span>
                  </button>
                )}
              </div>

              <button
                onClick={() => setShowRegisterModal(true)}
                className="btn-secondary flex items-center space-x-2"
              >
                <UserPlus size={20} />
                <span>Register Face</span>
              </button>
            </div>
          </div>
        </div>

        {/* LAST DETECTION */}
        <div className="lg:col-span-1">
          <div className="card">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Last Detection</h2>
            
            {lastDetection ? (
              <div className="space-y-4">
                {lastDetection.success ? (
                  <>
                    <div className="p-4 bg-green-50 rounded-lg">
                      <p className="text-green-800 font-medium">{lastDetection.name}</p>
                      <p className="text-sm text-green-600 mt-1">ID: {lastDetection.userId}</p>
                      <p className="text-sm text-green-600">Dept: {lastDetection.department}</p>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-4">
                      <div className="text-center p-3 bg-gray-50 rounded-lg">
                        <p className="text-sm text-gray-600">Confidence</p>
                        <p className="text-xl font-bold text-gray-900">
                          {((lastDetection.confidence || 0) * 100).toFixed(1)}%
                        </p>
                      </div>
                      <div className="text-center p-3 bg-gray-50 rounded-lg">
                        <p className="text-sm text-gray-600">Status</p>
                        <p className={`text-xl font-bold ${
                          lastDetection.status === 'On Time' ? 'text-green-600' :
                          lastDetection.status === 'Late' ? 'text-yellow-600' :
                          'text-blue-600'
                        }`}>
                          {lastDetection.status}
                        </p>
                      </div>
                    </div>
                  </>
                ) : (
                  <div className="text-center py-8">
                    <AlertCircle className="w-12 h-12 text-gray-400 mx-auto mb-3" />
                    <p className="text-gray-500">{lastDetection.message}</p>
                  </div>
                )}
              </div>
            ) : (
              <div className="text-center py-8">
                <CameraIcon className="w-12 h-12 text-gray-400 mx-auto mb-3" />
                <p className="text-gray-500">No face detected yet</p>
                <p className="text-sm text-gray-400 mt-2">
                  Start recognition to begin
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* REGISTRATION MODAL */}
      {showRegisterModal && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-[9999]"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setShowRegisterModal(false);
            }
          }}
        >
          <div className="bg-white rounded-xl max-w-md w-full p-6 shadow-2xl">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold text-gray-900">Register New Face</h2>
              <button
                onClick={() => setShowRegisterModal(false)}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <X size={24} />
              </button>
            </div>
            
            <form onSubmit={handleRegister} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Full Name *
                </label>
                <input
                  type="text"
                  placeholder="Enter full name"
                  className="input-field w-full"
                  value={registerForm.name}
                  onChange={e => setRegisterForm({...registerForm, name: e.target.value})}
                  required
                  autoFocus
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  User ID *
                </label>
                <input
                  type="text"
                  placeholder="Enter user ID"
                  className="input-field w-full"
                  value={registerForm.userId}
                  onChange={e => setRegisterForm({...registerForm, userId: e.target.value})}
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Department
                </label>
                <select
                  value={registerForm.department}
                  onChange={e => setRegisterForm({...registerForm, department: e.target.value})}
                  className="input-field w-full"
                >
                  <option value="">Select Department</option>
                  <option value="IT">IT</option>
                  <option value="HR">HR</option>
                  <option value="Finance">Finance</option>
                  <option value="Marketing">Marketing</option>
                  <option value="Operations">Operations</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Email
                </label>
                <input
                  type="email"
                  placeholder="Enter email address"
                  className="input-field w-full"
                  value={registerForm.email}
                  onChange={e => setRegisterForm({...registerForm, email: e.target.value})}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Phone
                </label>
                <input
                  type="tel"
                  placeholder="Enter phone number"
                  className="input-field w-full"
                  value={registerForm.phone}
                  onChange={e => setRegisterForm({...registerForm, phone: e.target.value})}
                />
              </div>

              <div className="bg-blue-50 p-4 rounded-lg">
                <p className="text-sm text-blue-800">
                  Please ensure your face is clearly visible in the camera
                </p>
              </div>

              <div className="flex gap-3 pt-3">
                <button type="submit" className="btn-primary flex-1">
                  Register
                </button>
                <button
                  type="button"
                  onClick={() => setShowRegisterModal(false)}
                  className="btn-secondary flex-1"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Camera;