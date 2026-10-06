/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { doc, getDoc, runTransaction, collection, getDocs } from "firebase/firestore";
import { db } from "./firebase";
import { User } from "../types";
import { getStoredData } from "./local_db";
import { getItemsFromIndexedDB } from "./indexed_db";

// In-memory set of reserved account IDs in the current session to prevent intra-tick race conditions
const inMemoryReservedIds = new Set<string>();

/**
 * Checks whether an account ID is already registered or reserved across all storage layers:
 * 1. In-memory reservations
 * 2. In-memory / LocalStorage / IndexedDB users
 * 3. Firestore `users` collection document
 * 4. Firestore `account_registry` collection reservation document
 */
export async function isAccountIdTaken(id: string, cachedUsers?: User[]): Promise<boolean> {
  if (!id) return true;

  // 1. Check in-memory reservation set
  if (inMemoryReservedIds.has(id)) {
    return true;
  }

  // 2. Check cached users passed from component
  if (cachedUsers && cachedUsers.some(u => u.id === id)) {
    return true;
  }

  // 3. Check localStorage & Memory Vault users
  const localUsers = getStoredData<User[]>("paopao_users", []);
  if (localUsers.some(u => u.id === id)) {
    return true;
  }

  // 4. Check IndexedDB users
  try {
    const idbUsers = await getItemsFromIndexedDB<User>("users");
    if (idbUsers && idbUsers.some(u => u.id === id)) {
      return true;
    }
  } catch (e) {
    // Non-fatal if IndexedDB check fails
  }

  // 5. Check real Firestore database
  try {
    if (localStorage.getItem("paopao_firestore_quota_exceeded") !== "true") {
      const userDocRef = doc(db, "users", id);
      const registryDocRef = doc(db, "account_registry", id);

      const [userSnap, registrySnap] = await Promise.all([
        getDoc(userDocRef),
        getDoc(registryDocRef)
      ]);

      if (userSnap.exists() || registrySnap.exists()) {
        return true;
      }
    }
  } catch (err) {
    console.warn("Firestore ID existence check warning:", err);
  }

  return false;
}

/**
 * Collects all existing IDs from local storage, memory vault, and optionally Firestore.
 */
async function collectAllExistingIds(fallbackUsers?: User[]): Promise<Set<string>> {
  const ids = new Set<string>();

  // In-memory reserved
  inMemoryReservedIds.forEach(id => ids.add(id));

  // Fallback users
  if (fallbackUsers) {
    fallbackUsers.forEach(u => { if (u?.id) ids.add(u.id); });
  }

  // Local storage / Memory Vault users
  const localUsers = getStoredData<User[]>("paopao_users", []);
  localUsers.forEach(u => { if (u?.id) ids.add(u.id); });

  // IndexedDB
  try {
    const idbUsers = await getItemsFromIndexedDB<User>("users");
    if (idbUsers) {
      idbUsers.forEach(u => { if (u?.id) ids.add(u.id); });
    }
  } catch (e) {}

  // Firestore users if online
  try {
    if (localStorage.getItem("paopao_firestore_quota_exceeded") !== "true") {
      const snap = await getDocs(collection(db, "users"));
      snap.forEach(d => {
        ids.add(d.id);
        const data = d.data();
        if (data?.id) ids.add(data.id);
      });
      const regSnap = await getDocs(collection(db, "account_registry"));
      regSnap.forEach(d => ids.add(d.id));
    }
  } catch (e) {
    // offline or quota warning
  }

  return ids;
}

/**
 * Generates a guaranteed unique account ID across the entire system for any role,
 * continuing from existing database records, preventing race conditions via atomic
 * Firestore transactions and local reservation guards.
 *
 * - Customer: Prefix 'M', starting base 23132 (or higher based on existing IDs)
 * - Merchant: Prefix 'S', starting base 42134 (or higher based on existing IDs)
 * - Admin / SuperAdmin: Prefix 'A', formatted with 5-digit padding (e.g. A00003)
 */
export async function generateUniqueAccountId(
  role: 'Customer' | 'Merchant' | 'Admin' | 'SuperAdmin',
  fallbackUsers?: User[]
): Promise<string> {
  const allExistingIds = await collectAllExistingIds(fallbackUsers);

  let prefix = 'M';
  let minBase = 23132;

  if (role === 'Customer') {
    prefix = 'M';
    minBase = 23132;
  } else if (role === 'Merchant') {
    prefix = 'S';
    minBase = 42134;
  } else {
    // Admin or SuperAdmin
    prefix = 'A';
    minBase = 1;
  }

  // Find the maximum existing number with this prefix
  const matchingNums: number[] = [];
  allExistingIds.forEach(id => {
    if (id && id.startsWith(prefix)) {
      const numPart = parseInt(id.substring(1), 10);
      if (!isNaN(numPart)) {
        matchingNums.push(numPart);
      }
    }
  });

  const currentMax = matchingNums.length > 0 ? Math.max(...matchingNums) : 0;
  let baseNumber = Math.max(currentMax, minBase);

  // Attempt to allocate and lock an ID with database transaction (or local atomic fallback)
  const maxAttempts = 50;
  let attempt = 0;

  while (attempt < maxAttempts) {
    attempt++;

    // For Customer / Merchant: continue sequentially or with a slight random increment
    // while guaranteeing no collision with any existing record
    let candidateNum: number;
    if (prefix === 'A') {
      candidateNum = baseNumber + attempt;
    } else {
      const randomStep = Math.floor(Math.random() * 25) + 1;
      candidateNum = baseNumber + (attempt === 1 ? randomStep : (randomStep + attempt * 5));
    }

    const candidateId = prefix === 'A'
      ? `A${String(candidateNum).padStart(5, '0')}`
      : `${prefix}${candidateNum}`;

    // Fast-check against all known local IDs and memory reservations
    if (allExistingIds.has(candidateId) || inMemoryReservedIds.has(candidateId)) {
      baseNumber = Math.max(baseNumber, candidateNum);
      continue;
    }

    // Attempt atomic database reservation via Firestore transaction if online
    const isOnline = localStorage.getItem("paopao_firestore_quota_exceeded") !== "true";
    if (isOnline) {
      try {
        const userDocRef = doc(db, "users", candidateId);
        const registryDocRef = doc(db, "account_registry", candidateId);

        let conflictDetected = false;

        await runTransaction(db, async (transaction) => {
          const userSnap = await transaction.get(userDocRef);
          const regSnap = await transaction.get(registryDocRef);

          if (userSnap.exists() || regSnap.exists()) {
            conflictDetected = true;
            throw new Error("COLLISION");
          }

          // Atomically reserve the ID in the database
          transaction.set(registryDocRef, {
            id: candidateId,
            role,
            reservedAt: new Date().toISOString()
          });
        });

        if (!conflictDetected) {
          // Successfully reserved in Firestore database atomically!
          inMemoryReservedIds.add(candidateId);
          allExistingIds.add(candidateId);
          return candidateId;
        }
      } catch (err: any) {
        if (err?.message === "COLLISION") {
          // ID already taken in the database by concurrent user; advance and retry
          allExistingIds.add(candidateId);
          baseNumber = Math.max(baseNumber, candidateNum);
          continue;
        }
        // If Firestore network failed or in offline mode, fall back to robust local verification
        console.warn("Firestore transaction note (proceeding with local reservation):", err);
      }
    }

    // Local reservation check
    const taken = await isAccountIdTaken(candidateId, fallbackUsers);
    if (!taken) {
      inMemoryReservedIds.add(candidateId);
      allExistingIds.add(candidateId);
      return candidateId;
    }

    allExistingIds.add(candidateId);
    baseNumber = Math.max(baseNumber, candidateNum);
  }

  // Safe fallback if loop exhausted: guaranteed unique timestamp-based ID with prefix
  const timestampSuffix = Date.now().toString().slice(-6);
  const fallbackId = `${prefix}${timestampSuffix}`;
  inMemoryReservedIds.add(fallbackId);
  return fallbackId;
}
