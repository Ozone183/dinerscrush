import { useState } from 'react';
import { useAuth } from '../context/AuthContext';

const DriverDashboard = () => {
  const [isAvailable, setIsAvailable] = useState(true);
  const { logout } = useAuth();

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      {/* Header with Logout */}
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold text-[#2D3142]">⚡ Crusher Hub</h1>
          <p className="text-gray-600 mt-1">Your delivery command center</p>
        </div>
        <button
          onClick={logout}
          className="text-gray-500 hover:text-red-500 transition text-sm"
        >
          🚪 Sign Out
        </button>
      </div>

      {/* Status Card */}
      <div className="bg-gradient-to-r from-[#FF6B35] to-orange-500 rounded-2xl p-6 mb-8 text-white">
        <div className="flex justify-between items-center">
          <div>
            <p className="text-sm opacity-90">Current Status</p>
            <p className="text-2xl font-bold">{isAvailable ? '🟢 Crushing It' : '⚡ Taking a Break'}</p>
            <p className="text-sm opacity-80 mt-1">
              {isAvailable ? 'Ready to crush deliveries' : 'You\'re offline'}
            </p>
          </div>
          <button
            onClick={() => setIsAvailable(!isAvailable)}
            className={`px-5 py-2 rounded-xl font-semibold transition ${
              isAvailable 
                ? 'bg-white text-[#FF6B35] hover:bg-gray-100' 
                : 'bg-[#2D3142] text-white hover:bg-gray-800'
            }`}
          >
            {isAvailable ? 'Go Offline' : 'Go Online'}
          </button>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-3 gap-4 mb-8">
        <div className="bg-white rounded-xl p-4 text-center shadow-sm border border-gray-100">
          <p className="text-2xl font-bold text-[#FF6B35]">$0</p>
          <p className="text-xs text-gray-500 mt-1">Today's Crush</p>
        </div>
        <div className="bg-white rounded-xl p-4 text-center shadow-sm border border-gray-100">
          <p className="text-2xl font-bold text-[#2D3142]">0</p>
          <p className="text-xs text-gray-500 mt-1">Deliveries</p>
        </div>
        <div className="bg-white rounded-xl p-4 text-center shadow-sm border border-gray-100">
          <p className="text-2xl font-bold text-[#2D3142]">5.0</p>
          <p className="text-xs text-gray-500 mt-1">Crusher Rating ★</p>
        </div>
      </div>

      {/* Available Crushes (Deliveries) */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
        <h2 className="text-lg font-semibold text-[#2D3142] mb-4">🍽️ Available Crushes</h2>
        {isAvailable ? (
          <div className="text-center py-12">
            <p className="text-gray-400 text-lg">No crushes right now</p>
            <p className="text-sm text-gray-400 mt-2">Stay online — we'll notify you!</p>
          </div>
        ) : (
          <div className="text-center py-12">
            <p className="text-gray-400">Go online to see available deliveries</p>
          </div>
        )}
      </div>

      {/* Recent History */}
      <div className="mt-6 bg-white rounded-xl shadow-sm border border-gray-100 p-6">
        <h2 className="text-lg font-semibold text-[#2D3142] mb-4">📜 Crush History</h2>
        <div className="text-center py-8">
          <p className="text-gray-400 text-sm">No deliveries yet</p>
          <p className="text-xs text-gray-400 mt-1">Your first crush will appear here</p>
        </div>
      </div>
    </div>
  );
};

export default DriverDashboard;