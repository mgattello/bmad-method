import './tokens.css';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App.js';

export function mount(container: HTMLElement) {
  createRoot(container).render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
}

const root = document.getElementById('root');
if (root) mount(root);
