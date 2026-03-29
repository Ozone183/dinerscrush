import { useState, useEffect } from 'react';
import { db } from '../firebase/config';
import { collection, query, where, getDocs, addDoc, updateDoc, doc, serverTimestamp, orderBy } from 'firebase/firestore';
import toast, { Toaster } from 'react-hot-toast';

interface Order {
  id: string;
  customerName: string;
  customerAddress: string;
  customerPhone: string;
  items: any[];
  totalAmount: number;
  status: 'pending' | 'confirmed' | 'preparing' | 'ready' | 'delivered';
  createdAt: any;
}

interface MenuItem {
  id: string;
  name: string;
  price: number;
  description: string;
  category: string;
}

const RestaurantDashboard = () => {
  const [activeTab, setActiveTab] = useState<'orders' | 'menu' | 'earnings'>('orders');
  const [orders, setOrders] = useState<Order[]>([]);
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [newItem, setNewItem] = useState({ name: '', price: '', description: '', category: '' });

  // Mock restaurant ID – in production, this comes from authentication
  const restaurantId = 'demo-restaurant-123';

  // Fetch orders
  useEffect(() => {
    fetchOrders();
    fetchMenu();
  }, []);

  const fetchOrders = async () => {
    try {
      const ordersRef = collection(db, 'orders');
      const q = query(ordersRef, where('restaurantId', '==', restaurantId), orderBy('createdAt', 'desc'));
      const querySnapshot = await getDocs(q);
      const ordersData = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Order));
      setOrders(ordersData);
    } catch (error) {
      console.error('Error fetching orders:', error);
      toast.error('Failed to load orders');
    } finally {
      setLoading(false);
    }
  };

  const fetchMenu = async () => {
    try {
      const menuRef = collection(db, 'menu');
      const q = query(menuRef, where('restaurantId', '==', restaurantId));
      const querySnapshot = await getDocs(q);
      const menuData = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as MenuItem));
      setMenuItems(menuData);
    } catch (error) {
      console.error('Error fetching menu:', error);
    }
  };

  const updateOrderStatus = async (orderId: string, newStatus: Order['status']) => {
    try {
      const orderRef = doc(db, 'orders', orderId);
      await updateDoc(orderRef, { status: newStatus });
      toast.success(`Order ${newStatus}`);
      fetchOrders(); // Refresh
    } catch (error) {
      console.error('Error updating order:', error);
      toast.error('Failed to update order');
    }
  };

  const addMenuItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newItem.name || !newItem.price) {
      toast.error('Please fill in name and price');
      return;
    }

    try {
      const menuRef = collection(db, 'menu');
      await addDoc(menuRef, {
        restaurantId,
        name: newItem.name,
        price: parseFloat(newItem.price),
        description: newItem.description,
        category: newItem.category,
        createdAt: serverTimestamp()
      });
      toast.success('Menu item added!');
      setNewItem({ name: '', price: '', description: '', category: '' });
      fetchMenu();
    } catch (error) {
      console.error('Error adding menu item:', error);
      toast.error('Failed to add item');
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending': return 'bg-yellow-100 text-yellow-800';
      case 'confirmed': return 'bg-blue-100 text-blue-800';
      case 'preparing': return 'bg-purple-100 text-purple-800';
      case 'ready': return 'bg-green-100 text-green-800';
      case 'delivered': return 'bg-gray-100 text-gray-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <Toaster position="top-right" />
      
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-[#2D3142]">Restaurant Dashboard</h1>
        <p className="text-gray-600 mt-2">Manage orders, menu, and track your earnings</p>
      </div>

      {/* Tabs */}
      <div className="flex space-x-4 mb-8 border-b">
        <button
          onClick={() => setActiveTab('orders')}
          className={`px-4 py-2 font-semibold transition ${
            activeTab === 'orders'
              ? 'text-[#FF6B35] border-b-2 border-[#FF6B35]'
              : 'text-gray-500 hover:text-[#FF6B35]'
          }`}
        >
          📦 Orders ({orders.filter(o => o.status !== 'delivered').length})
        </button>
        <button
          onClick={() => setActiveTab('menu')}
          className={`px-4 py-2 font-semibold transition ${
            activeTab === 'menu'
              ? 'text-[#FF6B35] border-b-2 border-[#FF6B35]'
              : 'text-gray-500 hover:text-[#FF6B35]'
          }`}
        >
          📋 Menu
        </button>
        <button
          onClick={() => setActiveTab('earnings')}
          className={`px-4 py-2 font-semibold transition ${
            activeTab === 'earnings'
              ? 'text-[#FF6B35] border-b-2 border-[#FF6B35]'
              : 'text-gray-500 hover:text-[#FF6B35]'
          }`}
        >
          💰 Earnings
        </button>
      </div>

      {/* Orders Tab */}
      {activeTab === 'orders' && (
        <div>
          {loading ? (
            <div className="text-center py-12">
              <div className="text-gray-500">Loading orders...</div>
            </div>
          ) : orders.length === 0 ? (
            <div className="text-center py-12 bg-gray-50 rounded-lg">
              <p className="text-gray-500">No orders yet. Share your restaurant with customers!</p>
            </div>
          ) : (
            <div className="space-y-4">
              {orders.map((order) => (
                <div key={order.id} className="bg-white rounded-lg shadow-md p-6 border border-gray-200">
                  <div className="flex justify-between items-start mb-4">
                    <div>
                      <h3 className="font-semibold text-lg">Order #{order.id.slice(0, 8)}</h3>
                      <p className="text-gray-600 text-sm">{order.customerName}</p>
                      <p className="text-gray-600 text-sm">{order.customerPhone}</p>
                      <p className="text-gray-600 text-sm">{order.customerAddress}</p>
                    </div>
                    <span className={`px-3 py-1 rounded-full text-sm font-medium ${getStatusColor(order.status)}`}>
                      {order.status.toUpperCase()}
                    </span>
                  </div>
                  
                  <div className="border-t border-gray-200 pt-4 mb-4">
                    {order.items.map((item, idx) => (
                      <div key={idx} className="flex justify-between text-sm mb-2">
                        <span>{item.quantity}x {item.name}</span>
                        <span>${(item.price * item.quantity).toFixed(2)}</span>
                      </div>
                    ))}
                    <div className="border-t border-gray-200 pt-2 mt-2 flex justify-between font-semibold">
                      <span>Total</span>
                      <span className="text-[#FF6B35]">${order.totalAmount.toFixed(2)}</span>
                    </div>
                  </div>

                  {order.status !== 'delivered' && order.status !== 'ready' && (
                    <div className="flex space-x-2">
                      {order.status === 'pending' && (
                        <button
                          onClick={() => updateOrderStatus(order.id, 'confirmed')}
                          className="bg-blue-500 text-white px-4 py-2 rounded-lg text-sm hover:bg-blue-600"
                        >
                          Confirm Order
                        </button>
                      )}
                      {order.status === 'confirmed' && (
                        <button
                          onClick={() => updateOrderStatus(order.id, 'preparing')}
                          className="bg-purple-500 text-white px-4 py-2 rounded-lg text-sm hover:bg-purple-600"
                        >
                          Start Preparing
                        </button>
                      )}
                      {order.status === 'preparing' && (
                        <button
                          onClick={() => updateOrderStatus(order.id, 'ready')}
                          className="bg-green-500 text-white px-4 py-2 rounded-lg text-sm hover:bg-green-600"
                        >
                          Mark Ready for Pickup
                        </button>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Menu Tab */}
      {activeTab === 'menu' && (
        <div className="grid md:grid-cols-2 gap-8">
          {/* Add New Item Form */}
          <div className="bg-white rounded-lg shadow-md p-6">
            <h2 className="text-xl font-semibold mb-4">Add Menu Item</h2>
            <form onSubmit={addMenuItem}>
              <input
                type="text"
                placeholder="Item name"
                value={newItem.name}
                onChange={(e) => setNewItem({ ...newItem, name: e.target.value })}
                className="w-full p-2 border border-gray-300 rounded-lg mb-3"
              />
              <input
                type="number"
                placeholder="Price"
                value={newItem.price}
                onChange={(e) => setNewItem({ ...newItem, price: e.target.value })}
                className="w-full p-2 border border-gray-300 rounded-lg mb-3"
              />
              <input
                type="text"
                placeholder="Category (e.g., Appetizer, Main, Dessert)"
                value={newItem.category}
                onChange={(e) => setNewItem({ ...newItem, category: e.target.value })}
                className="w-full p-2 border border-gray-300 rounded-lg mb-3"
              />
              <textarea
                placeholder="Description"
                value={newItem.description}
                onChange={(e) => setNewItem({ ...newItem, description: e.target.value })}
                className="w-full p-2 border border-gray-300 rounded-lg mb-3"
                rows={3}
              />
              <button
                type="submit"
                className="w-full bg-[#FF6B35] text-white py-2 rounded-lg font-semibold hover:bg-orange-600"
              >
                Add to Menu
              </button>
            </form>
          </div>

          {/* Menu List */}
          <div className="bg-white rounded-lg shadow-md p-6">
            <h2 className="text-xl font-semibold mb-4">Current Menu</h2>
            {menuItems.length === 0 ? (
              <p className="text-gray-500 text-center py-8">No menu items yet. Add your first item!</p>
            ) : (
              <div className="space-y-3">
                {menuItems.map((item) => (
                  <div key={item.id} className="border-b border-gray-200 pb-3">
                    <div className="flex justify-between">
                      <div>
                        <h3 className="font-semibold">{item.name}</h3>
                        <p className="text-sm text-gray-600">{item.description}</p>
                        <p className="text-xs text-gray-500">{item.category}</p>
                      </div>
                      <p className="text-[#FF6B35] font-semibold">${item.price.toFixed(2)}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Earnings Tab */}
      {activeTab === 'earnings' && (
        <div className="bg-white rounded-lg shadow-md p-6">
          <h2 className="text-xl font-semibold mb-4">Coming Soon</h2>
          <p className="text-gray-600">
            Earnings tracking will be available once you start receiving orders. 
            You'll see real-time revenue, delivery fees, and payouts here.
          </p>
          <div className="mt-6 p-4 bg-gray-50 rounded-lg">
            <p className="text-sm text-gray-500">Commission rate: <span className="font-semibold text-[#FF6B35]">15%</span></p>
            <p className="text-sm text-gray-500">Next payout: Track after your first delivery</p>
          </div>
        </div>
      )}
    </div>
  );
};

export default RestaurantDashboard;
