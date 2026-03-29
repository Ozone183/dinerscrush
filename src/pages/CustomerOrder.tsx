const CustomerOrder = () => {
    return (
      <div className="max-w-7xl mx-auto px-4 py-8">
        <h1 className="text-2xl font-bold text-[#2D3142]">Place Your Order</h1>
        <p className="text-gray-600 mt-2 mb-8">Order from your favorite restaurants</p>
        
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3].map((i) => (
            <div key={i} className="bg-white rounded-lg shadow-md p-6 border border-gray-200">
              <div className="h-32 bg-gray-200 rounded-lg mb-4"></div>
              <h3 className="font-semibold text-lg">Restaurant {i}</h3>
              <p className="text-gray-600 text-sm mt-1">Italian • 2.5 mi</p>
              <p className="text-[#FF6B35] font-bold mt-2">$$ • 15-25 min</p>
              <button className="mt-4 w-full bg-[#FF6B35] text-white py-2 rounded-lg hover:bg-orange-600 transition">
                View Menu
              </button>
            </div>
          ))}
        </div>
        
        <div className="mt-12 text-center">
          <p className="text-gray-500">More restaurants coming soon. <a href="/restaurant-dashboard" className="text-[#FF6B35]">Are you a restaurant? Partner with us →</a></p>
        </div>
      </div>
    );
  };
  
  export default CustomerOrder;