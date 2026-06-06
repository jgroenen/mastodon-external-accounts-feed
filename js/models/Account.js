/**
 * Account Model
 * Beheert 1 Mastodon account en diens posts
 * Doet API calls, caching en periodieke updates
 */

import { initDB, getFromDB, getAllFromDB, putInDB, stripHtml } from '../utils/db.js';

// ============================================
// CONSTANTS
// ============================================

const DB_ACCOUNTS = 'accounts';
const DB_POSTS = 'posts';
const EVENT_POSTS_UPDATED = 'postsUpdated';
const API_ACCOUNT_LOOKUP = '/api/v1/accounts/lookup?acct=';
const API_STATUSES = '/api/v1/accounts/';
const AUTO_UPDATE_INTERVAL = 30000; // 30 seconds

// ============================================
// MAIN CLASS
// ============================================

export class Account {
  constructor(instance, username, sourceList = null) {
    this.instance = instance;
    this.username = username;
    this.sourceList = sourceList;
    this.id = `${instance}:${username}`;
    
    // Account data from Mastodon API
    this.mastodonId = null;
    this.displayName = null;
    this.acct = null;
    this.avatar = null;
    this.url = null;
    
    // Post tracking
    this.posts = new Map();
    this.highestPostId = null;
    this.lowestPostId = null;
    this.lastFetched = null;
    
    // Auto-update
    this.updateInterval = null;
    this.updatePromise = null;
    
    // Events
    this.listeners = new Set();
    
    initDB();
  }

  // ============================================
  // INITIALIZATION
  // ============================================

  async init() {
    try {
      await this.loadFromCache();
      
      if (!this.mastodonId) {
        await this.fetchAccount();
      }
      
      // Start auto-update for this account
      this.startAutoUpdate();
    } catch (error) {
      console.error(`Failed to initialize account ${this.id}:`, error);
      // Mark account as failed - it won't fetch posts but List can still continue
      this.mastodonId = null;
      throw error; // Re-throw so List can handle it with allSettled
    }
  }

  async loadFromCache() {
    const accountData = await getFromDB(DB_ACCOUNTS, this.id);
    if (accountData) {
      this.fromCacheData(accountData);
    }
    
    const posts = await this.loadCachedPosts();
    if (posts.length > 0) {
      posts.forEach(post => this.posts.set(post.mastodonId, post));
      this.highestPostId = posts[0].mastodonId;
      this.lowestPostId = posts[posts.length - 1].mastodonId;
    }
  }

  fromCacheData(data) {
    this.mastodonId = data.mastodonId;
    this.displayName = data.displayName;
    this.acct = data.acct || this.username;
    this.avatar = data.avatar;
    this.url = data.url;
    this.highestPostId = data.highestPostId;
    this.lowestPostId = data.lowestPostId;
    this.lastFetched = data.fetchedAt;
    this.sourceList = data.sourceList || this.sourceList;
  }

  async loadCachedPosts() {
    const posts = await getAllFromDB(DB_POSTS, 'sourceList', this.sourceList);
    return posts.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  }

  // ============================================
  // ACCOUNT DATA
  // ============================================

  async fetchAccount() {
    const url = `${this.instance}${API_ACCOUNT_LOOKUP}${this.username}`;
    
    try {
      const response = await fetch(url, { timeout: 5000 });
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status} - ${response.statusText}`);
      }
      
      const data = await response.json();
      
      this.mastodonId = data.id;
      this.displayName = data.display_name || this.username;
      this.acct = data.acct || this.username;
      this.avatar = data.avatar;
      this.url = data.url;
      this.lastFetched = Date.now();
      
      this.saveAccountToCache();
      return data;
    } catch (error) {
      console.error(`Failed to fetch account @${this.username}@${this.instance}:`, error);
      throw new Error(`Account fetch failed: ${error.message}`);
    }
  }

  saveAccountToCache() {
    putInDB(DB_ACCOUNTS, {
      id: this.id,
      mastodonId: this.mastodonId,
      instance: this.instance,
      username: this.username,
      displayName: this.displayName,
      acct: this.acct,
      avatar: this.avatar,
      url: this.url,
      fetchedAt: this.lastFetched,
      sourceList: this.sourceList,
      highestPostId: this.highestPostId,
      lowestPostId: this.lowestPostId
    });
  }

  // ============================================
  // POSTS
  // ============================================

  getCachedPosts(limit) {
    return Array.from(this.posts.values())
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
      .slice(0, limit);
  }

  buildStatusesUrl(options = {}) {
    const { limit = 20, sinceId, maxId } = options;
    let url = `${this.instance}${API_STATUSES}${this.mastodonId}/statuses?limit=${limit}&exclude_reblogs=true`;
    if (sinceId) url += `&since_id=${sinceId}`;
    if (maxId) url += `&max_id=${maxId}`;
    return url;
  }

  async fetchPosts(options = {}) {
    const url = this.buildStatusesUrl(options);
    
    try {
      const response = await fetch(url);
      
      if (!response.ok) {
        if (response.status === 404) {
          // Account has no posts or doesn't exist - not an error
          return [];
        }
        console.error(`Failed to fetch posts for ${this.id}: HTTP ${response.status} - ${response.statusText}`);
        return [];
      }
      
      const toots = await response.json();
      return toots.map(toot => this.normalizePost(toot));
    } catch (error) {
      console.error(`Error fetching posts for ${this.id}:`, error);
      return [];
    }
  }

  normalizePost(toot) {
    // Als dit een reblog is, gebruik dan de originele post
    let url = toot.url;
    let isReblog = false;
    let originalPost = null;
    
    if (toot.reblog) {
      isReblog = true;
      originalPost = {
        id: toot.reblog.id,
        url: toot.reblog.url,
        account: toot.reblog.account
      };
      // Gebruik de originele post URL
      url = toot.reblog.url;
    }
    
    return {
      id: `${this.instance}:${toot.id}`,
      mastodonId: toot.id,
      instance: this.instance,
      url: url,
      createdAt: toot.created_at,
      content: toot.content || '',
      contentText: stripHtml(toot.content || ''),
      account: {
        id: this.id,
        mastodonId: this.mastodonId,
        displayName: this.displayName,
        username: this.username,
        acct: this.acct,
        avatar: this.avatar,
        url: this.url
      },
      // Als het een reblog is, sla de originele post info op
      isReblog: isReblog,
      originalPost: originalPost,
      // Originele instance (voor federated URLs)
      originalInstance: toot.reblog ? new URL(toot.reblog.url).hostname : this.instance,
      originalPostId: toot.reblog ? toot.reblog.id : toot.id,
      mediaAttachments: toot.media_attachments || [],
      repliesCount: toot.replies_count || 0,
      reblogsCount: toot.reblogs_count || 0,
      favouritesCount: toot.favourites_count || 0,
      fetchedAt: Date.now(),
      sourceList: this.sourceList
    };
  }

  // ============================================
  // AUTO-UPDATE
  // ============================================

  startAutoUpdate() {
    this.refreshPosts();
    this.updateInterval = setInterval(() => this.refreshPosts(), AUTO_UPDATE_INTERVAL);
  }

  stopAutoUpdate() {
    if (this.updateInterval) {
      clearInterval(this.updateInterval);
      this.updateInterval = null;
    }
  }

  async refreshPosts(limit = 20) {
    if (this.updatePromise) return this.updatePromise;
    
    this.updatePromise = (async () => {
      try {
        const newPosts = await this.fetchPosts({ limit });
        
        if (newPosts.length > 0) {
          // Update tracking
          this.highestPostId = newPosts[0].mastodonId;
          if (!this.lowestPostId || newPosts[newPosts.length - 1].mastodonId < this.lowestPostId) {
            this.lowestPostId = newPosts[newPosts.length - 1].mastodonId;
          }
          
          // Cache new posts
          newPosts.forEach(post => {
            this.posts.set(post.mastodonId, post);
            putInDB(DB_POSTS, post);
          });
          
          this.lastFetched = Date.now();
          this.saveAccountToCache();
          
          // Notify listeners (List will handle sorting and display)
          this.notify(EVENT_POSTS_UPDATED, { posts: newPosts });
        }
      } catch (error) {
        console.error(`Auto-update failed for ${this.id}:`, error);
        // Continue with next update cycle - don't stop auto-update for one failure
      } finally {
        this.updatePromise = null;
      }
    })();
    
    return this.updatePromise;
  }

  // ============================================
  // PAGINATION
  // ============================================

  async getNewPosts() {
    if (!this.highestPostId) return this.getCachedPosts(20);
    const newPosts = await this.fetchPosts({ limit: 20, sinceId: this.highestPostId });
    
    // Cache the new posts
    if (newPosts.length > 0) {
      newPosts.forEach(post => {
        this.posts.set(post.mastodonId, post);
        putInDB(DB_POSTS, post);
      });
      
      // Update tracking
      this.highestPostId = newPosts[0].mastodonId;
      if (!this.lowestPostId || newPosts[newPosts.length - 1].mastodonId < this.lowestPostId) {
        this.lowestPostId = newPosts[newPosts.length - 1].mastodonId;
      }
      
      this.lastFetched = Date.now();
      this.saveAccountToCache();
    }
    
    return newPosts;
  }

  async getOlderPosts() {
    if (!this.lowestPostId) return [];
    const olderPosts = await this.fetchPosts({ limit: 20, maxId: this.lowestPostId });
    
    // Cache the older posts
    if (olderPosts.length > 0) {
      olderPosts.forEach(post => {
        this.posts.set(post.mastodonId, post);
        putInDB(DB_POSTS, post);
      });
      
      // Update tracking
      this.lowestPostId = olderPosts[olderPosts.length - 1].mastodonId;
      this.lastFetched = Date.now();
      this.saveAccountToCache();
    }
    
    return olderPosts;
  }

  hasMorePosts() {
    return !!this.lowestPostId;
  }

  // ============================================
  // EVENTS
  // ============================================

  subscribe(callback) {
    this.listeners.add(callback);
    return () => this.listeners.delete(callback);
  }

  notify(eventType, data) {
    this.listeners.forEach(cb => cb({ eventType, accountId: this.id, ...data }));
  }

  // ============================================
  // GETTERS
  // ============================================

  getAccountInfo() {
    return {
      id: this.id,
      mastodonId: this.mastodonId,
      instance: this.instance,
      username: this.username,
      displayName: this.displayName,
      acct: this.acct,
      avatar: this.avatar,
      url: this.url,
      sourceList: this.sourceList
    };
  }
}
