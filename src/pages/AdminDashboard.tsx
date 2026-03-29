import { useState } from 'react';

const AdminDashboard = () => {
  const [activeTab, setActiveTab] = useState<'restaurants' | 'drivers' | 'orders'>('restaurants');

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold text-[#2D3142] mb-2">Admin Dashboard</h1>
      <p className="text-gray-600 mb-8">Manage restaurants, drivers, and platform operations</p>

      {/* Tabs */}
      <div className="flex space-x-4 mb-8 border-b">
        <button
          onClick={() => setActiveTab('restaurants')}
          className={`px-4 py-2 font-semibold transition ${
            activeTab === 'restaurants'
              ? 'text-[#FF6B35] border-b-2 border-[#FF6B35]'
              : 'text-gray-500 hover:text-[#FF6B35]'
          }`}
        >
          🏪 Restaurants
        </button>
        <button
          onClick={() => setActiveTab('drivers')}
          className={`px-4 py-2 font-semibold transition ${
            activeTab === 'drivers'
              ? 'text-[#FF6B35] border-b-2 border-[#FF6B35]'
              : 'text-gray-500 hover:text-[#FF6B35]'
          }`}
        >
          🚚 Drivers
        </button>
        <button
          onClick={() => setActiveTab('orders')}
          className={`px-4 py-2 font-semibold transition ${
            activeTab === 'orders'
              ? 'text-[#FF6B35] border-b-2 border-[#FF6B35]'
              : 'text-gray-500 hover:text-[#FF6B35]'
          }`}
        >
          📦 Orders
        </button>
      </div>

      {/* Restaurants Tab */}
      {activeTab === 'restaurants' && (
        <div className="bg-white rounded-lg shadow-md p-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-semibold">Registered Restaurants</h2>
            <button className="bg-[#FF6B35] text-white px-4 py-2 rounded-lg text-sm hover:bg-orange-600">
              + Add Restaurant
            </button>
          </div>
          <div className="text-center py-12 text-gray-500">
            <p>No restaurants registered yet</p>
            <p className="text-sm mt-2">Restaurants will appear here when they sign up</p>
          </div>
        </div>
      )}

      {/* Drivers Tab */}
      {activeTab === 'drivers' && (
        <div className="bg-white rounded-lg shadow-md p-6">
          <h2 className="text-xl font-semibold mb-4">Registered Drivers</h2>
          <div className="text-center py-12 text-gray-500">
            <p>No drivers registered yet</p>
            <p className="text-sm mt-2">Drivers will appear here when they sign up</p>
          </div>
        </div>
      )}

      {/* Orders Tab */}
      {activeTab === 'orders' && (
        <div className="bg-white rounded-lg shadow-md p-6">
          <h2 className="text-xl font-semibold mb-4">All Orders</h2>
          <div className="text-center py-12 text-gray-500">
            <p>No orders yet</p>
            <p className="text-sm mt-2">Orders will appear here when customers start ordering</p>
          </div>
        </div>
      )}

      {/* Platform Stats */}
      <div className="mt-8 grid md:grid-cols-3 gap-6">
        <div className="bg-white rounded-lg shadow-md p-6 text-center">
          <p className="text-gray-500 text-sm">Total Restaurants</p>
          <p className="text-2xl font-bold text-[#2D3142]">0</p>
        </div>
        <div className="bg-white rounded-lg shadow-md p-6 text-center">
          <p className="text-gray-500 text-sm">Total Drivers</p>
          <p className="text-2xl font-bold text-[#2D3142]">0</p>
        </div>
        <div className="bg-white rounded-lg shadow-md p-6 text-center">
          <p className="text-gray-500 text-sm">Total Orders</p>
          <p className="text-2xl font-bold text-[#2D3142]">0</p>
        </div>
      </div>
    </div>
  );
};

export default AdminDashboard;