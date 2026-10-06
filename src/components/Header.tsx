/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { ShoppingBag, Sparkles, User, LogIn, Database } from 'lucide-react';
import { User as UserType, SystemSettings } from '../types';
import { SephoraLogo } from './SephoraLogo';

interface HeaderProps {
  settings: SystemSettings;
  currentUser: UserType | null;
  onNavigate: (tab: string) => void;
  cartCount: number;
  onOpenAdmin: () => void;
}

export default React.memo(function Header({ settings, currentUser, onNavigate, cartCount, onOpenAdmin }: HeaderProps) {
  // Extract custom theme color for fallback inline styles if necessary
  const primaryColor = settings.themeColor || '#FF1E27';
  const gradientEnd = settings.themeGradientEnd || '#FF5E62';

  const [logoError, setLogoError] = React.useState(false);

  return (
    <header className="sticky top-0 z-50 bg-white/90 backdrop-blur-md border-b border-gray-100 py-3 px-4 md:px-8 flex justify-between items-center transition-all">
      {/* Brand Logo Group */}
      <div 
        id="header-brand-logo"
        onClick={() => onNavigate('home')} 
        className="flex items-center gap-2.5 cursor-pointer group shrink-0"
      >
        {!logoError && (settings.siteIcon || settings.siteLogo) ? (
          <img 
            src={settings.siteIcon || settings.siteLogo} 
            alt="Website Icon" 
            className="w-11 h-11 object-contain rounded-xl bg-white border border-gray-150 shadow-sm p-0.5 transition-transform group-hover:scale-105"
            referrerPolicy="no-referrer"
            onError={() => setLogoError(true)}
          />
        ) : (
          <SephoraLogo className="w-11 h-11" />
        )}
        <div className="flex flex-col">
          <span 
            id="brand-name"
            className="text-xl font-black tracking-tight text-gray-900 leading-none uppercase font-display"
          >
            {settings.siteName || 'Sephora Thailand'}
          </span>
          <span className="text-[8px] font-bold text-gray-400 uppercase tracking-widest leading-none mt-1">
            Luxury Beauty & Cosmetics
          </span>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex items-center gap-3">
        {/* Admin Quick Entry - visible to Admins/SuperAdmins */}
        {currentUser && (currentUser.role === 'Admin' || currentUser.role === 'SuperAdmin') && (
          <button
            id="header-admin-quick-btn"
            onClick={onOpenAdmin}
            className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold text-rose-600 bg-rose-50 hover:bg-rose-100 transition-colors border border-rose-100"
          >
            <Database size={13} />
            คุมหลังบ้าน (Admin Panel)
          </button>
        )}

        {currentUser ? (
          <div 
            id="header-user-badge"
            onClick={() => onNavigate('profile')} 
            className="flex items-center gap-2 cursor-pointer bg-gray-50 hover:bg-gray-100 px-3 py-1.5 rounded-full transition-colors border border-gray-100"
          >
            {currentUser.avatar && currentUser.avatar.trim() !== "" ? (
              <img 
                src={currentUser.avatar || undefined} 
                alt={currentUser.name} 
                className="w-6 h-6 rounded-full object-cover border border-red-200"
                referrerPolicy="no-referrer"
              />
            ) : (
              <div id="header-user-avatar-placeholder" className="w-6 h-6 rounded-full bg-rose-100 flex items-center justify-center text-[#FF1E27]">
                <User size={12} />
              </div>
            )}
            <div className="flex flex-col items-start leading-none">
              <span className="text-xs font-bold text-gray-700 max-w-[80px] sm:max-w-[120px] truncate">
                {currentUser.nickname || currentUser.name}
              </span>
              <span className="text-[8px] font-semibold text-gray-400 mt-0.5">
                {currentUser.role === 'Merchant' ? 'ร้านค้า' : currentUser.role === 'SuperAdmin' || currentUser.role === 'Admin' ? 'ผู้ดูแล' : 'ลูกค้า'}
              </span>
            </div>
          </div>
        ) : (
          <button
            id="header-login-btn"
            onClick={() => onNavigate('login')}
            className="flex items-center gap-1.5 px-4 py-2 rounded-full text-xs font-bold text-white shadow-md hover:opacity-90 transition-opacity"
            style={{ backgroundImage: `linear-gradient(135deg, ${primaryColor} 0%, ${gradientEnd} 100%)` }}
          >
            <LogIn size={14} />
            เข้าสู่ระบบ
          </button>
        )}

        {/* Quick Cart Trigger */}
        <div 
          id="header-cart-badge"
          onClick={() => onNavigate('cart')}
          className="relative p-2.5 rounded-full bg-gray-50 hover:bg-gray-100 text-gray-600 transition-colors cursor-pointer border border-gray-100"
        >
          <ShoppingBag size={18} />
          {cartCount > 0 && (
            <div id="header-cart-count" className="absolute -top-1 -right-1 min-w-5 h-5 px-1 bg-[#FF1E27] text-white text-[10px] font-black rounded-full flex items-center justify-center border-2 border-white animate-bounce"
                 style={{ backgroundColor: primaryColor }}>
              {cartCount}
            </div>
          )}
        </div>
      </div>
    </header>
  );
});
