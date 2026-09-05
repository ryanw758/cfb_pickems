import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App.jsx';
import { UserProvider } from './context/UserContext.jsx';
import './styles/index.css';

// Handle 404 redirect from GitHub Pages
const redirect = sessionStorage.redirect;
delete sessionStorage.redirect;
if (redirect && redirect !== location.pathname) {
  window.history.replaceState(null, null, redirect);
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <BrowserRouter basename="/cfb_pickems/">
    <UserProvider>
      <App />
    </UserProvider>
  </BrowserRouter>
);
