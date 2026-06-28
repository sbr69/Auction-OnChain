import { useState, useEffect, useCallback } from 'react';
import { fetchAllAuctions, fetchAllOrgs, isOrgMember } from '../services/contract';
import { Auction, Organisation } from '../types';
import { AuctionCard } from '../components/AuctionCard';
import { EventPoller } from '../services/events';
import { Gavel, AlertCircle, Building2 } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useWallet } from '../context/WalletContext';

export function ExplorePage() {
  const { address, joinedOrgIds } = useWallet();
  const [auctions, setAuctions] = useState<Auction[]>([]);
  const [allOrgs, setAllOrgs] = useState<Organisation[]>([]);
  const [selectedOrgFilter, setSelectedOrgFilter] = useState<number | 'all'>('all');
  const [loading, setLoading] = useState(true);

  const loadData = useCallback(async () => {
    try {
      const [auctionData, orgData] = await Promise.all([fetchAllAuctions(), fetchAllOrgs()]);
      // Show only approved/ended auctions from orgs user has joined
      const visibleAuctions = auctionData.filter(
        a => (a.status === 'Approved' || a.status === 'Ended') && joinedOrgIds.includes(a.orgId)
      );
      setAuctions(visibleAuctions);
      setAllOrgs(orgData.filter(o => joinedOrgIds.includes(o.id)));
    } catch (err) {
      console.error("Error loading auctions:", err);
    } finally {
      setLoading(false);
    }
  }, [joinedOrgIds]);

  useEffect(() => {
    loadData();
    const unsubscribe = EventPoller.subscribe(() => {
      loadData();
    });
    return () => unsubscribe();
  }, [loadData]);

  const filteredAuctions = selectedOrgFilter === 'all'
    ? auctions
    : auctions.filter(a => a.orgId === selectedOrgFilter);

  if (!address) {
    return (
      <div className="flex flex-col items-center justify-center py-32 text-center">
        <div className="w-20 h-20 bg-brand-100 rounded-full flex items-center justify-center mb-6">
          <AlertCircle className="w-10 h-10 text-brand-600" />
        </div>
        <h2 className="text-2xl font-serif text-brand-900 mb-3">Wallet Connection Required</h2>
        <p className="text-brand-600 max-w-md mb-8">Connect your wallet to explore and bid on live auctions.</p>
        <Link to="/" className="px-6 py-3 bg-brand-900 text-surface rounded-full font-medium hover:bg-brand-800 transition-colors shadow-sm">
          Return to Home
        </Link>
      </div>
    );
  }

  if (joinedOrgIds.length === 0 && !loading) {
    return (
      <div className="flex flex-col items-center justify-center py-32 text-center">
        <div className="w-20 h-20 bg-brand-100 rounded-full flex items-center justify-center mb-6">
          <Building2 className="w-10 h-10 text-brand-600" />
        </div>
        <h2 className="text-2xl font-serif text-brand-900 mb-3">Join an Organisation</h2>
        <p className="text-brand-600 max-w-md mb-8">You need to join at least one organisation to see and bid on auctions.</p>
        <Link to="/join-org" className="px-6 py-3 bg-brand-900 text-surface rounded-full font-medium hover:bg-brand-800 transition-colors shadow-sm">
          Browse Organisations
        </Link>
      </div>
    );
  }

  return (
    <div className="py-12">
      <div className="flex flex-col sm:flex-row items-start sm:items-end justify-between mb-10 gap-4">
        <div>
          <h1 className="text-4xl font-serif text-brand-900 mb-3">Live Auctions</h1>
          <p className="text-brand-600 text-lg">Discover rare digital and physical assets verified on Stellar.</p>
        </div>
        <div className="flex items-center gap-3">
          {allOrgs.length > 1 && (
            <select
              value={selectedOrgFilter === 'all' ? 'all' : selectedOrgFilter}
              onChange={(e) => setSelectedOrgFilter(e.target.value === 'all' ? 'all' : Number(e.target.value))}
              className="px-4 py-2 bg-brand-50 border border-brand-200 rounded-lg text-sm text-brand-900 focus:outline-none focus:ring-2 focus:ring-brand-400"
            >
              <option value="all">All Organisations</option>
              {allOrgs.map(org => (
                <option key={org.id} value={org.id}>{org.name}</option>
              ))}
            </select>
          )}
          <div className="hidden sm:flex items-center gap-2 text-sm text-brand-500 font-mono bg-brand-50 px-4 py-2 rounded-lg">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
            Soroban Testnet
          </div>
        </div>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-8">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="bg-surface rounded-2xl border border-border overflow-hidden animate-pulse">
              <div className="h-64 bg-brand-100" />
              <div className="p-6 space-y-4">
                <div className="h-6 bg-brand-100 rounded w-3/4" />
                <div className="h-4 bg-brand-50 rounded w-full" />
                <div className="h-4 bg-brand-50 rounded w-2/3" />
              </div>
            </div>
          ))}
        </div>
      ) : filteredAuctions.length === 0 ? (
        <div className="bg-surface border border-dashed border-brand-300 rounded-2xl p-12 text-center">
          <Gavel className="w-12 h-12 text-brand-400 mx-auto mb-4" />
          <h3 className="text-xl font-serif text-brand-900 mb-2">No Live Auctions Found</h3>
          <p className="text-brand-500 mb-6">There are currently no approved auctions in your organisations.</p>
          <Link
            to="/create"
            className="inline-flex items-center gap-2 px-6 py-3 bg-brand-900 text-surface rounded-full font-medium hover:bg-brand-800 transition-colors"
          >
            <Gavel className="w-4 h-4" />
            Create First Auction
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-8">
          {filteredAuctions.map(auction => (
            <AuctionCard key={auction.id} auction={auction} />
          ))}
        </div>
      )}
    </div>
  );
}
