/**
 * App Model
 * Hoofdklasse die Lists beheert en de applicatie coördineert
 */

import { List } from './List.js';
import { initDB } from '../utils/db.js';

export class App {
  constructor() {
    this.lists = new Map();
    this.listeners = new Set();
    this.isInitialized = false;
    initDB();
  }

  // ============================================
  // INITIALIZATION
  // ============================================

  async init(config) {
    if (this.isInitialized) return;
    
    for (const listConfig of config.lists) {
      const list = new List(listConfig.slug, listConfig.name, listConfig.accounts || []);
      this.lists.set(list.slug, list);
      await list.init();
    }
    
    this.isInitialized = true;
    console.log('App initialized with', this.lists.size, 'lists');
  }

  // ============================================
  // LIST MANAGEMENT
  // ============================================

  getList(slug) {
    return this.lists.get(slug);
  }

  getAllLists() {
    return Array.from(this.lists.values());
  }

  async addList(slug, name, accountRefs = []) {
    const list = new List(slug, name, accountRefs);
    this.lists.set(slug, list);
    await list.init();
    return list;
  }

  removeList(slug) {
    const list = this.lists.get(slug);
    if (list) {
      // Stop all account auto-updates for this list
      list.getAllAccounts().forEach(account => account.stopAutoUpdate());
      this.lists.delete(slug);
    }
  }

  // ============================================
  // PROXY METHODS
  // ============================================

  getListOrWarn(slug) {
    const list = this.getList(slug);
    if (!list) console.warn(`List ${slug} not found`);
    return list;
  }

  async getPostsForList(listSlug, options = {}) {
    const list = this.getListOrWarn(listSlug);
    return list ? list.getPosts(options.limit, options.sinceId, options.maxId) : [];
  }

  async getNewPosts(listSlug) {
    const list = this.getList(listSlug);
    return list ? list.getNewPosts() : [];
  }

  async getOlderPosts(listSlug) {
    const list = this.getList(listSlug);
    return list ? list.getOlderPosts() : [];
  }

  hasMorePosts(listSlug) {
    const list = this.getList(listSlug);
    return list?.hasMorePosts() || false;
  }

  // ============================================
  // EVENTS
  // ============================================

  subscribe(callback) {
    this.listeners.add(callback);
    return () => this.listeners.delete(callback);
  }

  notify(eventType, data) {
    this.listeners.forEach(cb => cb({ eventType, ...data }));
  }

  // ============================================
  // SERIALIZATION
  // ============================================

  toJSON() {
    return {
      lists: Array.from(this.lists.values()).map(list => list.toJSON())
    };
  }
}

// Singleton instance
export const app = new App();
