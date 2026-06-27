/**
 * ShareModal - Functionaliteit voor delen op sociale media
 * Ondersteunt LinkedIn en X (Twitter)
 */

// ============================================
// CONSTANTS
// ============================================

const SHARE_MODAL_ID = 'share-modal';
const SHARE_X_BTN_ID = 'share-x';
const SHARE_LINKEDIN_BTN_ID = 'share-linkedin';
const SHARE_POST_LINK_ID = 'share-post-link';

// ============================================
// STATE
// ============================================

let currentShareData = null;

// ============================================
// SHARE FUNCTIONS
// ============================================

/**
 * Open de share modal met post data
 * @param {Object} postData - Object met post URL, content, author
 */
export function openShareModal(postData) {
  currentShareData = postData;
  
  const modal = document.getElementById(SHARE_MODAL_ID);
  const postLink = document.getElementById(SHARE_POST_LINK_ID);
  
  if (modal && postLink) {
    // Set the original post link
    postLink.href = postData.postUrl;
    modal.setAttribute('aria-hidden', 'false');
    
    // Focus on first share button
    const firstBtn = modal.querySelector('.share-btn');
    if (firstBtn) {
      firstBtn.focus();
    }
    
    // Add event listener for escape key
    document.addEventListener('keydown', handleKeyDown);
  }
}

/**
 * Sluit de share modal
 */
export function closeShareModal() {
  const modal = document.getElementById(SHARE_MODAL_ID);
  if (modal) {
    modal.setAttribute('aria-hidden', 'true');
    document.removeEventListener('keydown', handleKeyDown);
    currentShareData = null;
  }
}

/**
 * Behandel toetsenbord events (escape om te sluiten)
 */
function handleKeyDown(event) {
  if (event.key === 'Escape') {
    closeShareModal();
  }
}

/**
 * Deel op X (Twitter)
 * Opent Twitter share intent met vooraf ingevulde tekst
 */
function shareOnX() {
  if (!currentShareData) return;
  
  const url = currentShareData.postUrl;
  const text = currentShareData.postContent;
  const author = currentShareData.postAuthor;
  
  // Bouw de Twitter share URL
  const shareText = author ? `${author}: ${text}` : text;
  const twitterUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText)}&url=${encodeURIComponent(url)}`;
  
  window.open(twitterUrl, '_blank', 'width=600,height=400,menubar=no,toolbar=no,status=no');
  closeShareModal();
}

/**
 * Deel op LinkedIn
 * Opent LinkedIn share dialog
 */
function shareOnLinkedIn() {
  if (!currentShareData) return;
  
  const url = currentShareData.postUrl;
  const text = currentShareData.postContent;
  const author = currentShareData.postAuthor;
  
  // Bouw de LinkedIn share URL
  const shareText = author ? `${author}: ${text}` : text;
  const linkedinUrl = `https://www.linkedin.com/shareArticle?mini=true&title=${encodeURIComponent(shareText)}&url=${encodeURIComponent(url)}`;
  
  window.open(linkedinUrl, '_blank', 'width=600,height=400,menubar=no,toolbar=no,status=no');
  closeShareModal();
}

// ============================================
// INITIALIZATION
// ============================================

/**
 * Initialiseer de share modal
 * Voeg event listeners toe
 */
export function initShareModal() {
  const modal = document.getElementById(SHARE_MODAL_ID);
  const xBtn = document.getElementById(SHARE_X_BTN_ID);
  const linkedinBtn = document.getElementById(SHARE_LINKEDIN_BTN_ID);
  const closeBtn = document.querySelector('#' + SHARE_MODAL_ID + ' .modal-close');
  
  // Event listeners voor share knoppen
  if (xBtn) {
    xBtn.addEventListener('click', shareOnX);
  }
  
  if (linkedinBtn) {
    linkedinBtn.addEventListener('click', shareOnLinkedIn);
  }
  
  // Event listener voor sluit knop
  if (closeBtn) {
    closeBtn.addEventListener('click', closeShareModal);
  }
  
  // Sluit modal als je buiten klikt
  if (modal) {
    modal.addEventListener('click', (event) => {
      if (event.target === modal) {
        closeShareModal();
      }
    });
  }
  
  // Event delegation voor share post knoppen in de timeline
  document.addEventListener('click', (event) => {
    const btn = event.target.closest('.share-post-btn');
    if (btn) {
      const postUrl = btn.dataset.postUrl;
      const postContent = btn.dataset.postContent;
      const postAuthor = btn.dataset.postAuthor;
      
      if (postUrl) {
        event.preventDefault();
        openShareModal({
          postUrl: postUrl || '',
          postContent: postContent || '',
          postAuthor: postAuthor || ''
        });
      }
    }
  });
}
