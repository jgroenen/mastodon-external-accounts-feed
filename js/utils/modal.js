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
  
  // Bouw de post URL voor de gebruikers instance
  // Mastodon web interface: https://user-instance/@user@original-instance/post-id
  try {
    const url = new URL(currentPostUrl);
    const pathParts = url.pathname.split('/').filter(p => p);
    
    // Zoek de gebruiker (start met @) en post ID (is een nummer)
    let userPart = '';
    let postId = '';
    
    for (let i = 0; i < pathParts.length; i++) {
      const part = pathParts[i];
      if (part.startsWith('@')) {
        userPart = part;
      } else if (/^\d+$/.test(part)) {
        postId = part;
      }
    }
    
    // Als we geen userPart vonden met @, probeer dan username uit hostname
    if (!userPart || !userPart.startsWith('@')) {
      // Probeer @username@instance format uit pathname
      const atIndex = pathParts.findIndex(p => p.startsWith('@'));
      if (atIndex !== -1) {
        userPart = pathParts[atIndex];
      } else {
        // Als laatste redmiddel: useer de laatste @ in de URL
        const atMatch = currentPostUrl.match(/@([^\/]+)/);
        if (atMatch) {
          userPart = '@' + atMatch[1];
        }
      }
    }
    
    // Voeg de originale instance toe aan de username
    // userPart is iets als @gebruiker, we moeten @gebruiker@original-instance maken
    if (userPart && postId) {
      // Check of userPart al de vollledige federaal identifier heeft
      if (userPart.includes('@', 1)) {
        // userPart is al @gebruiker@instance
        const newUrl = `${normalizedInstance}/${userPart}/${postId}`;
        window.open(newUrl, '_blank');
      } else {
        // userPart is alleen @gebruiker, voeg @original-instance toe
        const originalHost = url.hostname;
        const fullUserPart = `${userPart}@${originalHost}`;
        const newUrl = `${normalizedInstance}/${fullUserPart}/${postId}`;
        window.open(newUrl, '_blank');
      }
    } else {
      // Fallback: open gewoon de originele post
      window.open(currentPostUrl, '_blank');
    }
    
    closePostModal();
  } catch (error) {
    console.error('Failed to parse post URL:', error);
    // Fallback: open gewoon de originele post
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
