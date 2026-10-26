import { TODOS_PATH } from '@todo/contract';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

// Placeholder shell; Story 1.3 replaces it with App, the list and its states.
export function App() {
  return (
    <main>
      <h1>Todo</h1>
      <p>List endpoint: {TODOS_PATH}</p>
    </main>
  );
}

export function mount(container: HTMLElement) {
  createRoot(container).render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
}

const root = document.getElementById('root');
if (root) mount(root);
