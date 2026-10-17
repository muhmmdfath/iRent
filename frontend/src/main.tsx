import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '@fontsource/poppins/latin-400.css';
import '@fontsource/poppins/latin-500.css';
import '@fontsource/poppins/latin-600.css';
import '@fontsource/poppins/latin-700.css';
import './styles.css';
import './studio.css';
import './site-footer.css';
import './pink-theme.css';
import './landing.css';
import './admin-dashboard.css';
import './form-typography.css';
import { Providers } from './app/providers';
import { AppRouter } from './app/router';
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Providers>
      <AppRouter />
    </Providers>
  </StrictMode>,
);
