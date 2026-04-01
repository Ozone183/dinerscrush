import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import Logo from './Logo';

const Navbar = () => {
  const { currentUser, userRole, logout } = useAuth();
  const navigate = useNavigate();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const handleLogout = async () => {
    try {
      await logout();
      setMobileMenuOpen(false);
      navigate('/', { replace: true });
    } catch (error) {
      console.error('Failed to logout', error);
    }
  };

  return (
    <nav className="bg-[#2D3142] text-white shadow-lg sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          {/* Logo */}
          <Logo />

          {/* Desktop Navigation */}
          <div className="hidden md:flex space-x-6 items-center">
            <Link
              to="/corporate"
              className="inline-flex items-center justify-center rounded-xl px-5 py-3 font-bold text-white"
              style={{ backgroundColor: "#FF6B35" }}
            >
              Corporate
            </Link>

            {currentUser ? (
              <>
                <span className="text-sm text-[#4ECDC4]">
                  {userRole === 'driver' && '⚡ Crusher'}
                  {userRole === 'restaurant' && '🍳 Crush Kitchen'}
                  {userRole === 'admin' && '👑 Crush Control'}
                </span>
                {userRole === 'restaurant' && (
                  <Link to="/restaurant-dashboard" className="hover:text-[#FF6B35] transition">Kitchen Hub</Link>
                )}
                {userRole === 'driver' && (
                  <Link to="/driver-dashboard" className="hover:text-[#FF6B35] transition">Crusher Hub</Link>
                )}
                {userRole === 'diner' && (
                  <Link to="/order" className="hover:text-[#FF6B35] transition">🍽️ Order Food</Link>
                )}
                {userRole === 'admin' && (
                  <Link to="/admin-dashboard" className="hover:text-[#FF6B35] transition">Crush Control</Link>
                )}
                <button onClick={handleLogout} className="hover:text-red-400 transition">
                  Sign Out
                </button>
              </>
            ) : (
              <>
                <Link to="/signup" className="bg-[#FF6B35] px-4 py-2 rounded-lg hover:bg-orange-600 transition">
                  Join the Crush
                </Link>
                <Link to="/signin" className="hover:text-[#4ECDC4] transition">Sign In</Link>
              </>

            )}
          </div>

          {/* Mobile menu button */}
          <div className="md:hidden">
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="text-white focus:outline-none"
            >
              <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                {mobileMenuOpen ? (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                ) : (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                )}
              </svg>
            </button>
          </div>
        </div>

        {/* Mobile Navigation - Overlay style */}
        {mobileMenuOpen && (
          <div className="md:hidden fixed inset-0 top-16 bg-[#2D3142] z-50 overflow-y-auto">
            <div className="flex flex-col space-y-4 p-6">
              <Link
                to="/corporate"
                className="bg-[#FF6B35] text-center text-white px-4 py-3 rounded-lg font-semibold hover:bg-orange-600 transition"
                onClick={() => setMobileMenuOpen(false)}
              >
                Corporate Lunch & Catering
              </Link>
              {currentUser ? (
                <>
                  <div className="text-[#4ECDC4] font-semibold border-b border-gray-700 pb-2 mb-2">
                    {userRole === 'driver' && '⚡ Crusher Dashboard'}
                    {userRole === 'restaurant' && '🍳 Crush Kitchen Dashboard'}
                    {userRole === 'admin' && '👑 Crush Control'}
                  </div>
                  {userRole === 'restaurant' && (
                    <Link
                      to="/restaurant-dashboard"
                      className="text-white text-lg py-2 hover:text-[#FF6B35] transition"
                      onClick={() => setMobileMenuOpen(false)}
                    >
                      Kitchen Hub
                    </Link>
                  )}
                  {userRole === 'driver' && (
                    <Link
                      to="/driver-dashboard"
                      className="text-white text-lg py-2 hover:text-[#FF6B35] transition"
                      onClick={() => setMobileMenuOpen(false)}
                    >
                      Crusher Hub
                    </Link>
                  )}
                  {userRole === 'diner' && (
                    <Link
                      to="/order"
                      className="text-white text-lg py-2 hover:text-[#FF6B35] transition"
                      onClick={() => setMobileMenuOpen(false)}
                    >
                      🍽️ Order Food
                    </Link>
                  )}
                  {userRole === 'admin' && (
                    <Link
                      to="/admin-dashboard"
                      className="text-white text-lg py-2 hover:text-[#FF6B35] transition"
                      onClick={() => setMobileMenuOpen(false)}
                    >
                      Crush Control
                    </Link>
                  )}
                  <button
                    onClick={handleLogout}
                    className="text-left text-white text-lg py-2 hover:text-red-400 transition"
                  >
                    Sign Out
                  </button>
                </>
              ) : (
                <>
                  <Link
                    to="/signup"
                    className="bg-[#FF6B35] text-center text-white px-4 py-3 rounded-lg font-semibold hover:bg-orange-600 transition"
                    onClick={() => setMobileMenuOpen(false)}
                  >
                    Join the Crush
                  </Link>
                  <Link
                    to="/signin"
                    className="text-white text-lg py-2 hover:text-[#4ECDC4] transition border-b border-gray-700"
                    onClick={() => setMobileMenuOpen(false)}
                  >
                    Sign In
                  </Link>
                </>

              )}
            </div>
          </div>
        )}
      </div>
    </nav>
  );
};

export default Navbar;