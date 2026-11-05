import { initializeLanguage, applyDocumentTranslations } from './i18n.js?v=20261002-brand-quality-1';

// Reuse the site's translations after moving the stories off the landing page.
applyDocumentTranslations(initializeLanguage());
