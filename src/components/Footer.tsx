/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { Home, ShoppingCart, Receipt, Bell, User } from 'lucide-react';
import { SystemSettings } from '../types';

interface FooterProps {
  currentTab: string;
  onNavigate: (tab: string) => void;
  cartCount: number;
  notificationCount: number;
  ordersCount: number; // to show pending order status badge if they want
  settings: SystemSettings;
}

export default React.memo(function Footer({ currentTab, onNavigate, cartCount, notificationCount, ordersCount, settings }: FooterProps) {
  const primaryColor = settings.themeColor || '#FF1E27';
  const gradientEnd = settings.themeGradientEnd || '#FF5E62';

  const menuItems = [
    { id: 'home', label: 'หน้าแรก', icon: Home, badge: 0 },
    { id: 'cart', label: 'ตะกร้า', icon: ShoppingCart, badge: cartCount },
    { id: 'orders', label: 'การซื้อของฉัน', icon: Receipt, badge: ordersCount },
    { id: 'notifications', label: 'แจ้งเตือน', icon: Bell, badge: notificationCount },
    { id: 'profile', label: 'โปรไฟล์', icon: User, badge: 0 },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-white border-t border-gray-100 shadow-[0_-4px_24px_rgba(0,0,0,0.06)] pb-safe px-2 sm:px-6 md:px-12 transition-all">
      <div className="max-w-lg mx-auto flex justify-between items-center h-16">
        {menuItems.map((item) => {
          const Icon = item.icon;
          const isActive = currentTab === item.id;
          
          return (
            <button
              key={item.id}
              id={`nav-tab-${item.id}`}
              onClick={() => onNavigate(item.id)}
              className="relative flex flex-col items-center justify-center flex-1 h-full py-1 text-center group transition-transform active:scale-95 touch-manipulation"
            >
              {/* Highlight state wrapper */}
              <div 
                id={`nav-icon-box-${item.id}`}
                className={`relative p-2 rounded-xl transition-all duration-300 ${
                  isActive 
                    ? 'scale-110 shadow-sm shadow-red-50 text-white' 
                    : 'text-gray-400 group-hover:text-gray-600'
                }`}
                style={isActive ? {
                  background: `linear-gradient(135deg, ${primaryColor} 0%, ${gradientEnd} 100%)`
                } : undefined}
              >
                <Icon size={isActive ? 20 : 22} className="stroke-[2.2]" />

                {/* Badge component */}
                {item.badge > 0 && (
                  <span 
                    id={`nav-badge-${item.id}`}
                    className="absolute -top-1 -right-1 min-w-[16px] h-4 px-1 flex items-center justify-center text-[9px] font-black text-white rounded-full border border-white animate-pulse"
                    style={{ backgroundColor: isActive ? '#000000' : primaryColor }}
                  >
                    {item.badge}
                  </span>
                )}
              </div>

              {/* Label */}
              <span 
                id={`nav-label-${item.id}`}
                className={`text-[9px] font-bold mt-1 tracking-tight transition-colors ${
                  isActive ? 'text-gray-900 font-extrabold' : 'text-gray-400 group-hover:text-gray-500'
                }`}
              >
                {item.label}
              </span>

              {/* Little active dot indicator */}
              {isActive && (
                <div 
                  id={`nav-active-dot-${item.id}`}
                  className="absolute bottom-0 w-1 h-1 rounded-full"
                  style={{ backgroundColor: primaryColor }}
                />
              )}
            </button>
          );
        })}
      </div>
    </nav>
  );
});
