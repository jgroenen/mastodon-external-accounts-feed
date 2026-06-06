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

let currentPostData = null;

// ============================================
// MODAL FUNCTIONS
// ============================================

/**
 * Open de modal met post data
 * @param {Object} postData - Object met post URL, ActivityPub URI, etc.
 */
export function openPostModal(postData) {
  currentPostData = postData;
  
  const modal = document.getElementById(MODAL_ID);
  const originalLink = document.getElementById(ORIGINAL_LINK_ID);
  
  if (modal && originalLink) {
    // Gebruik de weergave URL voor de originele link
    originalLink.href = postData.postUrl;
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
    currentPostData = null;
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
 * Gebruikt /search?q= met de ActivityPub URI voor betrouwbaarheid
 */
function handleFormSubmit(event) {
  event.preventDefault();
  
  const input = document.getElementById(INSTANCE_INPUT_ID);
  if (!input || !currentPostData) return;
  
  const instance = input.value.trim();
  if (!instance) return;
  
  // Sla instance op voor volgende keer
  saveInstance(instance);
  
  // Normaliseer de instance URL (voeg https:// toe als ontbreekt)
  let normalizedInstance = instance;
  if (!normalizedInstance.startsWith('http://') && !normalizedInstance.startsWith('https://')) {
    normalizedInstance = 'https://' + normalizedInstance;
  }
  
  // Gebruik de ActivityPub URI als die beschikbaar is, anders de weergave URL
  let postUriToUse = currentPostData.activityPubUri || currentPostData.postUrl;
  
  // Bouw de search URL: instance/search?q=activitypub-uri
  // Mastodon zal de post ophalen via ActivityPub
  const searchUrl = `${normalizedInstance}/search?q=${encodeURIComponent(postUriToUse)}`;
  
  window.open(searchUrl, '_blank');
  closePostModal();
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
        // Verzamel alle benodigde data
        openPostModal({
          postUrl: btn.dataset.postUrl || '',
          activityPubUri: btn.dataset.activityPubUri || '',
          originalUsername: btn.dataset.originalUsername || '',
          originalInstance: btn.dataset.originalInstance || '',
          originalPostId: btn.dataset.originalPostId || ''
        });
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
