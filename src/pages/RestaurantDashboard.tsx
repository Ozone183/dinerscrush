import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { db } from '../firebase/config';
import {
  addDoc,
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  serverTimestamp,
  updateDoc,
  where,
} from 'firebase/firestore';
import toast, { Toaster } from 'react-hot-toast';
import { useAuth } from '../context/AuthContext';

type OrderStatus =
  | 'pending'
  | 'confirmed'
  | 'preparing'
  | 'ready'
  | 'delivered'
  | 'cancelled';

interface OrderItem {
  menuItemId?: string;
  name: string;
  quantity: number;
  price?: number;
  priceCents?: number;
  displayPrice?: string | null;
  description?: string;
  specialInstructions?: string;
}

interface FirestoreTimestampLike {
  seconds?: number;
  nanoseconds?: number;
}

interface Order {
  id: string;
  restaurantId?: string;
  restaurantDocId?: string;
  restaurantName?: string;
  customerName: string;
  customerAddress: string;
  customerPhone: string;
  customerEmail?: string | null;
  orderInstructions?: string;
  items: OrderItem[];
  totalAmount?: number;
  totalCents?: number;
  status: OrderStatus;
  createdAt: FirestoreTimestampLike | null;
}

interface MenuItem {
  id: string;
  name: string;
  price?: number | string | null;
  priceCents?: number | string | null;
  displayPrice?: string | null;
  description?: string;
  category?: string;
  restaurantId?: string;
}

interface RestaurantIdentifiers {
  authUid: string;
  restaurantDocId: string | null;
  userRestaurantId: string | null;
  displayName: string;
  candidateIds: string[];
}

const OPEN_STATUSES: OrderStatus[] = ['pending', 'confirmed', 'preparing'];
const COMPLETED_STATUSES: OrderStatus[] = ['ready', 'delivered'];

const pickFirstString = (...values: unknown[]) => {
  for (const value of values) {
    if (typeof value === 'string' && value.trim()) {
      return value.trim();
    }
  }
  return '';
};

const normalizeMoneyToCents = (value: unknown): number => {
  if (typeof value === 'number' && Number.isFinite(value)) {
    if (value >= 100 && Number.isInteger(value)) return Math.round(value);
    return Math.round(value * 100);
  }

  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) return 0;

    const numeric = trimmed.replace(/[^0-9.]/g, '');
    if (!numeric) return 0;

    const parsed = Number.parseFloat(numeric);
    if (!Number.isFinite(parsed)) return 0;

    const looksLikeDollarString = trimmed.includes('$') || trimmed.includes('.');
    if (looksLikeDollarString) return Math.round(parsed * 100);
    if (parsed >= 100) return Math.round(parsed);
    return Math.round(parsed * 100);
  }

  return 0;
};

const formatCents = (cents: number) => `$${(cents / 100).toFixed(2)}`;

const getTimestampSeconds = (value: FirestoreTimestampLike | null | undefined) => {
  return typeof value?.seconds === 'number' ? value.seconds : 0;
};

const getOrderItemPriceCents = (item: OrderItem) => {
  const fromPriceCents = normalizeMoneyToCents(item.priceCents);
  if (fromPriceCents > 0) return fromPriceCents;

  const fromPrice = normalizeMoneyToCents(item.price);
  if (fromPrice > 0) return fromPrice;

  const fromDisplayPrice = normalizeMoneyToCents(item.displayPrice);
  if (fromDisplayPrice > 0) return fromDisplayPrice;

  return 0;
};

const getOrderTotalCents = (order: Order) => {
  const fromTotalCents = normalizeMoneyToCents(order.totalCents);
  if (fromTotalCents > 0) return fromTotalCents;

  const fromTotalAmount = normalizeMoneyToCents(order.totalAmount);
  if (fromTotalAmount > 0) return fromTotalAmount;

  return order.items.reduce(
    (sum, item) => sum + getOrderItemPriceCents(item) * item.quantity,
    0
  );
};

const getMenuItemPriceCents = (item: MenuItem) => {
  const fromPriceCents = normalizeMoneyToCents(item.priceCents);
  if (fromPriceCents > 0) return fromPriceCents;

  const fromPrice = normalizeMoneyToCents(item.price);
  if (fromPrice > 0) return fromPrice;

  const fromDisplayPrice = normalizeMoneyToCents(item.displayPrice);
  if (fromDisplayPrice > 0) return fromDisplayPrice;

  return 0;
};

const RestaurantDashboard = () => {
  const { currentUser, loading: authLoading } = useAuth();

  const [activeTab, setActiveTab] = useState<'orders' | 'menu' | 'earnings'>('orders');
  const [orders, setOrders] = useState<Order[]>([]);
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [loadingOrders, setLoadingOrders] = useState(true);
  const [loadingMenu, setLoadingMenu] = useState(true);
  const [restaurantIdentifiers, setRestaurantIdentifiers] =
    useState<RestaurantIdentifiers | null>(null);

  const [newItem, setNewItem] = useState({
    name: '',
    price: '',
    description: '',
    category: '',
  });

  useEffect(() => {
    if (authLoading || !currentUser?.uid) return;
    void bootstrapDashboard();
  }, [authLoading, currentUser?.uid]);

  const bootstrapDashboard = async () => {
    if (!currentUser?.uid) return;

    try {
      const identifiers = await resolveRestaurantIdentifiers(currentUser.uid);
      setRestaurantIdentifiers(identifiers);
      await Promise.all([fetchOrders(identifiers), fetchMenu(identifiers)]);
    } catch (error) {
      console.error('Error bootstrapping restaurant dashboard:', error);
      toast.error('Failed to load restaurant dashboard');
      setLoadingOrders(false);
      setLoadingMenu(false);
    }
  };

  const resolveRestaurantIdentifiers = async (
    authUid: string
  ): Promise<RestaurantIdentifiers> => {
    let userRestaurantId: string | null = null;
    let displayName = '';

    const userDoc = await getDoc(doc(db, 'users', authUid));
    if (userDoc.exists()) {
      const data = userDoc.data();
      userRestaurantId = pickFirstString(data.restaurantId) || null;
      displayName = pickFirstString(data.name, data.restaurantName);
    }

    const restaurantsSnapshot = await getDocs(collection(db, 'restaurants'));
    const matchingRestaurantDoc =
      restaurantsSnapshot.docs.find((restaurantDoc) => {
        const data = restaurantDoc.data();
        return (
          restaurantDoc.id === authUid ||
          restaurantDoc.id === userRestaurantId ||
          pickFirstString(data.ownerId) === authUid ||
          pickFirstString(data.ownerUid) === authUid ||
          pickFirstString(data.userId) === authUid ||
          pickFirstString(data.authUid) === authUid ||
          pickFirstString(data.restaurantId) === authUid
        );
      }) || null;

    const restaurantDocId = matchingRestaurantDoc?.id || null;

    if (matchingRestaurantDoc) {
      const data = matchingRestaurantDoc.data();
      displayName = pickFirstString(data.name, data.restaurantName) || displayName;
    }

    const candidateIds = Array.from(
      new Set([authUid, userRestaurantId, restaurantDocId].filter(Boolean) as string[])
    );

    return {
      authUid,
      restaurantDocId,
      userRestaurantId,
      displayName,
      candidateIds,
    };
  };

  const fetchOrders = async (identifiers: RestaurantIdentifiers) => {
    try {
      setLoadingOrders(true);

      const collected = new Map<string, Order>();
      const ordersRef = collection(db, 'orders');

      for (const candidateId of identifiers.candidateIds) {
        const byRestaurantId = query(ordersRef, where('restaurantId', '==', candidateId));
        const snapshot = await getDocs(byRestaurantId);

        snapshot.docs.forEach((orderDoc) => {
          collected.set(orderDoc.id, {
            id: orderDoc.id,
            ...orderDoc.data(),
          } as Order);
        });
      }

      if (identifiers.restaurantDocId) {
        const byRestaurantDocId = query(
          ordersRef,
          where('restaurantDocId', '==', identifiers.restaurantDocId)
        );
        const snapshot = await getDocs(byRestaurantDocId);

        snapshot.docs.forEach((orderDoc) => {
          collected.set(orderDoc.id, {
            id: orderDoc.id,
            ...orderDoc.data(),
          } as Order);
        });
      }

      const sortedOrders = Array.from(collected.values()).sort(
        (a, b) => getTimestampSeconds(b.createdAt) - getTimestampSeconds(a.createdAt)
      );

      setOrders(sortedOrders);
    } catch (error) {
      console.error('Error fetching orders:', error);
      toast.error('Failed to load orders');
    } finally {
      setLoadingOrders(false);
    }
  };

  const fetchMenu = async (identifiers: RestaurantIdentifiers) => {
    try {
      setLoadingMenu(true);

      const collected = new Map<string, MenuItem>();

      for (const candidateId of identifiers.candidateIds) {
        const menuItemsSnapshot = await getDocs(
          query(collection(db, 'menuItems'), where('restaurantId', '==', candidateId))
        );

        menuItemsSnapshot.docs.forEach((menuDoc) => {
          collected.set(menuDoc.id, {
            id: menuDoc.id,
            ...menuDoc.data(),
          } as MenuItem);
        });

        const legacyMenuSnapshot = await getDocs(
          query(collection(db, 'menu'), where('restaurantId', '==', candidateId))
        );

        legacyMenuSnapshot.docs.forEach((menuDoc) => {
          collected.set(menuDoc.id, {
            id: menuDoc.id,
            ...menuDoc.data(),
          } as MenuItem);
        });
      }

      const sortedMenu = Array.from(collected.values()).sort((a, b) => {
        const categoryCompare = (a.category || 'Uncategorized').localeCompare(
          b.category || 'Uncategorized'
        );
        if (categoryCompare !== 0) return categoryCompare;
        return a.name.localeCompare(b.name);
      });

      setMenuItems(sortedMenu);
    } catch (error) {
      console.error('Error fetching menu:', error);
      toast.error('Failed to load menu');
    } finally {
      setLoadingMenu(false);
    }
  };

  const updateOrderStatus = async (orderId: string, newStatus: OrderStatus) => {
    try {
      await updateDoc(doc(db, 'orders', orderId), {
        status: newStatus,
        updatedAt: serverTimestamp(),
      });

      setOrders((prev) =>
        prev.map((order) =>
          order.id === orderId ? { ...order, status: newStatus } : order
        )
      );

      toast.success(`Order ${newStatus}`);
    } catch (error) {
      console.error('Error updating order:', error);
      toast.error('Failed to update order');
    }
  };

  const addMenuItem = async (e: FormEvent) => {
    e.preventDefault();

    if (!restaurantIdentifiers) {
      toast.error('Restaurant account not found');
      return;
    }

    const name = newItem.name.trim();
    const category = newItem.category.trim();
    const description = newItem.description.trim();
    const priceInput = newItem.price.trim();
    const parsedPrice = Number.parseFloat(priceInput);

    if (!name || !priceInput || !Number.isFinite(parsedPrice) || parsedPrice <= 0) {
      toast.error('Please enter a valid item name and price');
      return;
    }

    const menuRestaurantId =
      restaurantIdentifiers.restaurantDocId || restaurantIdentifiers.authUid;

    try {
      await addDoc(collection(db, 'menuItems'), {
        restaurantId: menuRestaurantId,
        ownerId: restaurantIdentifiers.authUid,
        name,
        description,
        category: category || 'Main',
        price: Number(parsedPrice.toFixed(2)),
        priceCents: Math.round(parsedPrice * 100),
        displayPrice: `$${parsedPrice.toFixed(2)}`,
        isActive: true,
        isAvailable: true,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      toast.success('Menu item added!');
      setNewItem({ name: '', price: '', description: '', category: '' });
      await fetchMenu(restaurantIdentifiers);
    } catch (error) {
      console.error('Error adding menu item:', error);
      toast.error('Failed to add item');
    }
  };

  const openOrders = useMemo(
    () => orders.filter((order) => OPEN_STATUSES.includes(order.status)),
    [orders]
  );

  const completedOrders = useMemo(
    () => orders.filter((order) => COMPLETED_STATUSES.includes(order.status)),
    [orders]
  );

  const deliveredOrders = useMemo(
    () => orders.filter((order) => order.status === 'delivered'),
    [orders]
  );

  const pendingOrdersCount = useMemo(
    () => orders.filter((order) => order.status === 'pending').length,
    [orders]
  );

  const deliveredRevenueCents = useMemo(
    () => deliveredOrders.reduce((sum, order) => sum + getOrderTotalCents(order), 0),
    [deliveredOrders]
  );

  const averageDeliveredOrderValueCents = useMemo(() => {
    if (deliveredOrders.length === 0) return 0;
    return Math.round(deliveredRevenueCents / deliveredOrders.length);
  }, [deliveredOrders, deliveredRevenueCents]);

  const getStatusColor = (status: OrderStatus) => {
    switch (status) {
      case 'pending':
        return 'bg-yellow-100 text-yellow-800';
      case 'confirmed':
        return 'bg-blue-100 text-blue-800';
      case 'preparing':
        return 'bg-purple-100 text-purple-800';
      case 'ready':
        return 'bg-green-100 text-green-800';
      case 'delivered':
        return 'bg-gray-100 text-gray-800';
      case 'cancelled':
        return 'bg-red-100 text-red-700';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const renderOrderActions = (order: Order) => {
    if (order.status === 'pending') {
      return (
        <button
          onClick={() => updateOrderStatus(order.id, 'confirmed')}
          className="bg-blue-500 text-white px-4 py-2 rounded-lg text-sm hover:bg-blue-600"
        >
          Confirm Order
        </button>
      );
    }

    if (order.status === 'confirmed') {
      return (
        <button
          onClick={() => updateOrderStatus(order.id, 'preparing')}
          className="bg-purple-500 text-white px-4 py-2 rounded-lg text-sm hover:bg-purple-600"
        >
          Start Preparing
        </button>
      );
    }

    if (order.status === 'preparing') {
      return (
        <button
          onClick={() => updateOrderStatus(order.id, 'ready')}
          className="bg-green-500 text-white px-4 py-2 rounded-lg text-sm hover:bg-green-600"
        >
          Mark Ready
        </button>
      );
    }

    if (order.status === 'ready') {
      return (
        <button
          onClick={() => updateOrderStatus(order.id, 'delivered')}
          className="bg-gray-700 text-white px-4 py-2 rounded-lg text-sm hover:bg-gray-800"
        >
          Mark Delivered
        </button>
      );
    }

    return null;
  };

  const renderOrderCard = (order: Order) => {
    const totalCents = getOrderTotalCents(order);

    return (
      <div
        key={order.id}
        className="bg-white rounded-lg shadow-md p-6 border border-gray-200"
      >
        <div className="flex justify-between items-start mb-4 gap-4">
          <div>
            <h3 className="font-semibold text-lg">Order #{order.id.slice(0, 8)}</h3>
            <p className="text-gray-600 text-sm">{order.customerName}</p>
            <p className="text-gray-600 text-sm">{order.customerPhone}</p>
            {order.customerEmail && (
              <p className="text-gray-600 text-sm">{order.customerEmail}</p>
            )}
            <p className="text-gray-600 text-sm">{order.customerAddress}</p>
          </div>

          <span
            className={`px-3 py-1 rounded-full text-sm font-medium ${getStatusColor(
              order.status
            )}`}
          >
            {order.status.toUpperCase()}
          </span>
        </div>

        <div className="border-t border-gray-200 pt-4 mb-4">
          {order.items.map((item, idx) => {
            const itemTotalCents = getOrderItemPriceCents(item) * item.quantity;

            return (
              <div key={idx} className="mb-3 rounded-lg border border-gray-100 p-3">
                <div className="flex justify-between text-sm gap-3">
                  <span>
                    {item.quantity}x {item.name}
                  </span>
                  <span>{formatCents(itemTotalCents)}</span>
                </div>

                {item.specialInstructions && (
                  <p className="text-xs text-orange-600 mt-2">
                    Item note: {item.specialInstructions}
                  </p>
                )}
              </div>
            );
          })}

          {order.orderInstructions && (
            <div className="rounded-lg bg-orange-50 border border-orange-100 p-3 mb-3">
              <p className="text-xs font-semibold text-orange-700 uppercase tracking-wide">
                Order Instructions
              </p>
              <p className="text-sm text-orange-700 mt-1">{order.orderInstructions}</p>
            </div>
          )}

          <div className="border-t border-gray-200 pt-2 mt-2 flex justify-between font-semibold">
            <span>Total</span>
            <span className="text-[#FF6B35]">{formatCents(totalCents)}</span>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">{renderOrderActions(order)}</div>
      </div>
    );
  };

  if (authLoading) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 text-center">
        <p className="text-gray-500">Loading restaurant dashboard...</p>
      </div>
    );
  }

  if (!currentUser) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 text-center">
        <p className="text-gray-500">
          You must be signed in as a restaurant to view this page.
        </p>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <Toaster position="top-right" />

      <div className="mb-8">
        <h1 className="text-3xl font-bold text-[#2D3142]">Restaurant Dashboard</h1>
        <p className="text-gray-600 mt-2">
          {restaurantIdentifiers?.displayName
            ? `Managing ${restaurantIdentifiers.displayName}`
            : 'Manage orders, menu, and track your earnings'}
        </p>
      </div>

      <div className="grid md:grid-cols-3 gap-4 mb-8">
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
          <p className="text-sm text-gray-500">Open Orders</p>
          <p className="text-3xl font-bold text-[#2D3142] mt-2">{openOrders.length}</p>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
          <p className="text-sm text-gray-500">Pending Orders</p>
          <p className="text-3xl font-bold text-[#FF6B35] mt-2">{pendingOrdersCount}</p>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
          <p className="text-sm text-gray-500">Delivered Revenue</p>
          <p className="text-3xl font-bold text-[#2D3142] mt-2">
            {formatCents(deliveredRevenueCents)}
          </p>
        </div>
      </div>

      <div className="flex space-x-4 mb-8 border-b">
        <button
          onClick={() => setActiveTab('orders')}
          className={`px-4 py-2 font-semibold transition ${
            activeTab === 'orders'
              ? 'text-[#FF6B35] border-b-2 border-[#FF6B35]'
              : 'text-gray-500 hover:text-[#FF6B35]'
          }`}
        >
          📦 Orders ({openOrders.length})
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

      {activeTab === 'orders' && (
        <div className="space-y-8">
          <div>
            <div className="flex items-center justify-between mb-4 gap-4">
              <h2 className="text-xl font-semibold text-[#2D3142]">Open Orders</h2>
              <span className="text-sm text-gray-500">{openOrders.length} active</span>
            </div>

            {loadingOrders ? (
              <div className="text-center py-12">
                <div className="text-gray-500">Loading orders...</div>
              </div>
            ) : openOrders.length === 0 ? (
              <div className="text-center py-12 bg-gray-50 rounded-lg">
                <p className="text-gray-500">No open orders right now.</p>
              </div>
            ) : (
              <div className="space-y-4">{openOrders.map(renderOrderCard)}</div>
            )}
          </div>

          <div>
            <div className="flex items-center justify-between mb-4 gap-4">
              <h2 className="text-xl font-semibold text-[#2D3142]">Completed / Ready Orders</h2>
              <span className="text-sm text-gray-500">{completedOrders.length} total</span>
            </div>

            {loadingOrders ? null : completedOrders.length === 0 ? (
              <div className="text-center py-8 bg-gray-50 rounded-lg">
                <p className="text-gray-500">No completed orders yet.</p>
              </div>
            ) : (
              <div className="space-y-4">{completedOrders.map(renderOrderCard)}</div>
            )}
          </div>
        </div>
      )}

      {activeTab === 'menu' && (
        <div className="grid md:grid-cols-2 gap-8">
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
                step="0.01"
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

          <div className="bg-white rounded-lg shadow-md p-6">
            <h2 className="text-xl font-semibold mb-4">Current Menu</h2>

            {loadingMenu ? (
              <p className="text-gray-500 text-center py-8">Loading menu...</p>
            ) : menuItems.length === 0 ? (
              <p className="text-gray-500 text-center py-8">
                No menu items yet. Add your first item!
              </p>
            ) : (
              <div className="space-y-3">
                {menuItems.map((item) => {
                  const priceCents = getMenuItemPriceCents(item);

                  return (
                    <div
                      key={item.id}
                      className="border border-gray-200 rounded-lg p-4 hover:border-[#FF6B35] transition"
                    >
                      <div className="flex justify-between items-start gap-4">
                        <div>
                          <h3 className="font-semibold text-[#2D3142]">{item.name}</h3>
                          <p className="text-sm text-gray-500 mt-1">
                            {item.description || 'No description'}
                          </p>
                          <p className="text-xs text-gray-400 mt-2">
                            {item.category || 'Uncategorized'}
                          </p>
                        </div>
                        <p className="font-bold text-[#FF6B35]">
                          {priceCents > 0
                            ? formatCents(priceCents)
                            : item.displayPrice || 'Unavailable'}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {activeTab === 'earnings' && (
        <div className="bg-white rounded-lg shadow-md p-6">
          <h2 className="text-xl font-semibold mb-6">Earnings Overview</h2>

          <div className="grid md:grid-cols-3 gap-4">
            <div className="bg-gray-50 rounded-xl p-5 border border-gray-100">
              <p className="text-sm text-gray-500">Delivered Orders</p>
              <p className="text-3xl font-bold text-[#2D3142] mt-2">
                {deliveredOrders.length}
              </p>
            </div>

            <div className="bg-gray-50 rounded-xl p-5 border border-gray-100">
              <p className="text-sm text-gray-500">Total Revenue</p>
              <p className="text-3xl font-bold text-[#FF6B35] mt-2">
                {formatCents(deliveredRevenueCents)}
              </p>
            </div>

            <div className="bg-gray-50 rounded-xl p-5 border border-gray-100">
              <p className="text-sm text-gray-500">Average Order Value</p>
              <p className="text-3xl font-bold text-[#2D3142] mt-2">
                {formatCents(averageDeliveredOrderValueCents)}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default RestaurantDashboard;
