/**
 * List Model
 * Beheert een collectie van Accounts en hun Posts
 * Vraagt sync aan Accounts voor hun (cached) posts
 */

import { Account } from './Account.js';
import { getFromDB, putInDB } from '../utils/db.js';

// ============================================
// CONSTANTS
// ============================================

const DB_TABLE = 'lists';
const EVENT_POSTS_UPDATED = 'postsUpdated';

export class List {
  constructor(slug, name, accountRefs = []) {
    this.slug = slug;
    this.name = name;
    this.accounts = new Map();
    this.listeners = new Set();
    
    // Post tracking
    this.highestPostId = null;
    this.lowestPostId = null;
    this.lastFetched = null;
    
    // Pending new posts (for batching updates from multiple accounts)
    this.pendingPosts = [];
    this.isNotifying = false;
    
    // Auto-refresh
    this.refreshInterval = null;
    this.isRefreshing = false;
    
    this.initAccounts(accountRefs);
  }

  // ============================================
  // INITIALIZATION
  // ============================================

  initAccounts(accountRefs) {
    accountRefs.forEach(ref => {
      const account = new Account(ref.instance, ref.username, this.slug);
      this.accounts.set(account.id, account);
    });
  }

  async init() {
    // Initialize all accounts, but don't fail if one account fails
    const accountsArray = Array.from(this.accounts.values());
    const initResults = await Promise.allSettled(
      accountsArray.map(acc => acc.init())
    );
    
    // Remove failed accounts from the list
    initResults.forEach((result, index) => {
      if (result.status === 'rejected') {
        const account = accountsArray[index];
        console.error(`Failed to init account ${account.id}:`, result.reason);
        this.accounts.delete(account.id);
      }
    });
    
    // Setup subscriptions for successful accounts only
    this.setupAccountSubscriptions();
    await this.loadFromCache();
    
    // Log summary
    console.log(`List "${this.name}" initialized with ${this.accounts.size} accounts`);
    
    // Start auto-refresh (every 30 seconds)
    this.startAutoRefresh();
  }

  // ============================================
  // AUTO-REFRESH
  // ============================================

  startAutoRefresh(interval = 30000) {
    // Clear any existing interval
    this.stopAutoRefresh();
    
    // Set up periodic refresh
    this.refreshInterval = setInterval(() => {
      this.refreshAllPosts();
    }, interval);
  }

  stopAutoRefresh() {
    if (this.refreshInterval) {
      clearInterval(this.refreshInterval);
      this.refreshInterval = null;
    }
  }

  async refreshAllPosts() {
    // Prevent concurrent refreshes
    if (this.isRefreshing) return;
    
    this.isRefreshing = true;
    
    try {
      const newPosts = await this.getNewPosts();
      
      if (newPosts.length > 0) {
        // Batch and notify
        this.pendingPosts.push(...newPosts);
        this.scheduleNotification();
      }
    } catch (error) {
      console.error(`List auto-refresh failed for ${this.slug}:`, error);
    } finally {
      this.isRefreshing = false;
    }
  }

  async loadFromCache() {
    const listData = await getFromDB(DB_TABLE, this.slug);
    if (listData) {
      this.highestPostId = listData.highestPostId;
      this.lowestPostId = listData.lowestPostId;
      this.lastFetched = listData.lastFetched;
    }
  }

  setupAccountSubscriptions() {
    this.accounts.forEach(account => {
      account.subscribe((data) => {
        if (data.eventType === EVENT_POSTS_UPDATED) {
          this.handleAccountUpdate(account, data.posts);
        }
      });
    });
  }

  // ============================================
  // POST TRACKING
  // ============================================

  updatePostTracking(newPosts) {
    if (newPosts.length === 0) return;
    
    // Update lowest tracking (voor pagination)
    const lowest = newPosts[newPosts.length - 1].mastodonId;
    if (!this.lowestPostId || lowest < this.lowestPostId) {
      this.lowestPostId = lowest;
    }
    
    // highestPostId wordt geüpdatet in notifyPendingPosts
    this.lastFetched = Date.now();
    this.saveToCache();
  }

  handleAccountUpdate(account, newPosts) {
    if (newPosts.length > 0) {
      this.updatePostTracking(newPosts);
      // Voeg toe aan pending posts en notify met gesorteerde batch
      this.pendingPosts.push(...newPosts);
      this.scheduleNotification();
    }
  }

  scheduleNotification() {
    // Als er al een notificatie bezig is, wacht dan
    if (this.isNotifying) return;
    
    // Small delay to batch updates from multiple accounts
    setTimeout(() => this.notifyPendingPosts(), 100);
  }

  notifyPendingPosts() {
    if (this.pendingPosts.length === 0) return;
    
    this.isNotifying = true;
    
    // Sorteer de pending posts (descending)
    const sortedPosts = this.sortAndDeduplicate(this.pendingPosts);
    
    // Alleen posts doorgeven die nieuwer zijn dan huidige highestPostId
    const newPostsOnly = sortedPosts.filter(post => 
      !this.highestPostId || post.mastodonId > this.highestPostId
    );
    
    if (newPostsOnly.length > 0) {
      this.highestPostId = newPostsOnly[0].mastodonId;
      this.notify(EVENT_POSTS_UPDATED, { posts: newPostsOnly });
    }
    
    // Clear pending posts
    this.pendingPosts = [];
    this.isNotifying = false;
  }

  saveToCache() {
    putInDB(DB_TABLE, {
      slug: this.slug,
      name: this.name,
      accountRefs: Array.from(this.accounts.values()).map(acc => ({
        instance: acc.instance,
        username: acc.username,
        sourceList: this.slug
      })),
      lastFetched: this.lastFetched,
      highestPostId: this.highestPostId,
      lowestPostId: this.lowestPostId
    });
  }

  // ============================================
  // ACCOUNT MANAGEMENT
  // ============================================

  async addAccount(instance, username) {
    const account = new Account(instance, username, this.slug);
    this.accounts.set(account.id, account);
    
    try {
      await account.init();
      
      // Subscribe to updates from this account
      account.subscribe((data) => {
        if (data.eventType === EVENT_POSTS_UPDATED) {
          this.handleAccountUpdate(account, data.posts);
        }
      });
      
      this.saveToCache();
      console.log(`Added account ${account.id} to list "${this.name}"`);
      
      // Start auto-refresh if this is the first account
      if (this.accounts.size === 1 && !this.refreshInterval) {
        this.startAutoRefresh();
      }
    } catch (error) {
      // Remove failed account
      this.accounts.delete(account.id);
      console.error(`Failed to add account ${account.id} to list "${this.name}":`, error);
      throw error;
    }
  }

  removeAccount(accountId) {
    const account = this.accounts.get(accountId);
    if (!account) return;
    
    account.stopAutoUpdate();
    this.accounts.delete(accountId);
    this.saveToCache();
    
    // If no accounts left, stop auto-refresh
    if (this.accounts.size === 0) {
      this.stopAutoRefresh();
    }
  }

  getAccount(accountId) {
    return this.accounts.get(accountId);
  }

  getAllAccounts() {
    return Array.from(this.accounts.values());
  }

  // ============================================
  // POSTS (SYNC requests to Accounts for their cached posts)
  // ============================================

  getAllCachedPosts() {
    const allPosts = [];
    
    for (const account of this.accounts.values()) {
      const posts = account.getCachedPosts();
      allPosts.push(...posts);
    }
    
    return this.sortAndDeduplicate(allPosts);
  }

  async getPosts(limit = 20, sinceId = null, maxId = null) {
    const allPosts = [];
    
    for (const account of this.accounts.values()) {
      const posts = sinceId || maxId 
        ? await account.fetchPosts({ limit, sinceId, maxId })
        : account.getCachedPosts(limit);
      allPosts.push(...posts);
    }
    
    return this.sortAndDeduplicate(allPosts, limit);
  }

  async getNewPosts() {
    const allPosts = [];
    
    for (const account of this.accounts.values()) {
      const newPosts = await account.getNewPosts();
      allPosts.push(...newPosts);
    }
    
    return this.sortAndDeduplicate(allPosts);
  }

  async getOlderPosts() {
    const allPosts = [];
    
    for (const account of this.accounts.values()) {
      const olderPosts = await account.getOlderPosts();
      allPosts.push(...olderPosts);
    }
    
    return this.sortAndDeduplicate(allPosts);
  }

  hasMorePosts() {
    return Array.from(this.accounts.values()).some(acc => acc.hasMorePosts());
  }

  sortAndDeduplicate(posts, limit) {
    const seen = new Set();
    return posts
      .filter(post => !seen.has(post.id) && seen.add(post.id))
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
      .slice(0, limit);
  }

  // ============================================
  // EVENTS
  // ============================================

  subscribe(callback) {
    this.listeners.add(callback);
    return () => this.listeners.delete(callback);
  }

  notify(eventType, data) {
    this.listeners.forEach(cb => cb({ eventType, listSlug: this.slug, ...data }));
  }

  // ============================================
  // SERIALIZATION
  // ============================================

  toJSON() {
    return {
      slug: this.slug,
      name: this.name,
      accountRefs: Array.from(this.accounts.values()).map(acc => ({
        instance: acc.instance,
        username: acc.username
      }))
    };
  }
}
