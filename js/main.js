/**
 * Main Entry Point
 * Start de applicatie op
 */

import { app } from './models/App.js';
import { AppView } from './views/AppView.js';

// ============================================
// INITIALIZATION
// ============================================

async function init() {
  const appView = new AppView();
  appView.initTheme();
  
  try {
    const config = await fetch('accounts.json').then(res => res.json());
    await app.init(config);
    
    // Setup UI
    const lists = app.getAllLists();
    appView.renderListSelect(lists);
    appView.setupNavigation(app);
    appView.setupSubscriptions(app);
    
    // Determine initial list
    const urlParams = new URLSearchParams(window.location.search);
    let slug = urlParams.get('list');
    
    if (!slug || !lists.some(l => l.slug === slug)) {
      slug = lists[0]?.slug;
    }
    
    appView.getSelectElement().value = slug;
    await appView.showList(slug, app);
    
  } catch (error) {
    console.error('Initialization error:', error);
    appView.showError('Fout bij initialiseren van dashboard. Check accounts.json.');
    appView.setStatus('Fout');
  }
}

// ============================================
// STARTUP
// ============================================

const initOnReady = document.readyState === 'loading'
  ? () => document.addEventListener('DOMContentLoaded', init)
  : init;

initOnReady();
