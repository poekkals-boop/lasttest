/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface User {
  id: string; // M00001, S00001, A00001
  name: string;
  nickname?: string;
  dob?: string;
  phone: string; // 10 digits
  password: string;
  role: 'Customer' | 'Merchant' | 'Admin' | 'SuperAdmin';
  status: 'active' | 'suspended' | 'banned';
  wallet: number;
  bankName?: string;
  bankAccount?: string;
  bankHolderName?: string;
  avatar?: string;
  isOrderEnabled?: boolean;
  createdAt?: string;
}

export interface ProductOptionItem {
  name: string;
  stock: number;
}

export interface ProductOption {
  category: string; // e.g., "Size", "Color"
  list: ProductOptionItem[];
}

export interface Product {
  id: string;
  merchantId: string;
  merchantName: string;
  merchantPhone: string;
  name: string;
  description: string;
  image: string;
  images?: string[];
  price: number;
  salesVolume: number;
  status: 'pending' | 'approved' | 'rejected' | 'paused';
  rejectionReason?: string;
  options: ProductOption[];
  totalStock: number;
  category?: 'APPAREL' | 'BAGS' | 'CAPS' | 'TUMBLER' | string;
}

export interface OrderItem {
  productId: string;
  name: string;
  image: string;
  price: number;
  quantity: number;
  options: { [category: string]: string };
}

export interface Order {
  id: string;
  merchantId: string;
  customerId: string;
  items: OrderItem[];
  shippingAddress: {
    name: string;
    phone: string;
    address: string;
    zipcode: string;
  };
  paymentMethod: 'wallet' | 'cod';
  status: 'waiting_approval' | 'preparing' | 'in_transit' | 'completed' | 'cancelled';
  subtotal: number;
  shippingFee: number;
  discount: number;
  grandTotal: number;
  createdAt: string;
}

export interface ChatMessage {
  id: string;
  userId: string; // The customer/merchant participating in support
  userName: string;
  userPhone: string;
  sender: 'user' | 'admin';
  message: string;
  image?: string;
  createdAt: string;
}

export interface SystemNotification {
  id: string;
  userId: string; // TARGET user (or "all" for general)
  title: string;
  message: string;
  isSystemAnnouncement: boolean;
  highlightColor?: string; // Hex color for highlighted style
  createdAt: string;
  readBy?: string[]; // user IDs who have read this
}

export interface WithdrawalRequest {
  id: string;
  merchantId: string;
  merchantPhone: string;
  merchantName: string;
  amount: number;
  status: 'pending' | 'approved' | 'rejected';
  comment?: string;
  bankName?: string;
  bankAccount?: string;
  bankHolderName?: string;
  createdAt: string;
}

export interface SystemSettings {
  siteName: string;
  siteLogo: string; // Name of logo SVG or base64
  siteIcon?: string; // Icon of website (favicon)
  themeColor: string; // Neon red primary
  themeGradientEnd: string; // Light neon coral gradient
  banners: string[]; // Promotion images
  customCategories?: { key: string; label: string; icon: string }[];
}

export interface DepositRequest {
  id: string;
  userId: string;
  userPhone: string;
  userName: string;
  amount: number;
  bonus?: number;
  comment?: string; // Optional admin comment/remark
  slipImage: string; // Base64 slip
  status: 'pending' | 'approved' | 'rejected';
  createdAt: string;
}

export interface OnlineActionLog {
  id: string;
  timestamp: string;
  category: string;
  actionName: string;
  description: string;
  operator: string;
  status: 'offline_saved' | 'cloud_synced';
}


