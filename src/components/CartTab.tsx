/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { ShoppingBag, ChevronRight, MapPin, CreditCard, Gift, ShieldCheck, Ticket, Trash2, Plus, Minus, CheckSquare, Square } from 'lucide-react';
import { Product, User, SystemSettings, OrderItem } from '../types';

interface CartItem {
  id: string; // unique hash of productId + option values combinatory
  product: Product;
  quantity: number;
  selectedOptions: { [category: string]: string };
}

interface CartTabProps {
  cart: CartItem[];
  currentUser: User | null;
  settings: SystemSettings;
  onUpdateCartQty: (itemId: string, newQty: number) => void;
  onRemoveFromCart: (itemId: string) => void;
  onCheckout: (orderData: {
    items: OrderItem[];
    merchantId: string;
    shippingAddress: { name: string; phone: string; address: string; zipcode: string };
    paymentMethod: 'wallet' | 'cod';
    subtotal: number;
    shippingFee: number;
    discount: number;
    grandTotal: number;
  }) => void;
  userWalletBalance: number;
  onNavigate: (tab: string) => void;
}

export default function CartTab({
  cart,
  currentUser,
  settings,
  onUpdateCartQty,
  onRemoveFromCart,
  onCheckout,
  userWalletBalance,
  onNavigate
}: CartTabProps) {
  // Toggle states
  const [isCheckoutStep, setIsCheckoutStep] = useState(false);

  // Selected item IDs in cart for payment
  const [selectedItemIds, setSelectedItemIds] = useState<string[]>([]);

  // Checkout shipping address form
  const [shipName, setShipName] = useState(currentUser?.name || '');
  const [shipPhone, setShipPhone] = useState(currentUser?.phone || '');
  const [shipAddress, setShipAddress] = useState('');
  const [shipZipcode, setShipZipcode] = useState('');
  const [payMethod, setPayMethod] = useState<'wallet' | 'cod'>('wallet');

  // Interactive coupon coupon
  const [couponCode, setCouponCode] = useState('');
  const [appliedDiscount, setAppliedDiscount] = useState(0); // THB discount
  const [couponFeedback, setCouponFeedback] = useState('');

  const themePrimary = settings.themeColor || '#FF1E27';
  const themeGradientEnd = settings.themeGradientEnd || '#FF5E62';

  // Toggle selection for checkout
  const toggleItemSelect = (itemId: string) => {
    setSelectedItemIds(prev =>
      prev.includes(itemId) ? prev.filter(id => id !== itemId) : [...prev, itemId]
    );
  };

  // Select all items
  const toggleSelectAll = () => {
    if (selectedItemIds.length === cart.length) {
      setSelectedItemIds([]);
    } else {
      setSelectedItemIds(cart.map(i => i.id));
    }
  };

  // Group cart items by merchant
  const groupedCart: { [merchantId: string]: { merchantName: string; list: CartItem[] } } = {};
  cart.forEach(item => {
    const mId = item.product.merchantId;
    if (!groupedCart[mId]) {
      groupedCart[mId] = {
        merchantName: item.product.merchantName,
        list: []
      };
    }
    groupedCart[mId].list.push(item);
  });

  // Calculate prices based on ticked/selected IDs only
  const selectedItems = cart.filter(item => selectedItemIds.includes(item.id));
  const subtotalSelected = selectedItems.reduce((acc, current) => {
    return acc + (current.product.price * current.quantity);
  }, 0);

  const shippingFee = selectedItems.length > 0 ? 50 : 0; // Flat 50 thb delivery fee standard
  const discountAmount = appliedDiscount;
  const grandTotal = Math.max(0, subtotalSelected + shippingFee - discountAmount);

  // Apply Coupon Code
  const handleApplyCoupon = () => {
    setCouponFeedback('');
    setAppliedDiscount(0);

    const codeClean = couponCode.trim().toUpperCase();
    if (codeClean === "WELCOMESEPHORA" || codeClean === "WELCOMEPAOPAO") {
      if (subtotalSelected < 500) {
        setCouponFeedback("โค้ดนี้ใช้ได้เมื่อช้อปยอดสิ้นค้าขั้นต่ำ 500 บาทขึ้นไป");
      } else {
        setAppliedDiscount(50);
        setCouponFeedback("ประยุกต์ใช้โค้ด WELCOMESEPHORA: ลดทันที 50 บาท!");
      }
    } else if (codeClean) {
      setCouponFeedback("ไม่พบรหัสคูปองส่วนลดนี้ หรือหมดอายุการใช้งานแล้ว");
    }
  };

  // Reset coupon state when subtotal changes
  useEffect(() => {
    if (subtotalSelected === 0) {
      setAppliedDiscount(0);
      setCouponFeedback('');
    }
  }, [subtotalSelected]);

  // Proceed order confirmations
  const handleConfirmOrder = () => {
    if (!currentUser) {
      alert('กรุณาเข้าสู่ระบบก่อนทำรายการสั่งซื้อค่ะ');
      onNavigate('login');
      return;
    }
    if (!shipName.trim() || !shipPhone.trim() || !shipAddress.trim() || !shipZipcode.trim()) {
      alert('กรุณากรอกข้อมูลจัดส่งให้ครบถ้วนก่อนส่งใบคำขอซื้อค่ะ');
      return;
    }
    if (payMethod === 'wallet' && userWalletBalance < grandTotal) {
      alert(`ยอดเงินในกระเป๋าไม่เพียงพอ (ยอดเงินคงเหลือ: ${userWalletBalance.toLocaleString()} THB) กรุณาเติมเงินผ่านแอดมินก่อนทำรายการสั่งซื้อค่ะ`);
      return;
    }

    // Since the system must distribute orders to their respective merchants, 
    // we make order payloads split per Merchant section so merchants manage their orders cleanly!
    // Group active selected checkout items because "ออเดอร์ต้องแยกของแต่ละร้านค้านั้นๆ ทันที"
    const selectedByMerchant: { [mId: string]: CartItem[] } = {};
    selectedItems.forEach(item => {
      const mId = item.product.merchantId;
      if (!selectedByMerchant[mId]) selectedByMerchant[mId] = [];
      selectedByMerchant[mId].push(item);
    });

    // Fire checkout triggers for each merchant group separated
    Object.keys(selectedByMerchant).forEach(mId => {
      const mItems = selectedByMerchant[mId];
      const mSubtotal = mItems.reduce((sum, item) => sum + (item.product.price * item.quantity), 0);
      const mShipping = 50; // default fee per shop order
      const mDiscount = Object.keys(selectedByMerchant).length > 1 
        ? Math.floor(discountAmount / Object.keys(selectedByMerchant).length) 
        : discountAmount; // Pro-rate coupons
      const mGrand = Math.max(0, mSubtotal + mShipping - mDiscount);

      // Convert items to OrderItem type
      const orderItems: OrderItem[] = mItems.map(cit => ({
        productId: cit.product.id,
        name: cit.product.name,
        image: cit.product.image,
        price: cit.product.price,
        quantity: cit.quantity,
        options: cit.selectedOptions
      }));

      onCheckout({
        items: orderItems,
        merchantId: mId,
        shippingAddress: {
          name: shipName,
          phone: shipPhone,
          address: shipAddress,
          zipcode: shipZipcode
        },
        paymentMethod: payMethod,
        subtotal: mSubtotal,
        shippingFee: mShipping,
        discount: mDiscount,
        grandTotal: mGrand
      });
    });

    // Remove checked-out items from cart state globally
    selectedItemIds.forEach(itemId => onRemoveFromCart(itemId));

    // Redirect user to My Orders screen
    alert('บันทึกคำสั่งซื้อของคุณเรียบร้อยแล้ว! กำลังนำทางไปติดตามสถานะ');
    setIsCheckoutStep(false);
    setSelectedItemIds([]);
    onNavigate('orders');
  };

  if (cart.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[70vh] p-8 text-center animate-fade-in bg-white rounded-3xl border border-gray-100 shadow-sm mx-4 mt-6">
        <div className="w-20 h-20 bg-rose-50 rounded-full flex items-center justify-center mb-4">
          <ShoppingBag size={36} className="text-[#FF1E27] stroke-[1.2]" />
        </div>
        <h3 className="text-sm font-black text-gray-800 uppercase tracking-wider font-display">ไม่มีสินค้าในตะกร้าของคุณ</h3>
        <p className="text-xs text-gray-400 max-w-sm mt-1 mb-6 leading-relaxed">
          ความสุขของการแต่งห้องและสวมใส่เกิดขึ้นได้ เพียงเพิ่มของชิ้นโปรดเก๋ๆ สไตล์เรโทรฟิวเจอร์เข้าไปที่หน้าแรกเลยค่ะ
        </p>
        <button
          onClick={() => onNavigate('home')}
          className="px-6 py-3 rounded-full text-xs font-black text-white hover:opacity-90 shadow-md transition-opacity"
          style={{ background: `linear-gradient(135deg, ${themePrimary} 0%, ${themeGradientEnd} 100%)` }}
        >
          กลับไปเลือกกระเป๋าหมวกเสื้อเสื้อผ้า
        </button>
      </div>
    );
  }

  return (
    <div className="px-4 py-8 md:px-8 max-w-3xl mx-auto pb-32 animate-fade-in">
      
      {/* STEPS TIMELINE WRAPPER */}
      <div className="flex justify-center items-center gap-2 mb-8 bg-white p-4 rounded-2xl border border-gray-100 shadow-sm max-w-md mx-auto">
        <span className={`text-xs font-black ${!isCheckoutStep ? 'text-red-500 font-extrabold' : 'text-gray-400'}`}>
          1. ตรวจสอบตะกร้า (Cart)
        </span>
        <ChevronRight size={14} className="text-gray-300" />
        <span className={`text-xs font-black ${isCheckoutStep ? 'text-red-500 font-extrabold' : 'text-gray-400'}`}>
          2. ชำระและส่งของ (Checkout)
        </span>
      </div>

      {!isCheckoutStep ? (
        // CART ITEMS VIEW
        <div className="space-y-6">
          <div className="flex justify-between items-center bg-white p-4 rounded-2xl border border-gray-100 shadow-sm">
            <button
              onClick={toggleSelectAll}
              className="flex items-center gap-2 text-xs font-bold text-gray-600 hover:text-gray-900"
            >
              {selectedItemIds.length === cart.length ? (
                <CheckSquare size={18} className="text-red-500" />
              ) : (
                <Square size={18} className="text-gray-400" />
              )}
              เลือกทั้งหมด ({cart.length} รายการ)
            </button>
            <span className="text-[10px] text-gray-400 font-bold font-mono">
              PAOPAO TRANSACTION ENGINE
            </span>
          </div>

          {/* Separation list sections per Merchants */}
          {Object.keys(groupedCart).map((mId) => {
            const section = groupedCart[mId];
            return (
              <div key={mId} className="bg-white rounded-3xl border border-gray-100 overflow-hidden shadow-sm">
                
                {/* HEAD SECTION SHOWING MERCHANT NAME - LOCKED */}
                <div className="bg-gray-50 border-b border-gray-100 px-4 py-3 flex items-center justify-between">
                  <span className="text-xs font-black text-gray-800 uppercase tracking-wider font-display">
                    🏪 ร้านค้า: {section.merchantName}
                  </span>
                  <span className="text-[9px] text-[#FF1E27] font-extrabold bg-[#FF1E27]/5 px-2 py-0.5 rounded-full border border-[#FF1E27]/10">
                    S-SHOP Verified
                  </span>
                </div>

                {/* ITEMS WITHIN THIS STORE CONTAINER */}
                <div className="divide-y divide-gray-50">
                  {section.list.map((item) => {
                    const isSelected = selectedItemIds.includes(item.id);
                    return (
                      <div 
                        key={item.id} 
                        id={`cart-item-${item.id}`}
                        className="p-4 flex gap-3 sm:gap-4 items-center transition-colors hover:bg-gray-50"
                      >
                        {/* Checkbox item */}
                        <button
                          id={`cart-select-checkbox-${item.id}`}
                          onClick={() => toggleItemSelect(item.id)}
                          className="text-gray-400 hover:text-gray-600 focus:outline-none shrink-0"
                        >
                          {isSelected ? (
                            <CheckSquare size={18} className="text-[#FF1E27]" />
                          ) : (
                            <Square size={18} className="text-gray-300" />
                          )}
                        </button>

                        {/* Thumbnail image */}
                        <img 
                          src={item.product.image || 'https://images.unsplash.com/photo-1522335789203-aabd1fc54bc9?auto=format&fit=crop&q=80&w=400'} 
                          alt={item.product.name} 
                          loading="lazy"
                          className="w-16 h-16 rounded-xl object-cover bg-gray-150 shrink-0 border border-gray-100"
                          referrerPolicy="no-referrer"
                          onError={(e) => {
                            const el = e.currentTarget;
                            if (!el.dataset.fallback) {
                              el.dataset.fallback = '1';
                              el.src = 'https://images.unsplash.com/photo-1522335789203-aabd1fc54bc9?auto=format&fit=crop&q=80&w=400';
                            }
                          }}
                        />

                        {/* Content detail */}
                        <div className="flex-1 min-w-0">
                          <h4 className="text-xs sm:text-sm font-bold text-gray-800 truncate leading-snug">
                            {item.product.name}
                          </h4>
                          
                          {/* Attribute options badge */}
                          {Object.keys(item.selectedOptions).length > 0 && (
                            <div className="flex flex-wrap gap-1 mt-1">
                              {Object.entries(item.selectedOptions).map(([cat, val]) => (
                                <span key={cat} className="text-[8px] font-bold text-gray-500 bg-gray-100 px-1.5 py-0.5 rounded">
                                  {cat}: {val}
                                </span>
                              ))}
                            </div>
                          )}

                          <div className="flex justify-between items-center mt-2">
                            {/* Price */}
                            <span className="text-sm font-black font-mono text-gray-900">
                              {item.product.price.toLocaleString()} <span className="text-[9px] text-gray-400 font-extrabold">THB</span>
                            </span>

                            {/* Qty controller inside cart item */}
                            <div className="flex items-center border border-gray-200 rounded-lg overflow-hidden bg-white shadow-sm">
                              <button
                                onClick={() => onUpdateCartQty(item.id, -1)}
                                className="p-1 px-1.5 text-gray-400 hover:bg-gray-50 hover:text-gray-700 transition-colors"
                              >
                                <Minus size={10} />
                              </button>
                              <span className="text-[11px] font-extrabold px-2 text-center font-mono text-gray-700">
                                {item.quantity}
                              </span>
                              <button
                                onClick={() => onUpdateCartQty(item.id, 1)}
                                className="p-1 px-1.5 text-gray-400 hover:bg-gray-50 hover:text-gray-700 transition-colors"
                              >
                                <Plus size={10} />
                              </button>
                            </div>
                          </div>
                        </div>

                        {/* Remove item fully */}
                        <button
                          id={`cart-remove-item-${item.id}`}
                          onClick={() => onRemoveFromCart(item.id)}
                          className="p-1.5 text-gray-300 hover:text-[#FF1E27] rounded-lg hover:bg-red-50 shrink-0 transition-colors"
                          title="ลบออกจากตะกร้า"
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    );
                  })}
                </div>

              </div>
            );
          })}

          {/* BOTTOM TOTAL SUMMARY SLIP BAR */}
          <div className="bg-white rounded-3xl border border-gray-100 p-6 shadow-md space-y-4">
            <div className="flex justify-between text-xs font-bold text-gray-500">
              <span>เลือกสินค้าชำระร่วมกัน:</span>
              <span className="text-gray-700">{selectedItems.length} รายการ</span>
            </div>
            
            <div className="flex justify-between items-baseline border-t border-dashed pt-4">
              <span className="text-sm font-black text-gray-800">ยอดราคารวมทั้งสิ้น:</span>
              <div className="text-right">
                <span className="text-xl sm:text-2xl font-black font-mono text-transparent bg-clip-text bg-gradient-to-r from-[#FF1E27] to-[#FF5E62]"
                      style={{ backgroundImage: `linear-gradient(to right, ${themePrimary}, ${themeGradientEnd})` }}>
                  {subtotalSelected.toLocaleString()}
                </span>
                <span className="text-[10px] font-bold text-gray-400 block mt-0.5">THB (ยังไม่รวมค่าส่ง)</span>
              </div>
            </div>

            <button
              id="cart-checkout-proceed-btn"
              onClick={() => {
                if (selectedItems.length === 0) {
                  alert('กรุณาเลือกสินค้าอย่างน้อย 1 รายการเพื่อดำเนินกระบวนการชำระเงินค่ะ');
                  return;
                }
                setIsCheckoutStep(true);
              }}
              className="w-full py-4 rounded-2xl text-xs sm:text-sm font-black text-white shadow-xl transition-all duration-300 active:scale-[0.98]"
              style={{ background: `linear-gradient(135deg, ${themePrimary} 0%, ${themeGradientEnd} 100%)` }}
            >
              ดำเนินการชำระเงิน ({selectedItems.length} รายการ)
            </button>
          </div>
        </div>
      ) : (
        // CHECKOUT WRAPPER FORM SCREEN
        <div className="space-y-6">
          {/* Shipping Form Input */}
          <div className="bg-white rounded-3xl p-6 border border-gray-100 shadow-sm space-y-4">
            <h3 className="text-sm font-black text-gray-800 uppercase tracking-wider block font-display mb-2 flex items-center gap-1.5">
              <MapPin size={16} className="text-[#FF1E27]" />
              ข้อมูลจัดส่งพัสดุด่วน (Shipping Address)
            </h3>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-gray-500">ชื่อจริงผู้รับสินค้า</label>
                <input
                  type="text"
                  placeholder="ป้อนชื่อผู้รับ"
                  className="w-full bg-gray-50 border rounded-xl p-2.5 text-xs font-semibold focus:outline-none"
                  value={shipName}
                  onChange={(e) => setShipName(e.target.value)}
                />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-gray-500">เบอร์โทรศัพท์ติดต่อกลับ</label>
                <input
                  type="text"
                  placeholder="ป้อนเบอร์มือถือ"
                  className="w-full bg-gray-50 border rounded-xl p-2.5 text-xs font-bold focus:outline-none"
                  value={shipPhone}
                  onChange={(e) => setShipPhone(e.target.value)}
                />
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-bold text-gray-500">ที่อยู่จัดส่งโดยละเอียด</label>
              <textarea
                placeholder="อาคาร, บ้านเลขที่, ซอย, ถนน, ตำบล, อำเภอ, จังหวัด"
                className="w-full bg-gray-50 border rounded-xl p-2.5 text-xs font-semibold focus:outline-none h-16 resize-none"
                value={shipAddress}
                onChange={(e) => setShipAddress(e.target.value)}
              />
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-bold text-gray-500">รหัสไปรษณีย์ (Zipcode)</label>
              <input
                type="text"
                maxLength={5}
                placeholder="เช่น 10400"
                className="w-full bg-gray-50 border rounded-xl p-2.5 text-xs font-bold focus:outline-none"
                value={shipZipcode}
                onChange={(e) => setShipZipcode(e.target.value)}
              />
            </div>
          </div>

          {/* Payment options selection */}
          <div className="bg-white rounded-3xl p-6 border border-gray-100 shadow-sm space-y-4">
            <h3 className="text-sm font-black text-gray-800 uppercase tracking-wider block font-display mb-2 flex items-center gap-1.5">
              <CreditCard size={16} className="text-[#FF1E27]" />
              ช่องทางชำระเงินที่ต้องการ (Payment Method)
            </h3>

            <div className="p-4 rounded-2xl border border-red-500 bg-red-50/50 outline-2 outline-red-500 shadow-sm shadow-red-100 flex items-center justify-between">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-black text-gray-800">Wallet</span>
                </div>
                <span className="text-[10px] font-bold text-gray-500 block">
                  ยอดเงินคงเหลือในกระเป๋า: <span className="font-mono text-rose-600 font-black text-xs">{userWalletBalance.toLocaleString()} THB</span>
                </span>
              </div>
              <div className="w-3 h-3 bg-red-500 rounded-full animate-ping"></div>
            </div>
          </div>

          {/* Interactive Coupon Apply Block */}
          <div className="bg-white rounded-3xl p-6 border border-gray-100 shadow-sm space-y-3">
            <h4 className="text-xs font-black text-gray-700 flex items-center gap-1.5">
              <Ticket size={14} className="text-[#FF1E27]" />
              โค้ดส่วนลดโปรโมชั่น (Promo Code Coupons)
            </h4>
            <div className="flex gap-2">
              <input
                type="text"
                placeholder="ป้อนรหัส เช่น WELCOMESEPHORA"
                className="flex-1 bg-gray-50 border rounded-xl p-2.5 text-xs font-bold uppercase tracking-wide focus:outline-none focus:border-red-500"
                value={couponCode}
                onChange={(e) => setCouponCode(e.target.value)}
              />
              <button
                type="button"
                onClick={handleApplyCoupon}
                className="px-4 py-2 bg-gray-900 hover:bg-black text-white rounded-xl text-xs font-bold shrink-0"
              >
                ตกลงใช้โค้ด
              </button>
            </div>
            {couponFeedback && (
              <p className="text-[10px] font-bold text-rose-500 mt-1 font-mono">
                {couponFeedback}
              </p>
            )}

          </div>

          {/* BILL RECEIPT SUMMARY - BIG FONT HIGHLIGHTS */}
          <div className="bg-white rounded-3xl border border-gray-100 p-6 shadow-md divide-y divide-gray-100 divide-dashed space-y-3">
            <div className="space-y-2 pb-2">
              <span className="text-xs font-black text-gray-800 tracking-wider font-display uppercase block mb-2">สรุปบิลสั่งนำส่งพัสดุ</span>
              {selectedItems.map(cit => (
                <div key={cit.id} className="flex justify-between text-[11px] font-bold text-gray-600 font-mono">
                  <span className="truncate max-w-[190px]">
                    {cit.product.name} ({cit.quantity}x)
                  </span>
                  <span>{(cit.product.price * cit.quantity).toLocaleString()} THB</span>
                </div>
              ))}
            </div>

            <div className="py-3 space-y-2 text-xs font-bold text-gray-500">
              <div className="flex justify-between">
                <span>ค่าบริการราคาสินค้ารวม:</span>
                <span className="font-mono text-gray-800">{subtotalSelected.toLocaleString()} THB</span>
              </div>
              <div className="flex justify-between">
                <span>ค่าจัดส่งแบนเนอร์ด่วน (Flat Fee):</span>
                <span className="font-mono text-gray-800">+{shippingFee} THB</span>
              </div>
              {appliedDiscount > 0 && (
                <div className="flex justify-between text-teal-600">
                  <span className="flex items-center gap-1">🎟️ ตั๋วส่วนลดลดหย่อน:</span>
                  <span className="font-mono">-{appliedDiscount} THB</span>
                </div>
              )}
            </div>

            {/* GRAND TOTAL COMPONENT - EXTRA LARGE */}
            <div className="pt-4 flex justify-between items-center">
              <span className="text-sm font-black text-gray-950 font-display">
                ยอดชำระเงินทั้งหมด
              </span>
              <div className="text-right">
                <span id="checkout-grand-total" className="text-2xl sm:text-3xl font-black font-mono text-[#FF1E27] tracking-tight">
                  {grandTotal.toLocaleString()}
                </span>
                <span className="text-[10px] font-bold text-gray-400 block mt-0.5">THB (บาทถ้วน)</span>
              </div>
            </div>

            {/* Trust assurances for final payment checkout processes */}
            <div className="pt-3 flex gap-2 items-center text-[10px] text-teal-600 font-bold bg-teal-50 px-3.5 py-2.5 rounded-xl border border-teal-100 border-dashed">
              <ShieldCheck size={16} className="shrink-0 text-teal-600" />
              <span>Sephora Thailand Security SSL: บัญชีและยอดถอนของคุณจะได้รับการรับประกันโดยสมบูรณ์</span>
            </div>

            {/* Form actions */}
            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={() => setIsCheckoutStep(false)}
                className="flex-1 py-3 text-center bg-gray-50 border border-gray-100 hover:bg-gray-100 text-gray-600 rounded-xl text-xs font-bold"
              >
                ย้อนกลับ
              </button>
              <button
                type="button"
                id="checkout-confirm-btn"
                onClick={handleConfirmOrder}
                className="flex-1 py-3.5 text-center text-xs font-black text-white shadow-xl transition-transform active:scale-[0.98]"
                style={{ background: `linear-gradient(135deg, ${themePrimary} 0%, ${themeGradientEnd} 100%)` }}
              >
                ยืนยันการทำสั่งจัดซื้อร่วมกัน
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
