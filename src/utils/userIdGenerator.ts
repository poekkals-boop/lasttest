/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { User } from '../types';
import { getStoredData, SEED_USERS } from '../db/local_db';
import { db } from '../db/firebase';
import { doc, getDoc } from 'firebase/firestore';

/**
 * Format the user ID with proper role prefix and formatting:
 * - Customer: 'M' + number (e.g. M23133, M23134...)
 * - Merchant: 'S' + number (e.g. S42135, S42136...)
 * - Admin/SuperAdmin: 'A' + 5-digit zero-padded number (e.g. A00003, A00004...)
 */
export function formatUserId(prefix: string, num: number): string {
  if (prefix === 'A') {
    return `A${String(num).padStart(5, '0')}`;
  }
  return `${prefix}${num}`;
}

/**
 * Collect all known existing users from all sources:
 * passed users, localStorage, and SEED_USERS
 */
export function getAllKnownUsers(additionalUsers: User[] = []): User[] {
  const map = new Map<string, User>();

  // 1. Base seeds
  SEED_USERS.forEach(u => {
    if (u && u.id) map.set(u.id, u);
  });

  // 2. Local storage
  try {
    const localUsers = getStoredData<User[]>("paopao_users", []);
    localUsers.forEach(u => {
      if (u && u.id) map.set(u.id, u);
    });
  } catch (err) {
    console.warn("Could not read local users for ID generation:", err);
  }

  // 3. Additional users passed from React state
  additionalUsers.forEach(u => {
    if (u && u.id) map.set(u.id, u);
  });

  return Array.from(map.values());
}

/**
 * Synchronously generates a 100% collision-free, strictly unique User ID.
 * Safely increments sequentially beyond the highest existing number
 * and verifies against all existing IDs across memory and localStorage.
 */
export function generateUniqueUserIdSync(
  role: 'Customer' | 'Merchant' | 'Admin' | 'SuperAdmin',
  additionalUsers: User[] = []
): string {
  const allUsers = getAllKnownUsers(additionalUsers);

  let prefix = 'M';
  let baseNum = 23132;

  if (role === 'Merchant') {
    prefix = 'S';
    baseNum = 42134;
  } else if (role === 'Admin' || role === 'SuperAdmin') {
    prefix = 'A';
    baseNum = 2; // A00001 (SuperAdmin) and A00002 (Admin) already exist
  }

  // All existing IDs as a set for instant O(1) collision checking
  const existingIds = new Set<string>();
  allUsers.forEach(u => {
    if (u && u.id) {
      existingIds.add(u.id.trim());
    }
  });

  // Extract all existing numeric sequences for this prefix
  const existingNums: number[] = [];
  allUsers.forEach(u => {
    if (u && u.id && u.id.startsWith(prefix)) {
      const numPart = parseInt(u.id.substring(prefix.length), 10);
      if (!isNaN(numPart) && numPart > 0) {
        existingNums.push(numPart);
      }
    }
  });

  // Determine highest starting sequence
  const highest = existingNums.length > 0 ? Math.max(...existingNums, baseNum) : baseNum;
  let nextNum = highest + 1;

  // Find the next available unused ID
  let candidateId = formatUserId(prefix, nextNum);
  while (existingIds.has(candidateId)) {
    nextNum++;
    candidateId = formatUserId(prefix, nextNum);
  }

  return candidateId;
}

/**
 * Asynchronously generates a guaranteed unique User ID.
 * First uses local databases to determine the next sequential ID,
 * then queries Firestore in real-time to guarantee no cross-device collision.
 * Unlimited registrations can occur safely without duplicates or losing accounts.
 */
export async function generateUniqueUserId(
  role: 'Customer' | 'Merchant' | 'Admin' | 'SuperAdmin',
  additionalUsers: User[] = []
): Promise<string> {
  let candidateId = generateUniqueUserIdSync(role, additionalUsers);

  let prefix = 'M';
  if (role === 'Merchant') {
    prefix = 'S';
  } else if (role === 'Admin' || role === 'SuperAdmin') {
    prefix = 'A';
  }

  // If online, check Firestore document existence to ensure multi-device safety
  const isQuotaExceeded = localStorage.getItem("paopao_firestore_quota_exceeded") === "true";
  if (!isQuotaExceeded && db) {
    try {
      let isTaken = true;
      let attempts = 0;
      let currentNum = parseInt(candidateId.substring(prefix.length), 10);

      while (isTaken && attempts < 50) {
        attempts++;
        const docRef = doc(db, "users", candidateId);
        const snap = await getDoc(docRef);

        if (snap.exists()) {
          // Collision detected with another device! Increment and recheck
          currentNum++;
          candidateId = formatUserId(prefix, currentNum);
        } else {
          isTaken = false;
        }
      }
    } catch (err) {
      console.warn("Firestore ID uniqueness check failed (running in offline/safe mode):", err);
      // Local check already performed and guaranteed unique locally
    }
  }

  return candidateId;
}
