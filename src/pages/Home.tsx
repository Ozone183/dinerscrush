import { Link } from 'react-router-dom';

const Home = () => {
  return (
    <div>
      {/* Hero Section */}
      <section className="bg-gradient-to-r from-[#2D3142] to-gray-800 text-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 md:py-16">
          <div className="grid md:grid-cols-2 gap-12 items-center">
            {/* Left side - Text */}
            <div>
              <h1 className="text-3xl md:text-4xl font-bold mb-4">
                Delivery That <span className="text-[#FF6B35]">Pays Fair</span>
              </h1>
              <p className="text-lg mb-6 text-gray-300">
                We treat our drivers like partners, not numbers. Better pay, better service, better partnerships.
              </p>
              <div className="flex flex-col sm:flex-row gap-4">
                <Link
                  to="/signup"
                  className="bg-[#FF6B35] text-white px-8 py-3 rounded-lg font-semibold text-center hover:bg-orange-600 transition"
                >
                  🍳 Partner Your Kitchen
                </Link>
                <Link
                  to="/corporate"
                  className="inline-flex items-center justify-center rounded-xl px-5 py-3 font-bold text-white"
                  style={{ backgroundColor: "#FF6B35" }}
                >
                  Corporate Lunch & Catering
                </Link>

                <Link
                  to="/signup"
                  className="border border-[#4ECDC4] text-[#4ECDC4] px-8 py-3 rounded-lg font-semibold text-center hover:bg-[#4ECDC4] hover:text-[#2D3142] transition"
                >
                  ⚡ Become a Crusher
                </Link>
              </div>
            </div>

            {/* Right side - Driver Pay Comparison (visible on all devices) */}
            <div className="bg-gray-700 rounded-2xl p-6 shadow-2xl">
              <div className="text-center mb-4">
                <p className="text-[#4ECDC4] font-bold">💰 Driver Pay Comparison</p>
              </div>
              <div className="space-y-4">
                <div className="bg-gray-600 rounded-lg p-3">
                  <p className="text-sm text-gray-300">Other Apps (UberEats, DoorDash)</p>
                  <p className="text-2xl font-bold text-gray-400">$2-4 per delivery</p>
                </div>
                <div className="bg-[#FF6B35] bg-opacity-20 border border-[#FF6B35] rounded-lg p-3">
                  <p className="text-sm text-[#FF6B35]">DinersCrush</p>
                  <p className="text-2xl font-bold text-[#FF6B35]">$6-8 per delivery + tips</p>
                </div>
              </div>
              <p className="text-xs text-gray-400 mt-4 text-center">Minimum $20/hour guaranteed</p>
            </div>
          </div>
        </div>
      </section>

      {/* Benefits Section */}
      {/* Why Restaurants Choose DinersCrush */}
      <section className="py-12 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl font-bold text-center text-[#2D3142] mb-12">
            Why Restaurants Choose DinersCrush
          </h2>
          <div className="grid md:grid-cols-3 gap-6">
            <div className="bg-white rounded-xl shadow-lg border border-gray-200 p-6 text-center hover:shadow-xl transition">
              <div className="text-4xl mb-4">💰</div>
              <h3 className="text-xl font-semibold mb-2 text-[#2D3142]">Lower Commission</h3>
              <p className="text-gray-600">15% commission vs 25-30% on other platforms. You keep more of what you earn.</p>
            </div>
            <div className="bg-white rounded-xl shadow-lg border border-gray-200 p-6 text-center hover:shadow-xl transition">
              <div className="text-4xl mb-4">🚚</div>
              <h3 className="text-xl font-semibold mb-2 text-[#2D3142]">Reliable Drivers</h3>
              <p className="text-gray-600">Drivers who care because they're paid fairly. Better service for your customers.</p>
            </div>
            <div className="bg-white rounded-xl shadow-lg border border-gray-200 p-6 text-center hover:shadow-xl transition">
              <div className="text-4xl mb-4">📱</div>
              <h3 className="text-xl font-semibold mb-2 text-[#2D3142]">Easy Dashboard</h3>
              <p className="text-gray-600">Simple interface to manage orders, update menu, and track deliveries.</p>
            </div>
          </div>
        </div>
      </section>

      {/* Diners Section - Focus on Customers */}
      <section className="py-12 bg-gradient-to-r from-[#FF6B35] to-orange-500">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-8">
            <h2 className="text-3xl font-bold text-white mb-2">🍽️ For Our Crushes</h2>
            <p className="text-white text-lg opacity-90">Hungry? We got you covered</p>
          </div>
          <div className="grid md:grid-cols-3 gap-6">
            <div className="bg-white rounded-xl p-6 text-center">
              <div className="text-4xl mb-3">📱</div>
              <h3 className="font-semibold text-lg">Easy Ordering</h3>
              <p className="text-gray-600 text-sm mt-2">Browse local Crush Kitchens, view menus, order in seconds</p>
            </div>
            <div className="bg-white rounded-xl p-6 text-center">
              <div className="text-4xl mb-3">⚡</div>
              <h3 className="font-semibold text-lg">Fast Delivery</h3>
              <p className="text-gray-600 text-sm mt-2">Our Crushers deliver hot & fresh, with real-time tracking</p>
            </div>
            <div className="bg-white rounded-xl p-6 text-center">
              <div className="text-4xl mb-3">💎</div>
              <h3 className="font-semibold text-lg">Crush Premium</h3>
              <p className="text-gray-600 text-sm mt-2">Free delivery, exclusive deals, and priority support</p>
            </div>
          </div>
        </div>
      </section>

      {/* Driver Focus Section */}
      <section className="bg-gray-100 py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid md:grid-cols-2 gap-12 items-center">
            <div>
              <h2 className="text-3xl font-bold text-[#2D3142] mb-6">
                Built By a Driver, <span className="text-[#FF6B35]">For Drivers</span>
              </h2>
              <p className="text-lg text-gray-700 mb-6">
                I've been in your shoes. I know what it's like to bust your ass for pennies.
                DinersCrush is different because I'm building it for us.
              </p>
              <ul className="space-y-3">
                <li className="flex items-center gap-2">
                  <span className="text-[#FF6B35] text-xl">✓</span>
                  <span>Minimum $20/hour guaranteed</span>
                </li>
                <li className="flex items-center gap-2">
                  <span className="text-[#FF6B35] text-xl">✓</span>
                  <span>Keep 100% of your tips</span>
                </li>
                <li className="flex items-center gap-2">
                  <span className="text-[#FF6B35] text-xl">✓</span>
                  <span>Get paid weekly, no holds</span>
                </li>
                <li className="flex items-center gap-2">
                  <span className="text-[#FF6B35] text-xl">✓</span>
                  <span>Driver support that actually answers</span>
                </li>
              </ul>
            </div>
            <div className="bg-white rounded-2xl p-8 shadow-xl border border-gray-200">
              <div className="text-center mb-4">
                <p className="text-[#4ECDC4] font-bold text-lg">Ready to Partner?</p>
                <p className="text-gray-600 mt-2">Sign up today and get your first week with reduced commission</p>
              </div>
              <Link
                to="/signup"
                className="w-full bg-[#FF6B35] text-white py-3 rounded-lg font-semibold text-center hover:bg-orange-600 transition block"
              >
                Get Started
              </Link>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};

export default Home;