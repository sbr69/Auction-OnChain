import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { WalletProvider } from './context/WalletContext';
import { ToastProvider } from './context/ToastContext';
import { Navbar } from './components/Navbar';
import { Landing } from './components/Landing';
import { CreateAuction } from './components/CreateAuction';
import { ExplorePage } from './pages/ExplorePage';
import { AuctionPage } from './pages/AuctionPage';
import { AdminPanel } from './pages/AdminPanel';
import { ProfilePage } from './pages/ProfilePage';
import { CreateOrganisation } from './pages/CreateOrganisation';
import { JoinOrganisationPage } from './pages/JoinOrganisationPage';
import { useLocation } from 'react-router-dom';

function AnimatedRoutes() {
  const location = useLocation();

  return (
    <main className="flex-grow max-w-7xl mx-auto px-6 w-full">
      <AnimatePresence mode="wait">
        <motion.div
          key={location.pathname}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          transition={{ duration: 0.2 }}
        >
          <Routes location={location}>
            <Route path="/" element={<Landing />} />
            <Route path="/explore" element={<ExplorePage />} />
            <Route path="/auction/:id" element={<AuctionPage />} />
            <Route path="/create" element={<CreateAuction />} />
            <Route path="/admin" element={<AdminPanel />} />
            <Route path="/profile" element={<ProfilePage />} />
            <Route path="/create-org" element={<CreateOrganisation />} />
            <Route path="/join-org" element={<JoinOrganisationPage />} />
          </Routes>
        </motion.div>
      </AnimatePresence>
    </main>
  );
}

export default function App() {
  return (
    <WalletProvider>
      <ToastProvider>
        <Router>
          <div className="min-h-screen flex flex-col font-sans">
            <Navbar />
            <AnimatedRoutes />
            <footer className="border-t border-border mt-20 py-8 bg-surface">
              <div className="max-w-7xl mx-auto px-6 flex flex-col md:flex-row items-center justify-between gap-4">
                <p className="text-sm text-brand-500">
                  Powered by Stellar Soroban Smart Contracts
                </p>
                <div className="flex items-center gap-6 text-sm text-brand-500">
                  <span className="hover:text-brand-900 cursor-pointer transition-colors">Terms of Service</span>
                  <span className="hover:text-brand-900 cursor-pointer transition-colors">Privacy Policy</span>
                </div>
              </div>
            </footer>
          </div>
        </Router>
      </ToastProvider>
    </WalletProvider>
  );
}
