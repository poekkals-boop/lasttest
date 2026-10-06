import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App';
import './index.css';

// Safely augment localStorage methods to handle and recover from QuotaExceededError (5MB browser limit)
// Compatible with all browser engines including iOS WebKit / Safari strict mode
const memoryStorageMap = new Map<string, string>();

// Helper to strip/optimize heavy base64 strings from data structures when quota is tight
function pruneHeavyBase64Data(obj: any): any {
  if (!obj) return obj;
  if (typeof obj === 'string') {
    if (obj.startsWith('data:image/') && obj.length > 300000) {
      // Replace oversized base64 with a lightweight stock image fallback
      return "https://images.unsplash.com/photo-1522335789203-aabd1fc54bc9?auto=format&fit=crop&q=80&w=300";
    }
    return obj;
  }
  if (Array.isArray(obj)) {
    return obj.map(item => pruneHeavyBase64Data(item));
  }
  if (typeof obj === 'object') {
    const cleaned: any = {};
    for (const k of Object.keys(obj)) {
      cleaned[k] = pruneHeavyBase64Data(obj[k]);
    }
    return cleaned;
  }
  return obj;
}

try {
  if (typeof window !== 'undefined' && window.Storage && window.Storage.prototype) {
    const storageProto = window.Storage.prototype;
    const originalSetItem = storageProto.setItem;
    const originalGetItem = storageProto.getItem;
    const originalRemoveItem = storageProto.removeItem;

    storageProto.getItem = function(key: string) {
      try {
        const val = originalGetItem.call(this, key);
        if (val !== null) return val;
      } catch (e) {}
      return memoryStorageMap.get(key) || null;
    };

    storageProto.removeItem = function(key: string) {
      try {
        originalRemoveItem.call(this, key);
      } catch (e) {}
      memoryStorageMap.delete(key);
    };

    storageProto.setItem = function(key: string, value: string) {
      memoryStorageMap.set(key, value); // Always store in memory fallback
      try {
        // 1. Try normal unmodified write
        originalSetItem.call(this, key, value);
      } catch (e: any) {
        const isQuotaError = 
          (typeof DOMException !== 'undefined' && e instanceof DOMException && (
            e.name === "QuotaExceededError" ||
            e.name === "NS_ERROR_DOM_QUOTA_REACHED" ||
            e.code === 22 ||
            e.code === 1014
          )) || (e && (e.name === "QuotaExceededError" || String(e.message || e).toLowerCase().includes("quota")));

        if (isQuotaError) {
          console.warn(`⚠️ [localStorage] Storage space limit reached. Cleaning non-critical history to save key "${key}"...`);
          try {
            // 1. Remove non-critical action logs
            try { originalRemoveItem.call(this, "paopao_online_actions_log"); } catch (err) {}

            // 2. Optimize image data in history arrays without deleting any transaction or notification records
            const arraysToPrune = [
              { key: "paopao_chats", stripImage: true },
              { key: "paopao_notifications", stripImage: false },
              { key: "paopao_orders", stripImage: true },
              { key: "paopao_withdrawals", stripImage: false },
              { key: "paopao_deposits", stripImage: true }
            ];

            for (const item of arraysToPrune) {
              try {
                const raw = originalGetItem.call(this, item.key);
                if (raw) {
                  let parsed = JSON.parse(raw);
                  if (Array.isArray(parsed)) {
                    if (item.stripImage) {
                      if (item.key === "paopao_chats") {
                        parsed = parsed.map((c: any) => ({
                          ...c,
                          image: (c.image && c.image.startsWith("data:")) ? "" : c.image
                        }));
                      } else if (item.key === "paopao_deposits") {
                        parsed = parsed.map((d: any) => {
                          if (d.status !== "pending" && d.slipImage && d.slipImage.startsWith("data:")) {
                            return { ...d, slipImage: "" };
                          }
                          return d;
                        });
                      } else if (item.key === "paopao_orders") {
                        parsed = parsed.map((o: any) => {
                          if (o.items && Array.isArray(o.items)) {
                            return {
                              ...o,
                              items: o.items.map((it: any) => ({
                                ...it,
                                image: (it.image && it.image.startsWith("data:"))
                                  ? "https://images.unsplash.com/photo-1522335789203-aabd1fc54bc9?auto=format&fit=crop&q=80&w=150"
                                  : it.image
                              }))
                            };
                          }
                          return o;
                        });
                      }
                    }
                    originalSetItem.call(this, item.key, JSON.stringify(parsed));
                  }
                }
              } catch (err) {}
            }

            // 3. Try writing key again after freeing up space
            try {
              originalSetItem.call(this, key, value);
              return;
            } catch (retryErr1) {
              // 4. If still failing, prune heavy base64 data directly from the value being saved
              try {
                const parsedValue = JSON.parse(value);
                const prunedValue = JSON.stringify(pruneHeavyBase64Data(parsedValue));
                originalSetItem.call(this, key, prunedValue);
                return;
              } catch (retryErr2) {
                // 5. Atomic fallback: remove key first then set pruned value
                try {
                  originalRemoveItem.call(this, key);
                  const parsedValue = JSON.parse(value);
                  const prunedValue = JSON.stringify(pruneHeavyBase64Data(parsedValue));
                  originalSetItem.call(this, key, prunedValue);
                  return;
                } catch (retryErr3) {
                  console.warn(`[localStorage] Safely operating in memory mode for key "${key}".`);
                }
              }
            }
          } catch (retryError) {
            console.warn(`[localStorage] Operating in memory fallback mode for key "${key}".`);
          }
        } else {
          console.warn(`[localStorage] setItem exception for "${key}". Saved to memory storage.`);
        }
      }
    };
  }
} catch (e) {
  console.warn("Storage prototype augmentation skipped for compatibility:", e);
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

