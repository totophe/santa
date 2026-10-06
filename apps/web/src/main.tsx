import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { I18nProvider } from './i18n';
import './styles.css';

const initialLang = (navigator.language || 'en').split('-')[0];

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <I18nProvider initialLang={initialLang}>
      <App />
    </I18nProvider>
  </StrictMode>,
);
