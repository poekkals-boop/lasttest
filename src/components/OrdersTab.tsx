/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { Package, Truck, Calendar, Store, CheckCircle, HelpCircle, XCircle, ChevronRight, AlertCircle } from 'lucide-react';
import { Order, User, SystemSettings } from '../types';
import { formatThaiDateTime } from '../utils/thaiTime';

interface OrdersTabProps {
  orders: Order[];
  currentUser: User | null;
  settings: SystemSettings;
  onCancelOrder: (orderId: string) => void;
  onMarkReceived: (orderId: string) => void;
  onNavigate: (tab: string) => void;
}

type OrderSubTab = 'waiting_approval' | 'preparing' | 'in_transit' | 'completed' | 'cancelled';

export default function OrdersTab({
  orders,
  currentUser,
  settings,
  onCancelOrder,
  onMarkReceived,
  onNavigate
}: OrdersTabProps) {
  const [activeSubTab, setActiveSubTab] = useState<OrderSubTab>('waiting_approval');

  const themePrimary = settings.themeColor || '#FF1E27';

  // Sub tabs metadata
  const tabMetadata = [
    { id: 'waiting_approval' as OrderSubTab, label: 'รออนุมัติ', color: 'text-amber-600 bg-amber-50' },
    { id: 'preparing' as OrderSubTab, label: 'เตรียมจัดส่ง', color: 'text-indigo-600 bg-indigo-50' },
    { id: 'in_transit' as OrderSubTab, label: 'อยู่ระหว่างส่ง', color: 'text-blue-600 bg-blue-50' },
    { id: 'completed' as OrderSubTab, label: 'จัดส่งสำเร็จ', color: 'text-teal-600 bg-teal-50' },
    { id: 'cancelled' as OrderSubTab, label: 'ยกเลิกแล้ว', color: 'text-gray-500 bg-gray-50' },
  ];

  // If no user is logged in, promt them to log in
  if (!currentUser) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] p-8 text-center animate-fade-in bg-white rounded-3xl border border-gray-100 shadow-sm mx-4 mt-6">
        <Package size={40} className="text-gray-350 stroke-[1.5] mb-2" />
        <p className="text-sm font-bold text-gray-500">กรุณาเข้าสู่ระบบก่อนเพื่อตรวจสอบประวัติคำสั่งซื้อของตนเองจ้า</p>
        <button
          onClick={() => onNavigate('login')}
          className="mt-4 px-5 py-2.5 rounded-full text-xs font-bold text-white shadow-md"
          style={{ background: `linear-gradient(135deg, ${themePrimary} 0%, ${themePrimary}ee 100%)` }}
        >
          ไปหน้าเข้าสู่ระบบ
        </button>
      </div>
    );
  }

  // Filter orders where customer is the logged-in current user and deduplicate by id
  const userOrderMap = new Map<string, Order>();
  orders
    .filter(ord => ord.customerId === currentUser.id)
    .forEach(ord => {
      if (ord && ord.id) userOrderMap.set(ord.id, ord);
    });
  const userOrders = Array.from(userOrderMap.values());

  // Group by current active sub tab
  const filteredOrders = userOrders.filter(ord => ord.status === activeSubTab);

  return (
    <div className="px-4 py-8 md:px-8 max-w-2xl mx-auto pb-32 animate-fade-in">
      <div className="mb-6">
        <h2 className="text-sm font-black text-gray-800 uppercase tracking-wider block font-display mb-1 flex items-center gap-1.5">
          <Truck size={17} className="text-[#FF1E27]" />
          การติดตามพัสดุ และประวัติสั่งซื้อของฉัน (My Orders)
        </h2>
        <p className="text-[11px] text-gray-400 font-bold uppercase tracking-widest font-mono">
          Customer Trace: {currentUser?.name} ({currentUser?.id})
        </p>
      </div>

      {/* SUB-TABS SELECTOR SCROLL BAR */}
      <div className="no-scrollbar overflow-x-auto flex gap-1 bg-white p-1 rounded-2xl border border-gray-100 shadow-sm mb-6 sticky top-16 z-20">
        {tabMetadata.map((tab) => {
          const isActive = activeSubTab === tab.id;
          const count = userOrders.filter(o => o.status === tab.id).length;
          
          return (
            <button
              key={tab.id}
              id={`orders-subtab-${tab.id}`}
              onClick={() => setActiveSubTab(tab.id)}
              className={`flex-1 min-w-[85px] py-2.5 px-2 text-[10px] font-black rounded-xl transition-all cursor-pointer border flex flex-col items-center justify-center gap-1 shrink-0 ${
                isActive 
                  ? 'bg-gray-900 border-gray-900 text-white shadow-sm scale-102' 
                  : 'bg-white border-transparent text-gray-400 hover:text-gray-600'
              }`}
            >
              <span>{tab.label}</span>
              <span className={`text-[9px] px-1.5 py-0.2 rounded-full font-mono ${isActive ? 'bg-white text-gray-900 font-extrabold' : 'bg-gray-100 text-gray-500'}`}>
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {/* FILTERED ORDERS LISTINGS */}
      {filteredOrders.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-3xl border border-gray-100 shadow-sm p-8 flex flex-col items-center">
          <Package size={40} className="text-gray-300 stroke-[1.2] mb-2" />
          <p className="text-xs font-bold text-gray-400">ยังไม่มีรายการสั่งซื้อใดๆ ในหมวดหมู่นี้</p>
          <button
            onClick={() => onNavigate('home')}
            className="mt-4 text-xs font-black text-red-500 hover:underline"
          >
            ไปหน้าช้อปปิ้งเพื่อสั่งผ้าเท่ๆ ตอนนี้เลย 🛍️
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredOrders.map((ord, oIdx) => {
            const dateStr = formatThaiDateTime(ord.createdAt);

            return (
              <div 
                key={`cust-order-${ord.id}-${ord.createdAt || oIdx}`} 
                id={`customer-order-card-${ord.id}`}
                className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden"
              >
                {/* Header card meta */}
                <div className="bg-gray-50/50 px-4 py-3 border-b border-gray-100 flex justify-between items-center text-xs">
                  <div className="space-y-0.5">
                    <span className="text-[10px] font-black text-gray-800 font-mono tracking-tight block">
                      เลขที่บิล: {ord.id}
                    </span>
                    <span className="text-[9px] font-bold text-gray-400 flex items-center gap-1">
                      <Calendar size={10} /> ทำรายการเมื่อ {dateStr}
                    </span>
                  </div>
                  <span className="text-[10px] font-black uppercase text-rose-500 font-mono bg-rose-50 px-2 py-0.5 rounded-full border border-rose-100">
                    {ord.paymentMethod === 'wallet' ? '💳 ชำระแล้ว (Wallet)' : '🚚 เก็บเงินปลายทาง (COD)'}
                  </span>
                </div>

                {/* Products inner summary */}
                <div className="divide-y divide-gray-50 p-4">
                  {ord.items.map((it, idx) => (
                    <div key={idx} className="flex gap-3 py-2 text-xs">
                      <img 
                        src={it.image || 'https://images.unsplash.com/photo-1522335789203-aabd1fc54bc9?auto=format&fit=crop&q=80&w=400'} 
                        alt={it.name} 
                        loading="lazy"
                        className="w-12 h-12 object-cover rounded-xl bg-gray-50 border shrink-0" 
                        referrerPolicy="no-referrer"
                        onError={(e) => {
                          const el = e.currentTarget;
                          if (!el.dataset.fallback) {
                            el.dataset.fallback = '1';
                            el.src = 'https://images.unsplash.com/photo-1522335789203-aabd1fc54bc9?auto=format&fit=crop&q=80&w=400';
                          }
                        }}
                      />
                      <div className="flex-1 min-w-0">
                        <h4 className="font-bold text-gray-800 truncate leading-snug">
                          {it.name}
                        </h4>
                        {/* Selected options parameters */}
                        {Object.keys(it.options).length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-0.5">
                            {Object.entries(it.options).map(([cat, val]) => (
                              <span key={cat} className="text-[8px] font-bold text-gray-400 bg-gray-50 px-1 py-0.1 rounded">
                                {cat}: {val}
                              </span>
                            ))}
                          </div>
                        )}
                        <div className="flex justify-between text-[10px] text-gray-500 font-bold mt-1">
                          <span>จำนวน: {it.quantity} ชิ้น</span>
                          <span className="font-mono text-gray-850">ราคา {it.price.toLocaleString()} THB</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Delivery details */}
                <div className="bg-gray-50/40 px-4 py-3 flex flex-col gap-1.5 border-t border-gray-50 text-[11px] text-gray-500 font-semibold border-b">
                  <p className="text-gray-700 font-extrabold flex items-center gap-1 leading-none">
                    📌 ข้อมูลผู้รับพัสดุ: {ord.shippingAddress.name} ({ord.shippingAddress.phone})
                  </p>
                  <p className="line-clamp-1 leading-none">
                    ที่อยู่จัดส่ง: {ord.shippingAddress.address} {ord.shippingAddress.zipcode}
                  </p>
                </div>

                {/* Footer totals & action triggers */}
                <div className="px-4 py-3.5 bg-white flex justify-between items-center">
                  <div className="leading-none text-left">
                    <span className="text-[10px] font-bold text-gray-400 block mb-0.5">ยอดรวมสุทธิทั้งสิ้น:</span>
                    <span className="text-base font-black font-mono text-gray-900">
                      {ord.grandTotal.toLocaleString()} <span className="text-[9px] font-extrabold text-gray-400">THB</span>
                    </span>
                  </div>

                  {/* Context dynamic buttons */}
                  {ord.status === 'waiting_approval' && (
                    <button
                      id={`cancel-order-btn-${ord.id}`}
                      onClick={() => {
                        alert("คำสั่งซื้อดังกล่าวไม่สามารถยกเลิกได้เนื่องจากร้านค้าดังกล่าวเป็นร้านค้าใหม่ โปรดติดต่อผู้ขายด้วยตัวท่านเอง ขอบคุณค่ะ");
                      }}
                      className="px-4 py-2 border border-rose-200 hover:bg-rose-50 rounded-xl text-[10px] font-extrabold text-rose-600 transition-colors"
                    >
                      ❌ ยกเลิกสินค้าในบิลนี้
                    </button>
                  )}

                  {ord.status === 'in_transit' && (
                    <button
                      id={`mark-received-btn-${ord.id}`}
                      onClick={() => {
                        onMarkReceived(ord.id);
                      }}
                      className="px-4 py-2 text-[10px] font-black text-white hover:opacity-90 rounded-xl flex items-center gap-1 transition-all shadow-md shadow-red-100"
                      style={{ background: `linear-gradient(135deg, ${settings.themeColor || '#FF1E27'} 0%, ${settings.themeGradientEnd || '#FF5E62'} 100%)` }}
                    >
                      <CheckCircle size={11} /> ได้รับผลิตภัณฑ์แล้วเรียบร้อย
                    </button>
                  )}

                  {ord.status === 'preparing' && (
                    <span className="text-[10px] font-extrabold text-indigo-700 bg-indigo-50 border border-indigo-100 px-3 py-1.5 rounded-xl flex items-center gap-1">
                      <Store size={11} /> ร้านค้ากำลังจัดเตรียมพัสดุ
                    </span>
                  )}

                  {ord.status === 'completed' && (
                    <span className="text-[10px] font-extrabold text-teal-700 bg-teal-50 border border-teal-100 px-3 py-1.5 rounded-xl flex items-center gap-1">
                      <CheckCircle size={11} /> พัสดุถูกจัดส่งเรียบร้อย
                    </span>
                  )}

                  {ord.status === 'cancelled' && (
                    <span className="text-[10px] font-extrabold text-gray-500 bg-gray-50 border border-gray-150 px-3 py-1.5 rounded-xl flex items-center gap-1">
                      <XCircle size={11} /> รายการถูกยกเลิกถอนทุนคืน
                    </span>
                  )}
                </div>

              </div>
            );
          })}
        </div>
      )}

    </div>
  );
}
