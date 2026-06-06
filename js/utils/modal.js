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
 * Gebruikt /search?q= met de originele post URL voor betrouwbaarheid
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
  
  // Gebruik de originele post URL uit de button's data-attribuut
  // De button heeft data-post-url met de weergave URL
  // Maar we willen de ActivityPub URI als die beschikbaar is
  const activeBtn = document.querySelector('.open-post-btn[data-post-url]');
  let postUrlToUse = currentPostUrl;
  
  if (activeBtn && activeBtn.dataset.activityPubUri) {
    // Gebruik de ActivityPub URI als die beschikbaar is
    postUrlToUse = activeBtn.dataset.activityPubUri;
  }
  
  // Bouw de search URL: instance/search?q=post-url
  // Mastodon zal de post ophalen via ActivityPub
  const searchUrl = `${normalizedInstance}/search?q=${encodeURIComponent(postUrlToUse)}`;
  
  console.log(`Opening search: ${searchUrl}`);
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
