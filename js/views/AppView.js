/**
 * AppView - Hoofdview die de hele applicatie beheert
 * Beheert ListViews en UI state
 */

import { ListView } from './ListView.js';

export class AppView {
  constructor() {
    // STATUS
  // ============================================

  setStatus(text) {
    this.statusElement.textContent = text;
  }

  showError(message) {
=======
  // ============================================
  // ERROR HANDLING
  // ============================================

  showError(message) {DOM elements
    this.container = document.querySelector('.container');
    this.selectElement = document.getElementById('feed-select');
    this.timelineElement = document.getElementById('timeline');
    this.triggerElement = document.getElementById('load-more-trigger');
    
    // State
    this.listViews = new Map();
    this.currentListSlug = null;
    this.currentListView = null;
  }

  // ============================================
  // INITIALIZATION
  // ============================================

  initTheme() {
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    if (!prefersDark) document.documentElement.classList.add('light-mode');
  }

  // ============================================
  // LIST SELECTION
  // ============================================

  renderListSelect(lists) {
    this.selectElement.innerHTML = '';
    lists.forEach(list => {
      const opt = document.createElement('option');
      opt.value = list.slug;
      opt.textContent = list.name;
      this.selectElement.appendChild(opt);
    });
  }

  async showList(slug, app) {
    const list = app.getList(slug);
    if (!list) {
      console.warn(`List ${slug} not found`);
      return;
    }

    this.currentListSlug = slug;
    
    let listView = this.listViews.get(slug);
    if (!listView) {
      listView = new ListView(this.timelineElement, list);
      listView.init();
      this.listViews.set(slug, listView);
    }
    
    this.currentListView = listView;
    await listView.loadInitial(20);
    
    window.scrollTo(0, 0);
    
    const newUrl = `${window.location.pathname}?list=${slug}`;
    window.history.pushState({ list: slug }, '', newUrl);
  }

  // ============================================
  // STATUS
  // ============================================

  setStatus(text) {
    this.statusElement.textContent = text;
  }

  showError(message) {
    this.timelineElement.innerHTML = `
      <div class="loading-trigger" style="color:red" role="alert">${message}</div>
    `;
  }

  // ============================================
  // EVENT SETUP
  // ============================================

  setupNavigation(app) {
    this.selectElement.addEventListener('change', (e) => {
      this.showList(e.target.value, app);
    });

    window.addEventListener('popstate', (e) => {
      const slug = new URLSearchParams(window.location.search).get('list');
      if (slug && slug !== this.currentListSlug) {
        this.showList(slug, app);
      }
    });
  }

  setupSubscriptions() {
    // Lists handle their own auto-refresh, no manual subscriptions needed
  }

  // ============================================
  // UTILITY
  // ============================================

  getSelectElement() {
    return this.selectElement;
  }
}
