import { createContext, useContext, useEffect, useMemo, useState } from 'react';

const STORAGE_KEY = 'dinerscrush_cart_v1';

export interface CartItem {
  id: string;
  restaurantId: string;
  restaurantName: string;
  name: string;
  description?: string;
  priceCents: number;
  displayPrice: string;
  quantity: number;
  specialInstructions?: string;
}

interface CartState {
  restaurantId: string | null;
  restaurantName: string | null;
  items: CartItem[];
}

interface CartContextType {
  cart: CartState;
  itemCount: number;
  subtotalCents: number;
  addItem: (item: Omit<CartItem, 'quantity'>) => void;
  updateQuantity: (itemId: string, quantity: number) => void;
  updateItemInstructions: (itemId: string, specialInstructions: string) => void;
  removeItem: (itemId: string) => void;
  clearCart: () => void;
}

const CartContext = createContext<CartContextType | null>(null);

const emptyCart: CartState = {
  restaurantId: null,
  restaurantName: null,
  items: [],
};

export const useCart = () => {
  const context = useContext(CartContext);
  if (!context) throw new Error('useCart must be used within CartProvider');
  return context;
};

export const CartProvider = ({ children }: { children: React.ReactNode }) => {
  const [cart, setCart] = useState<CartState>(emptyCart);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved) as CartState;
        if (parsed && Array.isArray(parsed.items)) {
          setCart(parsed);
        }
      }
    } catch (error) {
      console.error('Failed to load cart from storage:', error);
    }
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(cart));
    } catch (error) {
      console.error('Failed to save cart to storage:', error);
    }
  }, [cart]);

  const addItem = (item: Omit<CartItem, 'quantity'>) => {
    setCart((current) => {
      const existing = current.items.find((cartItem) => cartItem.id === item.id);

      if (!current.restaurantId || current.restaurantId !== item.restaurantId) {
        return {
          restaurantId: item.restaurantId,
          restaurantName: item.restaurantName,
          items: [{ ...item, quantity: 1 }],
        };
      }

      if (existing) {
        return {
          ...current,
          items: current.items.map((cartItem) =>
            cartItem.id === item.id
              ? { ...cartItem, quantity: cartItem.quantity + 1 }
              : cartItem
          ),
        };
      }

      return {
        ...current,
        items: [...current.items, { ...item, quantity: 1 }],
      };
    });
  };

  const updateQuantity = (itemId: string, quantity: number) => {
    if (quantity <= 0) {
      removeItem(itemId);
      return;
    }

    setCart((current) => ({
      ...current,
      items: current.items.map((item) =>
        item.id === itemId ? { ...item, quantity } : item
      ),
    }));
  };

  const updateItemInstructions = (itemId: string, specialInstructions: string) => {
    setCart((current) => ({
      ...current,
      items: current.items.map((item) =>
        item.id === itemId ? { ...item, specialInstructions } : item
      ),
    }));
  };

  const removeItem = (itemId: string) => {
    setCart((current) => {
      const items = current.items.filter((item) => item.id !== itemId);

      if (items.length === 0) {
        return emptyCart;
      }

      return {
        ...current,
        items,
      };
    });
  };

  const clearCart = () => {
    setCart(emptyCart);
  };

  const itemCount = useMemo(
    () => cart.items.reduce((sum, item) => sum + item.quantity, 0),
    [cart.items]
  );

  const subtotalCents = useMemo(
    () => cart.items.reduce((sum, item) => sum + item.priceCents * item.quantity, 0),
    [cart.items]
  );

  return (
    <CartContext.Provider
      value={{
        cart,
        itemCount,
        subtotalCents,
        addItem,
        updateQuantity,
        updateItemInstructions,
        removeItem,
        clearCart,
      }}
    >
      {children}
    </CartContext.Provider>
  );
};
