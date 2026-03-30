import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  addDoc,
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  serverTimestamp,
  where,
} from 'firebase/firestore';
import { db } from '../firebase/config';
import { useCart } from '../context/CartContext';
import { useAuth } from '../context/AuthContext';

interface Restaurant {
  id: string;
  name: string;
  address?: string;
  phone?: string;
  cuisine?: string;
  orderTargetId: string;
  menuLookupIds: string[];
}

interface MenuItem {
  id: string;
  name: string;
  price?: number | string | null;
  priceCents?: number | string | null;
  displayPrice?: string | null;
  description?: string;
  category?: string;
  categoryId?: string;
  restaurantId?: string;
  menuId?: string;
  sortOrder?: number;
  isActive?: boolean;
  isAvailable?: boolean;
  source?: 'menuItems' | 'menu';
}

const OPEN_SCROLL_THRESHOLD = 420;

const CHECKOUT_PREFILL_KEY = 'dinerscrush_checkout_prefill_v1';

const getInitialCheckoutForm = () => {
  if (typeof window === 'undefined') {
    return {
      customerName: '',
      customerPhone: '',
      customerAddress: '',
      orderInstructions: '',
    };
  }

  try {
    const savedRaw = window.localStorage.getItem(CHECKOUT_PREFILL_KEY);

    if (!savedRaw) {
      return {
        customerName: '',
        customerPhone: '',
        customerAddress: '',
        orderInstructions: '',
      };
    }

    const saved = JSON.parse(savedRaw) as Partial<{
      customerName: string;
      customerPhone: string;
      customerAddress: string;
    }>;

    return {
      customerName: saved.customerName || '',
      customerPhone: saved.customerPhone || '',
      customerAddress: saved.customerAddress || '',
      orderInstructions: '',
    };
  } catch (error) {
    console.error('Error reading checkout prefill:', error);

    return {
      customerName: '',
      customerPhone: '',
      customerAddress: '',
      orderInstructions: '',
    };
  }
};


const formatCents = (cents: number) => `$${(cents / 100).toFixed(2)}`;

const pickFirstString = (...values: unknown[]) => {
  for (const value of values) {
    if (typeof value === 'string' && value.trim()) {
      return value.trim();
    }
  }
  return '';
};

const normalizeName = (value?: string) => (value || '').trim().toLowerCase();
const normalizeCategory = (value?: string) => (value || 'Main').trim().toLowerCase();

const getRawDisplayPrice = (item: MenuItem) => {
  if (typeof item.displayPrice === 'string' && item.displayPrice.trim()) {
    return item.displayPrice.trim();
  }

  if (typeof item.price === 'string' && item.price.trim()) {
    return item.price.trim();
  }

  if (typeof item.priceCents === 'string' && item.priceCents.trim()) {
    return item.priceCents.trim();
  }

  return '';
};

const normalizeMoneyToCents = (value: unknown): number => {
  if (typeof value === 'number' && Number.isFinite(value)) {
    if (value >= 100 && Number.isInteger(value)) return Math.round(value);
    return Math.round(value * 100);
  }

  if (typeof value !== 'string') return 0;

  const trimmed = value.trim();
  if (!trimmed) return 0;

  const dollarMatch = /\$([0-9]+(?:\.[0-9]{1,2})?)/.exec(trimmed);
  if (dollarMatch && dollarMatch[1]) {
    return Math.round(Number.parseFloat(dollarMatch[1]) * 100);
  }

  const centMatch = /\b([0-9]+)c\b/i.exec(trimmed);
  if (centMatch && centMatch[1]) {
    return Number.parseInt(centMatch[1], 10);
  }

  const plainNumberMatch = trimmed.match(/\b([0-9]+(?:\.[0-9]{1,2})?)\b/);
  if (plainNumberMatch) {
    const parsed = Number.parseFloat(plainNumberMatch[1]);
    if (!Number.isFinite(parsed)) return 0;
    if (trimmed.includes('.')) return Math.round(parsed * 100);
    if (parsed >= 100) return Math.round(parsed);
    return Math.round(parsed * 100);
  }

  return 0;
};

const getItemPriceCents = (item: MenuItem) => {
  const fromPriceCents = normalizeMoneyToCents(item.priceCents);
  if (fromPriceCents > 0) return fromPriceCents;

  const fromPrice = normalizeMoneyToCents(item.price);
  if (fromPrice > 0) return fromPrice;

  const fromDisplayPrice = normalizeMoneyToCents(item.displayPrice);
  if (fromDisplayPrice > 0) return fromDisplayPrice;

  return 0;
};

const getDisplayPrice = (item: MenuItem) => {
  const rawDisplay = getRawDisplayPrice(item);
  if (rawDisplay) return rawDisplay;

  const cents = getItemPriceCents(item);
  if (cents > 0) return formatCents(cents);

  return 'Unavailable';
};

const getMergeKey = (item: MenuItem) =>
  `${normalizeCategory(item.category)}::${normalizeName(item.name)}`;

const chooseBetterItem = (existing: MenuItem, incoming: MenuItem): MenuItem => {
  const existingNumericPrice = getItemPriceCents(existing);
  const incomingNumericPrice = getItemPriceCents(incoming);
  const existingRawDisplay = getRawDisplayPrice(existing);
  const incomingRawDisplay = getRawDisplayPrice(incoming);

  if (existingNumericPrice <= 0 && incomingNumericPrice > 0) return incoming;
  if (incomingNumericPrice <= 0 && existingNumericPrice > 0) return existing;

  if (!existingRawDisplay && incomingRawDisplay) return incoming;
  if (!incomingRawDisplay && existingRawDisplay) return existing;

  const existingDesc = existing.description?.trim().length || 0;
  const incomingDesc = incoming.description?.trim().length || 0;

  if (incomingDesc > existingDesc) {
    return {
      ...existing,
      ...incoming,
      id: existing.id,
      source: existing.source === 'menuItems' ? 'menuItems' : incoming.source,
    };
  }

  return existing;
};

const resolveRestaurantOwnerUid = async (
  restaurantDocId: string,
  restaurantName: string,
  fallbackId: string
) => {
  try {
    const usersSnapshot = await getDocs(
      query(collection(db, 'users'), where('role', '==', 'restaurant'))
    );

    const normalizedRestaurantName = normalizeName(restaurantName);

    const exactRestaurantIdMatch = usersSnapshot.docs.find((userDoc) => {
      const data = userDoc.data();
      return pickFirstString(data.restaurantId) === restaurantDocId;
    });

    if (exactRestaurantIdMatch) return exactRestaurantIdMatch.id;

    const exactNameMatch = usersSnapshot.docs.find((userDoc) => {
      const data = userDoc.data();
      const userRestaurantName = pickFirstString(data.name, data.restaurantName);
      return normalizeName(userRestaurantName) === normalizedRestaurantName;
    });

    if (exactNameMatch) return exactNameMatch.id;

    return fallbackId;
  } catch (error) {
    console.error('Error resolving restaurant owner UID:', error);
    return fallbackId;
  }
};

const RestaurantMenu = () => {
  const { id } = useParams<{ id: string }>();
  const { currentUser } = useAuth();
  const {
    cart,
    addItem,
    updateQuantity,
    updateItemInstructions,
    removeItem,
    clearCart,
  } = useCart();

  const [restaurant, setRestaurant] = useState<Restaurant | null>(null);
  const [menu, setMenu] = useState<MenuItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [submittingOrder, setSubmittingOrder] = useState(false);
  const [showBackToTop, setShowBackToTop] = useState(false);
  const [reviewMode, setReviewMode] = useState(false);

  const [checkoutForm, setCheckoutForm] = useState(getInitialCheckoutForm);

  useEffect(() => {
    if (!id) return;
    void fetchRestaurantAndMenu(id);
  }, [id]);

  useEffect(() => {
    const onScroll = () => {
      setShowBackToTop(window.scrollY > OPEN_SCROLL_THRESHOLD);
    };

    window.addEventListener('scroll', onScroll);
    onScroll();

    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    try {
      window.localStorage.setItem(
        CHECKOUT_PREFILL_KEY,
        JSON.stringify({
          customerName: checkoutForm.customerName,
          customerPhone: checkoutForm.customerPhone,
          customerAddress: checkoutForm.customerAddress,
        })
      );
    } catch (error) {
      console.error('Error saving checkout prefill:', error);
    }
  }, [
    checkoutForm.customerName,
    checkoutForm.customerPhone,
    checkoutForm.customerAddress,
  ]);


  const fetchRestaurantAndMenu = async (routeRestaurantId: string) => {
    try {
      setLoading(true);

      let restaurantData: Restaurant | null = null;

      const restaurantDoc = await getDoc(doc(db, 'restaurants', routeRestaurantId));

      if (restaurantDoc.exists()) {
        const data = restaurantDoc.data();
        const restaurantName =
          pickFirstString(data.name, data.restaurantName) || 'Restaurant';

        const fallbackTargetId =
          pickFirstString(
            data.ownerId,
            data.ownerUid,
            data.userId,
            data.authUid,
            data.restaurantUserId,
            data.restaurantId
          ) || restaurantDoc.id;

        const resolvedOwnerUid = await resolveRestaurantOwnerUid(
          restaurantDoc.id,
          restaurantName,
          fallbackTargetId
        );

        restaurantData = {
          id: restaurantDoc.id,
          name: restaurantName,
          address: pickFirstString(data.address),
          phone: pickFirstString(data.phone),
          cuisine: pickFirstString(data.cuisine),
          orderTargetId: resolvedOwnerUid,
          menuLookupIds: Array.from(
            new Set([restaurantDoc.id, fallbackTargetId, resolvedOwnerUid])
          ),
        };
      } else {
        const userDoc = await getDoc(doc(db, 'users', routeRestaurantId));

        if (userDoc.exists()) {
          const data = userDoc.data();
          const linkedRestaurantId = pickFirstString(data.restaurantId);

          restaurantData = {
            id: linkedRestaurantId || userDoc.id,
            name: pickFirstString(data.name, data.restaurantName) || 'Restaurant',
            address: pickFirstString(data.address),
            phone: pickFirstString(data.phone),
            cuisine: pickFirstString(data.cuisine),
            orderTargetId: userDoc.id,
            menuLookupIds: Array.from(new Set([userDoc.id, linkedRestaurantId].filter(Boolean))),
          };
        }
      }

      if (!restaurantData) {
        setRestaurant(null);
        setMenu([]);
        return;
      }

      setRestaurant(restaurantData);

      const categoryMap = new Map<string, string>();

      for (const lookupId of restaurantData.menuLookupIds) {
        const categoriesSnapshot = await getDocs(
          query(collection(db, 'menuCategories'), where('restaurantId', '==', lookupId))
        );

        categoriesSnapshot.docs.forEach((categoryDoc) => {
          const data = categoryDoc.data();
          categoryMap.set(categoryDoc.id, pickFirstString(data.name) || 'Main');
        });
      }

      const collected: MenuItem[] = [];

      for (const lookupId of restaurantData.menuLookupIds) {
        const menuItemsSnapshot = await getDocs(
          query(collection(db, 'menuItems'), where('restaurantId', '==', lookupId))
        );

        menuItemsSnapshot.docs.forEach((menuDoc) => {
          const data = menuDoc.data();
          collected.push({
            id: menuDoc.id,
            ...data,
            category:
              pickFirstString(data.category) ||
              categoryMap.get(pickFirstString(data.categoryId)) ||
              'Main',
            source: 'menuItems',
          } as MenuItem);
        });

        const legacyMenuSnapshot = await getDocs(
          query(collection(db, 'menu'), where('restaurantId', '==', lookupId))
        );

        legacyMenuSnapshot.docs.forEach((menuDoc) => {
          const data = menuDoc.data();
          collected.push({
            id: menuDoc.id,
            ...data,
            category: pickFirstString(data.category) || 'Main',
            source: 'menu',
          } as MenuItem);
        });
      }

      const mergedMap = new Map<string, MenuItem>();

      for (const item of collected) {
        if (item.isActive === false || item.isAvailable === false) continue;

        const key = getMergeKey(item);
        const existing = mergedMap.get(key);

        if (!existing) {
          mergedMap.set(key, item);
        } else {
          mergedMap.set(key, chooseBetterItem(existing, item));
        }
      }

      const mergedMenu = Array.from(mergedMap.values())
        .filter((item) => getItemPriceCents(item) > 0)
        .sort((a, b) => {
          const categoryCompare = (a.category || 'Main').localeCompare(b.category || 'Main');
          if (categoryCompare !== 0) return categoryCompare;

          const sortCompare = (a.sortOrder ?? 0) - (b.sortOrder ?? 0);
          if (sortCompare !== 0) return sortCompare;

          return a.name.localeCompare(b.name);
        });

      setMenu(mergedMenu);
    } catch (error) {
      console.error('Error fetching restaurant menu:', error);
      setRestaurant(null);
      setMenu([]);
    } finally {
      setLoading(false);
    }
  };

  const groupedMenu = useMemo(() => {
    return menu.reduce<Record<string, MenuItem[]>>((acc, item) => {
      const category = item.category || 'Main';
      if (!acc[category]) acc[category] = [];
      acc[category].push(item);
      return acc;
    }, {});
  }, [menu]);

  const currentRestaurantCartItems = useMemo(() => {
    if (!restaurant) return [];
    return cart.restaurantId === restaurant.orderTargetId ? cart.items : [];
  }, [cart, restaurant]);

  const currentRestaurantItemCount = useMemo(
    () => currentRestaurantCartItems.reduce((sum, item) => sum + item.quantity, 0),
    [currentRestaurantCartItems]
  );

  const currentRestaurantSubtotal = useMemo(
    () =>
      currentRestaurantCartItems.reduce(
        (sum, item) => sum + item.priceCents * item.quantity,
        0
      ),
    [currentRestaurantCartItems]
  );

  useEffect(() => {
    if (currentRestaurantCartItems.length === 0) {
      setReviewMode(false);
    }
  }, [currentRestaurantCartItems.length]);

  const handleReviewOrder = () => {
    setReviewMode(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleBackToMenu = () => {
    setReviewMode(false);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleAddToCart = (item: MenuItem) => {
    if (!restaurant) return;

    const resolvedPriceCents = getItemPriceCents(item);

    if (resolvedPriceCents <= 0) {
      window.alert('This item does not have a valid price yet.');
      return;
    }

    if (
      cart.restaurantId &&
      cart.restaurantId !== restaurant.orderTargetId &&
      cart.items.length > 0
    ) {
      const confirmed = window.confirm(
        `Your cart already has items from ${cart.restaurantName}. Clear it and start a new order for ${restaurant.name}?`
      );

      if (!confirmed) return;
      clearCart();
    }

    addItem({
      id: item.id,
      restaurantId: restaurant.orderTargetId,
      restaurantName: restaurant.name,
      name: item.name,
      description: item.description,
      priceCents: resolvedPriceCents,
      displayPrice: getDisplayPrice(item),
      specialInstructions: '',
    });
  };

  const handlePlaceOrder = async (e: FormEvent) => {
    e.preventDefault();

    if (!restaurant) return;
    if (currentRestaurantCartItems.length === 0) {
      window.alert('Your order is empty.');
      return;
    }

    const customerName = checkoutForm.customerName.trim();
    const customerPhone = checkoutForm.customerPhone.trim();
    const customerAddress = checkoutForm.customerAddress.trim();
    const orderInstructions = checkoutForm.orderInstructions.trim();

    if (!customerName || !customerPhone || !customerAddress) {
      window.alert('Please fill in your name, phone number, and delivery address.');
      return;
    }

    try {
      setSubmittingOrder(true);

      const subtotalCents = currentRestaurantSubtotal;
      const deliveryFeeCents = 0;
      const totalCents = subtotalCents + deliveryFeeCents;

      const orderPayload = {
        restaurantId: restaurant.orderTargetId,
        restaurantDocId: restaurant.id,
        restaurantName: restaurant.name,
        restaurantLookupIds: restaurant.menuLookupIds,
        customerId: currentUser?.uid || null,
        customerEmail: currentUser?.email || null,
        customerName,
        customerPhone,
        customerAddress,
        orderInstructions,
        items: currentRestaurantCartItems.map((item) => ({
          menuItemId: item.id,
          name: item.name,
          description: item.description || '',
          quantity: item.quantity,
          price: Number((item.priceCents / 100).toFixed(2)),
          priceCents: item.priceCents,
          displayPrice: item.displayPrice,
          specialInstructions: item.specialInstructions || '',
        })),
        subtotalAmount: Number((subtotalCents / 100).toFixed(2)),
        subtotalCents,
        deliveryFeeAmount: 0,
        deliveryFeeCents,
        totalAmount: Number((totalCents / 100).toFixed(2)),
        totalCents,
        paymentStatus: 'pending',
        status: 'pending',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      };

      const docRef = await addDoc(collection(db, 'orders'), orderPayload);

      localStorage.setItem('dinerscrush_last_order_id', docRef.id);

      clearCart();
      setCheckoutForm((prev) => ({
        ...prev,
        orderInstructions: '',
      }));

      window.location.assign(`/track-order/${docRef.id}`);
    } catch (error) {
      console.error('Error placing order:', error);
      window.alert('Something went wrong while placing the order. Please try again.');
    } finally {
      setSubmittingOrder(false);
    }
  };

  if (loading) {
    return (
      <div className="max-w-5xl mx-auto px-4 py-12 text-center">
        <p className="text-gray-500">Loading menu...</p>
      </div>
    );
  }

  if (!restaurant) {
    return (
      <div className="max-w-5xl mx-auto px-4 py-12 text-center">
        <p className="text-gray-500">Restaurant not found.</p>
        <Link to="/order" className="text-[#FF6B35] mt-4 inline-block">
          ← Back to restaurants
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto px-4 py-6 pb-28">
      <Link to="/order" className="text-[#FF6B35] mb-4 inline-flex items-center gap-1">
        ← Back to Crush Kitchens
      </Link>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 mb-6">
        <div className="flex items-start justify-between gap-4 flex-col sm:flex-row">
          <div>
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

          {currentRestaurantCartItems.length > 0 && reviewMode && (
            <button
              onClick={handleBackToMenu}
              className="bg-white border border-[#FF6B35] text-[#FF6B35] px-4 py-2 rounded-lg font-semibold hover:bg-orange-50 transition"
            >
              ← Back to Menu
            </button>
          )}
        </div>
      </div>

      {!reviewMode && currentRestaurantCartItems.length > 0 && (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 mb-6">
          <div className="flex items-center justify-between gap-4 mb-4">
            <div>
              <h2 className="text-xl font-bold text-[#2D3142]">Current Cart</h2>
              <p className="text-sm text-gray-500">
                Remove items or adjust quantity before review
              </p>
            </div>
            <button
              onClick={clearCart}
              className="text-sm text-red-500 hover:text-red-600 font-medium"
            >
              Clear Cart
            </button>
          </div>

          <div className="space-y-3">
            {currentRestaurantCartItems.map((item) => (
              <div key={item.id} className="rounded-xl border border-gray-100 p-4">
                <div className="flex justify-between items-start gap-4 flex-col sm:flex-row">
                  <div className="flex-1">
                    <h3 className="font-semibold text-[#2D3142]">{item.name}</h3>
                    {item.description && (
                      <p className="text-sm text-gray-500 mt-1">{item.description}</p>
                    )}
                    <p className="text-sm font-medium text-[#FF6B35] mt-1">
                      {item.displayPrice}
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => updateQuantity(item.id, item.quantity - 1)}
                      className="w-8 h-8 rounded-lg border border-gray-300 text-[#2D3142] hover:bg-gray-50"
                    >
                      −
                    </button>
                    <span className="w-8 text-center font-semibold">{item.quantity}</span>
                    <button
                      onClick={() => updateQuantity(item.id, item.quantity + 1)}
                      className="w-8 h-8 rounded-lg border border-gray-300 text-[#2D3142] hover:bg-gray-50"
                    >
                      +
                    </button>
                    <button
                      onClick={() => removeItem(item.id)}
                      className="ml-2 text-sm text-red-500 hover:text-red-600"
                    >
                      Remove
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {!reviewMode && (
        <>
          {Object.keys(groupedMenu).length === 0 ? (
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-12 text-center">
              <p className="text-gray-400">No menu items yet.</p>
            </div>
          ) : (
            Object.entries(groupedMenu).map(([category, items]) => (
              <div key={category} className="mb-8">
                <h2 className="text-xl font-semibold text-[#2D3142] mb-4 pb-2 border-b border-gray-200">
                  {category}
                </h2>

                <div className="space-y-3">
                  {items.map((item) => {
                    const resolvedPriceCents = getItemPriceCents(item);
                    const canOrder = resolvedPriceCents > 0;

                    return (
                      <div
                        key={item.id}
                        className="bg-white rounded-xl shadow-sm border border-gray-100 p-4"
                      >
                        <div className="flex justify-between items-start gap-4">
                          <div className="flex-1">
                            <h3 className="font-semibold text-[#2D3142]">{item.name}</h3>
                            {item.description && (
                              <p className="text-sm text-gray-500 mt-1">{item.description}</p>
                            )}
                          </div>

                          <div className="text-right min-w-[140px]">
                            <p className="font-bold text-[#FF6B35]">{getDisplayPrice(item)}</p>
                            <button
                              onClick={() => handleAddToCart(item)}
                              disabled={!canOrder}
                              className="mt-2 bg-[#FF6B35] text-white px-4 py-1.5 rounded-lg text-sm font-semibold hover:bg-orange-600 transition disabled:bg-gray-300 disabled:cursor-not-allowed"
                            >
                              {canOrder ? 'Add to Order' : 'Unavailable'}
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))
          )}
        </>
      )}

      {currentRestaurantCartItems.length > 0 && (
        <div id="checkout" className="mt-10 bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
          <div className="flex items-center justify-between mb-4 gap-4">
            <div>
              <h2 className="text-xl font-bold text-[#2D3142]">Review Your Order</h2>
              <p className="text-sm text-gray-500">{restaurant.name}</p>
            </div>
            <button
              onClick={clearCart}
              className="text-sm text-red-500 hover:text-red-600 font-medium"
            >
              Clear Cart
            </button>
          </div>

          <div className="space-y-3">
            {currentRestaurantCartItems.map((item) => (
              <div key={item.id} className="rounded-xl border border-gray-100 p-4">
                <div className="flex justify-between items-start gap-4 flex-col md:flex-row">
                  <div className="flex-1 w-full">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <h3 className="font-semibold text-[#2D3142]">{item.name}</h3>
                        {item.description && (
                          <p className="text-sm text-gray-500 mt-1">{item.description}</p>
                        )}
                        <p className="text-sm font-medium text-[#FF6B35] mt-1">
                          {item.displayPrice}
                        </p>
                      </div>

                      <button
                        onClick={() => removeItem(item.id)}
                        className="text-sm text-red-500 hover:text-red-600 shrink-0"
                      >
                        Remove
                      </button>
                    </div>

                    <div className="mt-3">
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Special instructions for this item
                      </label>
                      <textarea
                        value={item.specialInstructions || ''}
                        onChange={(e) => updateItemInstructions(item.id, e.target.value)}
                        placeholder="No onions, extra sauce, dressing on side..."
                        className="w-full border border-gray-300 rounded-lg p-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#FF6B35]"
                        rows={2}
                      />
                    </div>
                  </div>

                  <div className="flex items-center gap-2 self-end md:self-start">
                    <button
                      onClick={() => updateQuantity(item.id, item.quantity - 1)}
                      className="w-8 h-8 rounded-lg border border-gray-300 text-[#2D3142] hover:bg-gray-50"
                    >
                      −
                    </button>
                    <span className="w-8 text-center font-semibold">{item.quantity}</span>
                    <button
                      onClick={() => updateQuantity(item.id, item.quantity + 1)}
                      className="w-8 h-8 rounded-lg border border-gray-300 text-[#2D3142] hover:bg-gray-50"
                    >
                      +
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <form onSubmit={handlePlaceOrder} className="mt-8 border-t border-gray-200 pt-6">
            <h3 className="text-lg font-bold text-[#2D3142] mb-4">Checkout Details</h3>

            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Your Name
                </label>
                <input
                  type="text"
                  value={checkoutForm.customerName}
                  onChange={(e) =>
                    setCheckoutForm((prev) => ({ ...prev, customerName: e.target.value }))
                  }
                  className="w-full border border-gray-300 rounded-lg p-3 focus:outline-none focus:ring-2 focus:ring-[#FF6B35]"
                  placeholder="Ozone"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Phone Number
                </label>
                <input
                  type="text"
                  value={checkoutForm.customerPhone}
                  onChange={(e) =>
                    setCheckoutForm((prev) => ({ ...prev, customerPhone: e.target.value }))
                  }
                  className="w-full border border-gray-300 rounded-lg p-3 focus:outline-none focus:ring-2 focus:ring-[#FF6B35]"
                  placeholder="(555) 555-5555"
                />
              </div>
            </div>

            <div className="mt-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Delivery Address
              </label>
              <textarea
                value={checkoutForm.customerAddress}
                onChange={(e) =>
                  setCheckoutForm((prev) => ({ ...prev, customerAddress: e.target.value }))
                }
                className="w-full border border-gray-300 rounded-lg p-3 focus:outline-none focus:ring-2 focus:ring-[#FF6B35]"
                rows={3}
                placeholder="Street address, apartment/unit, city, zip"
              />
            </div>

            <div className="mt-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Order / Delivery Instructions
              </label>
              <textarea
                value={checkoutForm.orderInstructions}
                onChange={(e) =>
                  setCheckoutForm((prev) => ({
                    ...prev,
                    orderInstructions: e.target.value,
                  }))
                }
                className="w-full border border-gray-300 rounded-lg p-3 focus:outline-none focus:ring-2 focus:ring-[#FF6B35]"
                rows={3}
                placeholder="Leave at door, call when outside, gate code, allergy notes..."
              />
            </div>

            <div className="mt-6 rounded-xl bg-gray-50 border border-gray-200 p-4">
              <div className="flex justify-between text-sm mb-2">
                <span>Items</span>
                <span>{currentRestaurantItemCount}</span>
              </div>
              <div className="flex justify-between text-sm mb-2">
                <span>Subtotal</span>
                <span>{formatCents(currentRestaurantSubtotal)}</span>
              </div>
              <div className="flex justify-between text-sm mb-2">
                <span>Delivery Fee</span>
                <span>$0.00</span>
              </div>
              <div className="border-t border-gray-200 pt-3 mt-3 flex justify-between font-bold text-lg">
                <span>Total</span>
                <span className="text-[#FF6B35]">{formatCents(currentRestaurantSubtotal)}</span>
              </div>
            </div>

            <button
              type="submit"
              disabled={submittingOrder}
              className="mt-5 w-full bg-[#FF6B35] text-white py-3 rounded-xl font-semibold hover:bg-orange-600 transition disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {submittingOrder ? 'Placing Order...' : 'Place Order'}
            </button>
          </form>
        </div>
      )}

      {currentRestaurantCartItems.length > 0 && !reviewMode && (
        <div className="fixed bottom-0 left-0 right-0 bg-[#2D3142] text-white shadow-2xl">
          <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between gap-4">
            <div>
              <p className="font-semibold">{currentRestaurantItemCount} item(s) in cart</p>
              <p className="text-sm text-gray-300">{formatCents(currentRestaurantSubtotal)}</p>
            </div>
            <button
              onClick={handleReviewOrder}
              className="bg-[#FF6B35] px-4 py-2 rounded-lg font-semibold hover:bg-orange-600 transition"
            >
              Review Order
            </button>
          </div>
        </div>
      )}

      {showBackToTop && (
        <button
          onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
          className="fixed bottom-24 right-4 bg-white border border-gray-200 text-[#2D3142] shadow-lg px-4 py-2 rounded-full font-semibold hover:bg-gray-50 transition"
        >
          ↑ Top
        </button>
      )}
    </div>
  );
};

export default RestaurantMenu;