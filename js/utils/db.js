/**
 * Database Utility - Pure IndexedDB helpers
 * Gebruikt door Account en List classes
 */

let db = null;

// Database version and stores configuration
const DB_NAME = 'MastodonFeedDB';
const DB_VERSION = 1;
const STORES = {
  posts: { keyPath: 'id', indexes: ['instance', 'accountId', 'createdAt', 'sourceList', 'fetchedAt'] },
  accounts: { keyPath: 'id', indexes: ['instance', 'mastodonId', 'username', 'fetchedAt'] },
  lists: { keyPath: 'slug', indexes: ['name', 'lastFetched'] }
};

/**
 * Initialize the database
 */
export async function initDB() {
  if (db) return db;
  
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    
    request.onerror = () => {
      console.warn('IndexedDB not available:', request.error);
      resolve(null);
    };
    
    request.onsuccess = () => {
      db = request.result;
      resolve(db);
    };
    
    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      
      // Create all stores
      for (const [storeName, config] of Object.entries(STORES)) {
        if (!db.objectStoreNames.contains(storeName)) {
          const store = db.createObjectStore(storeName, { keyPath: config.keyPath });
          config.indexes.forEach(idx => {
            store.createIndex(idx, idx, { unique: idx === 'mastodonId' });
          });
        }
      }
    };
  });
}

/**
 * Get the database instance
 */
export function getDB() {
  return db;
}

/**
 * Get a single item from a store
 */
export async function getFromDB(storeName, key) {
  if (!db) return null;
  
  return new Promise(resolve => {
    const tx = db.transaction(storeName, 'readonly');
    const store = tx.objectStore(storeName);
    const request = store.get(key);
    
    request.onsuccess = () => resolve(request.result || null);
    request.onerror = () => resolve(null);
  });
}

/**
 * Get all items from a store by index
 */
export async function getAllFromDB(storeName, indexName, key) {
  if (!db) return [];
  
  return new Promise(resolve => {
    const tx = db.transaction(storeName, 'readonly');
    const store = tx.objectStore(storeName);
    const index = store.index(indexName);
    const request = index.getAll(key);
    
    request.onsuccess = () => resolve(request.result || []);
    request.onerror = () => resolve([]);
  });
}

/**
 * Get all items from a store
 */
export async function getAllFromStore(storeName) {
  if (!db) return [];
  
  return new Promise(resolve => {
    const tx = db.transaction(storeName, 'readonly');
    const store = tx.objectStore(storeName);
    const request = store.getAll();
    
    request.onsuccess = () => resolve(request.result || []);
    request.onerror = () => resolve([]);
  });
}

/**
 * Put an item in a store
 */
export function putInDB(storeName, obj) {
  if (!db) return;
  
  const tx = db.transaction(storeName, 'readwrite');
  tx.objectStore(storeName).put(obj);
}

/**
 * Delete an item from a store
 */
export function deleteFromDB(storeName, key) {
  if (!db) return;
  
  const tx = db.transaction(storeName, 'readwrite');
  tx.objectStore(storeName).delete(key);
}

/**
 * Clear a store
 */
export function clearStore(storeName) {
  if (!db) return;
  
  const tx = db.transaction(storeName, 'readwrite');
  tx.objectStore(storeName).clear();
}

/**
 * Escape HTML to prevent XSS
 */
export function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

/**
 * Strip HTML tags from string
 */
export function stripHtml(html) {
  if (typeof document !== 'undefined') {
    const tmp = document.createElement('div');
    tmp.innerHTML = html;
    return tmp.textContent || '';
  }
  return html.replace(/<[^>]*>/g, '');
}
