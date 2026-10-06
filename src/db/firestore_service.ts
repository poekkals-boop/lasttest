import { 
  collection, 
  doc, 
  setDoc, 
  getDocs, 
  onSnapshot, 
  getDoc,
  deleteDoc,
  disableNetwork,
  enableNetwork,
  getDocFromServer
} from "firebase/firestore";
import { db } from "./firebase";
import { 
  User, 
  Product, 
  Order, 
  ChatMessage, 
  SystemNotification, 
  WithdrawalRequest, 
  SystemSettings, 
  DepositRequest 
} from "../types";
import { 
  SEED_USERS, 
  SEED_PRODUCTS, 
  SEED_NOTIFICATIONS,
  SEED_ORDERS,
  SEED_CHATS,
  SEED_WITHDRAWALS, 
  DEFAULT_SETTINGS,
  getStoredData,
  logOnlineAction
} from "./local_db";

// Clear legacy quota exceeded flag on load since the user has upgraded to the Blaze Plan!
try {
  localStorage.removeItem("paopao_firestore_quota_exceeded");
} catch (e) {}

let onQuotaExceededCallback: (() => void) | null = null;

export function onFirestoreQuotaExceeded(cb: () => void) {
  onQuotaExceededCallback = cb;
}

// Helper to recursively strip undefined properties from an object before writing to Firestore
export function cleanUndefined<T>(obj: T): T {
  if (obj === null || obj === undefined) {
    return null as any;
  }
  if (Array.isArray(obj)) {
    return obj.map(item => cleanUndefined(item)) as any;
  }
  if (typeof obj === 'object') {
    const cleaned: any = {};
    for (const key of Object.keys(obj as any)) {
      const val = (obj as any)[key];
      if (val !== undefined) {
        cleaned[key] = cleanUndefined(val);
      }
    }
    return cleaned;
  }
  return obj;
}

export const dbStateCache: { [key: string]: any } = {};

export function updateFirestoreCache(key: string, data: any) {
  try {
    dbStateCache[key] = JSON.parse(JSON.stringify(data));
  } catch (e) {
    // ignore parsing errors
  }
}

export function isQuotaError(err: any): boolean {
  if (!err) return false;
  const errMsg = (err?.message || String(err)).toLowerCase();
  const errCode = (err?.code || "").toLowerCase();
  return (
    errMsg.includes("quota") || 
    errMsg.includes("limit exceeded") || 
    errCode.includes("resource-exhausted") ||
    errCode.includes("quota")
  );
}

function handleQuotaError(err: any) {
  if (isQuotaError(err)) {
    // Gracefully shut down Firestore network synchronization to prevent background connection spam
    disableNetwork(db).then(() => {
      console.warn("Firestore background synchronization has been successfully deactivated.");
    }).catch((e) => {
      console.error("Failed to disable Firestore network connection:", e);
    });

    if (onQuotaExceededCallback) {
      onQuotaExceededCallback();
    }
  }
}

// Initialize Firestore collections with seed data if they are vacant
export async function initializeFirestoreDB() {
  if (localStorage.getItem("paopao_firestore_quota_exceeded") !== "true") {
    try {
      await enableNetwork(db);
      console.log("Firestore network successfully enabled on initialization.");
    } catch (e) {
      console.warn("Firestore network enable on init failed (it might already be active):", e);
    }
  }

  if (localStorage.getItem("paopao_firestore_quota_exceeded") === "true") {
    console.log("Checking if Firestore Quota has been restored or upgraded...");
    try {
      // Temporarily enable network to check if quota is back
      await enableNetwork(db);
      // Attempt to fetch a tiny doc from server to check real quota status
      await getDocFromServer(doc(db, "settings", "main"));
      
      // If we reach here, the quota is NOT exceeded anymore!
      console.log("Firestore connection test succeeded. Quota limit has been cleared/upgraded!");
      localStorage.removeItem("paopao_firestore_quota_exceeded");
      window.location.reload();
      return;
    } catch (error) {
      if (isQuotaError(error)) {
        console.warn("Firestore quota is still exceeded. Staying in offline-first mode.");
        try {
          await disableNetwork(db);
        } catch (e) {
          // ignore
        }
        return;
      } else {
        // Some other error (e.g. temporary network offline / no internet)
        console.warn("Firestore connection check failed with non-quota error. Staying in offline-first mode for safety:", error);
        try {
          await disableNetwork(db);
        } catch (e) {
          // ignore
        }
        return;
      }
    }
  }
  try {
    const settingsRef = doc(db, "settings", "main");
    // Protect against 30-70s slow internet hangs by racing with a 2.5s timeout
    const timeoutPromise = new Promise<null>((resolve) => setTimeout(() => resolve(null), 2500));
    const settingsSnap = await Promise.race([
      getDoc(settingsRef),
      timeoutPromise
    ]);
    
    if (!settingsSnap) {
      console.warn("Firestore initialization check timed out (slow network). Running with cached database instantly.");
      return;
    }
    
    if (!settingsSnap.exists()) {
      console.log("Initializing Firestore with standard seed data...");
      
      // Load from localStorage if present to preserve user registratons, else fall back to SEEDs
      const localSettings = getStoredData<SystemSettings>("paopao_settings", DEFAULT_SETTINGS);
      const localUsers = getStoredData<User[]>("paopao_users", SEED_USERS);
      const localProducts = getStoredData<Product[]>("paopao_products", SEED_PRODUCTS);
      const localNotifications = getStoredData<SystemNotification[]>("paopao_notifications", SEED_NOTIFICATIONS);
      const localOrders = getStoredData<Order[]>("paopao_orders", SEED_ORDERS);
      const localChats = getStoredData<ChatMessage[]>("paopao_chats", SEED_CHATS);
      const localWithdrawals = getStoredData<WithdrawalRequest[]>("paopao_withdrawals", SEED_WITHDRAWALS);
      const localDeposits = getStoredData<DepositRequest[]>("paopao_deposits", []);

      // 1. Settings
      const seedPromises: Promise<any>[] = [
        setDoc(settingsRef, cleanUndefined(localSettings))
      ];
      
      // 2. Users (preserve registered accounts!)
      for (const u of localUsers) {
        if (u?.id) seedPromises.push(setDoc(doc(db, "users", u.id), cleanUndefined(u)));
      }
      
      // 3. Products
      for (const p of localProducts) {
        if (p?.id) seedPromises.push(setDoc(doc(db, "products", p.id), cleanUndefined(p)));
      }
      
      // 4. Notifications
      for (const n of localNotifications) {
        if (n?.id) seedPromises.push(setDoc(doc(db, "notifications", n.id), cleanUndefined(n)));
      }
      
      // 5. Orders
      for (const o of localOrders) {
        if (o?.id) seedPromises.push(setDoc(doc(db, "orders", o.id), cleanUndefined(o)));
      }
      
      // 6. Chats
      for (const c of localChats) {
        if (c?.id) seedPromises.push(setDoc(doc(db, "chats", c.id), cleanUndefined(c)));
      }
      
      // 7. Withdrawals
      for (const w of localWithdrawals) {
        if (w?.id) seedPromises.push(setDoc(doc(db, "withdrawals", w.id), cleanUndefined(w)));
      }

      // 8. Deposits
      for (const d of localDeposits) {
        if (d?.id) seedPromises.push(setDoc(doc(db, "deposits", d.id), cleanUndefined(d)));
      }
      
      await Promise.all(seedPromises);
      console.log("Firestore database seeded successfully in parallel!");
    } else {
      console.log("Firestore database exists. Ready to listen to real-time updates.");
    }
  } catch (error) {
    if (isQuotaError(error)) {
      console.warn("Firestore initialization skipped: Quota limit exceeded. Running in offline/local-first mode safely.");
    } else {
      console.error("Error initializing Firestore database:", error);
    }
    handleQuotaError(error);
  }
}

export async function deleteFromFirestore(collectionName: string, id: string) {
  if (!collectionName || !id) return;
  if (localStorage.getItem("paopao_firestore_quota_exceeded") === "true") return;
  try {
    await deleteDoc(doc(db, collectionName, id));
  } catch (err) {
    console.warn(`Error deleting document ${id} from collection ${collectionName}:`, err);
  }
}

// Save dataset modifications back to Firestore
export async function saveToFirestore(key: string, data: any) {
  if (localStorage.getItem("paopao_firestore_quota_exceeded") === "true") {
    console.warn(`Skipping save of ${key} to Firestore: Quota limit exceeded. Saved locally only.`);
    return;
  }
  try {
    if (key === "paopao_settings") {
      const cachedSettings = dbStateCache["paopao_settings"];
      if (cachedSettings && JSON.stringify(cachedSettings) === JSON.stringify(data)) {
        return; // No change
      }
      await setDoc(doc(db, "settings", "main"), cleanUndefined(data));
      dbStateCache["paopao_settings"] = JSON.parse(JSON.stringify(data));
      return;
    }
    
    let collectionName = "";
    if (key === "paopao_users") collectionName = "users";
    else if (key === "paopao_products") collectionName = "products";
    else if (key === "paopao_orders") collectionName = "orders";
    else if (key === "paopao_notifications") collectionName = "notifications";
    else if (key === "paopao_chats") collectionName = "chats";
    else if (key === "paopao_withdrawals") collectionName = "withdrawals";
    else if (key === "paopao_deposits") collectionName = "deposits";

    if (!collectionName || !Array.isArray(data)) return;

    const cached = dbStateCache[key] || [];
    const cachedMap = new Map<string, any>(cached.map((item: any) => [item.id, item]));

    // 1. Save all new or modified items (Upsert in parallel)
    const writePromises: Promise<any>[] = [];
    for (const item of data) {
      if (item && item.id) {
        const cachedItem = cachedMap.get(item.id);
        if (!cachedItem || JSON.stringify(cachedItem) !== JSON.stringify(item)) {
          writePromises.push(setDoc(doc(db, collectionName, item.id), cleanUndefined(item)));
        }
      }
    }
    if (writePromises.length > 0) {
      await Promise.all(writePromises);
    }

    // Note: We do NOT automatically delete unlisted items in financial records (deposits, withdrawals, orders, notifications, users, chats).
    // Transactions and history are permanently preserved. Only explicit user actions should delete items (handled by deleteFromFirestore).

    // Keep cache up to date
    dbStateCache[key] = JSON.parse(JSON.stringify(data));
  } catch (error) {
    if (isQuotaError(error)) {
      console.warn(`Error saving ${key} to Firestore (Quota exceeded, saved locally only):`);
    } else {
      console.error(`Error saving ${key} to Firestore:`, error);
    }
    handleQuotaError(error);
  }
}

export async function disableFirestoreNetwork() {
  try {
    await disableNetwork(db);
    console.log("Firestore network disabled successfully.");
  } catch (e) {
    console.error("Error disabling Firestore network:", e);
  }
}

export async function tryForceReconnectAndSync() {
  // 1. Enable network
  await enableNetwork(db);
  
  // 2. Perform server read test to verify quota is restored
  const settingsRef = doc(db, "settings", "main");
  await getDocFromServer(settingsRef);

  // 3. Clear the quota exceeded flag
  localStorage.removeItem("paopao_firestore_quota_exceeded");

  // 4. Read all offline-stored data
  const localSettings = getStoredData<SystemSettings>("paopao_settings", DEFAULT_SETTINGS);
  const localUsers = getStoredData<User[]>("paopao_users", SEED_USERS);
  const localProducts = getStoredData<Product[]>("paopao_products", SEED_PRODUCTS);
  const localNotifications = getStoredData<SystemNotification[]>("paopao_notifications", SEED_NOTIFICATIONS);
  const localOrders = getStoredData<Order[]>("paopao_orders", SEED_ORDERS);
  const localChats = getStoredData<ChatMessage[]>("paopao_chats", SEED_CHATS);
  const localWithdrawals = getStoredData<WithdrawalRequest[]>("paopao_withdrawals", SEED_WITHDRAWALS);
  const localDeposits = getStoredData<DepositRequest[]>("paopao_deposits", []);

  // 5. Force save them back to Firestore (since the quota exceeded flag has been cleared)
  await saveToFirestore("paopao_settings", localSettings);
  await saveToFirestore("paopao_users", localUsers);
  await saveToFirestore("paopao_products", localProducts);
  await saveToFirestore("paopao_notifications", localNotifications);
  await saveToFirestore("paopao_orders", localOrders);
  await saveToFirestore("paopao_chats", localChats);
  await saveToFirestore("paopao_withdrawals", localWithdrawals);
  await saveToFirestore("paopao_deposits", localDeposits);

  // Log a success action log
  logOnlineAction(
    "settings",
    "เชื่อมต่อระบบคลาวด์สำเร็จ",
    "ระบบได้ทำการตรวจสอบการเชื่อมต่อและซิงก์ข้อมูลออฟไลน์ทั้งหมดขึ้นระบบคลาวด์เรียลไทม์เรียบร้อยแล้วค่ะ หลังจากที่ท่านอัปเกรดฐานข้อมูล",
    "ผู้ดูแลระบบ"
  );
}

export async function forceReconnectAndSyncWithoutCheck() {
  // 1. Enable network
  await enableNetwork(db);
  
  // 2. FORCE Clear the quota exceeded flag so that writes can happen
  localStorage.removeItem("paopao_firestore_quota_exceeded");

  // 3. Read all offline-stored data
  const localSettings = getStoredData<SystemSettings>("paopao_settings", DEFAULT_SETTINGS);
  const localUsers = getStoredData<User[]>("paopao_users", SEED_USERS);
  const localProducts = getStoredData<Product[]>("paopao_products", SEED_PRODUCTS);
  const localNotifications = getStoredData<SystemNotification[]>("paopao_notifications", SEED_NOTIFICATIONS);
  const localOrders = getStoredData<Order[]>("paopao_orders", SEED_ORDERS);
  const localChats = getStoredData<ChatMessage[]>("paopao_chats", SEED_CHATS);
  const localWithdrawals = getStoredData<WithdrawalRequest[]>("paopao_withdrawals", SEED_WITHDRAWALS);
  const localDeposits = getStoredData<DepositRequest[]>("paopao_deposits", []);

  // 4. Directly attempt to write everything back to Firestore
  await saveToFirestore("paopao_settings", localSettings);
  await saveToFirestore("paopao_users", localUsers);
  await saveToFirestore("paopao_products", localProducts);
  await saveToFirestore("paopao_notifications", localNotifications);
  await saveToFirestore("paopao_orders", localOrders);
  await saveToFirestore("paopao_chats", localChats);
  await saveToFirestore("paopao_withdrawals", localWithdrawals);
  await saveToFirestore("paopao_deposits", localDeposits);

  // Log a success action log
  logOnlineAction(
    "settings",
    "บังคับเชื่อมต่อคลาวด์สำเร็จ",
    "ผู้ใช้เลือกบังคับเชื่อมต่อระบบคลาวด์โดยข้ามขั้นตอนทดสอบอ่าน โหมดเรียลไทม์ได้รับการกู้คืนแล้ว",
    "ผู้ดูแลระบบ"
  );
}
