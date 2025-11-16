import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';
import './index.css';

const target = document.getElementById('app');
if (!target) throw new Error('Target element #app not found');

ReactDOM.createRoot(target).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
