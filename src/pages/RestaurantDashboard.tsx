import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { db } from '../firebase/config';
import {
  addDoc,
  collection,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  query,
  serverTimestamp,
  updateDoc,
  where,
  type Query,
  type Unsubscribe,
} from 'firebase/firestore';
import toast, { Toaster } from 'react-hot-toast';
import { useAuth } from '../context/AuthContext';

type OrderStatus =
  | 'pending'
  | 'confirmed'
  | 'preparing'
  | 'ready'
  | 'picked_up'
  | 'on_the_way'
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
  toDate?: () => Date;
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
  subtotalAmount?: number;
  subtotalCents?: number;
  deliveryFeeAmount?: number;
  deliveryFeeCents?: number;
  totalAmount?: number;
  totalCents?: number;
  tipAmount?: number;
  tipCents?: number;
  baseDriverPayoutAmount?: number;
  baseDriverPayoutCents?: number;
  driverPayoutAmount?: number;
  driverPayoutCents?: number;
  status: OrderStatus;
  driverId?: string | null;
  driverName?: string | null;
  createdAt: FirestoreTimestampLike | null;
  updatedAt?: FirestoreTimestampLike | null;
  assignedAt?: FirestoreTimestampLike | null;
  pickedUpAt?: FirestoreTimestampLike | null;
  onTheWayAt?: FirestoreTimestampLike | null;
  deliveredAt?: FirestoreTimestampLike | null;
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
const HANDOFF_STATUSES: OrderStatus[] = ['ready', 'picked_up', 'on_the_way'];
const COMPLETED_STATUSES: OrderStatus[] = ['delivered', 'cancelled'];

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

const formatTimestamp = (value: FirestoreTimestampLike | null | undefined) => {
  if (!value) return 'Just now';
  if (typeof value.toDate === 'function') return value.toDate().toLocaleString();
  if (typeof value.seconds === 'number') return new Date(value.seconds * 1000).toLocaleString();
  return 'Just now';
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

const getSubtotalCents = (order: Order) => {
  const fromSubtotalCents = normalizeMoneyToCents(order.subtotalCents);
  if (fromSubtotalCents > 0) return fromSubtotalCents;

  const fromSubtotalAmount = normalizeMoneyToCents(order.subtotalAmount);
  if (fromSubtotalAmount > 0) return fromSubtotalAmount;

  return order.items.reduce(
    (sum, item) => sum + getOrderItemPriceCents(item) * item.quantity,
    0
  );
};

const getDeliveryFeeCents = (order: Order) => {
  const fromDeliveryFeeCents = normalizeMoneyToCents(order.deliveryFeeCents);
  if (fromDeliveryFeeCents > 0) return fromDeliveryFeeCents;

  const fromDeliveryFeeAmount = normalizeMoneyToCents(order.deliveryFeeAmount);
  if (fromDeliveryFeeAmount > 0) return fromDeliveryFeeAmount;

  return 0;
};

const getTipCents = (order: Order) => {
  const fromTipCents = normalizeMoneyToCents(order.tipCents);
  if (fromTipCents > 0) return fromTipCents;

  const fromTipAmount = normalizeMoneyToCents(order.tipAmount);
  if (fromTipAmount > 0) return fromTipAmount;

  return 0;
};

const getBaseDriverPayoutCents = (order: Order) => {
  const explicitBase = normalizeMoneyToCents(order.baseDriverPayoutCents);
  if (explicitBase > 0) return explicitBase;

  const explicitBaseAmount = normalizeMoneyToCents(order.baseDriverPayoutAmount);
  if (explicitBaseAmount > 0) return explicitBaseAmount;

  const deliveryFeeBased = getDeliveryFeeCents(order);
  if (deliveryFeeBased > 0) return deliveryFeeBased;

  return 500;
};

const getDriverPayoutCents = (order: Order) => {
  const fromDriverPayoutCents = normalizeMoneyToCents(order.driverPayoutCents);
  if (fromDriverPayoutCents > 0) return fromDriverPayoutCents;

  const fromDriverPayoutAmount = normalizeMoneyToCents(order.driverPayoutAmount);
  if (fromDriverPayoutAmount > 0) return fromDriverPayoutAmount;

  return getBaseDriverPayoutCents(order) + getTipCents(order);
};

const getOrderTotalCents = (order: Order) => {
  const fromTotalCents = normalizeMoneyToCents(order.totalCents);
  if (fromTotalCents > 0) return fromTotalCents;

  const fromTotalAmount = normalizeMoneyToCents(order.totalAmount);
  if (fromTotalAmount > 0) return fromTotalAmount;

  return getSubtotalCents(order) + getDeliveryFeeCents(order) + getTipCents(order);
};

const getRestaurantSalesCents = (order: Order) => {
  const subtotalCents = getSubtotalCents(order);
  if (subtotalCents > 0) return subtotalCents;

  return Math.max(0, getOrderTotalCents(order) - getDeliveryFeeCents(order) - getTipCents(order));
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
    case 'picked_up':
      return 'bg-sky-100 text-sky-800';
    case 'on_the_way':
      return 'bg-orange-100 text-orange-800';
    case 'delivered':
      return 'bg-gray-100 text-gray-800';
    case 'cancelled':
      return 'bg-red-100 text-red-700';
    default:
      return 'bg-gray-100 text-gray-800';
  }
};

const getStatusLabel = (status: OrderStatus) => {
  switch (status) {
    case 'picked_up':
      return 'Picked Up';
    case 'on_the_way':
      return 'On the Way';
    default:
      return status.charAt(0).toUpperCase() + status.slice(1);
  }
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

    let unsubscribes: Unsubscribe[] = [];
    let cancelled = false;

    const bootstrap = async () => {
      try {
        const identifiers = await resolveRestaurantIdentifiers(currentUser.uid);
        if (cancelled) return;

        setRestaurantIdentifiers(identifiers);
        await fetchMenu(identifiers);
        if (cancelled) return;

        unsubscribes = subscribeToOrders(identifiers);
      } catch (error) {
        console.error('Error bootstrapping restaurant dashboard:', error);
        toast.error('Failed to load restaurant dashboard');
        setLoadingOrders(false);
        setLoadingMenu(false);
      }
    };

    void bootstrap();

    return () => {
      cancelled = true;
      unsubscribes.forEach((unsubscribe) => unsubscribe());
    };
  }, [authLoading, currentUser?.uid]);

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

  const subscribeToOrders = (identifiers: RestaurantIdentifiers): Unsubscribe[] => {
    setLoadingOrders(true);

    const queryEntries: Array<{ key: string; query: Query }> = [];
    const keySet = new Set<string>();

    for (const candidateId of identifiers.candidateIds) {
      const key = `restaurantId:${candidateId}`;
      if (!keySet.has(key)) {
        keySet.add(key);
        queryEntries.push({
          key,
          query: query(collection(db, 'orders'), where('restaurantId', '==', candidateId)),
        });
      }
    }

    if (identifiers.restaurantDocId) {
      const key = `restaurantDocId:${identifiers.restaurantDocId}`;
      if (!keySet.has(key)) {
        keySet.add(key);
        queryEntries.push({
          key,
          query: query(
            collection(db, 'orders'),
            where('restaurantDocId', '==', identifiers.restaurantDocId)
          ),
        });
      }
    }

    const snapshotsByQuery = new Map<string, Map<string, Order>>();

    const recomputeOrders = () => {
      const merged = new Map<string, Order>();
      snapshotsByQuery.forEach((ordersMap) => {
        ordersMap.forEach((order, orderId) => {
          merged.set(orderId, order);
        });
      });

      const sortedOrders = Array.from(merged.values()).sort(
        (a, b) => getTimestampSeconds(b.createdAt) - getTimestampSeconds(a.createdAt)
      );

      setOrders(sortedOrders);
      setLoadingOrders(false);
    };

    return queryEntries.map(({ key, query: ordersQuery }) =>
      onSnapshot(
        ordersQuery,
        (snapshot) => {
          const current = new Map<string, Order>();
          snapshot.docs.forEach((orderDoc) => {
            current.set(orderDoc.id, {
              id: orderDoc.id,
              ...(orderDoc.data() as Omit<Order, 'id'>),
            });
          });
          snapshotsByQuery.set(key, current);
          recomputeOrders();
        },
        (error) => {
          console.error('Error listening to orders:', error);
          toast.error('Failed to sync orders');
          setLoadingOrders(false);
        }
      )
    );
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

      toast.success(`Order ${getStatusLabel(newStatus).toLowerCase()}`);
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

  const handoffOrders = useMemo(
    () => orders.filter((order) => HANDOFF_STATUSES.includes(order.status)),
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
    () => deliveredOrders.reduce((sum, order) => sum + getRestaurantSalesCents(order), 0),
    [deliveredOrders]
  );

  const deliveredTipCents = useMemo(
    () => deliveredOrders.reduce((sum, order) => sum + getTipCents(order), 0),
    [deliveredOrders]
  );

  const deliveredCrusherEarningsCents = useMemo(
    () => deliveredOrders.reduce((sum, order) => sum + getDriverPayoutCents(order), 0),
    [deliveredOrders]
  );

  const averageDeliveredOrderValueCents = useMemo(() => {
    if (deliveredOrders.length === 0) return 0;
    return Math.round(deliveredRevenueCents / deliveredOrders.length);
  }, [deliveredOrders, deliveredRevenueCents]);

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
          Mark Ready for Pickup
        </button>
      );
    }

    if (order.status === 'ready') {
      return (
        <p className="text-sm text-gray-500">
          Waiting for a crusher to pick this order up.
        </p>
      );
    }

    if (order.status === 'picked_up') {
      return (
        <p className="text-sm text-sky-700">
          {order.driverName || 'A crusher'} picked this order up.
        </p>
      );
    }

    if (order.status === 'on_the_way') {
      return (
        <p className="text-sm text-orange-700">
          {order.driverName || 'A crusher'} is on the way to the customer.
        </p>
      );
    }

    if (order.status === 'delivered') {
      return <p className="text-sm text-gray-500">Completed by delivery flow.</p>;
    }

    return null;
  };

  const renderOrderCard = (order: Order) => {
    const subtotalCents = getRestaurantSalesCents(order);
    const tipCents = getTipCents(order);
    const driverPayoutCents = getDriverPayoutCents(order);
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
          <span className={`px-3 py-1 rounded-full text-sm font-medium ${getStatusColor(order.status)}`}>
            {getStatusLabel(order.status)}
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-4 text-sm">
          <div className="rounded-lg bg-gray-50 border border-gray-100 p-3">
            <p className="text-xs uppercase tracking-wide text-gray-500 font-semibold">Placed</p>
            <p className="mt-1 text-gray-700">{formatTimestamp(order.createdAt)}</p>
          </div>
          {order.driverName && (
            <div className="rounded-lg bg-gray-50 border border-gray-100 p-3">
              <p className="text-xs uppercase tracking-wide text-gray-500 font-semibold">Crusher</p>
              <p className="mt-1 text-gray-700">{order.driverName}</p>
              {order.assignedAt && <p className="text-xs text-gray-500 mt-1">Accepted {formatTimestamp(order.assignedAt)}</p>}
            </div>
          )}
          {(order.pickedUpAt || order.onTheWayAt || order.deliveredAt) && (
            <div className="rounded-lg bg-gray-50 border border-gray-100 p-3">
              <p className="text-xs uppercase tracking-wide text-gray-500 font-semibold">Delivery Flow</p>
              {order.pickedUpAt && <p className="mt-1 text-gray-700">Picked up {formatTimestamp(order.pickedUpAt)}</p>}
              {order.onTheWayAt && <p className="text-gray-700">On the way {formatTimestamp(order.onTheWayAt)}</p>}
              {order.deliveredAt && <p className="text-gray-700">Delivered {formatTimestamp(order.deliveredAt)}</p>}
            </div>
          )}
        </div>

        <div className="border-t border-gray-200 pt-4 mb-4">
          {order.items.map((item, idx) => (
            <div key={idx} className="flex justify-between text-sm mb-2 gap-4">
              <span>{item.quantity}x {item.name}</span>
              <span>{formatCents(getOrderItemPriceCents(item) * item.quantity)}</span>
            </div>
          ))}
          <div className="border-t border-gray-200 pt-2 mt-2 space-y-2">
            <div className="flex justify-between text-sm">
              <span>Food sales</span>
              <span>{formatCents(subtotalCents)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span>Customer tip</span>
              <span className="text-emerald-600 font-semibold">{formatCents(tipCents)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span>Crusher earnings</span>
              <span>{formatCents(driverPayoutCents)}</span>
            </div>
            <div className="flex justify-between font-semibold">
              <span>Customer total</span>
              <span className="text-[#FF6B35]">{formatCents(totalCents)}</span>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap gap-2 items-center">
          {renderOrderActions(order)}
        </div>
      </div>
    );
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <Toaster position="top-right" />

      <div className="mb-8">
      <h1 className="text-3xl font-bold text-[#2D3142]">
  🍳 Welcome back, {restaurantIdentifiers?.displayName || currentUser?.displayName || currentUser?.email?.split('@')[0] || 'Partner'}
</h1>
        <p className="text-gray-600 mt-2">
          Manage kitchen flow, watch crusher pickup progress, and see deliveries complete live.
        </p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <div className="bg-white rounded-xl p-4 text-center shadow-sm border border-gray-100">
          <p className="text-2xl font-bold text-[#FF6B35]">{openOrders.length}</p>
          <p className="text-xs text-gray-500 mt-1">Open Orders</p>
        </div>
        <div className="bg-white rounded-xl p-4 text-center shadow-sm border border-gray-100">
          <p className="text-2xl font-bold text-[#2D3142]">{pendingOrdersCount}</p>
          <p className="text-xs text-gray-500 mt-1">Pending Orders</p>
        </div>
        <div className="bg-white rounded-xl p-4 text-center shadow-sm border border-gray-100">
          <p className="text-2xl font-bold text-[#2D3142]">{handoffOrders.length}</p>
          <p className="text-xs text-gray-500 mt-1">Ready / In Transit</p>
        </div>
        <div className="bg-white rounded-xl p-4 text-center shadow-sm border border-gray-100">
          <p className="text-2xl font-bold text-[#2D3142]">{deliveredOrders.length}</p>
          <p className="text-xs text-gray-500 mt-1">Delivered</p>
        </div>
      </div>

      <div className="flex space-x-4 mb-8 border-b overflow-x-auto">
        <button
          onClick={() => setActiveTab('orders')}
          className={`px-4 py-2 font-semibold transition whitespace-nowrap ${
            activeTab === 'orders'
              ? 'text-[#FF6B35] border-b-2 border-[#FF6B35]'
              : 'text-gray-500 hover:text-[#FF6B35]'
          }`}
        >
          📦 Orders
        </button>
        <button
          onClick={() => setActiveTab('menu')}
          className={`px-4 py-2 font-semibold transition whitespace-nowrap ${
            activeTab === 'menu'
              ? 'text-[#FF6B35] border-b-2 border-[#FF6B35]'
              : 'text-gray-500 hover:text-[#FF6B35]'
          }`}
        >
          📋 Menu
        </button>
        <button
          onClick={() => setActiveTab('earnings')}
          className={`px-4 py-2 font-semibold transition whitespace-nowrap ${
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
          <section>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold text-[#2D3142]">Open Orders</h2>
              <span className="px-3 py-1 rounded-full bg-yellow-50 text-yellow-700 text-sm font-semibold">
                {openOrders.length}
              </span>
            </div>
            {loadingOrders ? (
              <div className="text-center py-12 bg-gray-50 rounded-lg text-gray-500">
                Loading orders...
              </div>
            ) : openOrders.length === 0 ? (
              <div className="text-center py-12 bg-gray-50 rounded-lg">
                <p className="text-gray-500">No open orders right now.</p>
              </div>
            ) : (
              <div className="space-y-4">{openOrders.map(renderOrderCard)}</div>
            )}
          </section>

          <section>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold text-[#2D3142]">Ready / In Transit</h2>
              <span className="px-3 py-1 rounded-full bg-green-50 text-green-700 text-sm font-semibold">
                {handoffOrders.length}
              </span>
            </div>
            {loadingOrders ? (
              <div className="text-center py-12 bg-gray-50 rounded-lg text-gray-500">
                Loading handoff orders...
              </div>
            ) : handoffOrders.length === 0 ? (
              <div className="text-center py-12 bg-gray-50 rounded-lg">
                <p className="text-gray-500">No ready or in-transit orders yet.</p>
              </div>
            ) : (
              <div className="space-y-4">{handoffOrders.map(renderOrderCard)}</div>
            )}
          </section>

          <section>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold text-[#2D3142]">Completed / Cancelled</h2>
              <span className="px-3 py-1 rounded-full bg-gray-100 text-gray-700 text-sm font-semibold">
                {completedOrders.length}
              </span>
            </div>
            {loadingOrders ? (
              <div className="text-center py-12 bg-gray-50 rounded-lg text-gray-500">
                Loading completed orders...
              </div>
            ) : completedOrders.length === 0 ? (
              <div className="text-center py-12 bg-gray-50 rounded-lg">
                <p className="text-gray-500">No completed orders yet.</p>
              </div>
            ) : (
              <div className="space-y-4">{completedOrders.map(renderOrderCard)}</div>
            )}
          </section>
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
                placeholder="Price"
                value={newItem.price}
                onChange={(e) => setNewItem({ ...newItem, price: e.target.value })}
                className="w-full p-2 border border-gray-300 rounded-lg mb-3"
              />
              <input
                type="text"
                placeholder="Category"
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
              <p className="text-gray-500 text-center py-8">No menu items yet. Add your first item!</p>
            ) : (
              <div className="space-y-3">
                {menuItems.map((item) => (
                  <div key={item.id} className="border-b border-gray-200 pb-3">
                    <div className="flex justify-between gap-4">
                      <div>
                        <h3 className="font-semibold">{item.name}</h3>
                        <p className="text-sm text-gray-600">{item.description}</p>
                        <p className="text-xs text-gray-500">{item.category}</p>
                      </div>
                      <p className="text-[#FF6B35] font-semibold">{formatCents(getMenuItemPriceCents(item))}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {activeTab === 'earnings' && (
        <div className="grid md:grid-cols-2 xl:grid-cols-5 gap-6">
          <div className="bg-white rounded-lg shadow-md p-6">
            <h2 className="text-sm uppercase tracking-wide text-gray-500 font-semibold">Delivered Orders</h2>
            <p className="text-3xl font-bold text-[#2D3142] mt-3">{deliveredOrders.length}</p>
          </div>
          <div className="bg-white rounded-lg shadow-md p-6">
            <h2 className="text-sm uppercase tracking-wide text-gray-500 font-semibold">Delivered Food Sales</h2>
            <p className="text-3xl font-bold text-[#FF6B35] mt-3">{formatCents(deliveredRevenueCents)}</p>
            <p className="text-xs text-gray-500 mt-2">Tips are excluded from restaurant revenue.</p>
          </div>
          <div className="bg-white rounded-lg shadow-md p-6">
            <h2 className="text-sm uppercase tracking-wide text-gray-500 font-semibold">Customer Tips</h2>
            <p className="text-3xl font-bold text-emerald-600 mt-3">{formatCents(deliveredTipCents)}</p>
          </div>
          <div className="bg-white rounded-lg shadow-md p-6">
            <h2 className="text-sm uppercase tracking-wide text-gray-500 font-semibold">Crusher Earnings</h2>
            <p className="text-3xl font-bold text-[#2D3142] mt-3">{formatCents(deliveredCrusherEarningsCents)}</p>
          </div>
          <div className="bg-white rounded-lg shadow-md p-6">
            <h2 className="text-sm uppercase tracking-wide text-gray-500 font-semibold">Average Food Ticket</h2>
            <p className="text-3xl font-bold text-[#2D3142] mt-3">{formatCents(averageDeliveredOrderValueCents)}</p>
          </div>
        </div>
      )}
    </div>
  );
};

export default RestaurantDashboard;
