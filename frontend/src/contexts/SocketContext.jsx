import React, { createContext, useContext, useEffect, useState } from "react";
import io from "socket.io-client";
import { useAuth } from "./AuthContext";
import toast from "react-hot-toast";

const SocketContext = createContext();

export const useSocket = () => useContext(SocketContext);

export const SocketProvider = ({ children }) => {
  const [socket, setSocket] = useState(null);
  const [connected, setConnected] = useState(false);
  const [lastDetection, setLastDetection] = useState(null);

  // ⭐ added authReady
  const { isAuthenticated, user, authReady } = useAuth();

  useEffect(() => {
    // ⭐ IMPORTANT FIX:
    // Wait until AuthContext finishes loading user
    if (!authReady) return;

    // ===============================
    // DISCONNECT if not authenticated
    // ===============================
    if (!isAuthenticated || !user?.userId) {
      if (socket) {
        console.log("🔌 Disconnecting socket on logout");
        socket.disconnect();
        setSocket(null);
        setConnected(false);
        setLastDetection(null);
      }
      return;
    }

    // ===============================
    // CONNECT SOCKET (ONLY AFTER LOGIN)
    // ===============================
    console.log("🔌 Connecting socket for admin:", user.userId);

    const newSocket = io("http://localhost:5000", {
      withCredentials: true,
      auth: {
        ownerId: user.userId,
      },
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
    });

    newSocket.on("connect", () => {
      console.log("✅ Socket connected");
      setConnected(true);
    });

    newSocket.on("disconnect", () => {
      console.log("❌ Socket disconnected");
      setConnected(false);
    });

    newSocket.on("face-registered", (data) => {
      console.log("👤 Face registered:", data);
      toast.success(`New face registered: ${data.name}`);
    });

    newSocket.on("attendance_marked", (data) => {
      console.log("✅ Attendance marked:", data);
      setLastDetection(data);
      toast.success(`${data.name} marked ${data.status}`);
    });

    newSocket.on("recognition_result", (data) => {
      console.log("🤖 AI Detection:", data);
      setLastDetection(data);
      if (data?.name) {
        toast.success(`Detected: ${data.name}`);
      }
    });

    setSocket(newSocket);

    // ===============================
    // CLEANUP
    // ===============================
    return () => {
      console.log("🔌 Closing socket");
      newSocket.disconnect();
    };

  }, [authReady, isAuthenticated, user]); // ⭐ updated dependencies

  const value = {
    socket,
    connected,
    lastDetection,
  };

  return (
    <SocketContext.Provider value={value}>
      {children}
    </SocketContext.Provider>
  );
};