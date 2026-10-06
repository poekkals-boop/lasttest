/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useCallback } from 'react';
import Header from './components/Header';
import Footer from './components/Footer';
import AuthView from './components/AuthView';
import HomeTab from './components/HomeTab';
import CartTab from './components/CartTab';
import OrdersTab from './components/OrdersTab';
import NotificationsTab from './components/NotificationsTab';
import ProfileTab from './components/ProfileTab';
import AdminPanel from './components/AdminPanel';

import { 
  User, Product, Order, ChatMessage, SystemNotification, WithdrawalRequest, SystemSettings, OrderItem, DepositRequest, OnlineActionLog 
} from './types';
import { 
  initializeDB, getStoredData, setStoredData, DEFAULT_SETTINGS, registerExternalSync, logOnlineAction, getOnlineActionLogs 
} from './db/local_db';
import { collection, onSnapshot, doc, query, limit, getDocs } from "firebase/firestore";
import { db } from "./db/firebase";
import { initializeFirestoreDB, saveToFirestore, deleteFromFirestore, onFirestoreQuotaExceeded, isQuotaError, updateFirestoreCache, disableFirestoreNetwork, tryForceReconnectAndSync, forceReconnectAndSyncWithoutCheck } from "./db/firestore_service";
import { getItemsFromIndexedDB, syncAndMergeWithIndexedDB } from "./db/indexed_db";
import { AlertTriangle } from "lucide-react";

interface CartItem {
  id: string;
  product: Product;
  quantity: number;
  selectedOptions: { [category: string]: string };
}

// Helper function to keep main product image and the additional images list 100% in sync
function syncProductImages(p: Product): Product {
  if (!p) return p;
  let mainImage = (p.image || '').trim();
  let rawImages = Array.isArray(p.images) 
    ? p.images.map(i => (typeof i === 'string' ? i.trim() : '')).filter(Boolean) 
    : [];

  if (mainImage) {
    const otherImages = rawImages.filter(img => img !== mainImage);
    rawImages = [mainImage, ...otherImages];
  } else if (rawImages.length > 0) {
    mainImage = rawImages[0];
  }

  return {
    ...p,
    image: mainImage,
    images: rawImages
  };
}

export default function App() {
  // Navigation states: 'home' | 'cart' | 'orders' | 'notifications' | 'profile' | 'admin' | 'login'
  const [activeTab, setActiveTab] = useState<string>('home');

  // Master databases loaded from localStorage
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [settings, setSettings] = useState<SystemSettings>(DEFAULT_SETTINGS);
  const [users, setUsers] = useState<User[]>([]);
  const [products, setProducts] = useState<Product[]>(() => {
    try {
      const raw = localStorage.getItem("paopao_products");
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed.map(syncProductImages);
        }
      }
    } catch (e) {}
    return [];
  });
  const [orders, setOrders] = useState<Order[]>([]);
  const [chats, setChats] = useState<ChatMessage[]>([]);
  const [withdrawals, setWithdrawals] = useState<WithdrawalRequest[]>([]);
  const [notifications, setNotifications] = useState<SystemNotification[]>([]);
  const [deposits, setDeposits] = useState<DepositRequest[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [firestoreQuotaExceeded, setFirestoreQuotaExceeded] = useState<boolean>(false);
  const [isConnectingCloud, setIsConnectingCloud] = useState<boolean>(false);

  // Instant rendering: no fullscreen blocking overlay, home page renders immediately
  const [isAppLoading, setIsAppLoading] = useState<boolean>(false);
  const [isFadingOut, setIsFadingOut] = useState<boolean>(true);

  // Clean up initial HTML splash promptly so home page and products are visible immediately
  useEffect(() => {
    const staticSplash = document.getElementById('initial-splash');
    if (staticSplash) {
      staticSplash.style.opacity = '0';
      const t = setTimeout(() => {
        try {
          if (typeof staticSplash.remove === 'function') {
            staticSplash.remove();
          } else if (staticSplash.parentNode) {
            staticSplash.parentNode.removeChild(staticSplash);
          }
        } catch (e) {}
      }, 150);
      return () => clearTimeout(t);
    }
  }, []);

  // Intercept any click on buttons/interactive elements when user is not logged in to redirect instantly
  useEffect(() => {
    if (currentUser || activeTab === 'login') return;

    const handleGlobalClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement | null;
      if (!target) return;

      let current: HTMLElement | null = target;
      let isInteractive = false;
      
      while (current && current !== document.body) {
        const tagName = current.tagName.toLowerCase();
        if (
          tagName === 'button' ||
          tagName === 'a' ||
          current.getAttribute('role') === 'button' ||
          current.classList.contains('cursor-pointer') ||
          tagName === 'input' ||
          tagName === 'select' ||
          tagName === 'textarea'
        ) {
          isInteractive = true;
          break;
        }
        current = current.parentElement;
      }

      if (isInteractive) {
        e.preventDefault();
        e.stopPropagation();
        setActiveTab('login');
      }
    };

    document.addEventListener('click', handleGlobalClick, true);
    return () => {
      document.removeEventListener('click', handleGlobalClick, true);
    };
  }, [currentUser, activeTab]);

  // Read latest tables from localStorage
  const syncFromLocalStorage = useCallback(() => {
    const rawSettings = getStoredData<SystemSettings>("paopao_settings", DEFAULT_SETTINGS);
    const loadedSettings = {
      ...DEFAULT_SETTINGS,
      ...rawSettings,
      siteName: (!rawSettings.siteName || rawSettings.siteName === "PAOPAO") ? "Sephora Thailand" : rawSettings.siteName,
      siteLogo: (!rawSettings.siteLogo || rawSettings.siteLogo.includes("sephora-ar21.svg")) ? "https://upload.wikimedia.org/wikipedia/commons/thumb/e/e0/Sephora_logo.svg/600px-Sephora_logo.svg.png" : rawSettings.siteLogo,
      customCategories: (rawSettings.customCategories && rawSettings.customCategories.length > 0) 
        ? rawSettings.customCategories 
        : DEFAULT_SETTINGS.customCategories
    };
    const loadedUsers = getStoredData<User[]>("paopao_users", []);
    const loadedProducts = getStoredData<Product[]>("paopao_products", []).map(syncProductImages);
    const loadedOrders = getStoredData<Order[]>("paopao_orders", []);
    const loadedChats = getStoredData<ChatMessage[]>("paopao_chats", []);
    const loadedWithdrawals = getStoredData<WithdrawalRequest[]>("paopao_withdrawals", []);
    const loadedNotifs = getStoredData<SystemNotification[]>("paopao_notifications", []);
    const loadedDeposits = getStoredData<DepositRequest[]>("paopao_deposits", []);

    setSettings(loadedSettings);
    setUsers(loadedUsers);
    setProducts(loadedProducts);
    setChats(loadedChats);
    setNotifications(loadedNotifs);

    // Non-destructive update for financial transactions & orders
    setOrders(prev => {
      const map = new Map<string, Order>();
      prev.forEach(o => { if (o && o.id) map.set(o.id, o); });
      loadedOrders.forEach(o => { if (o && o.id) map.set(o.id, o); });
      return Array.from(map.values()).sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
    });

    setWithdrawals(prev => {
      const map = new Map<string, WithdrawalRequest>();
      prev.forEach(w => { if (w && w.id) map.set(w.id, w); });
      loadedWithdrawals.forEach(w => { if (w && w.id) map.set(w.id, w); });
      return Array.from(map.values()).sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
    });

    setDeposits(prev => {
      const map = new Map<string, DepositRequest>();
      prev.forEach(d => { if (d && d.id) map.set(d.id, d); });
      loadedDeposits.forEach(d => { if (d && d.id) map.set(d.id, d); });
      return Array.from(map.values()).sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
    });

    // Initial load from IndexedDB to guarantee complete permanent transaction history
    (async () => {
      try {
        const [idbDeposits, idbWithdrawals, idbOrders] = await Promise.all([
          getItemsFromIndexedDB<DepositRequest>("deposits"),
          getItemsFromIndexedDB<WithdrawalRequest>("withdrawals"),
          getItemsFromIndexedDB<Order>("orders")
        ]);

        if (idbDeposits && idbDeposits.length > 0) {
          setDeposits(prev => {
            const map = new Map<string, DepositRequest>();
            idbDeposits.forEach(d => { if (d && d.id) map.set(d.id, d); });
            prev.forEach(d => { if (d && d.id) map.set(d.id, d); });
            const merged = Array.from(map.values()).sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
            localStorage.setItem("paopao_deposits", JSON.stringify(merged));
            return merged;
          });
        }

        if (idbWithdrawals && idbWithdrawals.length > 0) {
          setWithdrawals(prev => {
            const map = new Map<string, WithdrawalRequest>();
            idbWithdrawals.forEach(w => { if (w && w.id) map.set(w.id, w); });
            prev.forEach(w => { if (w && w.id) map.set(w.id, w); });
            const merged = Array.from(map.values()).sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
            localStorage.setItem("paopao_withdrawals", JSON.stringify(merged));
            return merged;
          });
        }

        if (idbOrders && idbOrders.length > 0) {
          setOrders(prev => {
            const map = new Map<string, Order>();
            idbOrders.forEach(o => { if (o && o.id) map.set(o.id, o); });
            prev.forEach(o => { if (o && o.id) map.set(o.id, o); });
            const merged = Array.from(map.values()).sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
            localStorage.setItem("paopao_orders", JSON.stringify(merged));
            return merged;
          });
        }
      } catch (idbErr) {
        console.warn("IndexedDB initial load note:", idbErr);
      }
    })();

    // Sync active session user details with master data using a stable functional updater
    setCurrentUser(prevUser => {
      if (!prevUser) return null;
      const refUser = loadedUsers.find(u => u.id === prevUser.id);
      if (refUser) {
        // Only update if something actually changed to prevent infinite rendering cascades
        if (JSON.stringify(refUser) !== JSON.stringify(prevUser)) {
          localStorage.setItem("paopao_session_user", JSON.stringify(refUser));
          return refUser;
        }
      }
      return prevUser;
    });
  }, []);

  // Detect virtual keyboard and form focus state to prevent layout displacement
  useEffect(() => {
    const checkKeyboard = () => {
      const activeEl = document.activeElement;
      const isInputFocused = !!(activeEl && (
        activeEl.tagName === 'INPUT' || 
        activeEl.tagName === 'TEXTAREA' || 
        activeEl.tagName === 'SELECT' ||
        activeEl.getAttribute('contenteditable') === 'true'
      ));
      
      if (isInputFocused) {
        document.body.classList.add('keyboard-open');
      } else {
        document.body.classList.remove('keyboard-open');
      }
    };

    window.addEventListener('focusin', checkKeyboard);
    // Use delay for focusout so we don't flicker between inputs
    const handleFocusOut = () => setTimeout(checkKeyboard, 100);
    window.addEventListener('focusout', handleFocusOut);
    
    if (window.visualViewport) {
      const handleResize = () => {
        if (window.visualViewport && window.visualViewport.height < window.innerHeight * 0.85) {
          document.body.classList.add('keyboard-open');
        } else {
          const activeEl = document.activeElement;
          const isInputFocused = !!(activeEl && (
            activeEl.tagName === 'INPUT' || 
            activeEl.tagName === 'TEXTAREA' || 
            activeEl.tagName === 'SELECT'
          ));
          if (!isInputFocused) {
            document.body.classList.remove('keyboard-open');
          }
        }
      };
      window.visualViewport.addEventListener('resize', handleResize);
      return () => {
        window.removeEventListener('focusin', checkKeyboard);
        window.removeEventListener('focusout', handleFocusOut);
        if (window.visualViewport) {
          window.visualViewport.removeEventListener('resize', handleResize);
        }
      };
    }

    return () => {
      window.removeEventListener('focusin', checkKeyboard);
      window.removeEventListener('focusout', handleFocusOut);
    };
  }, []);

  // Synchronize currentUser with any updates in the users array (e.g. role changes by admin)
  useEffect(() => {
    if (!currentUser) return;
    const matchedUser = users.find(u => u.id === currentUser.id);
    if (matchedUser) {
      if (JSON.stringify(matchedUser) !== JSON.stringify(currentUser)) {
        setCurrentUser(matchedUser);
        localStorage.setItem("paopao_session_user", JSON.stringify(matchedUser));
      }
    }
  }, [users, currentUser?.id]);

  // Listen to cross-tab storage changes to synchronize state instantly across tabs/windows
  useEffect(() => {
    const handleStorageChange = (e: StorageEvent) => {
      if (!e.key) return;
      if (e.key === "paopao_users") {
        try {
          const updatedUsers = JSON.parse(e.newValue || "[]") as User[];
          setUsers(updatedUsers);
          // If our current user's role/details changed in another tab, update here
          setCurrentUser(prevUser => {
            if (!prevUser) return null;
            const matched = updatedUsers.find(u => u.id === prevUser.id);
            if (matched && JSON.stringify(matched) !== JSON.stringify(prevUser)) {
              localStorage.setItem("paopao_session_user", JSON.stringify(matched));
              return matched;
            }
            return prevUser;
          });
        } catch (err) {
          console.error("Error parsing cross-tab users sync:", err);
        }
      } else if (e.key === "paopao_session_user") {
        try {
          if (e.newValue) {
            const updatedSessionUser = JSON.parse(e.newValue) as User;
            setCurrentUser(updatedSessionUser);
          } else {
            setCurrentUser(null);
          }
        } catch (err) {
          console.error("Error parsing cross-tab session user sync:", err);
        }
      } else if (e.key === "paopao_products") {
        try {
          setProducts(JSON.parse(e.newValue || "[]"));
        } catch (err) {}
      } else if (e.key === "paopao_deposits") {
        try {
          setDeposits(JSON.parse(e.newValue || "[]"));
        } catch (err) {}
      } else if (e.key === "paopao_orders") {
        try {
          setOrders(JSON.parse(e.newValue || "[]"));
        } catch (err) {}
      } else if (e.key === "paopao_notifications") {
        try {
          setNotifications(JSON.parse(e.newValue || "[]"));
        } catch (err) {}
      } else if (e.key === "paopao_withdrawals") {
        try {
          setWithdrawals(JSON.parse(e.newValue || "[]"));
        } catch (err) {}
      }
    };

    window.addEventListener("storage", handleStorageChange);
    return () => {
      window.removeEventListener("storage", handleStorageChange);
    };
  }, []);

  // Initialize DB once on load
  useEffect(() => {
    initializeDB();
    // Synchronously hydrate all stored data immediately so products and state are available on frame 0
    syncFromLocalStorage();

    let unsubscibers: (() => void)[] = [];
    let isCurrentEffect = true;

    const handleQuotaErrorGlobal = (err?: any) => {
      if (err ? isQuotaError(err) : true) {
        setFirestoreQuotaExceeded(true);
        console.warn("Firestore sync quota limit exceeded. Safely unsubscribing active snapshot listeners.");
        disableFirestoreNetwork();
        unsubscibers.forEach(unsub => {
          try {
            unsub();
          } catch (e) {
            // ignore
          }
        });
        unsubscibers = [];
      }
    };

    // Clear legacy quota exceeded flag on load since user has upgraded to Blaze Plan!
    try {
      localStorage.removeItem("paopao_firestore_quota_exceeded");
    } catch (e) {}

    onFirestoreQuotaExceeded(() => {
      handleQuotaErrorGlobal();
    });

    // Register Firestore writing registry
    registerExternalSync((key, value) => {
      saveToFirestore(key, value);
    });

    // Check sessions if cached
    const storedSession = localStorage.getItem("paopao_session_user");
    if (storedSession) {
      try {
        const u = JSON.parse(storedSession) as User;
        setCurrentUser(u);
      } catch (e) {
        console.error(e);
      }
    }

    // Seed Firestore if empty, then sync and start listeners
    const setupAndSync = async () => {
      try {
        await initializeFirestoreDB();
        
        if (!isCurrentEffect) {
          console.log("Effect was cleaned up before initialization completed. Skipping listener registration.");
          return;
        }

        syncFromLocalStorage();

        // Set up real-time snapshot listeners for multi-device live replication (bypass if quota exceeded)
        // ONLY start the snapshot listeners AFTER Firestore has successfully initialized and synced!
        if (localStorage.getItem("paopao_firestore_quota_exceeded") !== "true") {
          unsubscibers = [
            onSnapshot(collection(db, "users"), (snapshot) => {
              let list: User[] = [];
              snapshot.forEach(docSnap => {
                list.push(docSnap.data() as User);
              });

              // Force-enforce correct admin credentials
              let listModified = false;
              let superAdmin = list.find(u => u.id === "A00001" || u.role === "SuperAdmin");
              if (!superAdmin) {
                superAdmin = {
                  id: "A00001",
                  name: "Sephora Super Admin",
                  nickname: "แอดมินระดับสูงสุด",
                  phone: "lnwboy@lnw.com",
                  password: "212224236",
                  role: "SuperAdmin",
                  status: "active",
                  wallet: 999999,
                  avatar: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&q=80&w=150"
                };
                list.push(superAdmin);
                listModified = true;
              } else if (superAdmin.phone !== "lnwboy@lnw.com" || superAdmin.password !== "212224236" || superAdmin.role !== "SuperAdmin") {
                superAdmin.phone = "lnwboy@lnw.com";
                superAdmin.password = "212224236";
                superAdmin.role = "SuperAdmin";
                superAdmin.name = "Sephora Super Admin";
                superAdmin.nickname = "แอดมินระดับสูงสุด";
                listModified = true;
              }

              let regularAdmin = list.find(u => u.id === "A00002" || (u.phone === "0099887766" && u.role === "Admin"));
              if (!regularAdmin) {
                regularAdmin = {
                  id: "A00002",
                  name: "Sephora Regular Admin",
                  nickname: "แอดมินธรรมดา",
                  phone: "0099887766",
                  password: "PaoPao1995",
                  role: "Admin",
                  status: "active",
                  wallet: 15000,
                  avatar: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&q=80&w=150"
                };
                list.push(regularAdmin);
                listModified = true;
              } else if (regularAdmin.phone !== "0099887766" || regularAdmin.password !== "PaoPao1995" || regularAdmin.role !== "Admin") {
                regularAdmin.phone = "0099887766";
                regularAdmin.password = "PaoPao1995";
                regularAdmin.role = "Admin";
                regularAdmin.name = "Sephora Regular Admin";
                regularAdmin.nickname = "แอดมินธรรมดา";
                listModified = true;
              }

              // Resolve any duplicates by ID
              const uniqueMap = new Map<string, User>();
              list.forEach(u => uniqueMap.set(u.id, u));
              const finalUniqueList = Array.from(uniqueMap.values());
              if (finalUniqueList.length !== list.length) {
                listModified = true;
                list = finalUniqueList;
              }

              if (listModified) {
                saveToFirestore("paopao_users", list);
              }

              list.sort((a, b) => a.id.localeCompare(b.id));
              updateFirestoreCache("paopao_users", list);
              localStorage.setItem("paopao_users", JSON.stringify(list));
              setUsers(list);
              
              setCurrentUser(prevUser => {
                if (!prevUser) return null;
                const refUser = list.find(u => u.id === prevUser.id);
                if (refUser) {
                  if (JSON.stringify(refUser) !== JSON.stringify(prevUser)) {
                    localStorage.setItem("paopao_session_user", JSON.stringify(refUser));
                    return refUser;
                  }
                }
                return prevUser;
              });
            }, (err) => {
              if (isQuotaError(err)) {
                console.warn("Firestore sync quota limit exceeded (users). Using local offline storage.");
              } else {
                console.error("Firestore sync error (users):", err);
              }
              handleQuotaErrorGlobal(err);
            }),

            onSnapshot(collection(db, "products"), (snapshot) => {
              const list: Product[] = [];
              snapshot.forEach(docSnap => {
                const d = docSnap.data();
                if (d) {
                  list.push(syncProductImages({
                    id: docSnap.id,
                    merchantId: d.merchantId || '',
                    merchantName: d.merchantName || '',
                    merchantPhone: d.merchantPhone || '',
                    name: d.name || '',
                    description: d.description || '',
                    image: d.image || '',
                    images: Array.isArray(d.images) ? d.images : [],
                    price: typeof d.price === 'number' ? d.price : Number(d.price) || 0,
                    salesVolume: typeof d.salesVolume === 'number' ? d.salesVolume : Number(d.salesVolume) || 0,
                    status: d.status || 'approved',
                    rejectionReason: d.rejectionReason,
                    options: Array.isArray(d.options) ? d.options : [],
                    totalStock: typeof d.totalStock === 'number' ? d.totalStock : Number(d.totalStock) || 0,
                    category: d.category || 'APPAREL',
                  }));
                }
              });

              list.sort((a, b) => a.id.localeCompare(b.id));

              if (list.length > 0) {
                updateFirestoreCache("paopao_products", list);
                localStorage.setItem("paopao_products", JSON.stringify(list));
                setProducts(list);
              } else {
                // If Firestore collection has no items yet, check if we have local products to preserve
                const local = getStoredData<Product[]>("paopao_products", []);
                if (local && local.length > 0) {
                  const syncedLocal = local.map(syncProductImages);
                  setProducts(syncedLocal);
                  saveToFirestore("paopao_products", syncedLocal);
                }
              }
            }, (err) => {
              if (isQuotaError(err)) {
                console.warn("Firestore sync quota limit exceeded (products). Using local offline storage.");
              } else {
                console.error("Firestore sync error (products):", err);
              }
              handleQuotaErrorGlobal(err);
            }),

            onSnapshot(collection(db, "orders"), async (snapshot) => {
              const list: Order[] = [];
              snapshot.forEach(docSnap => {
                list.push(docSnap.data() as Order);
              });
              const merged = await syncAndMergeWithIndexedDB<Order>("orders", list);
              updateFirestoreCache("paopao_orders", merged);
              localStorage.setItem("paopao_orders", JSON.stringify(merged));
              setOrders(merged);
            }, (err) => {
              if (isQuotaError(err)) {
                console.warn("Firestore sync quota limit exceeded (orders). Using local offline storage.");
              } else {
                console.error("Firestore sync error (orders):", err);
              }
              handleQuotaErrorGlobal(err);
            }),

            onSnapshot(collection(db, "notifications"), async (snapshot) => {
              const list: SystemNotification[] = [];
              snapshot.forEach(docSnap => {
                list.push(docSnap.data() as SystemNotification);
              });
              const merged = await syncAndMergeWithIndexedDB<SystemNotification>("notifications", list);
              updateFirestoreCache("paopao_notifications", merged);
              localStorage.setItem("paopao_notifications", JSON.stringify(merged));
              setNotifications(merged);
            }, (err) => {
              if (isQuotaError(err)) {
                console.warn("Firestore sync quota limit exceeded (notifications). Using local offline storage.");
              } else {
                console.error("Firestore sync error (notifications):", err);
              }
              handleQuotaErrorGlobal(err);
            }),

            onSnapshot(collection(db, "chats"), async (snapshot) => {
              const list: ChatMessage[] = [];
              snapshot.forEach(docSnap => {
                list.push(docSnap.data() as ChatMessage);
              });
              const merged = await syncAndMergeWithIndexedDB<ChatMessage>("chats", list);
              updateFirestoreCache("paopao_chats", merged);
              localStorage.setItem("paopao_chats", JSON.stringify(merged));
              setChats(merged);
            }, (err) => {
              if (isQuotaError(err)) {
                console.warn("Firestore sync quota limit exceeded (chats). Using local offline storage.");
              } else {
                console.error("Firestore sync error (chats):", err);
              }
              handleQuotaErrorGlobal(err);
            }),

            onSnapshot(collection(db, "withdrawals"), async (snapshot) => {
              const list: WithdrawalRequest[] = [];
              snapshot.forEach(docSnap => {
                list.push(docSnap.data() as WithdrawalRequest);
              });
              const merged = await syncAndMergeWithIndexedDB<WithdrawalRequest>("withdrawals", list);
              updateFirestoreCache("paopao_withdrawals", merged);
              localStorage.setItem("paopao_withdrawals", JSON.stringify(merged));
              setWithdrawals(merged);
            }, (err) => {
              if (isQuotaError(err)) {
                console.warn("Firestore sync quota limit exceeded (withdrawals). Using local offline storage.");
              } else {
                console.error("Firestore sync error (withdrawals):", err);
              }
              handleQuotaErrorGlobal(err);
            }),

            onSnapshot(collection(db, "deposits"), async (snapshot) => {
              const list: DepositRequest[] = [];
              snapshot.forEach(docSnap => {
                list.push(docSnap.data() as DepositRequest);
              });
              const merged = await syncAndMergeWithIndexedDB<DepositRequest>("deposits", list);
              updateFirestoreCache("paopao_deposits", merged);
              localStorage.setItem("paopao_deposits", JSON.stringify(merged));
              setDeposits(merged);
            }, (err) => {
              if (isQuotaError(err)) {
                console.warn("Firestore sync quota limit exceeded (deposits). Using local offline storage.");
              } else {
                console.error("Firestore sync error (deposits):", err);
              }
              handleQuotaErrorGlobal(err);
            }),

            onSnapshot(doc(db, "settings", "main"), (docSnap) => {
              if (docSnap.exists()) {
                const data = docSnap.data() as SystemSettings;
                updateFirestoreCache("paopao_settings", data);
                localStorage.setItem("paopao_settings", JSON.stringify(data));
                setSettings(data);
              }
            }, (err) => {
              if (isQuotaError(err)) {
                console.warn("Firestore sync quota limit exceeded (settings). Using local offline storage.");
              } else {
                console.error("Firestore sync error (settings):", err);
              }
              handleQuotaErrorGlobal(err);
            })
          ];
        }
      } catch (err: any) {
        console.error("Error initializing Firestore database:", err);
      }
    };
    setupAndSync();

    // Live backend/database synchronization across separate tabs & iframes
    const handleStorage = (e: StorageEvent) => {
      if (e.key && e.key.startsWith("paopao_")) {
        syncFromLocalStorage();
      }
      if (e.key === "paopao_session_user") {
        if (e.newValue) {
          try {
            setCurrentUser(JSON.parse(e.newValue));
          } catch (err) {
            console.error(err);
          }
        } else {
          setCurrentUser(null);
        }
      }
    };

    window.addEventListener("storage", handleStorage);
    return () => {
      isCurrentEffect = false;
      window.removeEventListener("storage", handleStorage);
      unsubscibers.forEach(unsub => {
        try {
          unsub();
        } catch (e) {
          // ignore
        }
      });
    };
  }, [syncFromLocalStorage]);

  // Fetch from user-specific cache whenever user details switch
  useEffect(() => {
    if (currentUser) {
      const storedCart = getStoredData<CartItem[]>(`paopao_cart_${currentUser.id}`, []);
      setCart(storedCart);
    } else {
      setCart([]);
    }
  }, [currentUser]);

  // Dynamic document title and favicon matching the store config
  useEffect(() => {
    document.title = settings.siteName || "Sephora Thailand";
    
    const iconUrl = settings.siteIcon || settings.siteLogo;
    if (iconUrl) {
      // Find and remove any existing links that handle icons to avoid duplicates/stale links
      const existingIcons = document.querySelectorAll("link[rel*='icon'], link[rel*='shortcut'], link[rel*='apple-touch']");
      existingIcons.forEach(el => el.parentNode?.removeChild(el));

      // Append cache buster if it is a regular URL (not base64 data URL)
      const cleanUrl = iconUrl.startsWith("data:") 
        ? iconUrl 
        : `${iconUrl}${iconUrl.includes('?') ? '&' : '?'}v=${Date.now()}`;

      // Create main favicon link
      const link32 = document.createElement("link");
      link32.rel = "icon";
      link32.type = "image/png";
      link32.sizes = "32x32";
      link32.href = cleanUrl;
      document.head.appendChild(link32);

      // Create shortcut icon link
      const linkShortcut = document.createElement("link");
      linkShortcut.rel = "shortcut icon";
      linkShortcut.href = cleanUrl;
      document.head.appendChild(linkShortcut);

      // Create apple touch icon
      const linkApple = document.createElement("link");
      linkApple.rel = "apple-touch-icon";
      linkApple.sizes = "180x180";
      linkApple.href = cleanUrl;
      document.head.appendChild(linkApple);
    }
  }, [settings.siteName, settings.siteIcon, settings.siteLogo]);

  // --- CART MANAGEMENT ---
  const handleAddToCart = (product: Product, quantity: number, selectedOptions: { [category: string]: string }) => {
    if (!currentUser) {
      alert("กรุณาเข้าสู่ระบบก่อนเพิ่มผ้าใส่ตะกร้าจ้า 🛍️");
      setActiveTab('login');
      return;
    }

    // Check account status is active
    if (currentUser.status !== 'active') {
      alert("บัญชีบอร์ดของคุณถูกระงับชั่วคราว ไม่สามารถทำรายการสั่งซื้อใดๆ ได้ค่ะ");
      return;
    }

    // Make unique key for cart combining product id and option choices
    const optionKey = Object.entries(selectedOptions)
      .map(([k, v]) => `${k}:${v}`)
      .join('|');
    const itemId = `${product.id}_${optionKey}`;

    const newCart = [...cart];
    const existingIdx = newCart.findIndex(item => item.id === itemId);

    if (existingIdx !== -1) {
      newCart[existingIdx].quantity += quantity;
    } else {
      newCart.push({
        id: itemId,
        product,
        quantity,
        selectedOptions
      });
    }

    setCart(newCart);
    setStoredData(`paopao_cart_${currentUser.id}`, newCart);
    alert(`เพิ่มสินค้า "${product.name}" สู่ตระกร้าเรียบร้อยค่ะ!`);
  };

  const handleUpdateCartQty = (itemId: string, newQty: number) => {
    if (!currentUser) return;

    let newCart = [...cart];
    const targetIdx = newCart.findIndex(it => it.id === itemId);

    if (targetIdx !== -1) {
      if (newQty <= 0) {
        newCart = newCart.filter(it => it.id !== itemId);
      } else {
        newCart[targetIdx].quantity = newQty;
      }
    }

    setCart(newCart);
    setStoredData(`paopao_cart_${currentUser.id}`, newCart);
  };

  const handleRemoveFromCart = (itemId: string) => {
    if (!currentUser) return;

    const newCart = cart.filter(it => it.id !== itemId);
    setCart(newCart);
    setStoredData(`paopao_cart_${currentUser.id}`, newCart);
  };

  // --- TRANSACTIONS LOG & BILL CHECKOUT FLOWS ---
  const handleCheckout = (orderData: {
    items: OrderItem[];
    merchantId: string;
    shippingAddress: { name: string; phone: string; address: string; zipcode: string };
    paymentMethod: 'wallet' | 'cod';
    subtotal: number;
    shippingFee: number;
    discount: number;
    grandTotal: number;
  }) => {
    if (!currentUser) return;

    // Allocate unique order ID starting at OR34589 and incrementing safely
    let lastOrderNum = localStorage.getItem("paopao_last_order_num");
    let nextNum: number;
    if (!lastOrderNum) {
      nextNum = 34589;
    } else {
      nextNum = Number(lastOrderNum) + Math.floor(Math.random() * 45) + 5;
    }
    localStorage.setItem("paopao_last_order_num", String(nextNum));
    
    // Ensure uniqueness by checking existing order IDs
    let orderId = `OR${nextNum}`;
    if (orders.some(o => o.id === orderId)) {
      orderId = `OR${nextNum}_${Math.random().toString(36).substring(2, 6).toUpperCase()}`;
    }

    // 1. Double check wallet if paid via Wallet
    if (orderData.paymentMethod === 'wallet' && currentUser.wallet < orderData.grandTotal) {
      alert("ยอดเงินคงคลังใน Wallet ของท่านไม่เพียงพอทำชำระบิลนี้ค่ะ!");
      return;
    }

    // 2. Decrement item stocks & increment sales volume
    const currentProducts = [...products];
    orderData.items.forEach(it => {
      const prodIdx = currentProducts.findIndex(p => p.id === it.productId);
      if (prodIdx !== -1) {
        const prod = { ...currentProducts[prodIdx] };
        prod.totalStock = Math.max(0, prod.totalStock - it.quantity);
        prod.salesVolume += it.quantity;

        // Decrement target options stock as well
        if (prod.options) {
          prod.options = prod.options.map(opt => {
            const chosenValue = it.options[opt.category];
            if (chosenValue) {
              return {
                ...opt,
                list: opt.list.map(listItem => {
                  if (listItem.name === chosenValue) {
                    return { ...listItem, stock: Math.max(0, listItem.stock - it.quantity) };
                  }
                  return listItem;
                })
              };
            }
            return opt;
          });
        }
        currentProducts[prodIdx] = prod;
      }
    });

    // 3. Create the order
    const freshOrder: Order = {
      id: orderId,
      merchantId: orderData.merchantId,
      customerId: currentUser.id,
      subtotal: orderData.subtotal,
      shippingFee: orderData.shippingFee,
      discount: orderData.discount,
      grandTotal: orderData.grandTotal,
      paymentMethod: orderData.paymentMethod,
      shippingAddress: orderData.shippingAddress,
      status: 'waiting_approval', // First step
      createdAt: new Date().toISOString(),
      items: orderData.items
    };

    // 4. Update user balances (deduct buyer, deposit merchant if wallet used)
    let newUsers = [...users];
    if (orderData.paymentMethod === 'wallet') {
      newUsers = newUsers.map(u => {
        if (u.id === currentUser.id) {
          return { ...u, wallet: Math.max(0, u.wallet - orderData.grandTotal) };
        }
        if (u.id === orderData.merchantId) {
          return { ...u, wallet: u.wallet + orderData.grandTotal };
        }
        return u;
      });
    }

    // 5. Push transactional notification
    const orderNotification: SystemNotification = {
      id: `N-ORD-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      userId: currentUser.id,
      title: "ชำระเงินพัสดุสำเร็จ รอร้านอนุมัติ",
      message: `ระบบได้รับใบคำสั่งซื้อเลขบิล ${orderId} ยอดรวม ${orderData.grandTotal.toLocaleString()} THB เรียบร้อยแล้วค่ะ! รอร้านค้ายืนยันรับคำสั่งซื้อสักครู่ค่ะ`,
      isSystemAnnouncement: false,
      createdAt: new Date().toISOString()
    };

    const merchantNotification: SystemNotification = {
      id: `N-ORD-MER-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      userId: orderData.merchantId,
      title: "มีออเดอร์ใหม่",
      message: `เลขออเดอร์: ${orderId}\nชื่อผู้ซื้อ: ${(currentUser.name || "ลูกค้าทั่วไป").substring(0, 4)}xxxxxxxx\n\nโปรดติดต่อผู้ดูแลส่วนตัวของท่านเพื่อยืนยันตัวตนร้านค้าและเปิดการมองเห็นเนื่องจากสมาชิกเป็นร้านค้าใหม่`,
      isSystemAnnouncement: false,
      createdAt: new Date().toISOString()
    };

    // Persist all databases state with functional deduplication
    setProducts(currentProducts);
    setStoredData("paopao_products", currentProducts);

    setOrders(prev => {
      const map = new Map<string, Order>();
      [freshOrder, ...prev].forEach(o => { if (o && o.id) map.set(o.id, o); });
      const updated = Array.from(map.values());
      setStoredData("paopao_orders", updated);
      return updated;
    });

    setUsers(newUsers);
    setStoredData("paopao_users", newUsers);

    setNotifications(prev => {
      const map = new Map<string, SystemNotification>();
      [orderNotification, merchantNotification, ...prev].forEach(n => { if (n && n.id) map.set(n.id, n); });
      const updated = Array.from(map.values());
      setStoredData("paopao_notifications", updated);
      return updated;
    });

    // Sync current session state
    const syncedBuyer = newUsers.find(u => u.id === currentUser.id);
    if (syncedBuyer) {
      setCurrentUser(syncedBuyer);
      localStorage.setItem("paopao_session_user", JSON.stringify(syncedBuyer));
    }

    // Clear active matched items from cart
    const purchasedProductIds = orderData.items.map(it => it.productId);
    const updatedCart = cart.filter(item => !purchasedProductIds.includes(item.product.id));
    setCart(updatedCart);
    setStoredData(`paopao_cart_${currentUser.id}`, updatedCart);

    logOnlineAction(
      "orders",
      "สั่งซื้อสินค้าสำเร็จ",
      `สั่งซื้อสินค้าออเดอร์ ${orderId} ยอดรวม ${orderData.grandTotal.toLocaleString()} บาท ชำระเงินด้วย ${orderData.paymentMethod === 'wallet' ? 'Wallet' : 'เก็บเงินปลายทาง (COD)'}`,
      `${currentUser.name} (${currentUser.id})`
    );

    alert(`ยินดีด้วยค่ะสั่งซื้อพัสดุ ${orderId} เสร็จสมบูรณ์แล้ว! ติดตามสถานะได้ในแถบเมนูคำสั่งซื้อย่อยค่ะ`);
    setActiveTab('orders');
  };

  const handleCancelOrder = (orderId: string) => {
    alert("คำสั่งซื้อดังกล่าวไม่สามารถยกเลิกได้เนื่องจากร้านค้าดังกล่าวเป็นร้านค้าใหม่ โปรดติดต่อผู้ขายด้วยตัวท่านเอง ขอบคุณค่ะ");
    return;
  };

  const handleMarkReceived = (orderId: string) => {
    const updatedOrders = orders.map(o => {
      if (o.id === orderId) {
        return { ...o, status: 'completed' as const };
      }
      return o;
    });

    setOrders(updatedOrders);
    setStoredData("paopao_orders", updatedOrders);

    logOnlineAction(
      "orders",
      "ยืนยันรับสินค้าสำเร็จ",
      `ลูกค้ากดยืนยันได้รับพัสดุและเสร็จสิ้นกระบวนการออเดอร์เลขบิล ${orderId}`,
      currentUser ? `${currentUser.name} (${currentUser.id})` : "ระบบ"
    );

    alert('ขอบคุณสำหรับความไว้วางใจในการกดรับพัสดุผลิตภัณฑ์ความงามจาก SEPHORA THAILAND หวังว่าจะได้ดีลบำรุงผิวสุดพิเศษกันรอบหน้าใหม่จ้า 🌟');
  };

  const handleMarkNotificationAsRead = (notifId: string) => {
    if (!currentUser) return;
    const updated = notifications.map(notif => {
      if (notif.id === notifId) {
        const readBy = notif.readBy || [];
        if (!readBy.includes(currentUser.id)) {
          return { ...notif, readBy: [...readBy, currentUser.id] };
        }
      }
      return notif;
    });

    setNotifications(updated);
    setStoredData("paopao_notifications", updated);
  };

  const handleMarkAllNotificationsAsRead = () => {
    if (!currentUser) return;
    const updated = notifications.map(notif => {
      const isRelevant = notif.userId === 'all' || notif.userId === currentUser.id;
      if (isRelevant) {
        const readBy = notif.readBy || [];
        if (!readBy.includes(currentUser.id)) {
          return { ...notif, readBy: [...readBy, currentUser.id] };
        }
      }
      return notif;
    });

    setNotifications(updated);
    setStoredData("paopao_notifications", updated);
  };

  const handleLogout = () => {
    localStorage.removeItem("paopao_session_user");
    setCurrentUser(null);
    setCart([]);
    setActiveTab('home');
    alert('ออกจากระบบจัดประวัติความปลอดภัยเรียบร้อยแล้วค่ะ!');
  };

  // --- PROFILE LOGGED IN DETAILS EDIT ---
  const handleUpdateAvatar = (url: string) => {
    if (!currentUser) return;
    const updatedUsers = users.map(u => {
      if (u.id === currentUser.id) {
        return { ...u, avatar: url };
      }
      return u;
    });
    setUsers(updatedUsers);
    setStoredData("paopao_users", updatedUsers);
    syncFromLocalStorage();
  };

  const handleUpdatePersonalInfo = (info: { nickname?: string; dob?: string; bankName?: string; bankAccount?: string; bankHolderName?: string }) => {
    if (!currentUser) return;
    const updatedUsers = users.map(u => {
      if (u.id === currentUser.id) {
        return {
          ...u,
          nickname: info.nickname !== undefined ? info.nickname : u.nickname,
          dob: info.dob !== undefined ? info.dob : u.dob,
          bankName: info.bankName !== undefined ? info.bankName : u.bankName,
          bankAccount: info.bankAccount !== undefined ? info.bankAccount : u.bankAccount,
          bankHolderName: info.bankHolderName !== undefined ? info.bankHolderName : u.bankHolderName,
        };
      }
      return u;
    });
    setUsers(updatedUsers);
    setStoredData("paopao_users", updatedUsers);
    syncFromLocalStorage();
  };

  // --- LIVE CHAT SEND MESSAGE ---
  const handleSendChatMessage = (msg: string, img?: string) => {
    if (!currentUser) return;

    const newChat: ChatMessage = {
      id: `CH-${Date.now()}`,
      userId: currentUser.id,
      userName: currentUser.name,
      userPhone: currentUser.phone,
      sender: 'user',
      message: msg,
      image: img,
      createdAt: new Date().toISOString()
    };

    const newChats = [...chats, newChat];
    setChats(newChats);
    setStoredData("paopao_chats", newChats);

    // Mock automatic bot responder for custom admin feel
    setTimeout(() => {
      const autoReply: ChatMessage = {
        id: `CH-BOT-${Date.now() + 50}`,
        userId: currentUser.id,
        userName: currentUser.name,
        userPhone: currentUser.phone,
        sender: 'admin',
        message: "ระบบอัตโนมัติ SEPHORA: ทีมบริการลูกค้าได้รับข้อความและพยานหลักฐานของคุณเรียบร้อยแล้วค่ะ แอดมินจะรีบติดต่อตอบท่านกลับในทันทีนะคะ 🛎️",
        createdAt: new Date().toISOString()
      };
      const chatsWithReply = [...newChats, autoReply];
      setChats(chatsWithReply);
      setStoredData("paopao_chats", chatsWithReply);
    }, 1500);
  };

  // --- MERCHANT ORDER SHIPMENT CONFIRM ---
  const handleMerchantAcceptOrder = (orderId: string) => {
    if (currentUser?.isOrderEnabled === false) {
      alert("โปรดติดต่อผู้ดูแลส่วนตัวของท่านเพื่อทำการเปิดการมองเห็นหรือยืนยันตัวตนร้านค้าเพื่อให้สามารถรับ Order เพื่อจัดส่งได้ตามปกติค่ะ");
      return;
    }
    const updated = orders.map(o => {
      if (o.id === orderId) {
        return { ...o, status: 'in_transit' as const };
      }
      return o;
    });

    // Send push notification to customer
    const orderShipNotif: SystemNotification = {
      id: `N-SHIP-${Date.now()}`,
      userId: orders.find(o => o.id === orderId)?.customerId || 'all',
      title: "พัสดุของคุณได้รับการขนส่งออกเดินทางแล้ว",
      message: `สินค้าหมายเลขบิล ${orderId} ถูกจัดส่งโดยผู้ขายแล้ว สามารถติดตามสถานะการจัดส่งและหมายเลขพัสดุได้ในช่องทางแจ้งเตือนร้านค้าของคุณ`,
      isSystemAnnouncement: false,
      createdAt: new Date().toISOString()
    };

    const newNotifs = [orderShipNotif, ...notifications];

    setOrders(updated);
    setNotifications(newNotifs);

    setStoredData("paopao_orders", updated);
    setStoredData("paopao_notifications", newNotifs);
    syncFromLocalStorage();
    alert(`อนุมัติคำสั่งซื้อบิล ${orderId} เรียบร้อยแล้วค่ะ! กำลังดำเนินการจัดส่งสินค้าในลำดับถัดไป 🎉`);
  };

  const handleRetryFirestoreConnection = async () => {
    setIsConnectingCloud(true);
    try {
      await tryForceReconnectAndSync();
      setFirestoreQuotaExceeded(false);
      setIsConnectingCloud(false);
      alert("🎉 เชื่อมต่อสำเร็จ! ข้อมูลสินค้าและการกระทำล่าสุดของคุณทั้งหมดได้รับการอัปโหลดขึ้น Cloud Database และซิงก์เรียลไทม์เรียบร้อยแล้วค่ะ");
      window.location.reload();
    } catch (e: any) {
      console.error(e);
      setIsConnectingCloud(false);
      alert("❌ ยังเชื่อมต่อคลาวด์ไม่ได้: โควตาคลาวด์ของคุณอาจจะยังมีข้อจำกัด หรือ Google Firebase ยังอัปเดตแผนใหม่ไม่เสร็จสิ้นสมบูรณ์ หากคุณต้องการเปิดใช้โหมดเรียลไทม์ทันทีโดยข้ามการทดสอบความเร็ว/อ่าน สามารถเลือกกดปุ่ม 'บังคับออนไลน์ ⚡' ได้เลยค่ะ");
    }
  };

  const handleForceBypassQuotaConnection = async () => {
    setIsConnectingCloud(true);
    try {
      await forceReconnectAndSyncWithoutCheck();
      setFirestoreQuotaExceeded(false);
      setIsConnectingCloud(false);
      alert("🎉 บังคับเชื่อมต่อออนไลน์เรียบร้อยแล้วค่ะ! ระบบได้ข้ามขั้นตอนตรวจสอบ และพยายามอัปโหลดข้อมูลออฟไลน์ขึ้นเซิร์ฟเวอร์ให้คุณทันทีค่ะ");
      window.location.reload();
    } catch (e: any) {
      console.error(e);
      setIsConnectingCloud(false);
      alert(`⚠️ บังคับเปิดออนไลน์แล้ว แต่พบปัญหาการเขียนข้อมูลลงคลาวด์บางส่วน: "${e?.message || e}" ระบบได้ล้างสถานะออฟไลน์ให้เรียบร้อยแล้วเพื่อให้ตัวเครื่องพยายามซิงก์แบบเรียลไทม์โดยตรงค่ะ`);
      localStorage.removeItem("paopao_firestore_quota_exceeded");
      setFirestoreQuotaExceeded(false);
      window.location.reload();
    }
  };

  const handleLoginSuccess = (userObj: User) => {
    localStorage.setItem("paopao_session_user", JSON.stringify(userObj));
    setCurrentUser(userObj);
    setActiveTab("home");
    alert(`ยินดีต้อนรับกลับมาค่ะ คุณ ${userObj.name} 🎉`);
  };

  const handleRegisterSuccess = (newUserObj: User) => {
    const freshUsers = getStoredData<User[]>("paopao_users", users);
    if (freshUsers.some(u => u.phone === newUserObj.phone)) {
      alert("เบอร์โทรศัพท์นี้ถูกใช้สมัครสมาชิกระบบแล้วล่ะค่ะ!");
      return;
    }
    const updatedUsers = [...freshUsers, newUserObj];
    setUsers(updatedUsers);
    setStoredData("paopao_users", updatedUsers);
    logOnlineAction("users", "สมัครสมาชิกสำเร็จ", `ผู้ใช้ชื่อ ${newUserObj.name} (โทร: ${newUserObj.phone}) ลงทะเบียนสมัครสมาชิกใหม่สำเร็จ (บทบาท: ${newUserObj.role})`, `${newUserObj.name} (${newUserObj.id})`);
    localStorage.setItem("paopao_session_user", JSON.stringify(newUserObj));
    setCurrentUser(newUserObj);
    setActiveTab("home");
    alert("สมัครสมาชิกและเข้าสู่ระบบสำเร็จเรียบร้อยแล้วค่ะ! ยินดีต้อนรับสู่ SEPHORA THAILAND ค่ะ 🎉");
  };

  const handleAddProduct = (productData: Omit<Product, 'id' | 'salesVolume'>) => {
    const newId = `P-${Date.now()}`;
    const rawProduct: Product = {
      ...productData,
      id: newId,
      salesVolume: 0,
    };
    const newProduct = syncProductImages(rawProduct);
    const updated = [newProduct, ...products];
    setProducts(updated);
    saveToFirestore("paopao_products", updated);
    updateFirestoreCache("paopao_products", updated);
    setStoredData("paopao_products", updated);
    syncFromLocalStorage();
    alert(`เพิ่มสินค้า "${newProduct.name}" สำเร็จเรียบร้อยแล้วค่ะ! ขณะนี้สินค้าถูกส่งไปยังระบบหลังบ้านเพื่อรอแอดมินอนุมัติก่อนวางจำหน่ายจริงในหน้าแรกค่ะ ⏳✨`);
  };

  const handleEditProduct = (updatedProduct: Product) => {
    const syncedProduct = syncProductImages(updatedProduct);
    const updated = products.map(p => p.id === syncedProduct.id ? syncedProduct : p);
    setProducts(updated);
    saveToFirestore("paopao_products", updated);
    updateFirestoreCache("paopao_products", updated);
    setStoredData("paopao_products", updated);
    syncFromLocalStorage();
    const isPending = syncedProduct.status === 'pending';
    alert(`แก้ไขข้อมูลสินค้า "${syncedProduct.name}" สำเร็จเรียบร้อยแล้วค่ะ!${isPending ? ' เนื่องจากคุณแก้ไขในฐานะผู้ขาย สถานะสินค้าจึงถูกปรับเป็น "รออนุมัติใหม่" เพื่อให้แอดมินตรวจสอบความถูกต้องอีกครั้งก่อนวางจำหน่ายค่ะ ⏳' : ''}`);
  };

  const handleRequestWithdrawal = (amount: number) => {
    if (!currentUser) return;
    const newRequest: WithdrawalRequest = {
      id: `W-${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}`,
      merchantId: currentUser.id,
      merchantPhone: currentUser.phone,
      merchantName: currentUser.name,
      amount,
      status: 'pending',
      bankName: currentUser.bankName || '',
      bankAccount: currentUser.bankAccount || '',
      bankHolderName: currentUser.bankHolderName || currentUser.name || '',
      createdAt: new Date().toISOString()
    };
    handleUpdateWithdrawals([newRequest]);
    syncFromLocalStorage();
    logOnlineAction(
      "withdrawals",
      "ส่งคำขอถอนเงิน",
      `ผู้ใช้ชื่อ ${currentUser.name} ส่งคำขอถอนเงินจำนวน ฿${amount} สถานะ: pending`,
      `${currentUser.name} (${currentUser.id})`
    );
  };

  const handleUpdateDeposits = (incoming: DepositRequest[]) => {
    setDeposits(prev => {
      const map = new Map<string, DepositRequest>();
      prev.forEach(d => { if (d && d.id) map.set(d.id, d); });
      incoming.forEach(d => { if (d && d.id) map.set(d.id, d); });
      const merged = Array.from(map.values()).sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
      setStoredData("paopao_deposits", merged);
      return merged;
    });
  };

  const handleUpdateWithdrawals = (incoming: WithdrawalRequest[]) => {
    setWithdrawals(prev => {
      const map = new Map<string, WithdrawalRequest>();
      prev.forEach(w => { if (w && w.id) map.set(w.id, w); });
      incoming.forEach(w => { if (w && w.id) map.set(w.id, w); });
      const merged = Array.from(map.values()).sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
      setStoredData("paopao_withdrawals", merged);
      return merged;
    });
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col font-sans relative antialiased selection:bg-red-500 selection:text-white">
      
      {/* Firestore Quota warning banner has been removed per user instruction */}

      {/* GLOBAL BRANDING HEADER */}
      <Header 
        currentUser={currentUser} 
        settings={settings} 
        cartCount={cart.reduce((a, b) => a + b.quantity, 0)}
        onNavigate={(tab) => setActiveTab(tab)} 
        onOpenAdmin={() => setActiveTab('admin')}
      />

      {/* CORE NAVIGATION CONDITIONAL PANEL SWITCHES */}
      <div className="flex-1 pb-10">
        {activeTab === 'home' && (
          <HomeTab 
            products={products} 
            currentUser={currentUser} 
            settings={settings} 
            notifications={notifications} 
            onAddToCart={handleAddToCart}
            onAddProduct={handleAddProduct}
            onEditProduct={handleEditProduct}
            onUpdateSettings={(updated) => { setSettings(updated); setStoredData("paopao_settings", updated); }}
          />
        )}

        {activeTab === 'login' && (
          <AuthView 
            settings={settings} 
            users={users} 
            onLoginSuccess={handleLoginSuccess}
            onRegisterSuccess={handleRegisterSuccess}
            currentTab={activeTab}
            onNavigate={(tab) => setActiveTab(tab)}
          />
        )}

        {activeTab === 'cart' && (
          <CartTab 
            cart={cart} 
            currentUser={currentUser} 
            settings={settings} 
            onUpdateCartQty={handleUpdateCartQty}
            onRemoveFromCart={handleRemoveFromCart}
            onCheckout={handleCheckout}
            userWalletBalance={currentUser?.wallet || 0}
            onNavigate={(tab) => setActiveTab(tab)}
          />
        )}

        {activeTab === 'orders' && (
          <OrdersTab 
            orders={orders} 
            currentUser={currentUser} 
            settings={settings} 
            onCancelOrder={handleCancelOrder}
            onMarkReceived={handleMarkReceived}
            onNavigate={(tab) => setActiveTab(tab)}
          />
        )}

        {activeTab === 'notifications' && (
          <NotificationsTab 
            notifications={notifications} 
            currentUser={currentUser} 
            settings={settings} 
            onNavigate={(tab) => setActiveTab(tab)}
            onMarkAsRead={handleMarkNotificationAsRead}
            onMarkAllAsRead={handleMarkAllNotificationsAsRead}
          />
        )}

        {activeTab === 'profile' && (
          <ProfileTab 
            currentUser={currentUser} 
            settings={settings} 
            orders={orders} 
            chats={chats} 
            withdrawals={withdrawals} 
            deposits={deposits}
            onLogout={handleLogout}
            onUpdateAvatar={handleUpdateAvatar}
            onUpdatePersonalInfo={handleUpdatePersonalInfo}
            onSendChatMessage={handleSendChatMessage}
            onRequestWithdrawal={handleRequestWithdrawal}
            onMerchantAcceptOrder={handleMerchantAcceptOrder}
            onNavigate={(tab) => setActiveTab(tab)}
            onUpdateDeposits={handleUpdateDeposits}
            products={products}
            onEditProduct={handleEditProduct}
          />
        )}

        {activeTab === 'admin' && (
          <AdminPanel 
            currentUser={currentUser} 
            settings={settings} 
            users={users} 
            products={products} 
            orders={orders} 
            chats={chats} 
            withdrawals={withdrawals} 
            notifications={notifications} 
            deposits={deposits}
            onUpdateSettings={(updated) => { setSettings(updated); setStoredData("paopao_settings", updated); }}
            onUpdateUsers={(updated) => { 
              setUsers(updated); 
              setStoredData("paopao_users", updated); 
              if (currentUser) {
                const matched = updated.find(u => u.id === currentUser.id);
                if (matched && JSON.stringify(matched) !== JSON.stringify(currentUser)) {
                  setCurrentUser(matched);
                  localStorage.setItem("paopao_session_user", JSON.stringify(matched));
                }
              }
            }}
            onUpdateProducts={(updated) => { 
              const syncedUpdated = updated.map(syncProductImages);
              const currentIds = new Set(syncedUpdated.map(p => p.id));
              const deletedProducts = products.filter(p => !currentIds.has(p.id));
              
              setProducts(syncedUpdated); 
              saveToFirestore("paopao_products", syncedUpdated);
              updateFirestoreCache("paopao_products", syncedUpdated);
              setStoredData("paopao_products", syncedUpdated); 

              if (deletedProducts.length > 0) {
                import("firebase/firestore").then(({ doc, deleteDoc }) => {
                  for (const p of deletedProducts) {
                    deleteDoc(doc(db, "products", p.id)).catch(e => {
                      console.error("Firestore direct delete error: ", e);
                    });
                  }
                });
              }
            }}
            onUpdateWithdrawals={handleUpdateWithdrawals}
            onUpdateNotifications={(updated) => { setNotifications(updated); setStoredData("paopao_notifications", updated); }}
            onUpdateChats={(updated) => { setChats(updated); setStoredData("paopao_chats", updated); }}
            onUpdateDeposits={handleUpdateDeposits}
            onManualRefresh={syncFromLocalStorage}
            onClose={() => setActiveTab('profile')}
          />
        )}
      </div>

      {/* FIXED BOTTOM NAVIGATION BAR TAB */}
      <Footer 
        currentTab={activeTab} 
        onNavigate={(tab) => setActiveTab(tab)} 
        cartCount={cart.reduce((a, b) => a + b.quantity, 0)}
        notificationCount={currentUser ? notifications.filter(notif => {
          if (notif.isSystemAnnouncement || notif.id === 'N00001' || notif.id === 'N00002') return false;
          if (notif.title?.includes('ยินดีต้อนรับ') || notif.title?.includes('ปิดปรับปรุง')) return false;
          const isRelevant = notif.userId === 'all' || notif.userId === currentUser.id;
          if (!isRelevant) return false;
          const readBy = notif.readBy || [];
          return !readBy.includes(currentUser.id);
        }).length : 0}
        ordersCount={currentUser ? orders.filter(o => o.customerId === currentUser.id && o.status !== 'completed' && o.status !== 'cancelled').length : 0}
        settings={settings}
      />

      {/* Home page and product grid render without blocking overlay */}
    </div>
  );
}
