import React from 'react';
import { useSocket } from '../contexts/SocketContext';
import { Wifi, WifiOff } from 'lucide-react';

const Navbar = () => {
  const { connected } = useSocket();

  return (
    <header className="bg-white shadow-sm">
      <div className="flex items-center justify-between px-6 py-4">
        <h2 className="text-xl font-semibold text-gray-800">
          Face Recognition Attendance System
        </h2>
        <div className="flex items-center space-x-4">
          <div className="flex items-center space-x-2">
            {connected ? (
              <>
                <Wifi className="text-green-500" size={20} />
                <span className="text-sm text-green-600">Connected</span>
              </>
            ) : (
              <>
                <WifiOff className="text-red-500" size={20} />
                <span className="text-sm text-red-600">Disconnected</span>
              </>
            )}
          </div>
        </div>
      </div>
    </header>
  );
};

export default Navbar;