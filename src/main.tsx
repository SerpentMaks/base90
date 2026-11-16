import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { requestPersistentStorage } from './lib/platform';
import { loadSettings } from './lib/settings';
import { initTts } from './lib/tts';
import './index.css';

void requestPersistentStorage();
initTts();

await loadSettings();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
