import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { WalletProvider } from './context/WalletContext';
import { ToastProvider } from './context/ToastContext';
import { ErrorBoundary } from './components/ui/ErrorBoundary';
import { Layout } from './components/layout/Layout';

import { Home } from './pages/Home';
import { AuctionPage } from './pages/AuctionPage';
import { CreateAuction } from './pages/CreateAuction';
import { AdminPanel } from './pages/AdminPanel';
import { Profile } from './pages/Profile';

export const App: React.FC = () => {
  return (
    <ErrorBoundary>
      <WalletProvider>
        <ToastProvider>
          <Router>
            <Layout>
              <Routes>
                <Route path="/" element={<Home />} />
                <Route path="/auction/:id" element={<AuctionPage />} />
                <Route path="/create" element={<CreateAuction />} />
                <Route path="/admin" element={<AdminPanel />} />
                <Route path="/profile" element={<Profile />} />
              </Routes>
            </Layout>
          </Router>
        </ToastProvider>
      </WalletProvider>
    </ErrorBoundary>
  );
};
