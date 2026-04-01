import { useEffect, useMemo, useRef, useState } from 'react';
import {
  collection,
  doc,
  onSnapshot,
  query,
  runTransaction,
  setDoc,
  where,
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
  | 'on_the_way'
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
  restaurantId?: string | null;
  restaurantDocId?: string | null;
  restaurantName?: string;
  restaurantAddress?: string | null;
  restaurantPhone?: string | null;
  customerName?: string;
  customerPhone?: string;
  customerAddress?: string;
  address?: string;
  deliveryAddress?: string;
  items?: OrderItem[];
  total?: number | string | null;
  totalAmount?: number | string | null;
  totalCents?: number | null;
  deliveryFee?: number | string | null;
  deliveryFeeAmount?: number | string | null;
  deliveryFeeCents?: number | null;
  tip?: number | string | null;
  tipAmount?: number | string | null;
  tipCents?: number | null;
  baseDriverPayout?: number | string | null;
  baseDriverPayoutAmount?: number | string | null;
  baseDriverPayoutCents?: number | null;
  driverPayout?: number | string | null;
  driverPayoutAmount?: number | string | null;
  driverPayoutCents?: number | null;
  declinedByDriverIds?: string[] | null;
  status?: OrderStatus;
  driverId?: string | null;
  driverName?: string | null;
  createdAt?: FirestoreTimestampLike | Date | string | null;
  assignedAt?: FirestoreTimestampLike | Date | string | null;
  pickedUpAt?: FirestoreTimestampLike | Date | string | null;
  onTheWayAt?: FirestoreTimestampLike | Date | string | null;
  deliveredAt?: FirestoreTimestampLike | Date | string | null;
}

interface DriverProfile {
  name: string;
  isAvailable: boolean;
  currentOrderId: string | null;
  rating: number;
  totalDeliveries: number;
}

interface RestaurantRecord {
  id: string;
  lookupIds?: string[];
  name?: string;
  restaurantName?: string;
  address?: string;
  phone?: string;
}

const READY_STATUS: OrderStatus = 'ready';
const DEFAULT_DRIVER_BASE_PAYOUT_CENTS = 500;

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
  if (typeof item.displayPrice === 'string') return normalizeMoneyToCents(item.displayPrice);
  if (typeof item.price === 'string') return normalizeMoneyToCents(item.price);
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

const getTipCents = (order: Order): number =>
  normalizeMoneyToCents(order.tipCents ?? order.tipAmount ?? order.tip);

const getBaseDriverPayoutCents = (order: Order): number => {
  const explicitBase = normalizeMoneyToCents(
    order.baseDriverPayoutCents ?? order.baseDriverPayoutAmount ?? order.baseDriverPayout
  );
  if (explicitBase > 0) return explicitBase;

  const deliveryFeePayout = normalizeMoneyToCents(
    order.deliveryFeeCents ?? order.deliveryFeeAmount ?? order.deliveryFee
  );
  if (deliveryFeePayout > 0) return deliveryFeePayout;

  return DEFAULT_DRIVER_BASE_PAYOUT_CENTS;
};

const getDriverPayoutCents = (order: Order): number => {
  const explicitPayout = normalizeMoneyToCents(
    order.driverPayoutCents ?? order.driverPayoutAmount ?? order.driverPayout
  );
  if (explicitPayout > 0) return explicitPayout;

  return getBaseDriverPayoutCents(order) + getTipCents(order);
};

const getCustomerAddress = (order: Order): string =>
  order.customerAddress || order.deliveryAddress || order.address || 'No delivery address provided';

const buildMapsUrl = (address: string): string =>
  `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`;

const getDriverDisplayName = (profile: DriverProfile, email: string | null | undefined): string => {
  if (profile.name.trim()) return profile.name.trim();
  if (email) return email.split('@')[0];
  return 'Crusher';
};

const isActiveDriverStatus = (status?: OrderStatus): boolean =>
  status === 'ready' || status === 'picked_up' || status === 'on_the_way';

const getStatusLabel = (status?: OrderStatus): string => {
  switch (status) {
    case 'pending':
      return 'Pending';
    case 'confirmed':
      return 'Confirmed';
    case 'preparing':
      return 'Preparing';
    case 'ready':
      return 'Ready for pickup';
    case 'picked_up':
      return 'Picked up';
    case 'on_the_way':
      return 'On the way';
    case 'delivered':
      return 'Delivered';
    case 'cancelled':
      return 'Cancelled';
    default:
      return 'Unknown';
  }
};

const getStatusBadgeClass = (status?: OrderStatus): string => {
  switch (status) {
    case 'ready':
      return 'bg-green-100 text-green-700';
    case 'picked_up':
      return 'bg-blue-100 text-blue-700';
    case 'on_the_way':
      return 'bg-orange-100 text-orange-700';
    case 'delivered':
      return 'bg-gray-100 text-gray-700';
    case 'cancelled':
      return 'bg-red-100 text-red-700';
    default:
      return 'bg-gray-100 text-gray-700';
  }
};

const DriverDashboard = () => {
  const { currentUser, logout } = useAuth();
  const [orders, setOrders] = useState<Order[]>([]);
  const [restaurantsById, setRestaurantsById] = useState<Record<string, RestaurantRecord>>({});
  const [restaurantsByName, setRestaurantsByName] = useState<Record<string, RestaurantRecord>>({});
  const [driverProfile, setDriverProfile] = useState<DriverProfile>({
    name: '',
    isAvailable: true,
    currentOrderId: null,
    rating: 5,
    totalDeliveries: 0,
  });
  const [loading, setLoading] = useState(true);
  const [availabilitySaving, setAvailabilitySaving] = useState(false);
  const [notificationPermission, setNotificationPermission] = useState<NotificationPermission | 'unsupported'>(
    typeof window !== 'undefined' && 'Notification' in window ? window.Notification.permission : 'unsupported'
  );
  const [claimingOrderId, setClaimingOrderId] = useState<string | null>(null);
  const [decliningOrderId, setDecliningOrderId] = useState<string | null>(null);
  const [releasingOrderId, setReleasingOrderId] = useState<string | null>(null);
  const [statusActionOrderId, setStatusActionOrderId] = useState<string | null>(null);
  const notifiedReadyOrderIdsRef = useRef<Set<string>>(new Set());
  type DriverAccordionSection = 'pickup' | 'dropoff' | 'items' | null;
  const [openSectionsByOrder, setOpenSectionsByOrder] = useState<Record<string, DriverAccordionSection>>({});

  const toggleOrderSection = (
    orderKey: string,
    section: Exclude<DriverAccordionSection, null>
  ) => {
    setOpenSectionsByOrder((prev) => ({
      ...prev,
      [orderKey]: prev[orderKey] === section ? null : section,
    }));
  };

  const getOpenSection = (
    orderKey: string,
    defaultSection: DriverAccordionSection = null
  ): DriverAccordionSection => (
    Object.prototype.hasOwnProperty.call(openSectionsByOrder, orderKey)
      ? openSectionsByOrder[orderKey]
      : defaultSection
  );

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

    const normalizeRestaurantRecord = (
      sourceId: string,
      data: DocumentData,
      extraLookupIds: string[] = []
    ): RestaurantRecord => {
      const lookupIds = Array.from(
        new Set(
          [sourceId, ...extraLookupIds].filter(
            (value): value is string => typeof value === 'string' && value.trim().length > 0
          )
        )
      );

      return {
        id: sourceId,
        lookupIds,
        name:
          (typeof data.name === 'string' && data.name.trim()) ||
          (typeof data.restaurantName === 'string' && data.restaurantName.trim()) ||
          '',
        restaurantName:
          (typeof data.restaurantName === 'string' && data.restaurantName.trim()) ||
          (typeof data.name === 'string' && data.name.trim()) ||
          '',
        address:
          (typeof data.address === 'string' && data.address.trim()) ||
          (typeof data.restaurantAddress === 'string' && data.restaurantAddress.trim()) ||
          (typeof data.businessAddress === 'string' && data.businessAddress.trim()) ||
          (typeof data.location === 'string' && data.location.trim()) ||
          (typeof data.streetAddress === 'string' && data.streetAddress.trim()) ||
          '',
        phone:
          (typeof data.phone === 'string' && data.phone.trim()) ||
          (typeof data.restaurantPhone === 'string' && data.restaurantPhone.trim()) ||
          (typeof data.businessPhone === 'string' && data.businessPhone.trim()) ||
          '',
      };
    };

    let restaurantCollectionRecords: RestaurantRecord[] = [];
    let restaurantUserRecords: RestaurantRecord[] = [];

    const syncRestaurantMaps = () => {
      const byId: Record<string, RestaurantRecord> = {};
      const byName: Record<string, RestaurantRecord> = {};

      [...restaurantCollectionRecords, ...restaurantUserRecords].forEach((record) => {
        const ids = record.lookupIds?.length ? record.lookupIds : [record.id];

        ids.forEach((lookupId) => {
          if (lookupId) byId[lookupId] = record;
        });

        const nameKey = (record.name || record.restaurantName || '').trim().toLowerCase();
        if (nameKey) byName[nameKey] = record;
      });

      setRestaurantsById(byId);
      setRestaurantsByName(byName);
    };

    const unsubscribeRestaurants = onSnapshot(collection(db, 'restaurants'), (snapshot) => {
      restaurantCollectionRecords = snapshot.docs.map((restaurantDoc) =>
        normalizeRestaurantRecord(restaurantDoc.id, restaurantDoc.data() as DocumentData)
      );

      syncRestaurantMaps();
    });

    const unsubscribeRestaurantUsers = onSnapshot(
      query(collection(db, 'users'), where('role', '==', 'restaurant')),
      (snapshot) => {
        restaurantUserRecords = snapshot.docs.map((userDoc) => {
          const data = userDoc.data() as DocumentData;

          return normalizeRestaurantRecord(userDoc.id, data, [
            typeof data.restaurantId === 'string' ? data.restaurantId : '',
          ]);
        });

        syncRestaurantMaps();
      }
    );

    return () => {
      unsubscribeUser();
      unsubscribeOrders();
      unsubscribeRestaurants();
      unsubscribeRestaurantUsers();
    };

  }, [currentUser]);

  useEffect(() => {
    if (typeof window === 'undefined' || !('Notification' in window)) return;
    setNotificationPermission(window.Notification.permission);
  }, []);

  const requestBrowserNotifications = async () => {
    if (typeof window === 'undefined' || !('Notification' in window)) {
      toast.error('Browser notifications are not supported here.');
      return;
    }

    const permission = await window.Notification.requestPermission();
    setNotificationPermission(permission);

    if (permission === 'granted') {
      toast.success('Browser alerts enabled for new crushes.');
    } else {
      toast.error('Browser alerts were blocked.');
    }
  };

  const activeOrder = useMemo(() => {
    if (!currentUser) return null;
    return (
      orders.find(
        (order) => order.driverId === currentUser.uid && isActiveDriverStatus(order.status)
      ) ?? null
    );
  }, [orders, currentUser]);

  const availableOrders = useMemo(() => {
    return [...orders]
      .filter((order) => {
        if (order.status !== READY_STATUS || order.driverId) return false;
        if (!currentUser?.uid) return true;
        const declinedIds = Array.isArray(order.declinedByDriverIds)
          ? order.declinedByDriverIds.filter((value): value is string => typeof value === 'string')
          : [];
        return !declinedIds.includes(currentUser.uid);
      })
      .sort((a, b) => getTimestampMs(a.createdAt) - getTimestampMs(b.createdAt));
  }, [orders, currentUser?.uid]);

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
      const ms = getTimestampMs(order.deliveredAt || order.createdAt);
      if (!ms) return false;
      const deliveredDate = new Date(ms);
      return (
        deliveredDate.getFullYear() === today.getFullYear() &&
        deliveredDate.getMonth() === today.getMonth() &&
        deliveredDate.getDate() === today.getDate()
      );
    }).length;
  }, [historyOrders]);

  const todayDriverPayoutCents = useMemo(() => {
    const today = new Date();
    return historyOrders.reduce((sum, order) => {
      if (order.status !== 'delivered') return sum;
      const ms = getTimestampMs(order.deliveredAt || order.createdAt);
      if (!ms) return sum;
      const deliveredDate = new Date(ms);
      const isToday =
        deliveredDate.getFullYear() === today.getFullYear() &&
        deliveredDate.getMonth() === today.getMonth() &&
        deliveredDate.getDate() === today.getDate();
      return isToday ? sum + getDriverPayoutCents(order) : sum;
    }, 0);
  }, [historyOrders]);

  const assignedOpenCount = useMemo(() => {
    if (!currentUser) return 0;
    return orders.filter(
      (order) => order.driverId === currentUser.uid && isActiveDriverStatus(order.status)
    ).length;
  }, [orders, currentUser]);

  const getRestaurantRecord = (order: Order): RestaurantRecord | null => {
    if (order.restaurantDocId && restaurantsById[order.restaurantDocId]) {
      return restaurantsById[order.restaurantDocId];
    }
    if (order.restaurantId && restaurantsById[order.restaurantId]) {
      return restaurantsById[order.restaurantId];
    }
    const nameKey = (order.restaurantName || '').trim().toLowerCase();
    if (nameKey && restaurantsByName[nameKey]) {
      return restaurantsByName[nameKey];
    }
    return null;
  };

  const getRestaurantAddress = (order: Order): string => {
    const restaurantRecord = getRestaurantRecord(order) as
      | (RestaurantRecord & {
          restaurantAddress?: string;
          businessAddress?: string;
          location?: string;
          streetAddress?: string;
        })
      | null;
  
    return (
      [
        order.restaurantAddress,
        restaurantRecord?.address,
        restaurantRecord?.restaurantAddress,
        restaurantRecord?.businessAddress,
        restaurantRecord?.location,
        restaurantRecord?.streetAddress,
      ].find((value): value is string => typeof value === 'string' && value.trim().length > 0)?.trim() || ''
    );
  };

  const getRestaurantPhone = (order: Order): string => {
    const inlinePhone = (order.restaurantPhone || '').trim();
    if (inlinePhone) return inlinePhone;
    return getRestaurantRecord(order)?.phone?.trim() || '';
  };

  useEffect(() => {
    if (!driverProfile.isAvailable) {
      notifiedReadyOrderIdsRef.current = new Set(availableOrders.map((order) => order.id));
      return;
    }

    const previousIds = notifiedReadyOrderIdsRef.current;
    const nextIds = new Set(availableOrders.map((order) => order.id));
    const newlyAvailable = availableOrders.filter((order) => !previousIds.has(order.id));

    if (newlyAvailable.length > 0) {
      const latestOrder = newlyAvailable[0];
      const restaurantName = latestOrder.restaurantName || 'A restaurant';
      toast.success(`New crush ready from ${restaurantName}`);

      if (
        typeof window !== 'undefined' &&
        'Notification' in window &&
        notificationPermission === 'granted' &&
        document.visibilityState !== 'visible'
      ) {
        new window.Notification('New crush ready', {
          body: `${restaurantName} has an order ready for pickup.`,
        });
      }
    }

    notifiedReadyOrderIdsRef.current = nextIds;
  }, [availableOrders, driverProfile.isAvailable, notificationPermission]);

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
        if (orderData.status !== READY_STATUS) {
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
            updatedAt: new Date(),
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

      toast.success('Crush accepted. Navigate to the restaurant for pickup.');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to accept order.');
    } finally {
      setClaimingOrderId(null);
    }
  };

  const declineOrder = async (orderId: string) => {
    if (!currentUser) return;

    setDecliningOrderId(orderId);
    try {
      await runTransaction(db, async (transaction) => {
        const orderRef = doc(db, 'orders', orderId);
        const orderSnap = await transaction.get(orderRef);

        if (!orderSnap.exists()) {
          throw new Error('This order no longer exists.');
        }

        const orderData = orderSnap.data() as DocumentData;
        if (orderData.status !== READY_STATUS) {
          throw new Error('This order is no longer ready for pickup.');
        }
        if (orderData.driverId) {
          throw new Error('Another crusher already accepted this order.');
        }

        const declinedIds = Array.isArray(orderData.declinedByDriverIds)
          ? orderData.declinedByDriverIds.filter((value: unknown): value is string => typeof value === 'string')
          : [];

        if (!declinedIds.includes(currentUser.uid)) {
          transaction.set(
            orderRef,
            {
              declinedByDriverIds: [...declinedIds, currentUser.uid],
              updatedAt: new Date(),
            },
            { merge: true }
          );
        }
      });

      toast.success('Order declined. We removed it from your queue.');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to decline order.');
    } finally {
      setDecliningOrderId(null);
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
        if (orderData.status !== READY_STATUS) {
          throw new Error('You can only release a crush before pickup.');
        }

        transaction.set(
          orderRef,
          {
            driverId: null,
            driverName: null,
            assignedAt: null,
            updatedAt: new Date(),
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

  const updateDriverOrderStatus = async (orderId: string, nextStatus: OrderStatus) => {
    if (!currentUser) return;

    setStatusActionOrderId(orderId);
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
        if (orderData.driverId !== currentUser.uid) {
          throw new Error('This crush is not assigned to you.');
        }

        const currentStatus = orderData.status as OrderStatus | undefined;
        const patch: Record<string, unknown> = {
          status: nextStatus,
          updatedAt: new Date(),
        };

        if (nextStatus === 'picked_up') {
          if (currentStatus !== 'ready') {
            throw new Error('Pickup can only happen after the order is ready.');
          }
          patch.pickedUpAt = new Date();
        }

        if (nextStatus === 'on_the_way') {
          if (currentStatus !== 'picked_up') {
            throw new Error('Mark pickup first before going on the way.');
          }
          patch.onTheWayAt = new Date();
        }

        if (nextStatus === 'delivered') {
          if (currentStatus !== 'on_the_way' && currentStatus !== 'picked_up') {
            throw new Error('You can only mark delivered after pickup.');
          }
          patch.deliveredAt = new Date();
        }

        transaction.set(orderRef, patch, { merge: true });

        const userPatch: Record<string, unknown> = {};
        if (nextStatus === 'delivered') {
          userPatch.currentOrderId = null;
          userPatch.totalDeliveries = (typeof userSnap.data()?.totalDeliveries === 'number'
            ? userSnap.data()?.totalDeliveries
            : 0) + 1;
        }

        if (Object.keys(userPatch).length > 0) {
          transaction.set(userRef, userPatch, { merge: true });
        }
      });

      if (nextStatus === 'picked_up') toast.success('Picked up. Head to the customer now.');
      if (nextStatus === 'on_the_way') toast.success('Customer notified: order is on the way.');
      if (nextStatus === 'delivered') toast.success('Delivery completed successfully.');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to update delivery status.');
    } finally {
      setStatusActionOrderId(null);
    }
  };

  const renderNavigateButton = (label: string, address: string, className: string) => {
    if (!address || address.toLowerCase().includes('unavailable')) return null;
    return (
      <a
        href={buildMapsUrl(address)}
        target="_blank"
        rel="noreferrer"
        className={className}
      >
        {label}
      </a>
    );
  };

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <Toaster position="top-center" />

      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-bold text-[#2D3142]">
            ⚡ Welcome back, {driverProfile.name || currentUser?.displayName || currentUser?.email?.split('@')[0] || 'Crusher'}
          </h1>
          <p className="text-gray-600 mt-1">
            Claim ready orders, drive to pickup, head to the crush, and close out delivery live.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {notificationPermission !== 'granted' && notificationPermission !== 'unsupported' && (
            <button
              onClick={requestBrowserNotifications}
              className="px-4 py-2 rounded-xl border border-[#FF6B35] text-[#FF6B35] font-semibold hover:bg-orange-50 transition"
            >
              Enable Alerts
            </button>
          )}
          <button
            onClick={logout}
            className="text-gray-500 hover:text-red-500 transition text-sm self-start sm:self-auto"
          >
            🚪 Sign Out
          </button>
        </div>
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
                ? 'Ready orders will appear here in real time.'
                : 'Go online to receive available crushes.'}
            </p>
          </div>
          <button
            onClick={toggleAvailability}
            disabled={availabilitySaving}
            className={`px-5 py-2 rounded-xl font-semibold transition disabled:opacity-60 disabled:cursor-not-allowed ${driverProfile.isAvailable
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
          <p className="text-xs text-gray-500 mt-1">Crushed Today</p>
        </div>
        <div className="bg-white rounded-xl p-4 text-center shadow-sm border border-gray-100">
          <p className="text-2xl font-bold text-[#2D3142]">{formatCents(todayDriverPayoutCents)}</p>
          <p className="text-xs text-gray-500 mt-1">Today's Payout</p>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[1.05fr_1.2fr] gap-6">
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-[#2D3142]">🛵 My Active Crush</h2>
            {activeOrder && (
              <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold ${getStatusBadgeClass(activeOrder.status)}`}>
                {getStatusLabel(activeOrder.status)}
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
                  {activeOrder.driverName && (
                    <p className="text-xs text-gray-500 mt-1">Assigned to {activeOrder.driverName}</p>
                  )}
                </div>
                <div className="text-left sm:text-right">
                  <p className="text-sm text-gray-500">Customer Total</p>
                  <p className="text-lg font-bold text-[#FF6B35]">{formatCents(getOrderTotalCents(activeOrder))}</p>
                  <p className="text-sm text-gray-500 mt-2">Base Pay</p>
                  <p className="text-base font-bold text-[#2D3142]">{formatCents(getBaseDriverPayoutCents(activeOrder))}</p>
                  <p className="text-sm text-gray-500 mt-2">Tip</p>
                  <p className="text-base font-bold text-emerald-600">{formatCents(getTipCents(activeOrder))}</p>
                  <p className="text-sm text-gray-500 mt-2">Total Earnings</p>
                  <p className="text-lg font-bold text-[#2D3142]">{formatCents(getDriverPayoutCents(activeOrder))}</p>
                </div>
              </div>

              <div className="mt-4 space-y-3 text-sm text-gray-700">
                <button
                  type="button"
                  onClick={() => toggleOrderSection(`active-${activeOrder.id}`, 'pickup')}
                  className="w-full flex items-center justify-between rounded-xl border border-gray-200 bg-white px-4 py-3 text-left"
                >
                  <span className="font-semibold text-[#2D3142]">Pickup Details</span>
                  <span className="text-sm text-gray-500">
                    {getOpenSection(`active-${activeOrder.id}`, 'pickup') === 'pickup' ? '▲' : '▼'}
                  </span>
                </button>

                {getOpenSection(`active-${activeOrder.id}`, 'pickup') === 'pickup' && (
                  <div className="rounded-xl bg-white border border-gray-100 p-4">
                    <p className="font-semibold text-[#2D3142]">{activeOrder.restaurantName || 'Restaurant'}</p>
                    <p className="mt-1">{getRestaurantAddress(activeOrder)}</p>
                    {getRestaurantPhone(activeOrder) && <p className="mt-2">📞 {getRestaurantPhone(activeOrder)}</p>}
                    <div className="mt-3">
                      {renderNavigateButton(
                        'Navigate to Restaurant',
                        getRestaurantAddress(activeOrder),
                        'inline-flex px-4 py-2 rounded-xl bg-[#2D3142] text-white font-semibold hover:bg-gray-800 transition'
                      )}
                    </div>
                  </div>
                )}

                <button
                  type="button"
                  onClick={() => toggleOrderSection(`active-${activeOrder.id}`, 'dropoff')}
                  className="w-full flex items-center justify-between rounded-xl border border-gray-200 bg-white px-4 py-3 text-left"
                >
                  <span className="font-semibold text-[#2D3142]">Dropoff Details</span>
                  <span className="text-sm text-gray-500">
                    {getOpenSection(`active-${activeOrder.id}`) === 'dropoff' ? '▲' : '▼'}
                  </span>
                </button>

                {getOpenSection(`active-${activeOrder.id}`) === 'dropoff' && (
                  <div className="rounded-xl bg-white border border-gray-100 p-4">
                    <p className="font-semibold text-[#2D3142]">{activeOrder.customerName || 'Customer'}</p>
                    <p className="mt-1">{getCustomerAddress(activeOrder)}</p>
                    {activeOrder.customerPhone && <p className="mt-2">📞 {activeOrder.customerPhone}</p>}
                  </div>
                )}

                <button
                  type="button"
                  onClick={() => toggleOrderSection(`active-${activeOrder.id}`, 'items')}
                  className="w-full flex items-center justify-between rounded-xl border border-gray-200 bg-white px-4 py-3 text-left"
                >
                  <span className="font-semibold text-[#2D3142]">Order Items</span>
                  <span className="text-sm text-gray-500">
                    {getOpenSection(`active-${activeOrder.id}`) === 'items' ? '▲' : '▼'}
                  </span>
                </button>

                {getOpenSection(`active-${activeOrder.id}`) === 'items' && (
                  <div className="space-y-2 rounded-xl bg-white border border-gray-100 p-3">
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
                )}
              </div>

              <div className="mt-4 space-y-2 text-sm text-gray-700">
                <p><span className="font-semibold text-[#2D3142]">Placed:</span> {formatDateTime(activeOrder.createdAt)}</p>
                {activeOrder.assignedAt && (
                  <p><span className="font-semibold text-[#2D3142]">Accepted:</span> {formatDateTime(activeOrder.assignedAt)}</p>
                )}
                {activeOrder.pickedUpAt && (
                  <p><span className="font-semibold text-[#2D3142]">Picked Up:</span> {formatDateTime(activeOrder.pickedUpAt)}</p>
                )}
                {activeOrder.onTheWayAt && (
                  <p><span className="font-semibold text-[#2D3142]">On the Way:</span> {formatDateTime(activeOrder.onTheWayAt)}</p>
                )}
              </div>

              <div className="mt-5 flex flex-wrap gap-3">
                {activeOrder.status === 'ready' && (
                  <>
                    {renderNavigateButton(
                      'Navigate to Restaurant',
                      getRestaurantAddress(activeOrder),
                      'px-4 py-2 rounded-xl bg-[#2D3142] text-white font-semibold hover:bg-gray-800 transition'
                    )}
                    <button
                      onClick={() => updateDriverOrderStatus(activeOrder.id, 'picked_up')}
                      disabled={statusActionOrderId === activeOrder.id}
                      className="px-4 py-2 rounded-xl bg-[#FF6B35] text-white font-semibold hover:bg-orange-600 transition disabled:opacity-60"
                    >
                      {statusActionOrderId === activeOrder.id ? 'Saving...' : 'Mark Picked Up'}
                    </button>
                    <button
                      onClick={() => releaseOrder(activeOrder.id)}
                      disabled={releasingOrderId === activeOrder.id}
                      className="px-4 py-2 rounded-xl border border-red-200 text-red-600 font-semibold hover:bg-red-50 transition disabled:opacity-60"
                    >
                      {releasingOrderId === activeOrder.id ? 'Releasing...' : 'Release Order'}
                    </button>
                  </>
                )}

                {activeOrder.status === 'picked_up' && (
                  <>
                    {renderNavigateButton(
                      'Navigate to Customer',
                      getCustomerAddress(activeOrder),
                      'px-4 py-2 rounded-xl bg-[#2D3142] text-white font-semibold hover:bg-gray-800 transition'
                    )}
                    <button
                      onClick={() => updateDriverOrderStatus(activeOrder.id, 'on_the_way')}
                      disabled={statusActionOrderId === activeOrder.id}
                      className="px-4 py-2 rounded-xl bg-[#FF6B35] text-white font-semibold hover:bg-orange-600 transition disabled:opacity-60"
                    >
                      {statusActionOrderId === activeOrder.id ? 'Saving...' : 'Mark On the Way'}
                    </button>
                  </>
                )}

                {activeOrder.status === 'on_the_way' && (
                  <>
                    {renderNavigateButton(
                      'Navigate to Crush',
                      getCustomerAddress(activeOrder),
                      'px-4 py-2 rounded-xl bg-[#2D3142] text-white font-semibold hover:bg-gray-800 transition'
                    )}
                    <button
                      onClick={() => updateDriverOrderStatus(activeOrder.id, 'delivered')}
                      disabled={statusActionOrderId === activeOrder.id}
                      className="px-4 py-2 rounded-xl bg-green-600 text-white font-semibold hover:bg-green-700 transition disabled:opacity-60"
                    >
                      {statusActionOrderId === activeOrder.id ? 'Saving...' : 'Mark Delivered'}
                    </button>
                  </>
                )}
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
                const orderAccordionKey = `available-${order.id}`;
                const openSection = getOpenSection(orderAccordionKey);

                return (
                  <div
                    key={order.id}
                    className="rounded-2xl border border-gray-100 bg-gray-50/70 p-5 hover:border-orange-200 transition"
                  >
                    <div className="flex flex-col md:flex-row md:justify-between md:items-start gap-4">
                      <div>
                        <p className="text-xl font-bold text-[#2D3142]">{order.restaurantName || 'Restaurant order'}</p>
                        <p className="text-sm text-gray-600 mt-2">Customer: {order.customerName || 'Customer'}</p>
                      </div>

                      <div className="w-full md:w-[240px] rounded-xl border border-emerald-200 bg-emerald-50 p-4">
                        <p className="text-xs font-bold uppercase tracking-wide text-emerald-700">
                          Crusher Earnings Breakdown
                        </p>

                        <div className="mt-3 space-y-2">
                          <div className="flex items-center justify-between text-sm">
                            <span className="text-gray-600">Base Pay</span>
                            <span className="font-bold text-[#2D3142]">
                              {formatCents(getBaseDriverPayoutCents(order))}
                            </span>
                          </div>

                          <div className="flex items-center justify-between text-sm">
                            <span className="text-gray-600">Tip</span>
                            <span className="font-bold text-emerald-700">
                              {formatCents(getTipCents(order))}
                            </span>
                          </div>

                          <div className="flex items-center justify-between border-t border-emerald-200 pt-2 text-sm">
                            <span className="font-semibold text-[#2D3142]">Total Earnings</span>
                            <span className="text-lg font-extrabold text-[#2D3142]">
                              {formatCents(getDriverPayoutCents(order))}
                            </span>
                          </div>

                          <div className="flex items-center justify-between text-xs pt-1">
                            <span className="text-gray-500">Customer Total</span>
                            <span className="font-semibold text-[#FF6B35]">
                              {formatCents(getOrderTotalCents(order))}
                            </span>
                          </div>

                          <p className="text-xs text-gray-500 pt-1">
                            Placed {formatDateTime(order.createdAt)}
                          </p>
                        </div>
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

                    <div className="mt-4 space-y-3">
                      <button
                        type="button"
                        onClick={() => toggleOrderSection(orderAccordionKey, 'pickup')}
                        className="w-full flex items-center justify-between rounded-xl border border-gray-200 bg-white px-4 py-3 text-left"
                      >
                        <span className="font-semibold text-[#2D3142]">Pickup Details</span>
                        <span className="text-sm text-gray-500">
                          {openSection === 'pickup' ? '▲' : '▼'}
                        </span>
                      </button>

                      {openSection === 'pickup' && (
                        <div className="rounded-xl border border-gray-100 bg-white p-4 text-sm text-gray-700">
                          <p className="font-semibold text-[#2D3142]">{order.restaurantName || 'Restaurant'}</p>
                          <p className="mt-1">{getRestaurantAddress(order)}</p>
                          {getRestaurantPhone(order) && <p className="mt-2">📞 {getRestaurantPhone(order)}</p>}
                        </div>
                      )}

                      <button
                        type="button"
                        onClick={() => toggleOrderSection(orderAccordionKey, 'dropoff')}
                        className="w-full flex items-center justify-between rounded-xl border border-gray-200 bg-white px-4 py-3 text-left"
                      >
                        <span className="font-semibold text-[#2D3142]">Dropoff Details</span>
                        <span className="text-sm text-gray-500">
                          {openSection === 'dropoff' ? '▲' : '▼'}
                        </span>
                      </button>

                      {openSection === 'dropoff' && (
                        <div className="rounded-xl border border-gray-100 bg-white p-4 text-sm text-gray-700">
                          <p className="font-semibold text-[#2D3142]">{order.customerName || 'Customer'}</p>
                          <p className="mt-1">{getCustomerAddress(order)}</p>
                          {order.customerPhone && <p className="mt-2">📞 {order.customerPhone}</p>}
                        </div>
                      )}

                      <button
                        type="button"
                        onClick={() => toggleOrderSection(orderAccordionKey, 'items')}
                        className="w-full flex items-center justify-between rounded-xl border border-gray-200 bg-white px-4 py-3 text-left"
                      >
                        <span className="font-semibold text-[#2D3142]">Order Items</span>
                        <span className="text-sm text-gray-500">
                          {openSection === 'items' ? '▲' : '▼'}
                        </span>
                      </button>

                      {openSection === 'items' && (
                        <div className="space-y-2 rounded-xl border border-gray-100 bg-white p-3">
                          {(order.items ?? []).map((item, index) => (
                            <div
                              key={`${order.id}-${item.name ?? 'item'}-${index}`}
                              className="flex items-center justify-between text-sm text-gray-700 rounded-xl px-3 py-2 border border-gray-100"
                            >
                              <span>{item.quantity || 1}× {item.name || 'Item'}</span>
                              <span className="font-semibold text-[#2D3142]">
                                {formatCents(getItemPriceCents(item) * Math.max(1, Number(item.quantity ?? 1)))}
                              </span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    <div className="mt-5 flex flex-wrap justify-end gap-3">
                      {renderNavigateButton(
                        'Navigate to Restaurant',
                        getRestaurantAddress(order),
                        'px-5 py-2.5 rounded-xl border border-gray-200 text-[#2D3142] font-semibold hover:bg-white transition'
                      )}
                      <button
                        onClick={() => declineOrder(order.id)}
                        disabled={decliningOrderId === order.id}
                        className="px-5 py-2.5 rounded-xl border border-red-200 text-red-600 font-semibold hover:bg-red-50 transition disabled:opacity-60 disabled:cursor-not-allowed"
                      >
                        {decliningOrderId === order.id ? 'Declining...' : 'Decline'}
                      </button>
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
                  <p className="text-xs text-gray-400 mt-1">{formatDateTime(order.deliveredAt || order.createdAt)}</p>
                </div>
                <div className="flex items-center gap-3">
                  <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold ${getStatusBadgeClass(order.status)}`}>
                    {getStatusLabel(order.status)}
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
