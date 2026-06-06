/**
 * Modal utilities voor post openen
 */

// ============================================
// CONSTANTS
// ============================================

const MODAL_ID = 'post-modal';
const FORM_ID = 'post-open-form';
const INSTANCE_INPUT_ID = 'user-instance';
const ORIGINAL_LINK_ID = 'original-post-link';
const STORAGE_KEY = 'mastodon_user_instance';

// ============================================
// STATE
// ============================================

let currentPostUrl = null;

// ============================================
// MODAL FUNCTIONS
// ============================================

/**
 * Open de modal met de gegeven post URL
 * @param {string} postUrl - De URL van de post
 */
export function openPostModal(postUrl) {
  currentPostUrl = postUrl;
  
  const modal = document.getElementById(MODAL_ID);
  const originalLink = document.getElementById(ORIGINAL_LINK_ID);
  
  if (modal && originalLink) {
    originalLink.href = postUrl;
    modal.setAttribute('aria-hidden', 'false');
    
    // Focus op het invoerveld
    const input = document.getElementById(INSTANCE_INPUT_ID);
    if (input) {
      input.focus();
      // Selecteer eventueel voorgeselecteerde tekst
      if (input.value) {
        input.select();
      }
    }
    
    // Voeg event listener toe voor escape toets
    document.addEventListener('keydown', handleKeyDown);
  }
}

/**
 * Sluit de modal
 */
export function closePostModal() {
  const modal = document.getElementById(MODAL_ID);
  if (modal) {
    modal.setAttribute('aria-hidden', 'true');
    document.removeEventListener('keydown', handleKeyDown);
  }
}

/**
 * Behandel toetsenbord events (escape om te sluiten)
 */
function handleKeyDown(event) {
  if (event.key === 'Escape') {
    closePostModal();
  }
}

// ============================================
// FORM SUBMISSION
// ============================================

/**
 * Sla instance op in localStorage
 */
function saveInstance(instance) {
  if (instance) {
    localStorage.setItem(STORAGE_KEY, instance);
  }
}

/**
 * Behandel form submission
 * Bouwt de URL en opent de post
 */
function handleFormSubmit(event) {
  event.preventDefault();
  
  const input = document.getElementById(INSTANCE_INPUT_ID);
  if (!input || !currentPostUrl) return;
  
  const instance = input.value.trim();
  if (!instance) return;
  
  // Sla instance op voor volgende keer
  saveInstance(instance);
  
  // Normaliseer de instance URL (voeg https:// toe als ontbreekt)
  let normalizedInstance = instance;
  if (!normalizedInstance.startsWith('http://') && !normalizedInstance.startsWith('https://')) {
    normalizedInstance = 'https://' + normalizedInstance;
  }
  
  // Probeer de originele post data van de button te krijgen
  const activeBtn = document.querySelector('.open-post-btn[data-post-url]');
  let originalUsername = '';
  let originalInstance = '';
  let originalPostId = '';
  let activityPubUri = '';
  
  if (activeBtn) {
    originalUsername = activeBtn.dataset.originalUsername || '';
    originalInstance = activeBtn.dataset.originalInstance || '';
    originalPostId = activeBtn.dataset.originalPostId || '';
    activityPubUri = activeBtn.dataset.activityPubUri || '';
  }
  
  // Probeer 1: Gebruik ActivityPub URI als die beschikbaar is
  if (activityPubUri) {
    // ActivityPub URI format: https://waag.social/users/sander/statuses/116703564687908173
    // We willen: https://user-instance/@sander@waag.social/116703564687908173
    try {
      const activityPubUrl = new URL(activityPubUri);
      const pathParts = activityPubUrl.pathname.split('/').filter(p => p);
      
      // Extract username from /users/username/statuses/id
      const usersIndex = pathParts.findIndex(p => p === 'users');
      if (usersIndex !== -1 && pathParts[usersIndex + 1]) {
        originalUsername = pathParts[usersIndex + 1];
      }
      
      // Extract post ID (laatste numerieke in path)
      for (let i = pathParts.length - 1; i >= 0; i--) {
        if (/^\d+$/.test(pathParts[i])) {
          originalPostId = pathParts[i];
          break;
        }
      }
      
      originalInstance = activityPubUrl.hostname;
    } catch (e) {
      console.warn('Failed to parse ActivityPub URI:', activityPubUri, e);
    }
  }
  
  // Probeer 2: Als we originalUsername, originalInstance en originalPostId hebben
  if (originalUsername && originalInstance && originalPostId) {
    const federatedUsername = `@${originalUsername}@${originalInstance}`;
    const newUrl = `${normalizedInstance}/${federatedUsername}/${originalPostId}`;
    console.log(`Opening with original data: ${newUrl}`);
    window.open(newUrl, '_blank');
    closePostModal();
    return;
  }
  
  // Probeer 3: Parse uit de currentPostUrl
  try {
    const url = new URL(currentPostUrl);
    const pathParts = url.pathname.split('/').filter(p => p);
    
    // Zoek naar @user@instance pattern in de path
    const federatedUserMatch = currentPostUrl.match(/@([^\/]+)@([^\/]+)/);
    
    if (federatedUserMatch) {
      // We hebben al een federated user: @user@original-instance
      const federatedUser = federatedUserMatch[0]; // @user@original-instance
      const postId = pathParts[pathParts.length - 1]; // Laatste deel is de post ID
      
      const newUrl = `${normalizedInstance}/${federatedUser}/${postId}`;
      console.log(`Opening federated: ${newUrl}`);
      window.open(newUrl, '_blank');
    } else {
      // Geen federated user gevonden, probeer standaard parsing
      let username = '';
      let postId = '';
      let originalHost = url.hostname;
      
      for (let i = 0; i < pathParts.length; i++) {
        const part = pathParts[i];
        if (part.startsWith('@')) {
          username = part.substring(1);
        }
      }
      
      for (let i = pathParts.length - 1; i >= 0; i--) {
        const part = pathParts[i];
        if (/^\d+$/.test(part)) {
          postId = part;
          break;
        }
      }
      
      if (!username) {
        const atMatch = currentPostUrl.match(/@([^\/\?#]+)/);
        if (atMatch) {
          username = atMatch[1].split('@')[0];
        }
      }
      
      if (username && postId) {
        const federatedUsername = `@${username}@${originalHost}`;
        const newUrl = `${normalizedInstance}/${federatedUsername}/${postId}`;
        console.log(`Opening: ${newUrl}`);
        window.open(newUrl, '_blank');
      } else {
        console.log('Fallback to original post URL');
        window.open(currentPostUrl, '_blank');
      }
    }
    
    closePostModal();
  } catch (error) {
    console.error('Failed to parse post URL:', error);
    window.open(currentPostUrl, '_blank');
    closePostModal();
  }
}

// ============================================
// INITIALIZATION
// ============================================

/**
 * Initialiseer de modal
 * Voeg event listeners toe
 */
export function initModal() {
  const modal = document.getElementById(MODAL_ID);
  const form = document.getElementById(FORM_ID);
  const closeBtn = document.querySelector('.modal-close');
  
  if (form) {
    form.addEventListener('submit', handleFormSubmit);
  }
  
  if (closeBtn) {
    closeBtn.addEventListener('click', closePostModal);
  }
  
  if (modal) {
    // Sluit modal als je buiten klikt
    modal.addEventListener('click', (event) => {
      if (event.target === modal) {
        closePostModal();
      }
    });
  }
  
  // Voeg event listeners toe aan alle "Open post" knoppen (delegation)
  document.addEventListener('click', (event) => {
    const btn = event.target.closest('.open-post-btn');
    if (btn) {
      const postUrl = btn.dataset.postUrl;
      if (postUrl) {
        event.preventDefault();
        openPostModal(postUrl);
      }
    }
  });
  
  // Laad opgeslagen instance uit localStorage
  const input = document.getElementById(INSTANCE_INPUT_ID);
  if (input) {
    const savedInstance = localStorage.getItem(STORAGE_KEY);
    if (savedInstance) {
      input.value = savedInstance;
    }
  }
}
