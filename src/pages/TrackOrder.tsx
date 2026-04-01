import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { doc, getDoc, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase/config';
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

interface FirestoreTimestampLike {
  seconds?: number;
  nanoseconds?: number;
  toDate?: () => Date;
}

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
  tipAmount?: number;
  tipCents?: number;
  totalAmount?: number;
  totalCents?: number;
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

const STATUS_STEPS: OrderStatus[] = [
  'pending',
  'confirmed',
  'preparing',
  'ready',
  'picked_up',
  'on_the_way',
  'delivered',
];

const STATUS_META: Record<
  OrderStatus,
  { label: string; description: string; badgeClass: string; icon: string }
> = {
  pending: {
    label: 'Pending',
    description: 'The restaurant received your order.',
    badgeClass: 'bg-yellow-100 text-yellow-800',
    icon: '🕒',
  },
  confirmed: {
    label: 'Confirmed',
    description: 'Your order has been accepted.',
    badgeClass: 'bg-blue-100 text-blue-800',
    icon: '✅',
  },
  preparing: {
    label: 'Preparing',
    description: 'The kitchen is working on your order.',
    badgeClass: 'bg-purple-100 text-purple-800',
    icon: '👨‍🍳',
  },
  ready: {
    label: 'Ready',
    description: 'Your order is packed and ready for pickup.',
    badgeClass: 'bg-green-100 text-green-800',
    icon: '🎉',
  },
  picked_up: {
    label: 'Picked Up',
    description: 'Your crusher has collected the order from the restaurant.',
    badgeClass: 'bg-sky-100 text-sky-800',
    icon: '🛵',
  },
  on_the_way: {
    label: 'On the Way',
    description: 'Your crusher is heading to your address now.',
    badgeClass: 'bg-orange-100 text-orange-800',
    icon: '🚗',
  },
  delivered: {
    label: 'Delivered',
    description: 'Your order has been completed.',
    badgeClass: 'bg-gray-100 text-gray-800',
    icon: '📦',
  },
  cancelled: {
    label: 'Cancelled',
    description: 'This order was cancelled.',
    badgeClass: 'bg-red-100 text-red-800',
    icon: '❌',
  },
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

const getFirstName = (value?: string | null) => {
  const trimmed = (value || '').trim();
  if (!trimmed) return '';
  return trimmed.split(/\s+/)[0] || '';
};

const getItemPriceCents = (item: OrderItem) => {
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
    (sum, item) => sum + getItemPriceCents(item) * item.quantity,
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

const getOrderTotalCents = (order: Order) => {
  const fromTotalCents = normalizeMoneyToCents(order.totalCents);
  if (fromTotalCents > 0) return fromTotalCents;

  const fromTotalAmount = normalizeMoneyToCents(order.totalAmount);
  if (fromTotalAmount > 0) return fromTotalAmount;

  return getSubtotalCents(order) + getDeliveryFeeCents(order) + getTipCents(order);
};

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

const getDriverJourneyMessage = (order: Order): string | null => {
  if (!order.driverName && !order.driverId) return null;

  if (order.status === 'ready') {
    return `${order.driverName || 'Your crusher'} has accepted the order and is heading to the restaurant for pickup.`;
  }

  if (order.status === 'picked_up') {
    return `${order.driverName || 'Your crusher'} has picked up the order.`;
  }

  if (order.status === 'on_the_way') {
    return `${order.driverName || 'Your crusher'} is on the way to your address.`;
  }

  if (order.status === 'delivered') {
    return `${order.driverName || 'Your crusher'} completed the delivery.`;
  }

  return `${order.driverName || 'Your crusher'} is assigned to this order.`;
};

const TrackOrder = () => {
  const { currentUser } = useAuth();
  const { orderId } = useParams<{ orderId: string }>();
  const resolvedOrderId =
    orderId || localStorage.getItem('dinerscrush_last_order_id') || '';

  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [viewerFirstName, setViewerFirstName] = useState('');

  useEffect(() => {
    if (!resolvedOrderId) {
      setLoading(false);
      setNotFound(true);
      return;
    }

    setLoading(true);
    setNotFound(false);

    const unsubscribe = onSnapshot(
      doc(db, 'orders', resolvedOrderId),
      (snapshot) => {
        if (!snapshot.exists()) {
          setOrder(null);
          setNotFound(true);
          setLoading(false);
          return;
        }

        setOrder({
          id: snapshot.id,
          ...snapshot.data(),
        } as Order);

        setLoading(false);
        setNotFound(false);
      },
      (error) => {
        console.error('Error tracking order:', error);
        setOrder(null);
        setNotFound(true);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [resolvedOrderId]);

  useEffect(() => {
    const loadViewerName = async () => {
      if (!currentUser?.uid) {
        setViewerFirstName('');
        return;
      }
  
      try {
        const userSnap = await getDoc(doc(db, 'users', currentUser.uid));
        if (!userSnap.exists()) {
          setViewerFirstName(getFirstName(currentUser.displayName));
          return;
        }
  
        const data = userSnap.data();
        const profileName =
          typeof data.name === 'string' ? data.name : currentUser.displayName;
  
        setViewerFirstName(getFirstName(profileName));
      } catch (error) {
        console.error('Error loading viewer profile:', error);
        setViewerFirstName(getFirstName(currentUser.displayName));
      }
    };
  
    void loadViewerName();
  }, [currentUser?.uid, currentUser?.displayName]);

  const currentStatus: OrderStatus = order?.status || 'pending';
  const currentMeta = STATUS_META[currentStatus];

  const currentStepIndex = useMemo(() => {
    if (currentStatus === 'cancelled') return -1;
    const idx = STATUS_STEPS.indexOf(currentStatus);
    return idx >= 0 ? idx : 0;
  }, [currentStatus]);

  if (loading) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-12 text-center">
        <p className="text-gray-500">Loading your order...</p>
      </div>
    );
  }

  if (notFound || !order) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-12 text-center">
        <h1 className="text-2xl font-bold text-[#2D3142]">Order not found</h1>
        <p className="text-gray-500 mt-2">
          We couldn’t find that order yet. If you just placed it, wait a second and refresh.
        </p>
        <Link to="/order" className="inline-block mt-6 text-[#FF6B35] font-semibold">
          ← Back to ordering
        </Link>
      </div>
    );
  }

  const subtotalCents = getSubtotalCents(order);
  const deliveryFeeCents = getDeliveryFeeCents(order);
  const tipCents = getTipCents(order);
  const totalCents = getOrderTotalCents(order);
  const driverJourneyMessage = getDriverJourneyMessage(order);

  return (
    <div className="max-w-3xl mx-auto px-4 py-6">
      <Link to="/order" className="text-[#FF6B35] mb-4 inline-flex items-center gap-1">
        ← Back to Crush Kitchens
      </Link>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 mb-6">
        <h1 className="text-2xl font-bold text-[#2D3142]">
          🍽️ Welcome back, {viewerFirstName || getFirstName(order.customerName) || 'Crush'}
        </h1>
        <p className="text-gray-600 mt-2">
          Tracking order <span className="font-semibold">#{order.id.slice(0, 8)}</span>
        </p>
        {order.restaurantName && (
          <p className="text-gray-500 text-sm mt-1">{order.restaurantName}</p>
        )}

        <div
          className={`mt-4 inline-flex items-center gap-2 px-3 py-1 rounded-full text-sm font-semibold ${currentMeta.badgeClass}`}
        >
          <span>{currentMeta.icon}</span>
          <span>{currentMeta.label}</span>
        </div>

        <p className="text-sm text-gray-500 mt-3">{currentMeta.description}</p>

        {driverJourneyMessage && (
          <div className="mt-4 rounded-xl border border-orange-100 bg-orange-50 px-4 py-3">
            <p className="text-sm font-medium text-orange-700">{driverJourneyMessage}</p>
          </div>
        )}
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 mb-6">
        <h2 className="text-lg font-bold text-[#2D3142] mb-4">Order Progress</h2>

        {currentStatus === 'cancelled' ? (
          <div className="rounded-xl border border-red-100 bg-red-50 p-4">
            <p className="font-semibold text-red-700 flex items-center gap-2">
              <span>{STATUS_META.cancelled.icon}</span>
              <span>{STATUS_META.cancelled.label}</span>
            </p>
            <p className="text-sm text-red-600 mt-1">
              {STATUS_META.cancelled.description}
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {STATUS_STEPS.map((step, index) => {
              const meta = STATUS_META[step];
              const isDone = index <= currentStepIndex;
              const isCurrent = currentStatus === step;

              return (
                <div key={step} className="flex items-start gap-3">
                  <div
                    className={`w-9 h-9 rounded-full flex items-center justify-center text-sm ${
                      isDone
                        ? 'bg-[#FF6B35] text-white'
                        : 'bg-gray-200 text-gray-500'
                    }`}
                  >
                    {meta.icon}
                  </div>

                  <div>
                    <p
                      className={`font-semibold ${
                        isCurrent ? 'text-[#FF6B35]' : 'text-[#2D3142]'
                      }`}
                    >
                      {meta.label}
                    </p>
                    <p className="text-sm text-gray-500">{meta.description}</p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 mb-6">
        <h2 className="text-lg font-bold text-[#2D3142] mb-4">Timeline</h2>
        <div className="space-y-3 text-sm text-gray-700">
          <p><span className="font-semibold text-[#2D3142]">Placed:</span> {formatDateTime(order.createdAt)}</p>
          {order.assignedAt && <p><span className="font-semibold text-[#2D3142]">Crusher accepted:</span> {formatDateTime(order.assignedAt)}</p>}
          {order.pickedUpAt && <p><span className="font-semibold text-[#2D3142]">Picked up:</span> {formatDateTime(order.pickedUpAt)}</p>}
          {order.onTheWayAt && <p><span className="font-semibold text-[#2D3142]">On the way:</span> {formatDateTime(order.onTheWayAt)}</p>}
          {order.deliveredAt && <p><span className="font-semibold text-[#2D3142]">Delivered:</span> {formatDateTime(order.deliveredAt)}</p>}
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 mb-6">
        <h2 className="text-lg font-bold text-[#2D3142] mb-4">Items</h2>

        <div className="space-y-3">
          {order.items.map((item, index) => {
            const itemTotalCents = getItemPriceCents(item) * item.quantity;

            return (
              <div key={`${item.name}-${index}`} className="border border-gray-100 rounded-xl p-4">
                <div className="flex justify-between items-start gap-4">
                  <div>
                    <p className="font-semibold text-[#2D3142]">
                      {item.quantity}x {item.name}
                    </p>
                    {item.description && (
                      <p className="text-sm text-gray-500 mt-1">{item.description}</p>
                    )}
                    {item.specialInstructions && (
                      <p className="text-xs text-orange-600 mt-2">
                        Item note: {item.specialInstructions}
                      </p>
                    )}
                  </div>

                  <p className="font-semibold text-[#FF6B35]">
                    {formatCents(itemTotalCents)}
                  </p>
                </div>
              </div>
            );
          })}
        </div>

        {order.orderInstructions && (
          <div className="mt-4 rounded-lg bg-orange-50 border border-orange-100 p-3">
            <p className="text-xs font-semibold text-orange-700 uppercase tracking-wide">
              Delivery Instructions
            </p>
            <p className="text-sm text-orange-700 mt-1">{order.orderInstructions}</p>
          </div>
        )}

        <div className="mt-6 rounded-xl bg-gray-50 border border-gray-200 p-4">
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span>Subtotal</span>
              <span>{formatCents(subtotalCents)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span>Delivery Fee</span>
              <span>{formatCents(deliveryFeeCents)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span>Tip for your crusher</span>
              <span className="text-emerald-600 font-semibold">{formatCents(tipCents)}</span>
            </div>
            <div className="border-t border-gray-200 pt-3 mt-3 flex justify-between font-bold text-lg">
              <span>Total</span>
              <span className="text-[#FF6B35]">{formatCents(totalCents)}</span>
            </div>
          </div>
          <p className="text-xs text-gray-500 mt-3">Tips go 100% to your crusher.</p>
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
        <h2 className="text-lg font-bold text-[#2D3142] mb-4">Delivery Info</h2>
        {order.customerName && <p className="text-gray-700">{order.customerName}</p>}
        {order.customerPhone && <p className="text-gray-700">{order.customerPhone}</p>}
        {order.customerAddress && <p className="text-gray-700">{order.customerAddress}</p>}
        {order.driverName && (
          <p className="text-gray-700 mt-3">Crusher: {order.driverName}</p>
        )}
      </div>
    </div>
  );
};

export default TrackOrder;