/**
 * cacheService.js — generic server-side in-memory TTL cache.
 *
 * Implemented as a simple Map of { value, cachedAt } entries with per-key TTL
 * eviction. No external dependencies — just Node.js built-ins.
 *
 * Usage:
 *   const cache = require('./cacheService');
 *   cache.set('my_key', data);           // store with default TTL
 *   const hit = cache.get('my_key');     // returns { value, cachedAt } or null
 *   cache.del('my_key');                 // manual eviction
 *   cache.set('key', data, 120_000);     // override TTL for this entry (ms)
 *
 * The TTL for each entry is determined at write time. Change
 * DEFAULT_TTL_MS to adjust the global default without touching callers.
 */

'use strict';

/** Default TTL: 5 minutes in milliseconds.
 *  Change this value (or pass a per-call override to set()) to adjust caching
 *  behaviour without modifying any calling code.
 */
const DEFAULT_TTL_MS = 5 * 60 * 1000; // 5 minutes

/**
 * @typedef {{ value: *, cachedAt: Date, expiresAt: Date }} CacheEntry
 */

/** @type {Map<string, CacheEntry>} */
const store = new Map();

/**
 * Stores a value under key with an optional TTL override.
 *
 * @param {string} key
 * @param {*}      value      — any serialisable value
 * @param {number} [ttlMs]   — TTL in milliseconds (default: DEFAULT_TTL_MS)
 */
function set(key, value, ttlMs = DEFAULT_TTL_MS) {
  const cachedAt  = new Date();
  const expiresAt = new Date(cachedAt.getTime() + ttlMs);
  store.set(key, { value, cachedAt, expiresAt });
}

/**
 * Retrieves a cached entry if it exists and has not expired.
 * Returns null on a miss or after TTL expiry (and evicts the stale entry).
 *
 * @param {string} key
 * @returns {{ value: *, cachedAt: Date } | null}
 */
function get(key) {
  const entry = store.get(key);
  if (!entry) return null;

  if (new Date() > entry.expiresAt) {
    store.delete(key); // evict expired entry
    return null;
  }

  return { value: entry.value, cachedAt: entry.cachedAt };
}

/**
 * Manually evicts a cache entry (used for force-refresh).
 *
 * @param {string} key
 */
function del(key) {
  store.delete(key);
}

/** Clears the entire cache (useful in tests). */
function clear() {
  store.clear();
}

/** Returns the number of currently stored (possibly expired) entries. */
function size() {
  return store.size;
}

module.exports = { set, get, del, clear, size, DEFAULT_TTL_MS };
