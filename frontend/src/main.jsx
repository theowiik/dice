import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import App from './App.jsx';
import Nuke from './components/Nuke.jsx';
import './index.css';

const target = document.getElementById('app');
if (!target) throw new Error('Target element #app not found');

ReactDOM.createRoot(target).render(
  <React.StrictMode>
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<App />} />
        <Route path="/nuke" element={<Nuke />} />
      </Routes>
    </BrowserRouter>
  </React.StrictMode>,
);
