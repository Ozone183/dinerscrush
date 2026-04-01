import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { db } from '../firebase/config';
import { collection, getDocs, query, where, doc, getDoc } from 'firebase/firestore';
import { useAuth } from '../context/AuthContext';

interface Restaurant {
  id: string;
  name: string;
  address?: string;
  phone?: string;
  cuisine?: string;
}

const CustomerOrder = () => {
  const { currentUser } = useAuth();
  const [restaurants, setRestaurants] = useState<Restaurant[]>([]);
  const [loading, setLoading] = useState(true);
  const [customerName, setCustomerName] = useState('');

  useEffect(() => {
    fetchAllRestaurants();
  }, []);

  useEffect(() => {
    const loadCustomerName = async () => {
      if (!currentUser?.uid) {
        setCustomerName('');
        return;
      }

      try {
        const userDoc = await getDoc(doc(db, 'users', currentUser.uid));
        if (userDoc.exists()) {
          const data = userDoc.data();
          setCustomerName(typeof data.name === 'string' ? data.name : '');
        }
      } catch (error) {
        console.error('Error loading customer profile:', error);
      }
    };

    loadCustomerName();
  }, [currentUser?.uid]);

  const fetchAllRestaurants = async () => {
    try {
      const normalizedRestaurants: Restaurant[] = [];

      // Prefer the new architecture first
      const restaurantsRef = collection(db, 'restaurants');
      const restaurantsSnapshot = await getDocs(restaurantsRef);

      if (!restaurantsSnapshot.empty) {
        restaurantsSnapshot.docs.forEach((docSnapshot) => {
          const data = docSnapshot.data();
          normalizedRestaurants.push({
            id: docSnapshot.id,
            name: data.name || data.restaurantName || 'Unnamed Restaurant',
            address: data.address,
            phone: data.phone,
            cuisine: data.cuisine,
          });
        });

        setRestaurants(
          normalizedRestaurants.sort((a, b) => a.name.localeCompare(b.name))
        );
        return;
      }

      // Fallback to older users-based restaurant records if needed
      const usersRef = collection(db, 'users');
      const usersQuery = query(usersRef, where('role', '==', 'restaurant'));
      const usersSnapshot = await getDocs(usersQuery);

      usersSnapshot.docs.forEach((docSnapshot) => {
        const data = docSnapshot.data();
        normalizedRestaurants.push({
          id: docSnapshot.id,
          name: data.name || 'Unnamed Restaurant',
          address: data.address,
          phone: data.phone,
          cuisine: data.cuisine,
        });
      });

      setRestaurants(
        normalizedRestaurants.sort((a, b) => a.name.localeCompare(b.name))
      );
    } catch (error) {
      console.error('Error fetching restaurants:', error);
    } finally {
      setLoading(false);
    }
  };

  const customerDisplayName =
    customerName ||
    currentUser?.displayName ||
    currentUser?.email?.split('@')[0] ||
    'Crush';

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-12 text-center">
        <p className="text-gray-500">Loading Crush Kitchens...</p>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-[#2D3142]">
          🍽️ Welcome back, {customerDisplayName}
        </h1>
        <p className="text-gray-600 mt-1">Find Your Crush</p>
        <p className="text-gray-600 mt-1">Discover the best Crush Kitchens near you</p>
      </div>

      {restaurants.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-xl border border-gray-100">
          <p className="text-gray-400">No Crush Kitchens yet</p>
          <p className="text-sm text-gray-400 mt-2">Be the first to partner with us!</p>
          <Link to="/signup" className="text-[#FF6B35] mt-4 inline-block">
            Partner Your Kitchen →
          </Link>
        </div>
      ) : (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5">
          {restaurants.map((restaurant) => (
            <div
              key={restaurant.id}
              className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 hover:shadow-md transition"
            >
              <div className="flex justify-between items-start gap-4">
                <div>
                  <h3 className="font-semibold text-lg text-[#2D3142]">{restaurant.name}</h3>
                  {restaurant.cuisine && (
                    <p className="text-gray-500 text-sm mt-1">{restaurant.cuisine}</p>
                  )}
                  {restaurant.address && (
                    <p className="text-gray-400 text-xs mt-2">📍 {restaurant.address}</p>
                  )}
                </div>
                <div className="text-right shrink-0">
                  <div className="text-[#FF6B35] font-bold">⭐ New</div>
                  <div className="text-xs text-gray-400">15-25 min</div>
                </div>
              </div>

              <Link
                to={`/restaurant/${restaurant.id}`}
                className="mt-4 w-full bg-[#FF6B35] text-white py-2 rounded-lg font-semibold text-center hover:bg-orange-600 transition block"
              >
                View Crush Menu
              </Link>
            </div>
          ))}
        </div>
      )}

      <div className="mt-12 text-center">
        <p className="text-gray-500">
          More restaurants coming soon.{` `}
          <Link to="/signup" className="text-[#FF6B35]">
            Are you a restaurant? Partner with us →
          </Link>
        </p>
      </div>
    </div>
  );
};

export default CustomerOrder;
