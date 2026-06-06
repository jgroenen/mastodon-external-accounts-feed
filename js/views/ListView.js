/**
 * ListView - Rendert een timeline voor 1 List
 * Beheert DOM en infinite scroll
 */

import { createTootElement } from './TootView.js';

// ============================================
// CONSTANTS
// ============================================

const EVENT_POSTS_UPDATED = 'postsUpdated';
const TRIGGER_CLASS = 'loading-trigger';
const SCROLL_ROOT_MARGIN = '400px';

export class ListView {
  /**
   * @param {HTMLElement} container - DOM element voor de timeline
   * @param {List} list - De List die deze view represent
   */
  constructor(container, list) {
    this.container = container;
    this.list = list;
    this.isLoadingMore = false;
    this.hasMore = false;
    this.observer = null;
    this.triggerElement = null;
    this.indicatorElement = null;
    this.indicatorCountElement = null;
    this.pendingPosts = [];
  }

  // ============================================
  // INITIALIZATION
  // ============================================

  init() {
    this.setupContainer();
    this.setupObserver();
    this.subscribeToList();
  }

  setupContainer() {
    this.container.innerHTML = '';
    
    // Setup new posts indicator
    this.indicatorElement = document.getElementById('new-posts-indicator');
    this.indicatorCountElement = document.getElementById('new-posts-count');
    
    // Setup trigger for infinite scroll
    this.triggerElement = document.createElement('div');
    this.triggerElement.className = TRIGGER_CLASS;
    this.triggerElement.setAttribute('aria-live', 'assertive');
    this.container.appendChild(this.triggerElement);
    
    // Setup click handler for indicator
    this.setupIndicatorClick();
  }

  setupIndicatorClick() {
    if (this.indicatorElement) {
      this.indicatorElement.addEventListener('click', () => {
        this.loadPendingPosts();
      });
    }
  }

  loadPendingPosts() {
    if (this.pendingPosts.length > 0) {
      this.prependPosts(this.pendingPosts);
      this.pendingPosts = [];
      this.hideNewPostsIndicator();
    }
  }

  setupObserver() {
    this.observer = new IntersectionObserver(
      (entries) => entries[0].isIntersecting && !this.isLoadingMore && this.loadMore(),
      { rootMargin: SCROLL_ROOT_MARGIN }
    );
    this.observer.observe(this.triggerElement);
  }

  subscribeToList() {
    this.list.subscribe((data) => {
      if (data.eventType === EVENT_POSTS_UPDATED && data.posts?.length > 0) {
        this.handlePostsUpdated(data.posts);
      }
    });
  }

  // ============================================
  // NEW POSTS INDICATOR
  // ============================================

  showNewPostsIndicator(count) {
    if (this.indicatorElement && this.indicatorCountElement) {
      this.indicatorCountElement.textContent = count;
      this.indicatorElement.style.display = 'block';
    }
  }

  hideNewPostsIndicator() {
    if (this.indicatorElement) {
      this.indicatorElement.style.display = 'none';
    }
  }

  // ============================================
  // RENDERING
  // ============================================

  renderTimeline(posts) {
    const trigger = this.container.querySelector(`.${TRIGGER_CLASS}`);
    this.container.innerHTML = '';
    
    posts.forEach(post => this.container.appendChild(createTootElement(post)));
    this.container.appendChild(trigger);
    
    this.updateState();
  }

  prependPosts(posts) {
    const fragment = document.createDocumentFragment();
    posts.forEach(post => fragment.prepend(createTootElement(post)));
    
    this.container.insertBefore(fragment, this.container.firstChild);
    this.updateState();
  }

  appendPosts(posts) {
    const fragment = document.createDocumentFragment();
    posts.forEach(post => fragment.appendChild(createTootElement(post)));
    
    this.container.insertBefore(fragment, this.triggerElement);
    this.updateState();
  }

  updateState() {
    this.hasMore = this.list.hasMorePosts();
    this.updateTrigger();
  }

  // ============================================
  // EVENT HANDLERS
  // ============================================

  handlePostsUpdated(newPosts) {
    const firstElement = this.container.querySelector('.toot');
    
    if (firstElement) {
      const firstPostId = firstElement.dataset.postId;
      const firstNewPostId = newPosts[0]?.mastodonId;
      
      if (firstPostId && firstNewPostId && firstNewPostId !== firstPostId) {
        this.pendingPosts = newPosts;
        this.showNewPostsIndicator(newPosts.length);
      }
    } else {
      this.renderTimeline(newPosts);
    }
  }

  // ============================================
  // LOADING
  // ============================================

  async loadInitial(limit = 20) {
    const posts = await this.list.getPosts(limit);
    this.renderTimeline(posts);
  }

  async loadMore() {
    if (this.isLoadingMore || !this.hasMore) return;
    
    this.isLoadingMore = true;
    this.setLoadingState(true);

    try {
      const olderPosts = await this.list.getOlderPosts();
      
      if (olderPosts.length > 0) {
        this.appendPosts(olderPosts);
      } else {
        this.hasMore = false;
        this.updateTrigger();
      }
    } catch (error) {
      console.error('Failed to load older posts:', error);
    } finally {
      this.isLoadingMore = false;
      this.setLoadingState(false);
    }
  }

  async loadNew() {
    const newPosts = await this.list.getNewPosts();
    if (newPosts.length > 0) this.prependPosts(newPosts);
    return newPosts;
  }

  // ============================================
  // UI UPDATES
  // ============================================

  updateTrigger() {
    if (!this.triggerElement) return;
    
    this.triggerElement.textContent = this.hasMore ? 'Scroll naar beneden voor meer...' : '';
    this.triggerElement.toggleAttribute('role', this.hasMore);
  }

  setLoadingState(isLoading) {
    if (!this.triggerElement) return;
    
    if (isLoading) {
      this.triggerElement.dataset.originalText = this.triggerElement.textContent || '';
      this.triggerElement.textContent = 'Laden...';
    } else {
      this.triggerElement.textContent = this.triggerElement.dataset.originalText || '';
    }
  }

  // ============================================
  // CLEANUP
  // ============================================

  destroy() {
    this.observer?.disconnect();
    this.container.innerHTML = '';
  }
}
