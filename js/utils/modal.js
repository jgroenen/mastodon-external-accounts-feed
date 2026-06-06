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
  
  // Als de post URL al een @user@instance format heeft, gebruik die direct
  // Dit is de beste manier om de originele post te openen
  try {
    // Check of de URL al een federated user heeft
    const url = new URL(currentPostUrl);
    const pathParts = url.pathname.split('/').filter(p => p);
    
    // Zoek naar @user@instance pattern in de path
    const federatedUserMatch = currentPostUrl.match(/@([^\/]+)@([^\/]+)/);
    
    if (federatedUserMatch) {
      // We hebben al een federated user: @user@original-instance
      const federatedUser = federatedUserMatch[0]; // @user@original-instance
      const postId = pathParts[pathParts.length - 1]; // Laatste deel is de post ID
      
      // Bouw nieuwe URL: user-instance/@user@original-instance/post-id
      const newUrl = `${normalizedInstance}/${federatedUser}/${postId}`;
      console.log(`Opening federated: ${newUrl}`);
      window.open(newUrl, '_blank');
    } else {
      // Geen federated user gevonden, probeer standaard parsing
      let username = '';
      let postId = '';
      let originalHost = url.hostname;
      
      // Loop door path parts van voren naar achteren
      for (let i = 0; i < pathParts.length; i++) {
        const part = pathParts[i];
        if (part.startsWith('@')) {
          username = part.substring(1); // Verwijder de @
        }
      }
      
      // Zoek de post ID: dit is de LAATSTE numerieke string in de path
      for (let i = pathParts.length - 1; i >= 0; i--) {
        const part = pathParts[i];
        if (/^\d+$/.test(part)) {
          postId = part;
          break;
        }
      }
      
      // Als we geen username vonden, probeer dan uit de URL te halen
      if (!username) {
        const atMatch = currentPostUrl.match(/@([^\/\?#]+)/);
        if (atMatch) {
          username = atMatch[1].split('@')[0];
        }
      }
      
      // Debug log
      console.log(`Parsed: username=${username}, postId=${postId}, host=${originalHost}`);
      
      // Bouw de nieuwe URL
      if (username && postId) {
        const federatedUsername = `@${username}@${originalHost}`;
        const newUrl = `${normalizedInstance}/${federatedUsername}/${postId}`;
        console.log(`Opening: ${newUrl}`);
        window.open(newUrl, '_blank');
      } else {
        // Fallback: open gewoon de originele post
        console.log('Fallback to original post URL');
        window.open(currentPostUrl, '_blank');
      }
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
