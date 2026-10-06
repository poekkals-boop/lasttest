/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { 
  User as UserIcon, Wallet, MessageSquare, Shield, ClipboardList, LogOut, 
  ChevronRight, ArrowUpRight, ArrowDownLeft, X, Sparkles, Image, CheckCircle, Smartphone, AlertTriangle,
  LayoutGrid, Edit3, Plus, Minus
} from 'lucide-react';
import { User, Order, ChatMessage, SystemSettings, WithdrawalRequest, DepositRequest, Product } from '../types';
import { compressImage, uploadImageToCloud } from '../db/image_compressor';
import { formatThaiDateTimeStandard, formatThaiChatTime, formatThaiDateTime } from '../utils/thaiTime';
import { THAI_BANKS, BankLogo, findBank, renderSelectedBankInfo } from '../utils/bankUtils';

interface ProfileTabProps {
  currentUser: User | null;
  settings: SystemSettings;
  orders: Order[];
  chats: ChatMessage[];
  withdrawals: WithdrawalRequest[];
  deposits: DepositRequest[];
  onLogout: () => void;
  onUpdateAvatar: (url: string) => void;
  onUpdatePersonalInfo: (info: { nickname?: string; dob?: string; bankName?: string; bankAccount?: string; bankHolderName?: string }) => void;
  onSendChatMessage: (msg: string, img?: string) => void;
  onRequestWithdrawal: (amount: number) => void;
  onMerchantAcceptOrder: (orderId: string) => void;
  onNavigate: (tab: string) => void;
  onUpdateDeposits: (updated: DepositRequest[]) => void;
  products: Product[];
  onEditProduct: (updated: Product) => void;
}

export default function ProfileTab({
  currentUser,
  settings,
  orders,
  chats,
  withdrawals,
  deposits,
  onLogout,
  onUpdateAvatar,
  onUpdatePersonalInfo,
  onSendChatMessage,
  onRequestWithdrawal,
  onMerchantAcceptOrder,
  onNavigate,
  onUpdateDeposits,
  products,
  onEditProduct
}: ProfileTabProps) {
  
  // Retrieve all users from localStorage to resolve buyer's account name
  const allUsersList: User[] = React.useMemo(() => {
    try {
      return JSON.parse(localStorage.getItem("paopao_users") || "[]");
    } catch {
      return [];
    }
  }, [orders]);
  
  // Sub-Navigation within Profile tab
  const [profileView, setProfileView] = useState<'index' | 'wallet_history' | 'live_chat' | 'personal_info' | 'merchant_orders' | 'merchant_products'>('index');

  // Products state for merchant dashboard editing
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [isUploadingEditImage, setIsUploadingEditImage] = useState(false);
  const [isUploadingEditAdditionalImage, setIsUploadingEditAdditionalImage] = useState(false);
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);
  const [isUploadingSlip, setIsUploadingSlip] = useState(false);

  // Dynamic categories helper for product editing in profile tab
  const dynamicCategories = React.useMemo(() => {
    const list = [
      { key: 'ALL', label: 'ทั้งหมด (Show All)', icon: '🛍️' },
      { key: 'APPAREL', label: 'เครื่องยืด & สตรีทแวร์', icon: '👕' },
      { key: 'BAGS', label: 'กระเป๋าหรูหรา', icon: '🎒' },
      { key: 'CAPS', label: 'หมวกบักเก็ต แฟชั่น', icon: '🧢' },
      { key: 'TUMBLER', label: 'แก้วสแตนเลสเก็บเย็น', icon: '🥤' }
    ];

    const customCats = settings.customCategories || [];
    customCats.forEach(cat => {
      if (!list.some(c => c.key === cat.key)) {
        list.push(cat);
      }
    });

    (products || []).forEach(p => {
      if (p.category) {
        const catKey = p.category.toUpperCase();
        const exists = list.some(c => c.key === catKey || c.label.toUpperCase() === p.category?.toUpperCase());
        if (!exists) {
          list.push({
            key: catKey,
            label: p.category,
            icon: '📦'
          });
        }
      }
    });

    return list;
  }, [settings.customCategories, products]);

  // Handle image file selection for editing a product in Profile Tab
  const handleImageFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setIsUploadingEditImage(true);
      try {
        const cloudUrl = await uploadImageToCloud(file);
        if (cloudUrl && editingProduct) {
          setEditingProduct({ ...editingProduct, image: cloudUrl });
        }
      } catch (err) {
        console.error("ProfileTab upload error:", err);
        alert("ไม่สามารถอัปโหลดหรือบีบอัดไฟล์รูปภาพได้ค่ะ ❌");
      } finally {
        setIsUploadingEditImage(false);
      }
    }
  };

  const handleMainImagePaste = async (e: React.ClipboardEvent<any>) => {
    const items = e.clipboardData?.items;
    if (!items) return;
    
    let hasImage = false;
    for (let i = 0; i < items.length; i++) {
      if (items[i].type.indexOf('image') !== -1) {
        hasImage = true;
        break;
      }
    }
    
    if (hasImage) {
      e.preventDefault();
      for (let i = 0; i < items.length; i++) {
        if (items[i].type.indexOf('image') !== -1) {
          const file = items[i].getAsFile();
          if (file) {
            setIsUploadingEditImage(true);
            try {
              const cloudUrl = await uploadImageToCloud(file);
              if (cloudUrl && editingProduct) {
                setEditingProduct(prev => prev ? { ...prev, image: cloudUrl } : null);
              }
            } catch (err) {
              console.error("Paste upload error:", err);
              alert("ไม่สามารถอัปโหลดรูปภาพที่คัดลอกมาได้ค่ะ ❌");
            } finally {
              setIsUploadingEditImage(false);
            }
            break;
          }
        }
      }
    }
  };

  const handleAdditionalImagesPaste = async (e: React.ClipboardEvent<any>) => {
    const items = e.clipboardData?.items;
    if (!items) return;
    
    const files: File[] = [];
    for (let i = 0; i < items.length; i++) {
      if (items[i].type.indexOf('image') !== -1) {
        const file = items[i].getAsFile();
        if (file) {
          files.push(file);
        }
      }
    }
    
    if (files.length > 0) {
      e.preventDefault();
      setIsUploadingEditAdditionalImage(true);
      try {
        const urls = await Promise.all(
          files.map(file => uploadImageToCloud(file))
        );
        const validUrls = urls.filter(Boolean);
        if (validUrls.length > 0) {
          setEditingProduct(prev => {
            if (!prev) return null;
            const currentImgs = prev.images || [];
            return {
              ...prev,
              images: [...currentImgs, ...validUrls]
            };
          });
        }
      } catch (err) {
        console.error("Paste additional upload error:", err);
        alert("ไม่สามารถอัปโหลดรูปภาพเพิ่มเติมที่คัดลอกมาได้ค่ะ ❌");
      } finally {
        setIsUploadingEditAdditionalImage(false);
      }
    }
  };

  const handleSaveEditProduct = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingProduct) return;
    
    const originalProd = products.find(p => p.id === editingProduct.id);
    const alignedProduct = { ...editingProduct };
    
    if (currentUser?.role !== 'Admin' && currentUser?.role !== 'SuperAdmin' && originalProd) {
      alignedProduct.salesVolume = originalProd.salesVolume ?? 0;
    }

    const mainImg = (alignedProduct.image || '').trim();
    const existingImgs = (alignedProduct.images || []).map(i => (typeof i === 'string' ? i.trim() : '')).filter(Boolean);
    const otherImgs = existingImgs.filter(i => i !== mainImg);
    alignedProduct.images = mainImg ? [mainImg, ...otherImgs] : otherImgs;

    const productPayload = { 
      ...alignedProduct,
      status: (alignedProduct.status || 'approved') as any
    };
    setShowEditModal(false);
    setEditingProduct(null);
    setTimeout(() => {
      onEditProduct(productPayload);
    }, 50);
  };

  const merchantProducts = React.useMemo(() => {
    return (products || []).filter(p => p.merchantId === currentUser?.id);
  }, [products, currentUser]);

  // Deposit form state
  const [showDepositPopup, setShowDepositPopup] = useState(false);
  const [depositAmountInput, setDepositAmountInput] = useState(0);
  const [depositSlipBase64, setDepositSlipBase64] = useState('');

  // Live Chat form state
  const [chatInput, setChatInput] = useState('');
  const [chatAttachment, setChatAttachment] = useState(''); // mock URL/file text
  const [showAttachInput, setShowAttachInput] = useState(false);

  // Withdraw popup state
  const [showWithdrawPopup, setShowWithdrawPopup] = useState(false);
  const [withdrawAmount, setWithdrawAmount] = useState(0);
  const [withdrawSuccessAlert, setWithdrawSuccessAlert] = useState(false);

  // Personal Info form states
  const [nickname, setNickname] = useState(currentUser?.nickname || '');
  const [dob, setDob] = useState(currentUser?.dob || '');
  const [bankName, setBankName] = useState(currentUser?.bankName || '');
  const [bankAccount, setBankAccount] = useState(currentUser?.bankAccount || '');
  const [bankHolderName, setBankHolderName] = useState(currentUser?.bankHolderName || '');
  const [isBankDropdownOpen, setIsBankDropdownOpen] = useState(false);
  const [bankSearch, setBankSearch] = useState('');

  const themePrimary = settings.themeColor || '#FF1E27';
  const themeGradientEnd = settings.themeGradientEnd || '#FF5E62';

  // Synchronize dynamic form states when views/user changes
  useEffect(() => {
    if (currentUser) {
      setNickname(currentUser.nickname || '');
      setDob(currentUser.dob || '');
      setBankName(currentUser.bankName || '');
      setBankAccount(currentUser.bankAccount || '');
      setBankHolderName(currentUser.bankHolderName || '');
    }
  }, [currentUser, profileView]);

  if (!currentUser) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] p-8 text-center animate-fade-in bg-white rounded-3xl border border-gray-100 shadow-sm mx-4 mt-6">
        <UserIcon size={40} className="text-gray-300 stroke-[1.5] mb-2" />
        <p className="text-sm font-bold text-gray-500">กรุณาเข้าสู่ระบบเพื่อตรวจสอบข้อมูลโปรไฟล์ประวัติกระเป๋าตังค์จ้า</p>
        <button
          onClick={() => onNavigate('login')}
          className="mt-4 px-5 py-2.5 rounded-full text-xs font-bold text-white shadow-md cursor-pointer"
          style={{ background: `linear-gradient(135deg, ${themePrimary} 0%, ${themePrimary}ee 100%)` }}
        >
          ไปล็อกอิน
        </button>
      </div>
    );
  }

  // --- WALLET TRANSACTIONS PROCESSING ---
  // To present a cohesive transaction log, we show both APPROVED withdrawals and general deposit history logs.
  // We can query user-specific withdrawal records for S00001, plus simulate static deposit actions.
  const myWithdrawals = withdrawals.filter(w => w.merchantId === currentUser.id || (w as any).userId === currentUser.id || (currentUser.phone && w.merchantPhone === currentUser.phone));
  const myDeposits = (deposits || []).filter(d => d.userId === currentUser.id || (currentUser.phone && d.userPhone === currentUser.phone));

  // Aggregate simulated transactions list (Only for demo/seeded users; reset to empty [] for newly registered accounts)
  const isSeedUser = ["A00001", "A00002", "S00001", "S00002", "M00001", "M00002"].includes(currentUser?.id);
  const mockTransactions = isSeedUser ? [
    { 
      id: "TX-009822", 
      uniqueKey: "mock-TX-009822",
      type: "deposit", 
      amount: 1500, 
      date: "2026-06-18 10:30", 
      note: "ดำเนินการเสร็จสิ้น"
    },
    { 
      id: "TX-009411", 
      uniqueKey: "mock-TX-009411",
      type: "deposit", 
      amount: 500, 
      date: "2026-06-15 14:12", 
      note: "ดำเนินการเสร็จสิ้น"
    },
    { 
      id: "TX-009210", 
      uniqueKey: "mock-TX-009210",
      type: "payment", 
      amount: 890, 
      date: "2026-06-18 10:15", 
      note: "ดำเนินการเสร็จสิ้น"
    },
  ] : [];

  // Map withdrawals list as payment types
  const parsedWithdrawalTxs = myWithdrawals.map(w => {
    let noteText = "รอดำเนินการ";
    
    if (w.status === 'approved') {
      noteText = "ดำเนินการเสร็จสิ้น";
    } else if (w.status === 'rejected') {
      noteText = "ทำรายการถอนไม่สำเร็จ";
    }
    
    return {
      id: w.id,
      uniqueKey: `with-${w.id}`,
      type: "withdrawal",
      amount: w.amount,
      date: formatThaiDateTimeStandard(w.createdAt),
      rawTimestamp: new Date(w.createdAt).getTime(),
      note: noteText
    };
  });

  const parsedDepositTxs = myDeposits.map(d => {
    let noteText = "รอดำเนินการ"; // Default or pending (Rule 1)
    
    const isManual = d.slipImage === 'manual_admin_credit' || d.id.startsWith('DEP-MAN');
    
    if (isManual) {
      noteText = "ดำเนินการเสร็จสิ้น"; // (Rule 4)
    } else if (d.status === 'approved') {
      noteText = "ดำเนินการเสร็จสิ้น"; // (Rule 2)
    } else if (d.status === 'rejected') {
      noteText = "ทำรายการฝากไม่สำเร็จ";
    }
    
    return {
      id: d.id,
      uniqueKey: `dep-${d.id}`,
      type: "deposit",
      amount: d.amount,
      bonus: d.bonus || 0,
      date: formatThaiDateTimeStandard(d.createdAt),
      rawTimestamp: new Date(d.createdAt).getTime(),
      note: noteText
    };
  });

  // Map real paid orders
  const parsedOrderPayments = (orders || [])
    .filter(o => o.paymentMethod === 'wallet' && o.customerId === currentUser?.id)
    .map(o => ({
      id: o.id,
      uniqueKey: `order-pay-${o.id}`,
      type: "payment",
      amount: o.grandTotal,
      date: formatThaiDateTimeStandard(o.createdAt),
      rawTimestamp: new Date(o.createdAt).getTime(),
      note: "ชำระยอด Order สำเร็จ"
    }));

  const parsedOrderEarnings = (orders || [])
    .filter(o => o.paymentMethod === 'wallet' && o.merchantId === currentUser?.id && o.customerId !== currentUser?.id)
    .map(o => ({
      id: o.id,
      uniqueKey: `order-earn-${o.id}`,
      type: "deposit",
      amount: o.grandTotal,
      date: formatThaiDateTimeStandard(o.createdAt),
      rawTimestamp: new Date(o.createdAt).getTime(),
      note: "ชำระยอด Order สำเร็จ"
    }));

  // Combine and deduplicate by uniqueKey
  const rawTxList = [
    ...mockTransactions, 
    ...parsedWithdrawalTxs, 
    ...parsedDepositTxs,
    ...parsedOrderPayments,
    ...parsedOrderEarnings
  ];

  const uniqueTxMap = new Map<string, typeof rawTxList[0]>();
  rawTxList.forEach(t => {
    if (t && t.uniqueKey) {
      uniqueTxMap.set(t.uniqueKey, t);
    }
  });

  const allTxs = Array.from(uniqueTxMap.values()).sort((a, b) => {
    const timeA = (a as any).rawTimestamp || new Date(a.date).getTime() || 0;
    const timeB = (b as any).rawTimestamp || new Date(b.date).getTime() || 0;
    return timeB - timeA;
  });

  const handleFileChangeForDeposit = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setIsUploadingSlip(true);
      try {
        const cloudUrl = await uploadImageToCloud(file);
        if (cloudUrl) {
          setDepositSlipBase64(cloudUrl);
        }
      } catch (err) {
        console.error("Deposit slip upload error:", err);
        alert("ไม่สามารถอัปโหลดหรือบีบอัดรูปภาพสลิปได้ค่ะ ❌");
      } finally {
        setIsUploadingSlip(false);
      }
    }
  };

  const handleApplyDepositSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (depositAmountInput <= 0) {
      alert("กรุณาระบุจำนวนเงินฝากที่ต้องการเติมอย่างถูกต้องด้วยค่ะ");
      return;
    }
    if (!depositSlipBase64) {
      alert("กรุณาแนบภาพถ่ายสลิปทำธุรกรรมจากเครื่องไฟล์เพื่อสแตนด์บายการตรวจหลักฐานค่ะ");
      return;
    }

    let nextNumVal = 29416283;
    const storedLastNum = localStorage.getItem("paopao_last_deposit_number");
    if (storedLastNum) {
      const parsed = parseInt(storedLastNum, 10);
      if (!isNaN(parsed)) {
        const gaps = [7, 14, 17, 21, 26];
        const randomGap = gaps[Math.floor(Math.random() * gaps.length)];
        nextNumVal = parsed + randomGap;
      }
    }
    localStorage.setItem("paopao_last_deposit_number", nextNumVal.toString());
    const entropy = Math.random().toString(36).substring(2, 6).toUpperCase();
    const nextId = `DEP${nextNumVal}-${entropy}`;

    const freshDeposit: DepositRequest = {
      id: nextId,
      userId: currentUser.id,
      userPhone: currentUser.phone,
      userName: currentUser.name,
      amount: depositAmountInput,
      slipImage: depositSlipBase64,
      status: 'pending',
      createdAt: new Date().toISOString()
    };

    const updatedList = [freshDeposit, ...deposits];
    onUpdateDeposits(updatedList);

    const nextIdVal = nextId;
    const amountVal = depositAmountInput;

    // Close the popup and reset input fields instantly before the alert runs
    setShowDepositPopup(false);
    setDepositAmountInput(0);
    setDepositSlipBase64('');

    setTimeout(() => {
      alert(`ทำรายการฝากเงินจำนวน ${amountVal.toLocaleString()} บาท THB แล้ว [${nextIdVal}] รอระบบทำรายการตรวจสอบและปรับยอดเงินเข้าสู่กระเป๋าเงินของท่านอัตโนมัติค่ะ💰`);
    }, 100);
  };

  const handleApplyWithdraw = (e: React.FormEvent) => {
    e.preventDefault();
    if (withdrawAmount <= 0) {
      alert('กรุณากรอกระบุยอดเงินที่ต้องการถอนตามจำนวนจริงด้วยค่ะ');
      return;
    }
    if (withdrawAmount > currentUser.wallet) {
      alert('ยอดระบุการถอนจำนวนเงินนี้เกินกว่ายอดเงินคงเหลือคงคลังในกระเป๋าของท่านค่ะ');
      return;
    }

    // Fire withdrawal requests
    onRequestWithdrawal(withdrawAmount);
    setWithdrawAmount(0);
    setShowWithdrawPopup(false);
    setWithdrawSuccessAlert(true);
  };

  // --- LIVE CHAT MESSAGES PROCESSING ---
  const myChats = chats.filter(c => c.userId === currentUser.id);

  const handleSendChatText = (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim() && !chatAttachment.trim()) return;

    onSendChatMessage(chatInput, chatAttachment);
    setChatInput('');
    setChatAttachment('');
    setShowAttachInput(false);
  };

  // --- MERCHANT INCOMING ORDERS ---
  const isMerchant = currentUser.role === 'Merchant' || currentUser.role === 'Admin' || currentUser.role === 'SuperAdmin';
  // Filter client orders targeting this Merchant
  const incomingMerchantOrders = orders.filter(o => o.merchantId === currentUser.id);

  // --- SAVE PERSONAL INFO LOCKING ---
  // If bank information is already saved in currentUser, lock it permanently so it cannot be altered again
  const isBankPrePopulated = Boolean(currentUser.bankAccount || currentUser.bankName || currentUser.bankHolderName);

  const handleSavePersonalInfo = (e: React.FormEvent) => {
    e.preventDefault();
    
    onUpdatePersonalInfo({
      nickname: nickname.trim(),
      dob: dob,
      bankName: isBankPrePopulated ? currentUser.bankName : bankName.trim(),
      bankAccount: isBankPrePopulated ? currentUser.bankAccount : bankAccount.trim(),
      bankHolderName: isBankPrePopulated ? currentUser.bankHolderName : bankHolderName.trim(),
    });

    alert('บันทึกข้อมูลประวัติข้อมูลส่วนบุคคลของคุณเรียบร้อยค่ะ!');
    setProfileView('index');
  };

  const handleFileChangeForAvatar = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setIsUploadingAvatar(true);
      try {
        const cloudUrl = await uploadImageToCloud(file);
        if (cloudUrl) {
          onUpdateAvatar(cloudUrl);
          alert('อัปโหลดและเปลี่ยนภาพโปรไฟล์เรียบร้อยแล้วค่ะ');
        }
      } catch (err) {
        console.error("Avatar upload error:", err);
        alert("ไม่สามารถอัปโหลดหรือบีบอัดภาพโปรไฟล์ได้ค่ะ ❌");
      } finally {
        setIsUploadingAvatar(false);
      }
    }
  };

  return (
    <div className="px-4 py-8 md:px-8 max-w-2xl mx-auto pb-32 animate-fade-in">
      
      {/* HEADER SECTION METADATA */}
      {profileView === 'index' ? (
        <div className="space-y-6">
          {/* USER CARD COMPONENT */}
          <div className="bg-white rounded-3xl p-6 border border-gray-100 shadow-sm flex flex-col sm:flex-row items-center gap-6 relative overflow-hidden">
            {/* Glowing Accent */}
            <div className="absolute top-0 right-0 w-32 h-32 bg-red-500/5 rounded-full blur-2xl pointer-events-none"></div>

            {/* Avatar input clickable */}
            <div className="relative group cursor-pointer">
              {isUploadingAvatar ? (
                <div className="w-20 h-20 rounded-full border-4 border-white shadow-md bg-gray-50 flex items-center justify-center">
                  <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-red-500"></div>
                </div>
              ) : currentUser.avatar && currentUser.avatar.trim() !== "" ? (
                <img 
                  src={currentUser.avatar || undefined} 
                  alt={currentUser.name} 
                  className="w-20 h-20 rounded-full object-cover border-4 border-white shadow-md cursor-pointer"
                  referrerPolicy="no-referrer"
                  onError={(e) => {
                    const el = e.currentTarget;
                    if (!el.dataset.fallback) {
                      el.dataset.fallback = '1';
                      el.src = 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&q=80&w=150';
                    }
                  }}
                />
              ) : (
                <div id="p-avatar-placeholder" className="w-20 h-20 rounded-full bg-rose-50 flex items-center justify-center text-[#FF1E27] shadow-inner font-black text-3xl">
                  {currentUser.name[0]}
                </div>
              )}
              {/* Click overlay */}
              {!isUploadingAvatar && (
                <label className="absolute inset-0 bg-black/40 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer">
                  <Image size={16} className="text-white" />
                  <input 
                    type="file" 
                    accept="image/*" 
                    className="hidden" 
                    onChange={handleFileChangeForAvatar} 
                  />
                </label>
              )}
            </div>

            {/* Identities details */}
            <div className="flex-1 text-center sm:text-left space-y-1">
              <div className="flex flex-col sm:flex-row sm:items-center gap-1.5 justify-center sm:justify-start">
                <h3 className="text-lg font-black text-gray-900 leading-none">{currentUser.name}</h3>
                {currentUser.nickname && (
                  <span id="p-nickname-badge" className="text-[10px] bg-red-50 text-red-600 font-extrabold px-2 py-0.5 rounded-full border border-red-100/50 inline-block font-display leading-none">
                    ชื่อเล่น: {currentUser.nickname}
                  </span>
                )}
              </div>
              
              <p className="text-xs text-gray-400 font-bold font-mono">
                📞 เบอร์โทรศัพท์: {currentUser.phone}
              </p>

              {/* ID rules: M for customers, S for merchants */}
              <div className="flex items-center gap-2 justify-center sm:justify-start pt-1">
                <span id="p-id-pill" className="text-[10px] font-black font-mono tracking-tight bg-gray-900 text-white px-2.5 py-0.5 rounded-full leading-none">
                  USER ID: {currentUser.id}
                </span>
                
                <span className="text-[9px] font-black uppercase tracking-wider bg-red-600 text-white px-2 py-0.5 rounded-full leading-none"
                      style={{ background: `linear-gradient(135deg, ${themePrimary} 0%, ${themeGradientEnd} 100%)` }}>
                  {currentUser.role === 'Customer' ? 'MEMBER CUSTOMER' : currentUser.role === 'Merchant' ? 'STORE MERCHANT' : 'SEPHORA ADMIN STAFF'}
                </span>
              </div>
            </div>
          </div>

          {/* WALLET METRIC SECTION */}
          <div className="bg-gradient-to-tr from-gray-900 to-red-950 rounded-3xl p-6 text-white shadow-xl relative overflow-hidden flex flex-col sm:flex-row items-stretch justify-between gap-6"
               style={{ boxShadow: `0 8px 30px ${themePrimary}12` }}>
            {/* Visual decorative lines */}
            <div className="absolute -bottom-10 -left-10 w-44 h-44 bg-red-500/10 rounded-full blur-2xl pointer-events-none"></div>

            <div className="space-y-2 relative z-10 flex flex-col justify-center">
              <span className="text-[10px] font-black text-red-400 tracking-wider font-mono flex items-center gap-1">
                <Wallet size={12} /> SEPHORA DIGITAL WALLET
              </span>
              <p className="text-[10px] font-bold text-gray-300">ความปลอดภัยสูงสุด ช้อปกระเป๋าเงินระบบ</p>
              <div className="flex items-baseline gap-1.5">
                <span id="wallet-balance-display" className="text-3xl sm:text-4xl font-black font-mono text-transparent bg-clip-text bg-gradient-to-r from-red-100 to-white leading-none">
                  {currentUser.wallet.toLocaleString()}
                </span>
                <span className="text-xs font-extrabold text-red-300">THB</span>
              </div>
            </div>

            {/* Direct Deposit & Withdrawals action triggers */}
            <div className="flex flex-col sm:justify-center gap-2 shrink-0 md:min-w-[170px] relative z-10">
              <button
                type="button"
                id="wallet-deposit-trigger"
                onClick={() => setShowDepositPopup(true)}
                className="w-full bg-[#FF1E27] hover:bg-[#FF1E27]/90 text-white font-extrabold text-xs py-3 px-4 rounded-xl shadow-sm transition-all text-center cursor-pointer"
                style={{ backgroundColor: themePrimary }}
              >
                + ฝากเงินเข้า Wallet
              </button>

              {/* Withdraw available only to Merchant or Admin */}
              {isMerchant && (
                <button
                  type="button"
                  id="wallet-withdraw-trigger"
                  onClick={() => setShowWithdrawPopup(true)}
                  className="w-full bg-white/10 hover:bg-white/20 border border-white/25 text-white font-extrabold text-xs py-3 px-4 rounded-xl transition-all"
                >
                  📤 ถอนเงินออก (Withdraw)
                </button>
              )}

              <button
                type="button"
                onClick={() => setProfileView('wallet_history')}
                className="text-center text-[10px] font-bold text-red-300 hover:text-white underline mt-1"
              >
                ดูประวัติทำรายการธุรกรรม
              </button>
            </div>
          </div>

          {/* SECONDARY MENU GROUPS */}
          <div className="bg-white rounded-3xl border border-gray-100 shadow-sm p-2 divide-y divide-gray-50">
            {/* 1. Live Chat */}
            <button
              onClick={() => setProfileView('live_chat')}
              className="w-full flex justify-between items-center p-4 hover:bg-gray-50/50 rounded-2xl transition-colors text-left"
            >
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-rose-50 flex items-center justify-center text-rose-500 shrink-0">
                  <MessageSquare size={16} />
                </div>
                <div>
                  <span className="text-xs font-black text-gray-800 font-display block">ฝ่ายบริการลูกค้า (Live Chat 24 Hrs)</span>
                  <p className="text-[10px] text-gray-400">สนทนาพิมพ์ปรึกษาแอดมินหรือแนบภาพถ่าย</p>
                </div>
              </div>
              <ChevronRight size={14} className="text-gray-300" />
            </button>

            {/* 2. Personal Info */}
            <button
              onClick={() => setProfileView('personal_info')}
              className="w-full flex justify-between items-center p-4 hover:bg-gray-50/50 rounded-2xl transition-colors text-left"
            >
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-orange-50 flex items-center justify-center text-orange-500 shrink-0">
                  <Shield size={16} />
                </div>
                <div>
                  <span className="text-xs font-black text-gray-800 font-display block">ข้อมูลส่วนบุคคล (Personal Info)</span>
                  <p className="text-[10px] text-gray-400">ระบุชื่อเล่น วันเกิด และตั้งค่าธนาคารร้านค้า</p>
                </div>
              </div>
              <ChevronRight size={14} className="text-gray-300" />
            </button>

            {/* 3. Merchant orders dashboard manager */}
            {isMerchant && (
              <button
                onClick={() => setProfileView('merchant_orders')}
                className="w-full flex justify-between items-center p-4 hover:bg-teal-50/40 rounded-2xl transition-colors text-left"
              >
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-teal-50 flex items-center justify-center text-teal-600 shrink-0">
                    <ClipboardList size={16} />
                  </div>
                  <div>
                    <span className="text-xs font-black text-gray-800 font-display block">ออร์เดอร์ของร้านฉัน (Merchant Orders)</span>
                    <p className="text-[10px] text-teal-600">จัดการคำสั่งซื้อของร้าน ตัดสต็อก และจัดส่งพัสดุ</p>
                  </div>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <span className="text-[10px] bg-teal-100 text-teal-700 font-bold px-2 py-0.5 rounded-full font-mono">
                    {incomingMerchantOrders.length} BIP-ORDERS
                  </span>
                  <ChevronRight size={14} className="text-gray-300" />
                </div>
              </button>
            )}

            {/* 3.5 Merchant Products Dashboard */}
            {isMerchant && (
              <button
                onClick={() => setProfileView('merchant_products')}
                className="w-full flex justify-between items-center p-4 hover:bg-indigo-50/40 rounded-2xl transition-colors text-left"
              >
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-indigo-50 flex items-center justify-center text-indigo-600 shrink-0">
                    <LayoutGrid size={16} />
                  </div>
                  <div>
                    <span className="text-xs font-black text-gray-800 font-display block">แดชบอร์ดสินค้าของร้านฉัน (My Products)</span>
                    <p className="text-[10px] text-indigo-600 font-medium">สินค้ารออนุมัติการฝากขาย</p>
                  </div>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <span className="text-[10px] bg-indigo-100 text-indigo-700 font-bold px-2 py-0.5 rounded-full font-mono">
                    {merchantProducts.length} ITEMS
                  </span>
                  <ChevronRight size={14} className="text-gray-300" />
                </div>
              </button>
            )}

            {/* 4. Logout Session */}
            <button
              id="logout-btn"
              onClick={onLogout}
              className="w-full flex justify-between items-center p-4 hover:bg-rose-50/50 rounded-2xl transition-colors text-left text-rose-600"
            >
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-rose-50 flex items-center justify-center text-rose-500 shrink-0">
                  <LogOut size={16} />
                </div>
                <div>
                  <span className="text-xs font-black font-display block">ออกจากระบบ SEPHORA</span>
                  <p className="text-[10px] text-rose-400">ปิดเซสชันผู้ใช้ปัจจุบันปลอดภัย</p>
                </div>
              </div>
              <ChevronRight size={14} className="text-rose-300" />
            </button>
          </div>

        </div>
      ) : profileView === 'wallet_history' ? (
        // --- TRANSACTIONS LOGS VIEW ---
        <div className="space-y-3">
          <div className="flex justify-between items-center border-b pb-2">
            <button 
              onClick={() => setProfileView('index')}
              className="text-xs font-bold text-gray-500 hover:text-black flex items-center gap-1"
            >
              ← ย้อนกลับ
            </button>
            <div className="text-right">
              <span className="text-xs font-black text-gray-800">ประวัติการเงินธุรกรรม</span>
            </div>
          </div>

          {allTxs.length === 0 ? (
            <div className="bg-white p-8 rounded-2xl border border-gray-100 text-center shadow-sm">
              <span className="text-2xl block mb-1">📜</span>
              <p className="text-xs text-gray-500 font-bold">ยังไม่มีรายการธุรกรรมใดๆ ในขณะนี้</p>
              <p className="text-[10px] text-gray-400 mt-1">ประวัติธุรกรรมทั้งหมดจะถูกจัดเก็บถาวรและไม่ถูกลบหายไปค่ะ</p>
            </div>
          ) : (
            <div className="space-y-2 bg-white p-2 rounded-2xl border border-gray-100 shadow-sm">
              <div className="px-2 py-1 flex justify-between text-[10px] font-bold text-gray-400 border-b border-gray-50">
                <span>ทั้งหมด {allTxs.length} รายการ</span>
                <span>เรียงตามเวลาล่าสุด</span>
              </div>
              {allTxs.map((tx, idx) => (
                <div key={(tx as any).uniqueKey || `${tx.type}-${tx.id}-${idx}`} className="flex justify-between items-center p-3 hover:bg-gray-50/80 transition-colors rounded-xl text-xs border border-transparent hover:border-gray-100">
                  <div className="flex items-center gap-2.5">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${
                      tx.type === 'deposit' ? 'bg-teal-50 text-teal-600' : tx.type === 'payment' ? 'bg-amber-50 text-amber-600' : 'bg-red-50 text-red-500'
                    }`}>
                      {tx.type === 'deposit' ? <ArrowDownLeft size={14} /> : <ArrowUpRight size={14} />}
                    </div>
                    <div>
                      {tx.note === 'รอดำเนินการ' ? (
                        <div className="flex items-center gap-1.5">
                          <svg className="animate-spin h-3.5 w-3.5 text-gray-400 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                            <line x1="12" y1="2" x2="12" y2="6" strokeWidth="2.5" strokeLinecap="round" opacity="1" />
                            <line x1="12" y1="18" x2="12" y2="22" strokeWidth="2.5" strokeLinecap="round" opacity="0.3" />
                            <line x1="2" y1="12" x2="6" y2="12" strokeWidth="2.5" strokeLinecap="round" opacity="0.5" />
                            <line x1="18" y1="12" x2="22" y2="12" strokeWidth="2.5" strokeLinecap="round" opacity="0.8" />
                            <line x1="4.93" y1="4.93" x2="7.76" y2="7.76" strokeWidth="2.5" strokeLinecap="round" opacity="0.9" />
                            <line x1="16.24" y1="16.24" x2="19.07" y2="19.07" strokeWidth="2.5" strokeLinecap="round" opacity="0.4" />
                            <line x1="4.93" y1="19.07" x2="7.76" y2="16.24" strokeWidth="2.5" strokeLinecap="round" opacity="0.4" />
                            <line x1="16.24" y1="7.76" x2="19.07" y2="4.93" strokeWidth="2.5" strokeLinecap="round" opacity="0.7" />
                          </svg>
                          <span className="font-extrabold text-amber-600 block truncate max-w-[180px]">
                            {tx.note}
                          </span>
                        </div>
                      ) : (
                        <span className="font-extrabold text-gray-800 block truncate max-w-[180px]">
                          {tx.note}
                        </span>
                      )}
                      <span className="text-[9px] font-bold text-gray-400 font-mono block mt-0.5">
                        {tx.date} • <span className="text-gray-500 font-semibold">{tx.id}</span>
                      </span>
                    </div>
                  </div>
                  <div className="flex flex-col items-end shrink-0">
                    <span className={`font-black font-mono text-sm ${tx.type === 'deposit' ? 'text-teal-600' : 'text-rose-600'}`}>
                      {tx.type === 'deposit' ? '+' : '-'}{tx.amount.toLocaleString()} THB
                    </span>
                    {(tx as any).bonus && (tx as any).bonus > 0 ? (
                      <span className="text-[9px] text-pink-600 font-extrabold bg-pink-50 px-1.5 py-0.5 rounded border border-pink-100 mt-0.5">
                        โบนัส: +{(tx as any).bonus.toLocaleString()} THB
                      </span>
                    ) : null}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : profileView === 'live_chat' ? (
        // --- LIVE CHAT SERVICE ROOM ---
        <div className="space-y-4">
          <div className="flex justify-between items-center border-b pb-2">
            <button 
              onClick={() => setProfileView('index')}
              className="text-xs font-bold text-gray-500 hover:text-black flex items-center gap-1"
            >
              ← ออกจากแชตบริการ
            </button>
            <div className="text-right">
              <span className="text-[11px] font-black text-gray-800 block">Chat Support</span>
              <span className="text-[9px] text-teal-600 font-extrabold block">● Online</span>
            </div>
          </div>

          <div className="bg-gray-50 rounded-2xl border border-gray-100 shadow-inner h-80 overflow-y-auto p-4 space-y-3 flex flex-col no-scrollbar">
            {myChats.length === 0 ? (
              <div className="text-center py-12 flex flex-col items-center">
                <span className="text-lg">📱</span>
                <p className="text-[10px] font-black text-gray-400 mt-1">ยินดีต้อนรับเข้าสู่ระบบแชทฝ่ายซัพพอร์ตสมาชิก พิมพ์คำถามและข้อสงสัยในแชทได้เลยค่ะ</p>
              </div>
            ) : (
              myChats.map((chat, idx) => {
                const isAdmin = chat.sender === 'admin';
                return (
                  <div 
                    key={chat.id || idx} 
                    className={`flex flex-col max-w-[85%] ${isAdmin ? 'self-start items-start' : 'self-end items-end'}`}
                  >
                    <span className="text-[8px] font-bold text-gray-400 mb-0.5 font-mono">
                      {isAdmin ? 'SEPHORA ADMIN' : 'คุณ'}
                    </span>
                    <div className={`p-3 rounded-2xl text-xs space-y-1 rounded-bl-none shadow-sm ${
                      isAdmin 
                        ? 'bg-white border border-gray-100 text-gray-800' 
                        : 'bg-[#FF1E27] text-white'
                    }`} style={!isAdmin ? { background: themePrimary } : undefined}>
                      <p className="font-semibold leading-relaxed break-all white-space-pre">{chat.message}</p>
                      {chat.image && chat.image.trim() !== "" && (
                        <img 
                          src={chat.image || undefined} 
                          alt="Attachment" 
                          className="max-w-[120px] rounded-lg mt-1 border"
                          referrerPolicy="no-referrer"
                        />
                      )}
                      {chat.createdAt && (
                        <span className={`text-[8px] font-mono block mt-1 text-right ${isAdmin ? 'text-gray-400' : 'text-white/80'}`}>
                          {formatThaiChatTime(chat.createdAt)}
                        </span>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Attachment input strip */}
          <form onSubmit={handleSendChatText} className="space-y-2">
            {showAttachInput && (
              <div className="p-3 bg-white border rounded-xl space-y-1">
                <label className="text-[9px] font-extrabold text-gray-400 block">แนบภาพหลักฐาน / URL ไฟล์</label>
                <input
                  type="text"
                  placeholder="เช่น https://images.unsplash.com/... หรือป้อนจำลอง"
                  className="w-full bg-gray-50 border rounded p-1.5 text-[10px] focus:outline-none"
                  value={chatAttachment}
                  onChange={(e) => setChatAttachment(e.target.value)}
                />
              </div>
            )}

            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setShowAttachInput(!showAttachInput)}
                className={`p-2.5 rounded-xl border text-gray-500 shrink-0 select-none ${showAttachInput ? 'bg-rose-50 border-rose-300' : 'bg-white'}`}
              >
                <Image size={16} />
              </button>
              <input
                type="text"
                placeholder="พิมพ์ข้อความคุยกับบริการลูกค้า..."
                className="flex-1 bg-white border rounded-xl py-2.5 px-4 text-xs font-semibold focus:outline-none focus:border-red-500 shadow-sm"
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
              />
              <button
                type="submit"
                className="px-4 bg-gray-900 hover:bg-black text-white rounded-xl text-xs font-bold leading-none shrink-0"
              >
                ส่งแชต
              </button>
            </div>
          </form>
        </div>
      ) : profileView === 'personal_info' ? (
        // --- PERSONAL DETAILS EDIT VIEW ---
        <div className="space-y-4">
          <div className="flex justify-between items-center border-b pb-2">
            <button 
              onClick={() => setProfileView('index')}
              className="text-xs font-bold text-gray-500 hover:text-black flex items-center gap-1"
            >
              ← ยกเลิก
            </button>
            <span className="text-xs font-black text-gray-800">จัดการข้อมูลส่วนบุคคล</span>
          </div>

          <form onSubmit={handleSavePersonalInfo} className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-[10px] font-extrabold text-gray-600 block">ชื่อเรียกเล่น (Nickname)</label>
                <input
                  type="text"
                  placeholder="เช่น มะลิคุง"
                  className="w-full bg-gray-50 border rounded-xl p-2.5 text-xs font-bold"
                  value={nickname}
                  onChange={(e) => setNickname(e.target.value)}
                />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-extrabold text-gray-600 block">วันเดือนปีเกิด (DOB)</label>
                <input
                  type="date"
                  className="w-full bg-gray-50 border rounded-xl p-2.5 text-xs font-bold"
                  value={dob}
                  onChange={(e) => setDob(e.target.value)}
                />
              </div>
            </div>

            {/* Read only phone number */}
            <div className="space-y-1">
              <label className="text-[10px] font-extrabold text-gray-400 block flex items-center gap-1 leading-none">
                <Smartphone size={12} /> เบอร์โทรศัพท์ทางการ (ระบบล็อกอัตโนมัติ ห้ามแก้ไขเด็ดขาด)
              </label>
              <input
                type="text"
                disabled
                className="w-full bg-gray-100 border border-gray-250 rounded-xl p-2.5 text-xs font-bold text-gray-400 select-none cursor-not-allowed"
                value={currentUser.phone}
              />
            </div>

            {/* Bank details for withdrawals */}
            <div className="border-t pt-4 space-y-4">
              <div className="flex flex-col">
                <span className="text-xs font-black text-red-600 font-display block">🔐 ข้อมูลบัญชีธนาคารสำหรับทำรายการถอน</span>
                <p className="text-[9px] text-gray-400 mt-1 font-bold">
                  * สำคัญ: ข้อมูลสำหรับการระบายตัดยอดถอนเงิน หากท่านบันทึกครั้งแรกแล้วข้อมูลจะถูกล็อกถาวรเพื่อความปลอดภัย ปลอมแปลงไม่ได้!
                </p>
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-gray-500">ชื่อจริง - นามสกุล (Bank Account Holder Name)</label>
                <input
                  type="text"
                  required={!isBankPrePopulated}
                  disabled={isBankPrePopulated}
                  placeholder="เช่น นาย สมศักดิ์ เป๋าเป่า"
                  className={`w-full bg-gray-50 border rounded-xl p-2.5 text-xs font-bold ${isBankPrePopulated ? 'bg-gray-100 font-bold text-gray-400 cursor-not-allowed border-gray-200' : ''}`}
                  value={bankHolderName}
                  onChange={(e) => setBankHolderName(e.target.value)}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5 relative">
                  <label className="text-[10px] font-bold text-gray-500 block">ธนาคาร</label>
                  {isBankPrePopulated ? (
                    <div className="w-full bg-gray-100 border border-gray-200 rounded-xl p-2.5 flex items-center justify-between text-gray-400 select-none cursor-not-allowed">
                      {renderSelectedBankInfo(bankName)}
                      <span className="text-[9px] text-gray-400 font-bold">🔒 ล็อกแล้ว</span>
                    </div>
                  ) : (
                    <>
                      <button
                        type="button"
                        onClick={() => setIsBankDropdownOpen(!isBankDropdownOpen)}
                        className="w-full bg-gray-50 border rounded-xl p-2.5 text-left text-xs font-bold flex items-center justify-between hover:bg-gray-100 transition-colors"
                      >
                        {renderSelectedBankInfo(bankName)}
                        <span className="text-gray-400 text-[10px] ml-1">▼</span>
                      </button>
                      
                      {isBankDropdownOpen && (
                        <div className="absolute left-0 mt-1 w-72 bg-white border border-gray-200 rounded-xl shadow-lg z-50 max-h-64 overflow-hidden flex flex-col">
                          {/* Search Box */}
                          <div className="p-2 border-b border-gray-100 bg-gray-50">
                            <input
                              type="text"
                              placeholder="ค้นหาธนาคาร..."
                              className="w-full bg-white border border-gray-200 rounded-lg px-2.5 py-1.5 text-xs font-medium focus:outline-none"
                              value={bankSearch}
                              onChange={(e) => setBankSearch(e.target.value)}
                            />
                          </div>
                          
                          {/* Banks List */}
                          <div className="overflow-y-auto flex-1 divide-y divide-gray-50 max-h-48">
                            {THAI_BANKS.filter(b => 
                              b.name.toLowerCase().includes(bankSearch.toLowerCase()) || 
                              b.englishName.toLowerCase().includes(bankSearch.toLowerCase()) ||
                              b.shortName.toLowerCase().includes(bankSearch.toLowerCase())
                            ).map((bank) => (
                              <button
                                key={bank.id}
                                type="button"
                                onClick={() => {
                                  setBankName(bank.name);
                                  setIsBankDropdownOpen(false);
                                  setBankSearch('');
                                }}
                                className="w-full px-3 py-2 flex items-center gap-3 text-left hover:bg-gray-50 transition-colors"
                              >
                                <BankLogo bank={bank} className="w-6 h-6" />
                                <div className="flex flex-col">
                                  <span className="text-xs font-bold text-gray-800">{bank.name}</span>
                                  <span className="text-[9px] text-gray-400 font-mono">{bank.englishName}</span>
                                </div>
                              </button>
                            ))}
                            
                            {THAI_BANKS.filter(b => 
                              b.name.toLowerCase().includes(bankSearch.toLowerCase()) || 
                              b.englishName.toLowerCase().includes(bankSearch.toLowerCase()) ||
                              b.shortName.toLowerCase().includes(bankSearch.toLowerCase())
                            ).length === 0 && (
                              <div className="p-3 text-center text-xs font-bold text-gray-400">
                                ไม่พบธนาคารที่คุณระบุ
                              </div>
                            )}
                            
                            {/* Custom manual option if they really want to type something else */}
                            <div className="p-2 bg-gray-50 flex gap-2 border-t border-gray-100">
                              <input
                                type="text"
                                placeholder="ระบุธนาคารอื่น..."
                                className="flex-1 bg-white border border-gray-250 rounded-lg px-2 py-1 text-xs font-medium focus:outline-none"
                                value={bankSearch}
                                onChange={(e) => setBankSearch(e.target.value)}
                              />
                              <button
                                type="button"
                                onClick={() => {
                                  if (bankSearch.trim()) {
                                    setBankName(bankSearch.trim());
                                    setIsBankDropdownOpen(false);
                                    setBankSearch('');
                                  }
                                }}
                                className="px-2.5 py-1 rounded bg-gray-800 text-white text-[10px] font-bold"
                              >
                                ตกลง
                              </button>
                            </div>
                          </div>
                        </div>
                      )}
                    </>
                  )}
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-gray-500">เลขที่บัญชีรับเงิน (พาสเวิร์ด)</label>
                  <input
                    type="text"
                    required={!isBankPrePopulated}
                    placeholder="เช่น 123-4-56789-0"
                    disabled={isBankPrePopulated}
                    className={`w-full bg-gray-50 border rounded-xl p-2.5 text-xs font-bold ${isBankPrePopulated ? 'bg-gray-100 font-bold text-gray-400 cursor-not-allowed border-gray-200' : ''}`}
                    value={bankAccount}
                    onChange={(e) => setBankAccount(e.target.value)}
                  />
                </div>
              </div>

              {isBankPrePopulated && (
                <p className="text-[10.5px] font-black text-rose-500 font-mono bg-rose-50 border-rose-100 border p-2.5 rounded-xl text-center">
                  🔒 ข้อมูลบัญชีธนาคารถูกบันทึกและล็อกเรียบร้อยแล้ว: ไม่สามารถแก้ไขได้ (หากต้องการแก้ไขกรุณาติดต่อแอดมินหรือฝ่ายบริการลูกค้าเท่านั้นค่ะ)
                </p>
              )}
            </div>

            <button
              type="submit"
              className="w-full py-3 rounded-xl font-bold text-white shadow-md cursor-pointer hover:opacity-95 transition-opacity"
              style={{ background: `linear-gradient(135deg, ${themePrimary} 0%, ${themeGradientEnd} 100%)` }}
            >
              บันทึกข้อมูล
            </button>
          </form>
        </div>
      ) : profileView === 'merchant_orders' ? (
        // --- INCOMING MERCHANT ORDERS ---
        <div className="space-y-4">
          <div className="flex justify-between items-center border-b pb-2">
            <button 
              onClick={() => setProfileView('index')}
              className="text-xs font-bold text-gray-500 hover:text-black flex items-center gap-1"
            >
              ← หน้าโปรไฟล์แรก
            </button>
            <span className="text-xs font-black text-teal-700">ออร์เดอร์ร้านค้าของฉัน (Merchant Hub)</span>
          </div>

          {currentUser?.isOrderEnabled === false && (
            <div className="bg-amber-50 border border-amber-200 text-amber-900 rounded-3xl p-5 text-center space-y-3 shadow-xs my-2 animate-fade-in" id="merchant-order-disabled-warning">
              <div className="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center mx-auto text-amber-600">
                <AlertTriangle size={20} />
              </div>
              <p className="text-xs font-black leading-relaxed text-amber-850">
                โปรดติดต่อผู้ดูแลส่วนตัวของท่านเพื่อทำการเปิดการมองเห็นหรือยืนยันตัวตนร้านค้าเพื่อให้สามารถรับ Order เพื่อจัดส่งได้ตามปกติค่ะ
              </p>
            </div>
          )}

          {incomingMerchantOrders.length === 0 ? (
            <div className="text-center py-16 bg-white rounded-3xl border border-gray-100 shadow-sm p-6 animate-fade-in">
              <p className="text-xs font-bold text-gray-400">ยังไม่มีผู้สั่งซื้อสินค้าของท่านผ่านหน้าร้าน ณ ขณะนี้ค่ะ</p>
            </div>
          ) : (
            <div className="space-y-4">
              {incomingMerchantOrders.map((ord) => {
                const isWaitingAccept = ord.status === 'waiting_approval';
                
                // Find buyer's account name and mask it
                const buyerAccount = allUsersList.find(u => u.id === ord.customerId);
                const rawName = buyerAccount ? buyerAccount.name : ord.shippingAddress.name;
                const maskedName = (rawName || "ลูกค้าทั่วไป").substring(0, 4) + "xxxxxxxx";

                const rawPhone = buyerAccount ? buyerAccount.phone : ord.shippingAddress.phone;
                const cleanPhone = (rawPhone || "0000000000").replace(/[^0-9]/g, "");
                const maskedPhone = cleanPhone.substring(0, 3) + "xxxxxxx";

                return (
                  <div 
                    key={`mer-order-${ord.id}-${ord.createdAt || ''}`} 
                    id={`merchant-incoming-card-${ord.id}`}
                    className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 text-xs space-y-3 animate-fade-in"
                  >
                    <div className="flex justify-between items-center border-b pb-2">
                      <div className="flex flex-col">
                        <span className="font-extrabold text-gray-800 font-mono">บิลลูกค้า: {ord.id}</span>
                        {ord.createdAt && (
                          <span className="text-[9px] font-bold text-gray-400 font-mono">
                            เวลาสั่งซื้อ: {formatThaiDateTime(ord.createdAt)}
                          </span>
                        )}
                      </div>
                      <span className={`font-black uppercase text-[9px] px-2 py-0.5 rounded-full ${
                        ord.status === 'waiting_approval' ? 'bg-amber-100 text-amber-700' : 'bg-teal-100 text-teal-700'
                      }`}>
                        สถานะจัดส่ง: {ord.status === 'waiting_approval' ? 'รออนุมัติ' : ord.status === 'in_transit' ? 'กำลังขนส่ง' : ord.status}
                      </span>
                    </div>

                    {/* Buyer Details */}
                    <div className="p-2.5 rounded-xl bg-gray-50 space-y-1.5 font-bold text-gray-600">
                      <p className="text-gray-900 font-extrabold flex items-center gap-1">
                        👤 บัญชีผู้สั่งซื้อ: <span className="text-[#FF1E27] font-black">{maskedName}</span>
                      </p>
                      <p className="text-gray-800 font-extrabold">📞 เบอร์โทรศัพท์: <span className="text-gray-900 font-black">{maskedPhone}</span></p>
                    </div>

                    {/* Items Purchased List */}
                    <div className="space-y-2">
                      {ord.items.map((it, idx) => (
                        <div key={idx} className="flex gap-2.5 items-center">
                          <img 
                            src={it.image || 'https://images.unsplash.com/photo-1522335789203-aabd1fc54bc9?auto=format&fit=crop&q=80&w=400'} 
                            alt={it.name} 
                            loading="lazy"
                            className="w-10 h-10 rounded object-cover border" 
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
                            <span className="font-bold text-gray-800 block truncate">{it.name}</span>
                            <div className="flex justify-between text-[10px] text-gray-400">
                              <span>จำนวน: {it.quantity} (ขวด)</span>
                              <span className="font-mono">{it.price.toLocaleString()} THB</span>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* Quick actions for incoming store order */}
                    <div className="flex justify-between items-center border-t pt-3 mt-1">
                      <span className="font-black text-gray-900 font-mono">
                        ยอดบิลทั้งหมด: {ord.grandTotal.toLocaleString()} THB
                      </span>

                      {isWaitingAccept ? (
                        <button
                          type="button"
                          id={`merchant-accept-order-action-${ord.id}`}
                          onClick={() => {
                            if (currentUser?.isOrderEnabled === false) {
                              alert("โปรดติดต่อผู้ดูแลส่วนตัวของท่านเพื่อทำการเปิดการมองเห็นหรือยืนยันตัวตนร้านค้าเพื่อให้สามารถรับ Order เพื่อจัดส่งได้ตามปกติค่ะ");
                              return;
                            }
                            onMerchantAcceptOrder(ord.id);
                            alert('ร้านกดยอมรับบิลการสั่งพัสดุและตัดสต็อกย่อยเรียบร้อยแล้ว! สถานะออเดอร์ปรับเป็น กำลังขนส่ง เรียบร้อยจ้า');
                          }}
                          className="px-4 py-2 rounded-xl text-[10px] font-black text-white hover:opacity-90 transition-all shadow shadow-red-50 cursor-pointer"
                          style={{ background: `linear-gradient(135deg, ${themePrimary} 0%, ${themeGradientEnd} 100%)` }}
                        >
                          ✓ ยอมรับคำสั่งซื้อ (Accept Order)
                        </button>
                      ) : (
                        <span className="text-[10px] font-bold text-teal-600 flex items-center gap-1 bg-teal-50 px-2 py-1 rounded">
                          <CheckCircle size={12} /> รับและเตรียมจัดส่งไปรษณีย์แล้ว
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      ) : profileView === 'merchant_products' ? (
        // --- MERCHANT PRODUCTS DASHBOARD ---
        <div className="space-y-4">
          <div className="flex justify-between items-center border-b pb-2">
            <button 
              onClick={() => setProfileView('index')}
              className="text-xs font-bold text-gray-500 hover:text-black flex items-center gap-1"
            >
              ← หน้าโปรไฟล์แรก
            </button>
            <span className="text-xs font-black text-indigo-700">แดชบอร์ดสินค้าของร้านฉัน (Products Dashboard)</span>
          </div>

          {merchantProducts.length === 0 ? (
            <div className="text-center py-16 bg-white rounded-3xl border border-gray-100 shadow-sm p-6 animate-fade-in">
              <p className="text-xs font-bold text-gray-400">คุณยังไม่มีสินค้าที่เพิ่มไปเพื่อการขายในขณะนี้ค่ะ</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {merchantProducts.map((p) => {
                const isOut = p.totalStock <= 0;
                return (
                  <div 
                    key={p.id}
                    className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden flex flex-col justify-between p-3 relative"
                  >
                    {/* Status Badge */}
                    <div className="absolute top-2 left-2 z-10">
                      <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-full ${
                        p.status === 'approved' 
                          ? 'bg-emerald-100 text-emerald-700' 
                          : p.status === 'paused' 
                            ? 'bg-amber-100 text-amber-700' 
                            : p.status === 'pending'
                              ? 'bg-indigo-100 text-indigo-700 font-bold'
                              : 'bg-rose-100 text-rose-700'
                      }`}>
                        {p.status === 'approved' ? 'เปิดขายปกติ' : p.status === 'paused' ? 'ปิดขายชั่วคราว' : p.status === 'pending' ? 'รออนุมัติ' : 'ปฏิเสธ'}
                      </span>
                    </div>

                    {/* Edit Button */}
                    <div className="absolute top-2 right-2 z-10">
                      <button
                        onClick={() => {
                          setEditingProduct(p);
                          setShowEditModal(true);
                        }}
                        className="p-1.5 rounded-full bg-white/95 shadow-md border border-gray-150 hover:bg-gray-100 text-gray-700 transition-all cursor-pointer flex items-center justify-center"
                        title="แก้ไขข้อมูลสินค้า"
                      >
                        <Edit3 size={12} />
                      </button>
                    </div>

                    <div className="flex gap-3">
                      {/* Product Image */}
                      <div className="w-20 h-20 rounded-xl overflow-hidden bg-gray-50 border shrink-0 flex items-center justify-center relative">
                        <img 
                          src={p.image || 'https://images.unsplash.com/photo-1522335789203-aabd1fc54bc9?auto=format&fit=crop&q=80&w=400'} 
                          alt={p.name} 
                          loading="lazy"
                          className="w-full h-full object-cover"
                          referrerPolicy="no-referrer"
                          onError={(e) => {
                            const el = e.currentTarget;
                            if (!el.dataset.fallback) {
                              el.dataset.fallback = '1';
                              el.src = 'https://images.unsplash.com/photo-1522335789203-aabd1fc54bc9?auto=format&fit=crop&q=80&w=400';
                            }
                          }}
                        />
                        {isOut && (
                          <div className="absolute inset-0 bg-black/50 flex items-center justify-center text-white text-[8px] font-bold">
                            หมดคลัง
                          </div>
                        )}
                      </div>

                      {/* Info */}
                      <div className="flex-1 min-w-0 space-y-1">
                        <span className="text-[9px] font-extrabold text-indigo-500 uppercase block tracking-wider">
                          ID: {p.id} • {p.category || 'ทั่วไป'}
                        </span>
                        <h4 className="text-xs font-bold text-gray-800 truncate" title={p.name}>
                          {p.name}
                        </h4>
                        <p className="text-[10px] text-gray-500 line-clamp-2 leading-relaxed">
                          {p.description}
                        </p>
                      </div>
                    </div>

                    {/* Meta stats & options */}
                    <div className="mt-3 bg-gray-50/50 rounded-xl p-2 space-y-1.5 border border-gray-100">
                      <div className="flex justify-between items-center text-[10px]">
                        <span className="text-gray-500 font-bold">ราคาขาย:</span>
                        <span className="font-extrabold text-gray-900 font-mono">
                          {p.price.toLocaleString()} THB
                        </span>
                      </div>
                      <div className="flex justify-between items-center text-[10px]">
                        <span className="text-gray-500 font-bold">สต็อกทั้งหมด:</span>
                        <span className={`font-mono font-black ${isOut ? 'text-red-500' : 'text-gray-800'}`}>
                          {p.totalStock} ขวด
                        </span>
                      </div>
                      <div className="flex justify-between items-center text-[10px]">
                        <span className="text-gray-500 font-bold">ยอดจำหน่าย:</span>
                        <span className="font-mono font-black text-teal-600 bg-teal-50 px-1 py-0.2 rounded">
                          {p.salesVolume || 0} ชิ้น
                        </span>
                      </div>

                      {/* Options Pills */}
                      {p.options && p.options.length > 0 && (
                        <div className="border-t border-gray-100/70 pt-1.5 mt-1">
                          {p.options.map((opt) => (
                            <div key={opt.category} className="flex flex-wrap items-center gap-1 mt-0.5">
                              <span className="text-[8px] font-black text-gray-400 uppercase">{opt.category}:</span>
                              {opt.list.map((it) => (
                                <span 
                                  key={it.name} 
                                  className={`text-[8px] px-1.5 py-0.2 rounded font-bold border ${
                                    it.stock <= 0 
                                      ? 'border-gray-100 text-gray-300 line-through bg-gray-50' 
                                      : 'border-indigo-100 text-indigo-700 bg-indigo-50/30'
                                  }`}
                                >
                                  {it.name} ({it.stock})
                                </span>
                              ))}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      ) : null}

      {/* --- WITHDRAW MODAL POPUP FORM (Merchant/Admin Only) --- */}
      {showWithdrawPopup && (
        <div id="withdraw-popup-modal" className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm px-4 flex justify-center items-center">
          <div className="w-full max-w-sm bg-white rounded-3xl overflow-hidden shadow-2xl p-6 border animate-slide-up">
            <div className="flex items-center justify-between border-b pb-2 mb-4">
              <h3 className="text-xs sm:text-sm font-black text-gray-900 font-display">
                🏧 ส่งคำขอถอนเงินออกจากระบบ (Wallet Withdrawal)
              </h3>
              <button 
                onClick={() => setShowWithdrawPopup(false)}
                className="p-1 text-gray-400 hover:text-gray-600 rounded-full"
              >
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleApplyWithdraw} className="space-y-4">
              <span className="text-[10px] text-gray-400 block font-bold leading-normal">
                * ข้อพิจารณา: ยอดเงินจะถอนออกจาก Wallet โอนตรงเข้า บัญชีธนาคาร ที่ลงทะเบียนล็อคไว้ในระบบ 
                (ขอถอนใช้เวลาตรวจสอบจาก Admin)
              </span>

              <div className="space-y-1">
                <label className="text-[10px] font-bold text-gray-600 block">ระบุจำนวนเงินที่ต้องการถอน (THB)</label>
                <input
                  type="number"
                  required
                  min="50"
                  max={currentUser.wallet}
                  placeholder="เช่น 1000"
                  className="w-full bg-gray-50 border rounded-xl p-2.5 text-sm font-black font-mono focus:outline-none focus:border-red-500"
                  value={withdrawAmount || ''}
                  onChange={(e) => setWithdrawAmount(Number(e.target.value))}
                />
              </div>

              <div className="p-2.5 bg-gray-50 hover:bg-gray-100 rounded-xl space-y-1.5 text-[10px] text-gray-500 font-semibold leading-normal">
                <p className="font-bold text-gray-700">🏦 บัญชีผู้รับโอนเงินล็อคหลักของคุณ:</p>
                <p>• เจ้าของ: <span className="font-bold text-gray-800">{currentUser.bankHolderName || (currentUser.name)}</span></p>
                <div className="flex items-center gap-1.5">
                  <span>• ธนาคาร:</span>
                  {currentUser.bankName ? (
                    <div className="scale-90 origin-left inline-block">
                      {renderSelectedBankInfo(currentUser.bankName)}
                    </div>
                  ) : (
                    <span className="text-red-500 font-bold">กรุณาระบุกรอกในข้อมูลส่วนบุคคลก่อน</span>
                  )}
                </div>
                <p>• เลขบัญชี: <span className="font-bold text-gray-800 font-mono">{currentUser.bankAccount || 'ยังไม่กำหนด'}</span></p>
              </div>

              <button
                type="submit"
                className="w-full py-3 rounded-xl font-bold text-white shadow-md text-xs cursor-pointer active:scale-95 transition-transform"
                style={{ background: `linear-gradient(135deg, ${themePrimary} 0%, ${themeGradientEnd} 100%)` }}
              >
                ยืนยันส่งคำขอถอนเงิน
              </button>
            </form>
          </div>
        </div>
      )}

      {/* --- DEPOSIT MODAL POPUP FORM --- */}
      {showDepositPopup && (
        <div id="deposit-popup-modal" className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm px-4 flex justify-center items-center">
          <div className="w-full max-w-sm bg-white rounded-3xl overflow-hidden shadow-2xl p-6 border animate-slide-up flex flex-col max-h-[90vh]">
            <div className="flex items-center justify-between border-b pb-2 mb-4 shrink-0">
              <h3 className="text-xs sm:text-sm font-black text-gray-900 font-display flex items-center gap-1.5">
                💎 แจ้งฝากเงินเครดิตระบบ (Digital Wallet Top-up)
              </h3>
              <button 
                type="button"
                onClick={() => {
                  setShowDepositPopup(false);
                  setDepositAmountInput(0);
                  setDepositSlipBase64('');
                }}
                className="p-1 text-gray-400 hover:text-gray-600 rounded-full cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleApplyDepositSubmit} className="space-y-4 overflow-y-auto pr-1">
              <span className="text-[10px] text-gray-400 block font-bold leading-normal">
                * ขั้นตอนการเติมเครดิต: โปรดติดต่อฝ่ายบริการลูกค้าเพื่อขอเลขบัญชีสำหรับการฝากเงิน จากนั้นกรอกจำนวนยอดเงินให้ตรง และแนบภาพหลักฐานสลิปการโอนค่ะ
              </span>

              {/* Demo target Bank account details replaced with notice */}
              <div className="p-3 bg-red-50 rounded-2xl border border-red-100 flex flex-col gap-1 text-[10px] text-red-800 font-extrabold leading-normal">
                <p className="text-xs font-black">ℹ️ หมายเหตุทางระบบ :</p>
                <p className="text-red-700 font-black text-[10.5px]">• โปรดติดต่อฝ่ายบริการลูกค้าเพื่อขอเลขบัญชีสำหรับการฝากเงินเข้ากระเป๋าตังค์</p>
              </div>

              {/* Deposit Amount input with chips */}
              <div className="space-y-1">
                <label className="text-[10px] font-black text-gray-600 block">ระบุมูลค่าเงินโอนจริง (THB)</label>
                <input
                  type="number"
                  required
                  min="20"
                  max="500000"
                  placeholder="ป้อนระบุยอดเงินโอนจริง..."
                  className="w-full bg-gray-50 border rounded-xl p-2.5 text-sm font-black font-mono focus:outline-none focus:border-red-500 animate-pulse-once"
                  value={depositAmountInput || ''}
                  onChange={(e) => setDepositAmountInput(Number(e.target.value))}
                />
                <div className="flex gap-1.5 flex-wrap pt-1">
                  {[100, 300, 500, 1000, 5000].map(val => (
                    <button
                      key={val}
                      type="button"
                      onClick={() => setDepositAmountInput(val)}
                      className={`text-[9.5px] font-black px-2.5 py-1 rounded-lg border transition-all cursor-pointer ${
                        depositAmountInput === val 
                          ? 'bg-red-50 text-red-600 border-red-300 shadow-sm' 
                          : 'bg-white text-gray-500 border-gray-150 hover:bg-gray-50'
                      }`}
                    >
                      +{val.toLocaleString()} THB
                    </button>
                  ))}
                </div>
              </div>

              {/* File Attachment & Drag and Drop with trigger */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-black text-gray-600 block">📸 แนบภาพหลักฐานสลิปโอนเงิน (Upload pay slip)</label>
                
                <div className="border-2 border-dashed border-gray-200 hover:border-red-400 bg-gray-50 rounded-2xl p-4 transition-all flex flex-col items-center justify-center relative cursor-pointer group">
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleFileChangeForDeposit}
                    className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                  />
                  {isUploadingSlip ? (
                    <div className="flex flex-col items-center gap-2 py-4">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-red-500"></div>
                      <span className="text-xs font-bold text-gray-500">กำลังอัปโหลดรูปภาพสลิปขึ้นคลาวด์ออนไลน์... ⏳</span>
                    </div>
                  ) : depositSlipBase64 ? (
                    <div className="text-center space-y-2 pointer-events-none">
                      <div className="flex justify-center">
                        <img 
                          src={depositSlipBase64} 
                          alt="Slip Preview" 
                          className="max-h-28 max-w-full rounded-xl object-contain border bg-white p-1"
                        />
                      </div>
                      <p className="text-[9px] text-teal-600 font-extrabold">✓ อัปโหลดภาพสลิปออนไลน์เรียบร้อยแล้ว (กดซ้ำเพื่อเปลี่ยนภาพ)</p>
                    </div>
                  ) : (
                    <div className="text-center pointer-events-none space-y-1 py-1.5">
                      <Image size={24} className="mx-auto text-gray-400 group-hover:text-red-500 transition-colors" />
                      <p className="text-[10.5px] font-black text-gray-600">กดหรือลากรูปภาพมาวางที่นี่</p>
                      <p className="text-[9px] text-gray-400">ขนาดไฟล์รองรับไม่เกิน 5MB</p>
                    </div>
                  )}
                </div>
              </div>

              <button
                type="submit"
                className="w-full py-3.5 rounded-xl font-black text-white shadow-md cursor-pointer text-xs active:scale-95 transition-transform"
                style={{ background: `linear-gradient(135deg, ${themePrimary} 0%, ${themeGradientEnd} 100%)` }}
              >
                ยืนยันแจ้งเติมเงินเข้าระบบ (Top up wallet)
              </button>
            </form>
          </div>
        </div>
      )}

      {/* --- WITHDRAW SUCCESS CUSTOM ALERT DIALOG --- */}
      {withdrawSuccessAlert && (
        <div id="withdraw-success-alert-dialog" className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm px-4 flex justify-center items-center">
          <div className="w-full max-w-sm bg-white rounded-3xl overflow-hidden shadow-2xl p-6 border flex flex-col items-center text-center">
            <div className="w-12 h-12 bg-emerald-100 rounded-full flex items-center justify-center text-emerald-500 mb-4 animate-pulse">
              <CheckCircle size={24} className="stroke-[2.5]" />
            </div>
            <h3 className="text-sm font-black text-gray-900 font-display mb-2">
              ส่งคำขอถอนเงินสำเร็จ
            </h3>
            <p className="text-xs text-gray-500 font-medium leading-relaxed mb-6">
              ส่งคำขอในการถอนยอดเงินแล้ว รอระบบดำเนินการตามลำดับอัตโนมัติ และตรวจสอบประวัติธุรกรรมได้ด้วยตนเองผ่านแจ้งเตือนร้านค้าของท่าน
            </p>
            <button
              type="button"
              onClick={() => setWithdrawSuccessAlert(false)}
              className="w-full py-2.5 rounded-xl font-bold text-white shadow-sm text-xs cursor-pointer hover:bg-gray-800 transition-colors bg-gray-900"
            >
              ตกลง
            </button>
          </div>
        </div>
      )}

      {/* --- EDITING PRODUCT POPUP MODAL (Merchant on self, Admin on all) --- */}
      {showEditModal && editingProduct && (
        <div id="profile-edit-product-popup-modal" className="fixed inset-0 z-50 bg-black/60 overflow-y-auto backdrop-blur-sm py-10 px-4 flex justify-center items-start">
          <div className="w-full max-w-lg bg-white rounded-3xl overflow-hidden shadow-2xl border border-gray-50 p-6 animate-slide-up">
            <div className="flex items-center justify-between border-b pb-3 mb-4">
              <h3 className="text-base font-black text-gray-950 font-display">
                ✏️ แก้ไขข้อมูลสินค้าของร้านค้า
              </h3>
              <button 
                onClick={() => { setShowEditModal(false); setEditingProduct(null); }}
                className="p-1.5 text-gray-400 hover:text-gray-600 rounded-full hover:bg-gray-100"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSaveEditProduct} className="space-y-4">
              <div className="space-y-1">
                <label className="text-xs font-bold text-gray-600 font-display">ชื่อสินค้า</label>
                <input
                  type="text"
                  required
                  placeholder="ชื่อสินค้า..."
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl py-2 px-3 text-xs font-bold"
                  value={editingProduct.name}
                  onChange={(e) => setEditingProduct({ ...editingProduct, name: e.target.value })}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-gray-600">ราคาจำหน่าย (THB)</label>
                  <input
                    type="number"
                    required
                    min="1"
                    className="w-full bg-gray-50 border border-gray-200 rounded-xl py-2 px-3 text-xs font-black font-mono"
                    value={editingProduct.price || ''}
                    onChange={(e) => setEditingProduct({ ...editingProduct, price: Number(e.target.value) })}
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-gray-600">สถานะขาย</label>
                  <select
                    className="w-full bg-gray-50 border border-gray-200 rounded-xl py-2 px-3 text-xs font-bold text-gray-700"
                    value={editingProduct.status}
                    onChange={(e) => setEditingProduct({ ...editingProduct, status: e.target.value as any })}
                  >
                    {currentUser?.role === 'Merchant' ? (
                      <>
                        <option value="approved">เปิดขายปกติ (Active / Approved)</option>
                        <option value="pending">ส่งเพื่อรอการอนุมัติ (Submit for Approval)</option>
                        <option value="paused">ปิดขายชั่วคราว (Paused)</option>
                      </>
                    ) : (
                      <>
                        <option value="approved">เปิดขายปกติ (Active / Approved)</option>
                        <option value="pending">รอการอนุมัติ (Pending)</option>
                        <option value="paused">ปิดขายชั่วคราว (Paused)</option>
                        <option value="rejected">ปฏิเสธการระงับ (Rejected)</option>
                      </>
                    )}
                  </select>
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-gray-600 font-display">หมวดหมู่สินค้าออนไลน์ (Product Category)</label>
                <select
                  required
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl py-2 px-3 text-xs font-bold text-gray-700"
                  value={editingProduct.category || 'APPAREL'}
                  onChange={(e) => setEditingProduct({ ...editingProduct, category: e.target.value })}
                >
                  {dynamicCategories.filter(cat => cat.key !== 'ALL').map(cat => (
                    <option key={cat.key} value={cat.key}>{cat.icon} {cat.label} ({cat.key})</option>
                  ))}
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-gray-600">คำอธิบาย</label>
                <textarea
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl py-2 px-3 text-xs font-medium h-20"
                  value={editingProduct.description}
                  onChange={(e) => setEditingProduct({ ...editingProduct, description: e.target.value })}
                />
              </div>

              <div className="space-y-2">
                <label className="text-xs font-bold text-gray-750 text-gray-700 flex justify-between items-center">
                  <span>เลือกรูปภาพสินค้าจากในเครื่องหรือไฟล์ 📷</span>
                  {editingProduct.image && (
                    <button
                      type="button"
                      onClick={() => setEditingProduct({ ...editingProduct, image: '' })}
                      className="text-[10px] text-red-500 hover:underline font-bold"
                    >
                      ลบรูปภาพ
                    </button>
                  )}
                </label>
                <div 
                  onPaste={handleMainImagePaste}
                  tabIndex={0}
                  className="flex flex-col gap-2 p-1 rounded-2xl border border-transparent focus-within:border-red-300 focus-within:ring-2 focus-within:ring-red-100 transition-all outline-none"
                >
                  <div className="relative border-2 border-dashed border-gray-200 hover:border-red-400 transition-colors rounded-2xl p-4 flex flex-col items-center justify-center bg-gray-50/50 cursor-pointer group">
                    <input
                      type="file"
                      accept="image/*"
                      id="profile-upload-edit-product-image"
                      onChange={handleImageFileChange}
                      className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                    />
                    {isUploadingEditImage ? (
                      <div className="flex flex-col items-center gap-2 py-4">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-red-500"></div>
                        <span className="text-xs font-bold text-gray-500">กำลังอัปโหลดรูปภาพใหม่ขึ้นคลาวด์ออนไลน์... ⏳</span>
                      </div>
                    ) : editingProduct.image && editingProduct.image.trim() !== "" ? (
                      <div className="flex flex-col items-center gap-2">
                        <img 
                          src={editingProduct.image || undefined} 
                          alt="Preview" 
                          className="w-20 h-20 object-cover rounded-xl shadow-md border border-gray-100" 
                        />
                        <span className="text-[10px] text-emerald-600 font-bold block bg-emerald-55 px-2 py-0.5 rounded-full">✓ อัปโหลดภาพใหม่สำเร็จ (รูปภาพออนไลน์พร้อมใช้งาน)</span>
                      </div>
                    ) : (
                      <div className="text-center space-y-1 py-1">
                        <div className="mx-auto w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center text-gray-500 group-hover:bg-red-100 group-hover:text-red-500 transition-colors">
                          📁
                        </div>
                        <p className="text-[11px] font-bold text-gray-500 group-hover:text-red-500 transition-colors">คลิก, ลากไฟล์ หรือกด Ctrl+V เพื่อวางรูปภาพใหม่ที่คัดลอกมา</p>
                        <p className="text-[9px] text-gray-400">รองรับไฟล์ภาพ JPEG, PNG, WEBP (หรือ Copy รูปแล้วกด Ctrl+V เพื่อวางรูปภาพ)</p>
                      </div>
                    )}
                  </div>
                  {/* Fallback URL */}
                  <div className="space-y-1">
                    <span className="text-[9px] font-bold text-gray-400">หรือระบุ URL รูปภาพใหม่ได้ที่นี่:</span>
                    <input
                      type="text"
                      className="w-full bg-gray-100/60 border border-gray-200 rounded-xl py-1.5 px-3 text-[10px] font-semibold"
                      value={editingProduct.image}
                      onChange={(e) => setEditingProduct({ ...editingProduct, image: e.target.value })}
                    />
                  </div>
                </div>
              </div>

              {/* Additional Images Section (Edit Mode - Profile Tab) */}
              <div 
                tabIndex={0}
                onPaste={handleAdditionalImagesPaste}
                className="space-y-2 border border-gray-100 p-3 rounded-2xl bg-gray-50/50 focus-within:border-red-300 focus-within:ring-2 focus-within:ring-red-100 transition-all outline-none"
              >
                <label className="text-xs font-bold text-gray-755 text-gray-700 flex justify-between items-center cursor-pointer">
                  <span>รูปภาพสินค้าเพิ่มเติม (หลายมุมมอง) 📸</span>
                  <span className="text-[10px] text-red-500 font-bold bg-red-50 px-2 py-0.5 rounded-full animate-pulse">💡 คลิกตรงนี้แล้วกด Ctrl+V เพื่อวางรูปได้หลายๆ รูป</span>
                </label>
                <div className="flex flex-wrap gap-2">
                  {(editingProduct.images || []).map((imgUrl, idx) => (
                    <div key={idx} className="relative w-14 h-14 rounded-xl overflow-hidden border border-gray-200 group bg-white shadow-sm shrink-0">
                      <img src={imgUrl || undefined} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                      <button
                        type="button"
                        onClick={() => {
                          const updatedImgs = (editingProduct.images || []).filter((_, i) => i !== idx);
                          setEditingProduct({ ...editingProduct, images: updatedImgs });
                        }}
                        className="absolute inset-0 bg-red-600/80 text-white font-bold text-[10px] opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity cursor-pointer"
                      >
                        ลบ
                      </button>
                    </div>
                  ))}
                  {isUploadingEditAdditionalImage && (
                    <div className="w-14 h-14 rounded-xl border border-gray-200 flex items-center justify-center bg-gray-50 shrink-0">
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-red-500"></div>
                    </div>
                  )}
                  <label className="w-14 h-14 rounded-xl border-2 border-dashed border-gray-300 hover:border-red-400 flex flex-col items-center justify-center cursor-pointer transition-colors shrink-0 bg-white group">
                    <span className="text-sm font-bold text-gray-400 group-hover:text-red-500">+</span>
                    <span className="text-[8px] text-gray-400 font-bold group-hover:text-red-500">เพิ่มรูป</span>
                    <input
                      type="file"
                      accept="image/*"
                      multiple
                      onChange={async (e) => {
                        if (e.target.files) {
                          const files = Array.from(e.target.files);
                          setIsUploadingEditAdditionalImage(true);
                          try {
                            const urls = await Promise.all(
                              files.map(file => uploadImageToCloud(file as File))
                            );
                            const validUrls = urls.filter(Boolean);
                            if (validUrls.length > 0) {
                              const currentImgs = editingProduct.images || [];
                              setEditingProduct({ 
                                ...editingProduct, 
                                images: [...currentImgs, ...validUrls] 
                              });
                            }
                          } catch (err) {
                            console.error("Edit additional upload error:", err);
                          } finally {
                            setIsUploadingEditAdditionalImage(false);
                          }
                        }
                      }}
                      className="hidden"
                    />
                  </label>
                </div>
              </div>

              {/* Simple stock & sales Volume updater */}
              <div className={`grid ${currentUser?.role === 'Admin' || currentUser?.role === 'SuperAdmin' ? 'grid-cols-2' : 'grid-cols-1'} gap-4 bg-rose-50 border-rose-100 border p-3 rounded-2xl`}>
                <div>
                  <span className="text-[11px] font-black text-rose-700 block mb-1">📦 อัปเดตสต็อกรวม</span>
                  <input
                    type="number"
                    min="0"
                    className="bg-white border rounded-xl py-1.5 px-3 uppercase text-xs font-black w-full font-mono"
                    value={editingProduct.totalStock}
                    onChange={(e) => setEditingProduct({ ...editingProduct, totalStock: Number(e.target.value) })}
                  />
                </div>
                {(currentUser?.role === 'Admin' || currentUser?.role === 'SuperAdmin') && (
                  <div>
                    <span className="text-[11px] font-black text-emerald-700 block mb-1">📈 ยอดจำหน่ายสะสม</span>
                    <input
                      type="number"
                      min="0"
                      className="bg-white border text-emerald-800 rounded-xl py-1.5 px-3 uppercase text-xs font-black w-full font-mono"
                      value={editingProduct.salesVolume || 0}
                      onChange={(e) => setEditingProduct({ ...editingProduct, salesVolume: Math.max(0, Number(e.target.value)) })}
                    />
                  </div>
                )}
              </div>

              <button
                type="submit"
                className="w-full py-3.5 rounded-xl font-bold text-white shadow-md transition-opacity hover:opacity-95 text-xs"
                style={{ background: `linear-gradient(135deg, ${themePrimary} 0%, ${themeGradientEnd} 100%)` }}
              >
                บันทึกการแก้ไขสินค้าทั้งหมด
              </button>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
