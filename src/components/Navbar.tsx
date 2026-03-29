import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import Logo from './Logo';

const Navbar = () => {
  const { currentUser, userRole, logout } = useAuth();

  const handleLogout = async () => {
    try {
      await logout();
    } catch (error) {
      console.error('Failed to logout', error);
    }
  };

  return (
    <nav className="bg-[#2D3142] text-white shadow-lg">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          {/* Logo Component */}
          <Logo />
          
          <div className="hidden md:flex space-x-6 items-center">
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
                {userRole === 'admin' && (
                  <Link to="/admin-dashboard" className="hover:text-[#FF6B35] transition">Crush Control</Link>
                )}
                <button onClick={handleLogout} className="hover:text-red-400 transition">
                  🚪 Sign Out
                </button>
              </>
            ) : (
              <>
                <Link to="/" className="hover:text-[#FF6B35] transition">Home</Link>
                <Link to="/order" className="hover:text-[#FF6B35] transition">Order Food</Link>
                <Link to="/signin" className="hover:text-[#FF6B35] transition">Sign In</Link>
                <Link to="/signup" className="bg-[#FF6B35] px-4 py-2 rounded-lg hover:bg-orange-600 transition">
                  Join the Crush
                </Link>
              </>
            )}
          </div>
        </div>
      </div>
    </nav>
  );
};

export default Navbar;