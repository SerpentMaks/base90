import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { requestPersistentStorage } from './lib/platform';
import { initTts } from './lib/tts';
import './index.css';

void requestPersistentStorage();
initTts();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
