/**
 * TootView - Rendert 1 enkele post/toot
 * Gebruikt HTML template in plaats van innerHTML
 */

import { escapeHtml } from '../utils/db.js';

// ============================================
// CONSTANTS
// ============================================

const TEMPLATE_ID = 'toot-template';

// ============================================
// HELPER FUNCTIONS
// ============================================

/**
 * Sanitize HTML content - allow only safe elements like links
 * This prevents XSS while preserving Mastodon's formatted content
 */
function sanitizeHtml(html) {
  if (!html) return '';
  
  // Create a temporary div to parse the HTML
  const tmp = document.createElement('div');
  tmp.innerHTML = html;
  
  // Recursively sanitize all elements
  const sanitizeNode = (node) => {
    // Text nodes are safe
    if (node.nodeType === Node.TEXT_NODE) {
      return node.cloneNode(true);
    }
    
    // Only allow specific safe elements
    const allowedTags = ['a', 'p', 'br', 'strong', 'b', 'em', 'i', 'u', 'code', 'pre', 'blockquote'];
    const allowedAttributes = {
      'a': ['href', 'title', 'rel', 'target']
    };
    
    if (!allowedTags.includes(node.tagName?.toLowerCase())) {
      // For disallowed elements, process their children
      const fragment = document.createDocumentFragment();
      for (const child of node.childNodes) {
        fragment.appendChild(sanitizeNode(child));
      }
      return fragment;
    }
    
    // Create new element
    const newNode = document.createElement(node.tagName.toLowerCase());
    
    // Copy only allowed attributes
    const allowedAttrs = allowedAttributes[node.tagName.toLowerCase()] || [];
    for (const attr of allowedAttrs) {
      if (node.hasAttribute(attr)) {
        let value = node.getAttribute(attr);
        // Sanitize href to prevent javascript: URLs
        if (attr === 'href') {
          value = sanitizeUrl(value);
        }
        newNode.setAttribute(attr, value);
      }
    }
    
    // Recursively process children
    for (const child of node.childNodes) {
      newNode.appendChild(sanitizeNode(child));
    }
    
    return newNode;
  };
  
  // Process all child nodes
  const fragment = document.createDocumentFragment();
  for (const child of tmp.childNodes) {
    fragment.appendChild(sanitizeNode(child));
  }
  
  // Return the sanitized HTML
  const result = document.createElement('div');
  result.appendChild(fragment);
  return result.innerHTML;
}

/**
 * Sanitize URLs to prevent javascript: and other dangerous protocols
 */
function sanitizeUrl(url) {
  if (!url) return url;
  // Allow http:, https:, and relative URLs
  if (url.startsWith('javascript:') || url.startsWith('data:')) {
    return '#';
  }
  return url;
}

/**
 * Format date for display
 */
function formatDate(dateString) {
  return new Date(dateString).toLocaleDateString('nl-NL', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit'
  });
}

/**
 * Get instance host without protocol
 */
function getHost(instance) {
  return instance.replace('https://', '');
}

/**
 * Get full date string for aria-label
 */
function getFullDate(dateString) {
  return new Date(dateString).toLocaleString();
}

/**
 * Build media HTML for a post
 */
function buildMediaHtml(mediaAttachments) {
  if (!mediaAttachments?.[0]) return '';
  
  const media = mediaAttachments[0];
  const alt = escapeHtml(media.description || 'Afbeelding');
  const previewUrl = media.preview_url || media.url;
  
  if (media.type === 'image') {
    return `
      <div class="media-attachments">
        <img src="${previewUrl}" alt="${alt}" loading="lazy" referrerpolicy="no-referrer">
      </div>
    `;
  }
  
  if (media.type === 'video' || media.type === 'gifv') {
    return `
      <div class="media-attachments">
        <video src="${media.url}" poster="${previewUrl}" controls
          ${media.type === 'gifv' ? 'loop muted autoplay playsinline' : ''}
          preload="none"
          style="width: 100%; max-height: 400px; display: block; object-fit: cover;"
          referrerpolicy="no-referrer"
          aria-label="Video: ${alt}">
        </video>
      </div>
    `;
  }
  
  return '';
}

/**
 * Get the icon filename based on count
 * If count > 0, use active- prefix
 */
function getIconName(type, count) {
  const countNum = Number(count) || 0;
  const prefix = countNum > 0 ? 'active-' : '';
  
  const iconMap = {
    reply: 're',
    boost: 'boost',
    favourite: 'star'
  };
  
  return prefix + iconMap[type];
}

// ============================================
// MAIN FUNCTION
// ============================================

/**
 * Create a DOM element for a single toot/post using the HTML template
 */
export function createTootElement(post) {
  const template = document.getElementById(TEMPLATE_ID);
  if (!template) {
    console.error('Toot template not found in DOM');
    return document.createElement('article');
  }
  
  const article = template.content.cloneNode(true).firstElementChild;
  
  // Set attributes
  article.setAttribute('aria-label', `Bericht van ${escapeHtml(post.account?.displayName || post.account?.username || 'Unknown')}`);
  article.dataset.postId = post.mastodonId;
  
  // Prepare data with fallbacks for missing fields
  const date = formatDate(post.createdAt);
  const fullDate = getFullDate(post.createdAt);
  const host = getHost(post.instance);
  const mediaHtml = buildMediaHtml(post.mediaAttachments);
  
  // Get icon names based on counts
  const replyIcon = getIconName('reply', post.repliesCount);
  const boostIcon = getIconName('boost', post.reblogsCount);
  const favouriteIcon = getIconName('favourite', post.favouritesCount);
  
  // Get original post info for modal
  const originalUsername = post.originalUsername || '';
  const originalInstance = post.originalInstance || '';
  const originalPostId = post.originalPostId || post.mastodonId || '';
  const activityPubUri = post.activityPubUri || post.url || '';
  
  // Replace placeholders with safe defaults
  const replacements = {
    '{mastodonId}': post.mastodonId || '',
    '{displayName}': escapeHtml(post.account?.displayName || post.account?.username || 'Unknown'),
    '{avatar}': post.account?.avatar || '',
    '{accountUrl}': post.account?.url || '#',
    '{acct}': escapeHtml(post.account?.acct || post.account?.username || 'unknown'),
    '{host}': host,
    '{url}': post.url || '#',
    '{date}': date,
    '{fullDate}': fullDate,
    '{content}': sanitizeHtml(post.content || ''),
    '{mediaHtml}': mediaHtml || '',
    '{replyIcon}': replyIcon,
    '{boostIcon}': boostIcon,
    '{favouriteIcon}': favouriteIcon,
    '{repliesCount}': String(post.repliesCount || 0),
    '{reblogsCount}': String(post.reblogsCount || 0),
    '{favouritesCount}': String(post.favouritesCount || 0),
    '{originalUsername}': escapeHtml(originalUsername),
    '{originalInstance}': escapeHtml(originalInstance),
    '{originalPostId}': originalPostId,
    '{activityPubUri}': escapeHtml(activityPubUri)
  };
  
  // Replace all placeholders in the HTML
  // If a placeholder is not found in replacements, remove it entirely
  let html = article.innerHTML;
  html = html.replace(/\{[^}]+\}/g, (match) => {
    const value = replacements[match];
    // If value is undefined or null, return empty string to remove the placeholder
    if (value == null) {
      return '';
    }
    return value;
  });
  article.innerHTML = html;
  
  return article;
}
