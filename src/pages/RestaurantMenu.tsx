import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { db } from '../firebase/config';
import { doc, getDoc, collection, getDocs, query, where } from 'firebase/firestore';

interface Restaurant {
  id: string;
  name: string;
  address?: string;
  phone?: string;
  cuisine?: string;
}

interface MenuItem {
  id: string;
  name: string;
  price?: number;
  priceCents?: number | null;
  displayPrice?: string | null;
  description?: string;
  category?: string;
  categoryId?: string;
  restaurantId?: string;
  menuId?: string;
}

const RestaurantMenu = () => {
  const { id } = useParams<{ id: string }>();
  const [restaurant, setRestaurant] = useState<Restaurant | null>(null);
  const [menu, setMenu] = useState<MenuItem[]>([]);
  const [loading, setLoading] = useState(true);

  const formatPrice = (item: MenuItem) => {
    if (item.displayPrice) return item.displayPrice;
    if (typeof item.priceCents === 'number') return `$${(item.priceCents / 100).toFixed(2)}`;
    if (typeof item.price === 'number') {
      return item.price > 100 ? `$${(item.price / 100).toFixed(2)}` : `$${item.price.toFixed(2)}`;
    }
    return 'Market Price';
  };

  useEffect(() => {
    if (id) {
      fetchRestaurantAndMenu(id);
    }
  }, [id]);

  const fetchRestaurantAndMenu = async (restaurantId: string) => {
    try {
      // Try to fetch from 'users' collection first
      let restaurantDoc = await getDoc(doc(db, 'users', restaurantId));
      
      // If not found, try 'restaurants' collection
      if (!restaurantDoc.exists()) {
        restaurantDoc = await getDoc(doc(db, 'restaurants', restaurantId));
      }
      
      if (restaurantDoc.exists()) {
        setRestaurant({
          id: restaurantDoc.id,
          name: restaurantDoc.data().name || restaurantDoc.data().restaurantName || 'Restaurant',
          address: restaurantDoc.data().address,
          phone: restaurantDoc.data().phone,
          cuisine: restaurantDoc.data().cuisine,
        });
      }

      // Fetch menu items (try both possible collection names)
      let menuItems: MenuItem[] = [];
      
      // Try 'menu' collection
      const menuRef = collection(db, 'menu');
      const menuQuery = query(menuRef, where('restaurantId', '==', restaurantId));
      const menuSnapshot = await getDocs(menuQuery);
      
      if (!menuSnapshot.empty) {
        menuItems = menuSnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        } as MenuItem));
      } else {
        // Try 'menuItems' collection
        const menuItemsRef = collection(db, 'menuItems');
        const menuItemsQuery = query(menuItemsRef, where('restaurantId', '==', restaurantId));
        const menuItemsSnapshot = await getDocs(menuItemsQuery);
        
        menuItems = menuItemsSnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        } as MenuItem));
      }
      
      setMenu(menuItems);
    } catch (error) {
      console.error('Error fetching restaurant:', error);
    } finally {
      setLoading(false);
    }
  };

  // Group menu items by category
  const groupedMenu = menu.reduce((acc, item) => {
    const category = item.category || 'Main';
    if (!acc[category]) acc[category] = [];
    acc[category].push(item);
    return acc;
  }, {} as Record<string, MenuItem[]>);

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-12 text-center">
        <p className="text-gray-500">Loading menu...</p>
      </div>
    );
  }

  if (!restaurant) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-12 text-center">
        <p className="text-gray-500">Restaurant not found</p>
        <Link to="/order" className="text-[#FF6B35] mt-4 inline-block">← Back to restaurants</Link>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-6 pb-20">
      <Link to="/order" className="text-[#FF6B35] mb-4 inline-flex items-center gap-1">
        ← Back to Crush Kitchens
      </Link>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 mb-6">
        <h1 className="text-2xl font-bold text-[#2D3142]">{restaurant.name}</h1>
        {restaurant.cuisine && (
          <p className="text-gray-500 text-sm mt-1">{restaurant.cuisine}</p>
        )}
        {restaurant.address && (
          <p className="text-gray-400 text-sm mt-2">📍 {restaurant.address}</p>
        )}
        {restaurant.phone && (
          <p className="text-gray-400 text-sm">📞 {restaurant.phone}</p>
        )}
      </div>

      {Object.keys(groupedMenu).length === 0 ? (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-12 text-center">
          <p className="text-gray-400">No menu items yet</p>
        </div>
      ) : (
        Object.entries(groupedMenu).map(([category, items]) => (
          <div key={category} className="mb-8">
            <h2 className="text-xl font-semibold text-[#2D3142] mb-4 pb-2 border-b border-gray-200">
              {category}
            </h2>
            <div className="space-y-3">
              {items.map((item) => (
                <div key={item.id} className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <h3 className="font-semibold text-[#2D3142]">{item.name}</h3>
                      {item.description && (
                        <p className="text-sm text-gray-500 mt-1">{item.description}</p>
                      )}
                    </div>
                    <div className="text-right">
                    <p className="font-bold text-[#FF6B35]">{formatPrice(item)}</p>

                      <button className="mt-2 bg-[#FF6B35] text-white px-4 py-1.5 rounded-lg text-sm font-semibold hover:bg-orange-600 transition">
                        Add to Order
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))
      )}
    </div>
  );
};

export default RestaurantMenu;