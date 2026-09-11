import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

// Global capture-phase listener to transform typed inputs in the DOM.
// - Standard text inputs and textareas are transformed to UPPERCASE.
// - Email inputs are transformed to LOWERCASE to prevent truncated email overflow.
document.addEventListener('input', (e) => {
  const target = e.target as HTMLInputElement | HTMLTextAreaElement;
  if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA')) {
    const inputType = (target.getAttribute('type') || (target.tagName === 'TEXTAREA' ? 'textarea' : 'text')).toLowerCase();
    
    // Email and username/login inputs must remain lowercase
    const placeholder = (target.getAttribute('placeholder') || '').toLowerCase();
    const nameAttr = (target.getAttribute('name') || '').toLowerCase();
    const idAttr = (target.id || '').toLowerCase();
    const isEmailInput = inputType === 'email' || 
                         nameAttr.includes('email') || 
                         nameAttr.includes('correo') || 
                         idAttr.includes('email') || 
                         idAttr.includes('correo') || 
                         placeholder.includes('email') || 
                         placeholder.includes('correo') || 
                         placeholder.includes('@');

    if (isEmailInput) {
      const val = target.value;
      if (val) {
        const lower = val.toLowerCase();
        if (val !== lower) {
          const start = target.selectionStart;
          const end = target.selectionEnd;
          target.value = lower;
          if (start !== null && end !== null && typeof target.setSelectionRange === 'function') {
            try { target.setSelectionRange(start, end); } catch (_) {}
          }
        }
      }
      return;
    }

    const excludedTypes = ['file', 'checkbox', 'radio', 'number', 'date', 'time', 'datetime-local', 'color', 'range', 'password'];
    if (!excludedTypes.includes(inputType)) {
      const val = target.value;
      if (val) {
        const upper = val.toUpperCase();
        if (val !== upper) {
          const start = target.selectionStart;
          const end = target.selectionEnd;
          target.value = upper;
          if (start !== null && end !== null && typeof target.setSelectionRange === 'function') {
            try {
              target.setSelectionRange(start, end);
            } catch (_) {}
          }
        }
      }
    }
  }
}, true);

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

