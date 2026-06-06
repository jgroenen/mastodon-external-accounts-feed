/**
 * TootView - Rendert 1 enkele post/toot
 * Gebruikt HTML template in plaats van innerHTML
 */

// ============================================
// CONSTANTS
// ============================================

const TEMPLATE_ID = 'toot-template';

// ============================================
// HELPER FUNCTIONS
// ============================================

/**
 * Escape HTML to prevent XSS
 */
function escapeHtml(text) {
  if (!text) return '';
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
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

// ============================================
// SVG ICONS - Cleaner, more modern design
// ============================================

function getIcon(name) {
  const icons = {
    // Reply icon - Speech bubble with arrow (Feather style)
    reply: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
      <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/>
    </svg>`,
    
    // Boost icon - Retweet arrows (Feather style)
    boost: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
      <polyline points="17 1 21 5 21 19 17 23"/>
      <polyline points="11 1 7 5 7 19 11 23"/>
      <polyline points="17 1 11 1 11 5 17 5"/>
      <polyline points="7 23 7 19 11 19"/>
    </svg>`,
    
    // Favorite icon - Heart (Feather style)
    favourite: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
      <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
    </svg>`
  };
  return icons[name] || '';
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
    '{content}': post.content || '',
    '{mediaHtml}': mediaHtml || '',
    '{replyIcon}': getIcon('reply'),
    '{boostIcon}': getIcon('boost'),
    '{favouriteIcon}': getIcon('favourite'),
    '{repliesCount}': String(post.repliesCount || 0),
    '{reblogsCount}': String(post.reblogsCount || 0),
    '{favouritesCount}': String(post.favouritesCount || 0)
  };
  
  // Replace all placeholders in the HTML
  // If a placeholder is not found in replacements, remove it entirely
  let html = article.innerHTML;
  html = html.replace(/\{[^}]+\}/g, (match) => {
    const value = replacements[match];
    // If value is undefined or null, return empty string to remove the placeholder
    if (value == null) {
      console.warn(`Placeholder ${match} not found in replacements`);
      return '';
    }
    return value;
  });
  article.innerHTML = html;
  
  return article;
}

export { escapeHtml, formatDate, getHost };
