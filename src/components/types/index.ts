export interface Restaurant {
  id: string;
  name: string;
  address: string;
  phone: string;
  cuisine: string;
  logo?: string;
  isActive: boolean;
  ownerId: string;
}

export interface MenuItem {
  id: string;
  restaurantId: string;
  name: string;
  price: number;
  description: string;
  category: string;
  image?: string;
}

export interface Order {
  id: string;
  customerId: string;
  customerName: string;
  customerAddress: string;
  customerPhone: string;
  restaurantId: string;
  restaurantName: string;
  items: OrderItem[];
  totalAmount: number;
  deliveryFee: number;
  status: 'pending' | 'confirmed' | 'preparing' | 'ready' | 'picked_up' | 'delivered' | 'cancelled';
  driverId?: string;
  driverName?: string;
  createdAt: Date;
  estimatedDeliveryTime?: Date;
  actualDeliveryTime?: Date;
}

export interface OrderItem {
  menuItemId: string;
  name: string;
  quantity: number;
  price: number;
}

export interface Driver {
  id: string;
  name: string;
  phone: string;
  email: string;
  vehicleType: string;
  licensePlate: string;
  isAvailable: boolean;
  currentOrderId?: string;
  rating: number;
  totalDeliveries: number;
}
