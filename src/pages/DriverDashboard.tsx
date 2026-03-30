import { useEffect, useMemo, useState } from 'react';
import {
  collection,
  doc,
  onSnapshot,
  runTransaction,
  setDoc,
  type DocumentData,
} from 'firebase/firestore';
import toast, { Toaster } from 'react-hot-toast';
import { db } from '../firebase/config';
import { useAuth } from '../context/AuthContext';

type OrderStatus =
  | 'pending'
  | 'confirmed'
  | 'preparing'
  | 'ready'
  | 'picked_up'
  | 'delivered'
  | 'cancelled';

type FirestoreTimestampLike = {
  seconds?: number;
  nanoseconds?: number;
  toDate?: () => Date;
};

interface OrderItem {
  name?: string;
  quantity?: number;
  price?: number | string | null;
  priceCents?: number | null;
  displayPrice?: string | null;
}

interface Order {
  id: string;
  restaurantName?: string;
  customerName?: string;
  customerPhone?: string;
  customerAddress?: string;
  address?: string;
  deliveryAddress?: string;
  items?: OrderItem[];
  total?: number | string | null;
  totalAmount?: number | string | null;
  totalCents?: number | null;
  subtotal?: number | string | null;
  subtotalCents?: number | null;
  deliveryFee?: number | string | null;
  deliveryFeeCents?: number | null;
  status?: OrderStatus;
  driverId?: string | null;
  driverName?: string | null;
  createdAt?: FirestoreTimestampLike;
  assignedAt?: FirestoreTimestampLike;
}

interface DriverProfile {
  name: string;
  isAvailable: boolean;
  currentOrderId: string | null;
  rating: number;
  totalDeliveries: number;
}

const normalizeMoneyToCents = (value: unknown): number => {
  if (typeof value === 'number' && Number.isFinite(value)) {
    if (value >= 100 && Number.isInteger(value)) return Math.round(value);
    return Math.round(value * 100);
  }

  if (typeof value !== 'string') return 0;

  const trimmed = value.trim();
  if (!trimmed) return 0;

  const dollarMatch = /\$([0-9]+(?:\.[0-9]{1,2})?)/.exec(trimmed);
  if (dollarMatch?.[1]) {
    return Math.round(Number.parseFloat(dollarMatch[1]) * 100);
  }

  const centMatch = /\b([0-9]+)c\b/i.exec(trimmed);
  if (centMatch?.[1]) {
    return Number.parseInt(centMatch[1], 10);
  }

  const plainNumberMatch = trimmed.match(/\b([0-9]+(?:\.[0-9]{1,2})?)\b/);
  if (!plainNumberMatch?.[1]) return 0;

  const parsed = Number.parseFloat(plainNumberMatch[1]);
  if (!Number.isFinite(parsed)) return 0;
  if (trimmed.includes('.')) return Math.round(parsed * 100);
  if (parsed >= 100) return Math.round(parsed);
  return Math.round(parsed * 100);
};

const formatCents = (cents: number): string => `$${(cents / 100).toFixed(2)}`;

const getTimestampMs = (value: FirestoreTimestampLike | Date | string | null | undefined): number => {
  if (!value) return 0;
  if (value instanceof Date) return value.getTime();
  if (typeof value === 'string') {
    const parsed = Date.parse(value);
    return Number.isNaN(parsed) ? 0 : parsed;
  }
  if (typeof value.toDate === 'function') return value.toDate().getTime();
  if (typeof value.seconds === 'number') return value.seconds * 1000;
  return 0;
};

const formatDateTime = (value: FirestoreTimestampLike | Date | string | null | undefined): string => {
  const ms = getTimestampMs(value);
  if (!ms) return 'Just now';
  return new Date(ms).toLocaleString();
};

const getItemPriceCents = (item: OrderItem): number => {
  if (typeof item.priceCents === 'number' && Number.isFinite(item.priceCents)) {
    return Math.max(0, Math.round(item.priceCents));
  }
  if (typeof item.price === 'number' && Number.isFinite(item.price)) {
    if (item.price >= 100 && Number.isInteger(item.price)) return Math.round(item.price);
    return Math.round(item.price * 100);
  }
  if (typeof item.displayPrice === 'string') {
    return normalizeMoneyToCents(item.displayPrice);
  }
  if (typeof item.price === 'string') {
    return normalizeMoneyToCents(item.price);
  }
  return 0;
};

const getOrderTotalCents = (order: Order): number => {
  if (typeof order.totalCents === 'number' && Number.isFinite(order.totalCents)) {
    return Math.max(0, Math.round(order.totalCents));
  }
  if (typeof order.totalAmount === 'number' && Number.isFinite(order.totalAmount)) {
    if (order.totalAmount >= 100 && Number.isInteger(order.totalAmount)) return Math.round(order.totalAmount);
    return Math.round(order.totalAmount * 100);
  }
  if (typeof order.total === 'number' && Number.isFinite(order.total)) {
    if (order.total >= 100 && Number.isInteger(order.total)) return Math.round(order.total);
    return Math.round(order.total * 100);
  }
  if (typeof order.total === 'string') {
    const normalized = normalizeMoneyToCents(order.total);
    if (normalized > 0) return normalized;
  }
  return (order.items ?? []).reduce((sum, item) => {
    const quantity = Number(item.quantity ?? 0);
    return sum + getItemPriceCents(item) * (Number.isFinite(quantity) ? quantity : 0);
  }, 0);
};

const getCustomerAddress = (order: Order): string =>
  order.customerAddress || order.deliveryAddress || order.address || 'No delivery address provided';

const getDriverDisplayName = (profile: DriverProfile, email: string | null | undefined): string => {
  if (profile.name.trim()) return profile.name.trim();
  if (email) return email.split('@')[0];
  return 'Crusher';
};

const isOpenDriverOrder = (status?: OrderStatus): boolean =>
  status === 'ready' || status === 'picked_up' || status === 'confirmed' || status === 'preparing';

const DriverDashboard = () => {
  const { currentUser, logout } = useAuth();
  const [orders, setOrders] = useState<Order[]>([]);
  const [driverProfile, setDriverProfile] = useState<DriverProfile>({
    name: '',
    isAvailable: true,
    currentOrderId: null,
    rating: 5,
    totalDeliveries: 0,
  });
  const [loading, setLoading] = useState(true);
  const [availabilitySaving, setAvailabilitySaving] = useState(false);
  const [claimingOrderId, setClaimingOrderId] = useState<string | null>(null);
  const [releasingOrderId, setReleasingOrderId] = useState<string | null>(null);

  useEffect(() => {
    if (!currentUser) return;

    const userRef = doc(db, 'users', currentUser.uid);
    const unsubscribeUser = onSnapshot(userRef, (snapshot) => {
      const data = (snapshot.data() ?? {}) as DocumentData;
      setDriverProfile({
        name: typeof data.name === 'string' ? data.name : currentUser.displayName || '',
        isAvailable: typeof data.isAvailable === 'boolean' ? data.isAvailable : true,
        currentOrderId: typeof data.currentOrderId === 'string' ? data.currentOrderId : null,
        rating: typeof data.rating === 'number' ? data.rating : 5,
        totalDeliveries: typeof data.totalDeliveries === 'number' ? data.totalDeliveries : 0,
      });
      setLoading(false);
    });

    const unsubscribeOrders = onSnapshot(collection(db, 'orders'), (snapshot) => {
      const nextOrders = snapshot.docs.map((orderDoc) => ({
        id: orderDoc.id,
        ...(orderDoc.data() as Omit<Order, 'id'>),
      }));

      nextOrders.sort((a, b) => getTimestampMs(b.createdAt) - getTimestampMs(a.createdAt));
      setOrders(nextOrders);
      setLoading(false);
    });

    return () => {
      unsubscribeUser();
      unsubscribeOrders();
    };
  }, [currentUser]);

  const activeOrder = useMemo(() => {
    if (!currentUser) return null;
    return (
      orders.find(
        (order) => order.driverId === currentUser.uid && isOpenDriverOrder(order.status)
      ) ?? null
    );
  }, [orders, currentUser]);

  const availableOrders = useMemo(() => {
    return [...orders]
      .filter((order) => order.status === 'ready' && !order.driverId)
      .sort((a, b) => getTimestampMs(a.createdAt) - getTimestampMs(b.createdAt));
  }, [orders]);

  const historyOrders = useMemo(() => {
    if (!currentUser) return [];
    return orders.filter(
      (order) =>
        order.driverId === currentUser.uid &&
        (order.status === 'delivered' || order.status === 'cancelled')
    );
  }, [orders, currentUser]);

  const todayDeliveredCount = useMemo(() => {
    const today = new Date();
    return historyOrders.filter((order) => {
      if (order.status !== 'delivered') return false;
      const ms = getTimestampMs(order.createdAt);
      if (!ms) return false;
      const orderDate = new Date(ms);
      return (
        orderDate.getFullYear() === today.getFullYear() &&
        orderDate.getMonth() === today.getMonth() &&
        orderDate.getDate() === today.getDate()
      );
    }).length;
  }, [historyOrders]);

  const assignedOpenCount = useMemo(() => {
    if (!currentUser) return 0;
    return orders.filter(
      (order) => order.driverId === currentUser.uid && isOpenDriverOrder(order.status)
    ).length;
  }, [orders, currentUser]);

  const toggleAvailability = async () => {
    if (!currentUser || availabilitySaving) return;

    if (driverProfile.isAvailable && activeOrder) {
      toast.error('Finish or release your current crush before going offline.');
      return;
    }

    const nextAvailability = !driverProfile.isAvailable;
    setAvailabilitySaving(true);
    try {
      await setDoc(
        doc(db, 'users', currentUser.uid),
        { isAvailable: nextAvailability },
        { merge: true }
      );
      toast.success(nextAvailability ? 'You are now online.' : 'You are now offline.');
    } catch {
      toast.error('Failed to update availability.');
    } finally {
      setAvailabilitySaving(false);
    }
  };

  const acceptOrder = async (orderId: string) => {
    if (!currentUser) return;
    if (!driverProfile.isAvailable) {
      toast.error('Go online before accepting a crush.');
      return;
    }
    if (activeOrder && activeOrder.id !== orderId) {
      toast.error('You already have an active crush assigned.');
      return;
    }

    const driverName = getDriverDisplayName(driverProfile, currentUser.email);
    setClaimingOrderId(orderId);

    try {
      await runTransaction(db, async (transaction) => {
        const orderRef = doc(db, 'orders', orderId);
        const userRef = doc(db, 'users', currentUser.uid);
        const [orderSnap, userSnap] = await Promise.all([
          transaction.get(orderRef),
          transaction.get(userRef),
        ]);

        if (!orderSnap.exists()) {
          throw new Error('This order no longer exists.');
        }

        const orderData = orderSnap.data() as DocumentData;
        if (orderData.status !== 'ready') {
          throw new Error('This order is no longer ready for pickup.');
        }
        if (orderData.driverId && orderData.driverId !== currentUser.uid) {
          throw new Error('Another driver already accepted this order.');
        }

        const currentOrderId = typeof userSnap.data()?.currentOrderId === 'string'
          ? userSnap.data()?.currentOrderId
          : null;
        if (currentOrderId && currentOrderId !== orderId) {
          throw new Error('You already have an active crush assigned.');
        }

        transaction.set(
          orderRef,
          {
            driverId: currentUser.uid,
            driverName,
            assignedAt: new Date(),
          },
          { merge: true }
        );

        transaction.set(
          userRef,
          {
            isAvailable: true,
            currentOrderId: orderId,
            name: driverName,
          },
          { merge: true }
        );
      });

      toast.success('Crush accepted. It is now assigned to you.');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to accept order.');
    } finally {
      setClaimingOrderId(null);
    }
  };

  const releaseOrder = async (orderId: string) => {
    if (!currentUser) return;

    setReleasingOrderId(orderId);
    try {
      await runTransaction(db, async (transaction) => {
        const orderRef = doc(db, 'orders', orderId);
        const userRef = doc(db, 'users', currentUser.uid);
        const orderSnap = await transaction.get(orderRef);

        if (!orderSnap.exists()) {
          throw new Error('This order no longer exists.');
        }

        const orderData = orderSnap.data() as DocumentData;
        if (orderData.driverId !== currentUser.uid) {
          throw new Error('This crush is no longer assigned to you.');
        }
        if (orderData.status === 'delivered' || orderData.status === 'cancelled') {
          throw new Error('Completed crushes cannot be released.');
        }

        transaction.set(
          orderRef,
          {
            driverId: null,
            driverName: null,
            assignedAt: null,
          },
          { merge: true }
        );

        transaction.set(
          userRef,
          {
            currentOrderId: null,
          },
          { merge: true }
        );
      });

      toast.success('Crush released back to the queue.');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to release order.');
    } finally {
      setReleasingOrderId(null);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <Toaster position="top-center" />

      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-bold text-[#2D3142]">⚡ Crusher Hub</h1>
          <p className="text-gray-600 mt-1">
            Claim ready orders, manage your active crush, and stay synced in real time.
          </p>
        </div>
        <button
          onClick={logout}
          className="text-gray-500 hover:text-red-500 transition text-sm self-start sm:self-auto"
        >
          🚪 Sign Out
        </button>
      </div>

      <div className="bg-gradient-to-r from-[#FF6B35] to-orange-500 rounded-2xl p-6 mb-8 text-white shadow-sm">
        <div className="flex flex-col md:flex-row md:justify-between md:items-center gap-4">
          <div>
            <p className="text-sm opacity-90">Current Status</p>
            <p className="text-2xl font-bold">
              {driverProfile.isAvailable ? '🟢 Crushing It' : '⚡ Taking a Break'}
            </p>
            <p className="text-sm opacity-80 mt-1">
              {driverProfile.isAvailable
                ? 'You can now see and accept ready deliveries.'
                : 'Go online to receive available crushes.'}
            </p>
          </div>
          <button
            onClick={toggleAvailability}
            disabled={availabilitySaving}
            className={`px-5 py-2 rounded-xl font-semibold transition disabled:opacity-60 disabled:cursor-not-allowed ${
              driverProfile.isAvailable
                ? 'bg-white text-[#FF6B35] hover:bg-orange-50'
                : 'bg-[#2D3142] text-white hover:bg-gray-800'
            }`}
          >
            {availabilitySaving
              ? 'Saving...'
              : driverProfile.isAvailable
                ? 'Go Offline'
                : 'Go Online'}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <div className="bg-white rounded-xl p-4 text-center shadow-sm border border-gray-100">
          <p className="text-2xl font-bold text-[#FF6B35]">{availableOrders.length}</p>
          <p className="text-xs text-gray-500 mt-1">Ready to Claim</p>
        </div>
        <div className="bg-white rounded-xl p-4 text-center shadow-sm border border-gray-100">
          <p className="text-2xl font-bold text-[#2D3142]">{assignedOpenCount}</p>
          <p className="text-xs text-gray-500 mt-1">My Active Crushes</p>
        </div>
        <div className="bg-white rounded-xl p-4 text-center shadow-sm border border-gray-100">
          <p className="text-2xl font-bold text-[#2D3142]">{todayDeliveredCount}</p>
          <p className="text-xs text-gray-500 mt-1">Delivered Today</p>
        </div>
        <div className="bg-white rounded-xl p-4 text-center shadow-sm border border-gray-100">
          <p className="text-2xl font-bold text-[#2D3142]">{driverProfile.rating.toFixed(1)}</p>
          <p className="text-xs text-gray-500 mt-1">Crusher Rating ★</p>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[1.05fr_1.2fr] gap-6">
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-[#2D3142]">🛵 My Active Crush</h2>
            {activeOrder && (
              <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-orange-100 text-orange-700">
                Assigned
              </span>
            )}
          </div>

          {loading ? (
            <div className="text-center py-12 text-gray-400">Loading your dashboard...</div>
          ) : activeOrder ? (
            <div className="rounded-2xl border border-orange-100 bg-orange-50/40 p-5">
              <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-3">
                <div>
                  <p className="text-xl font-bold text-[#2D3142]">{activeOrder.restaurantName || 'Restaurant order'}</p>
                  <p className="text-sm text-gray-600 mt-1">For {activeOrder.customerName || 'Customer'}</p>
                </div>
                <div className="text-left sm:text-right">
                  <p className="text-sm text-gray-500">Order total</p>
                  <p className="text-lg font-bold text-[#FF6B35]">{formatCents(getOrderTotalCents(activeOrder))}</p>
                </div>
              </div>

              <div className="mt-4 space-y-2 text-sm text-gray-700">
                <p><span className="font-semibold text-[#2D3142]">Address:</span> {getCustomerAddress(activeOrder)}</p>
                {activeOrder.customerPhone && (
                  <p><span className="font-semibold text-[#2D3142]">Phone:</span> {activeOrder.customerPhone}</p>
                )}
                <p><span className="font-semibold text-[#2D3142]">Placed:</span> {formatDateTime(activeOrder.createdAt)}</p>
              </div>

              <div className="mt-4">
                <p className="text-sm font-semibold text-[#2D3142] mb-2">Items</p>
                <div className="space-y-2">
                  {(activeOrder.items ?? []).map((item, index) => (
                    <div
                      key={`${activeOrder.id}-${item.name ?? 'item'}-${index}`}
                      className="flex items-center justify-between rounded-xl bg-white border border-gray-100 px-3 py-2"
                    >
                      <div>
                        <p className="font-medium text-[#2D3142]">{item.quantity || 1}× {item.name || 'Item'}</p>
                      </div>
                      <p className="text-sm font-semibold text-[#FF6B35]">
                        {formatCents(getItemPriceCents(item) * Math.max(1, Number(item.quantity ?? 1)))}
                      </p>
                    </div>
                  ))}
                </div>
              </div>

              <div className="mt-5 flex flex-wrap gap-3">
                <button
                  onClick={() => releaseOrder(activeOrder.id)}
                  disabled={releasingOrderId === activeOrder.id}
                  className="px-4 py-2 rounded-xl border border-red-200 text-red-600 font-semibold hover:bg-red-50 transition disabled:opacity-60"
                >
                  {releasingOrderId === activeOrder.id ? 'Releasing...' : 'Release Order'}
                </button>
                <p className="text-xs text-gray-500 self-center">
                  Next step after this: add pickup and delivered driver actions.
                </p>
              </div>
            </div>
          ) : (
            <div className="text-center py-12">
              <p className="text-gray-400 text-lg">No active crush assigned</p>
              <p className="text-sm text-gray-400 mt-2">Accept a ready order from the queue when you are online.</p>
            </div>
          )}
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-[#2D3142]">🍽️ Available Crushes</h2>
            <span className="text-xs font-semibold px-3 py-1 rounded-full bg-gray-100 text-gray-600">
              Ready orders only
            </span>
          </div>

          {!driverProfile.isAvailable ? (
            <div className="text-center py-12">
              <p className="text-gray-400 text-lg">You are offline</p>
              <p className="text-sm text-gray-400 mt-2">Go online to see available deliveries.</p>
            </div>
          ) : loading ? (
            <div className="text-center py-12 text-gray-400">Loading available crushes...</div>
          ) : availableOrders.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-gray-400 text-lg">No crushes right now</p>
              <p className="text-sm text-gray-400 mt-2">Stay online — ready orders will appear here automatically.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {availableOrders.map((order) => {
                const itemCount = (order.items ?? []).reduce(
                  (sum, item) => sum + Math.max(1, Number(item.quantity ?? 1)),
                  0
                );

                return (
                  <div
                    key={order.id}
                    className="rounded-2xl border border-gray-100 bg-gray-50/70 p-5 hover:border-orange-200 transition"
                  >
                    <div className="flex flex-col md:flex-row md:justify-between md:items-start gap-4">
                      <div>
                        <p className="text-xl font-bold text-[#2D3142]">{order.restaurantName || 'Restaurant order'}</p>
                        <p className="text-sm text-gray-600 mt-1">Customer: {order.customerName || 'Customer'}</p>
                        <p className="text-sm text-gray-500 mt-2">📍 {getCustomerAddress(order)}</p>
                        {order.customerPhone && (
                          <p className="text-sm text-gray-500 mt-1">📞 {order.customerPhone}</p>
                        )}
                      </div>

                      <div className="text-left md:text-right min-w-[140px]">
                        <p className="text-sm text-gray-500">Order total</p>
                        <p className="text-xl font-bold text-[#FF6B35]">{formatCents(getOrderTotalCents(order))}</p>
                        <p className="text-xs text-gray-500 mt-2">Placed {formatDateTime(order.createdAt)}</p>
                      </div>
                    </div>

                    <div className="mt-4 flex flex-wrap gap-2">
                      <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-orange-100 text-orange-700">
                        {itemCount} item{itemCount === 1 ? '' : 's'}
                      </span>
                      <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-green-100 text-green-700">
                        Ready for pickup
                      </span>
                    </div>

                    <div className="mt-4 space-y-2">
                      {(order.items ?? []).slice(0, 3).map((item, index) => (
                        <div
                          key={`${order.id}-${item.name ?? 'item'}-${index}`}
                          className="flex items-center justify-between text-sm text-gray-700 bg-white rounded-xl px-3 py-2 border border-gray-100"
                        >
                          <span>{item.quantity || 1}× {item.name || 'Item'}</span>
                          <span className="font-semibold text-[#2D3142]">
                            {formatCents(getItemPriceCents(item) * Math.max(1, Number(item.quantity ?? 1)))}
                          </span>
                        </div>
                      ))}
                      {(order.items ?? []).length > 3 && (
                        <p className="text-xs text-gray-500 px-1">
                          + {(order.items ?? []).length - 3} more item{(order.items ?? []).length - 3 === 1 ? '' : 's'}
                        </p>
                      )}
                    </div>

                    <div className="mt-5 flex justify-end">
                      <button
                        onClick={() => acceptOrder(order.id)}
                        disabled={claimingOrderId === order.id || !!activeOrder}
                        className="bg-[#FF6B35] text-white px-5 py-2.5 rounded-xl font-semibold hover:bg-orange-600 transition disabled:opacity-60 disabled:cursor-not-allowed"
                      >
                        {claimingOrderId === order.id
                          ? 'Accepting...'
                          : activeOrder && activeOrder.id !== order.id
                            ? 'Finish current crush first'
                            : 'Accept Delivery'}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      <div className="mt-6 bg-white rounded-xl shadow-sm border border-gray-100 p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-[#2D3142]">📜 Crush History</h2>
          <span className="text-xs font-semibold px-3 py-1 rounded-full bg-gray-100 text-gray-600">
            {historyOrders.length} total
          </span>
        </div>

        {loading ? (
          <div className="text-center py-8 text-gray-400">Loading history...</div>
        ) : historyOrders.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-gray-400 text-sm">No delivery history yet</p>
            <p className="text-xs text-gray-400 mt-1">Completed crushes will appear here.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {historyOrders.map((order) => (
              <div
                key={order.id}
                className="rounded-xl border border-gray-100 p-4 flex flex-col md:flex-row md:justify-between md:items-center gap-3"
              >
                <div>
                  <p className="font-semibold text-[#2D3142]">{order.restaurantName || 'Restaurant order'}</p>
                  <p className="text-sm text-gray-500">{order.customerName || 'Customer'}</p>
                  <p className="text-xs text-gray-400 mt-1">{formatDateTime(order.createdAt)}</p>
                </div>
                <div className="flex items-center gap-3">
                  <span
                    className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold ${
                      order.status === 'delivered'
                        ? 'bg-green-100 text-green-700'
                        : 'bg-red-100 text-red-700'
                    }`}
                  >
                    {order.status === 'delivered' ? 'Delivered' : 'Cancelled'}
                  </span>
                  <p className="font-bold text-[#FF6B35]">{formatCents(getOrderTotalCents(order))}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default DriverDashboard;
