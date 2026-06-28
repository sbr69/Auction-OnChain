import { useState, useEffect, useCallback } from 'react';
import { useWallet } from '../context/WalletContext';
import { fetchAllAuctions, fetchUserBidDeposit, fetchAllOrgs, isOrgMember } from '../services/contract';
import { Auction, Organisation } from '../types';
import { AuctionCard } from '../components/AuctionCard';
import { formatXlm, shortenAddress } from '../utils/formatters';
import { User, Gavel, Coins, ShieldCheck, ArrowRight, Building2 } from 'lucide-react';
import { Link } from 'react-router-dom';

export function ProfilePage() {
  const { address, username, isRegistered, balance, connect, ownedOrgs } = useWallet();
  const [createdAuctions, setCreatedAuctions] = useState<Auction[]>([]);
  const [biddingAuctions, setBiddingAuctions] = useState<{ auction: Auction; deposit: number }[]>([]);
  const [memberOrgs, setMemberOrgs] = useState<Organisation[]>([]);
  const [loading, setLoading] = useState(true);

  const loadUserData = useCallback(async () => {
    if (!address) {
      setLoading(false);
      return;
    }
    try {
      const [all, allOrgs] = await Promise.all([fetchAllAuctions(), fetchAllOrgs()]);
      const myCreated = all.filter(a => a.creator.toUpperCase() === address.toUpperCase());
      setCreatedAuctions(myCreated);

      const bidsWithDeposits: { auction: Auction; deposit: number }[] = [];
      for (const a of all) {
        const dep = await fetchUserBidDeposit(a.id, address);
        if (dep > 0) {
          bidsWithDeposits.push({ auction: a, deposit: dep });
        }
      }
      setBiddingAuctions(bidsWithDeposits);

      // Check org membership
      const myOrgs: Organisation[] = [];
      for (const org of allOrgs) {
        const isMember = await isOrgMember(org.id, address);
        if (isMember) myOrgs.push(org);
      }
      setMemberOrgs(myOrgs);
    } catch (err) {
      console.error("Error loading profile data:", err);
    } finally {
      setLoading(false);
    }
  }, [address]);

  useEffect(() => {
    loadUserData();
  }, [loadUserData]);

  if (!address) {
    return (
      <div className="max-w-lg mx-auto py-20 text-center">
        <div className="bg-surface rounded-2xl border border-border p-10 shadow-sm">
          <User className="w-12 h-12 text-brand-600 mx-auto mb-4" />
          <h2 className="text-2xl font-serif text-brand-900 mb-3">My Dashboard</h2>
          <p className="text-brand-600 text-sm mb-6">Connect your wallet to view your bids, auctions, and refunds.</p>
          <button onClick={connect} className="px-6 py-3 bg-brand-900 text-surface font-medium rounded-xl hover:bg-brand-800 transition-colors">
            Connect Wallet
          </button>
        </div>
      </div>
    );
  }

  const totalEscrowed = biddingAuctions.reduce((sum, b) => sum + b.deposit, 0);

  return (
    <div className="py-12 max-w-6xl mx-auto space-y-10">
      {/* Profile Header */}
      <div className="bg-surface p-8 rounded-2xl border border-border shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 rounded-2xl bg-brand-100 flex items-center justify-center text-2xl font-bold text-brand-600">
            {username ? username[0].toUpperCase() : 'W'}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-serif text-brand-900">
                {username ? `@${username}` : 'Anonymous User'}
              </h1>
              {isRegistered && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700 border border-emerald-200 text-xs font-semibold">
                  <ShieldCheck className="w-3 h-3" /> Verified
                </span>
              )}
            </div>
            <p className="text-xs font-mono text-brand-500 mt-1">{address}</p>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-4 w-full md:w-auto">
          <div className="bg-brand-50 p-4 rounded-xl text-center">
            <span className="text-xs text-brand-500 font-semibold block">Balance</span>
            <span className="text-lg font-mono font-bold text-brand-900">{balance.toFixed(2)}</span>
            <span className="text-xs text-brand-500 block">XLM</span>
          </div>
          <div className="bg-brand-50 p-4 rounded-xl text-center">
            <span className="text-xs text-brand-500 font-semibold block">Escrowed</span>
            <span className="text-lg font-mono font-bold text-brand-900">{totalEscrowed.toFixed(2)}</span>
            <span className="text-xs text-brand-500 block">XLM</span>
          </div>
          <div className="bg-brand-50 p-4 rounded-xl text-center">
            <span className="text-xs text-brand-500 font-semibold block">Active Bids</span>
            <span className="text-lg font-mono font-bold text-brand-900">{biddingAuctions.length}</span>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="w-8 h-8 border-2 border-brand-600 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <div className="space-y-10">
          {/* My Organisations */}
          <section className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-serif text-brand-900 flex items-center gap-2">
                <Building2 className="w-5 h-5 text-brand-500" /> My Organisations ({memberOrgs.length})
              </h2>
              <Link to="/join-org" className="text-sm text-brand-600 font-medium hover:text-brand-900 transition-colors">
                + Join More
              </Link>
            </div>

            {memberOrgs.length === 0 ? (
              <div className="bg-surface border border-dashed border-brand-300 rounded-2xl p-8 text-center">
                <p className="text-brand-500 text-sm mb-4">You haven't joined any organisations yet.</p>
                <Link to="/join-org" className="inline-flex items-center gap-2 px-6 py-2.5 bg-brand-900 text-surface rounded-xl text-sm font-medium hover:bg-brand-800 transition-colors">
                  Browse Organisations
                </Link>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {memberOrgs.map(org => {
                  const isOwner = ownedOrgs.some(o => o.id === org.id);
                  return (
                    <div key={org.id} className="bg-surface p-5 rounded-2xl border border-border shadow-sm">
                      <div className="flex items-center justify-between mb-2">
                        <h4 className="text-base font-serif font-medium text-brand-900">{org.name}</h4>
                        {isOwner && (
                          <span className="text-xs px-2 py-0.5 rounded-md bg-brand-100 text-brand-700 font-semibold">Owner</span>
                        )}
                      </div>
                      <p className="text-xs text-brand-600 line-clamp-2 mb-2">{org.description}</p>
                      <p className="text-xs font-mono text-brand-500">{org.memberCount} members</p>
                    </div>
                  );
                })}
              </div>
            )}
          </section>

          {/* My Bids & Escrows */}
          <section className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-serif text-brand-900 flex items-center gap-2">
                <Coins className="w-5 h-5 text-brand-500" /> My Bids & Escrows ({biddingAuctions.length})
              </h2>
            </div>

            {biddingAuctions.length === 0 ? (
              <div className="bg-surface border border-dashed border-brand-300 rounded-2xl p-8 text-center">
                <p className="text-brand-500 text-sm">You have not placed bids on any auctions yet.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {biddingAuctions.map(({ auction, deposit }) => (
                  <Link
                    key={auction.id}
                    to={`/auction/${auction.id}`}
                    className="bg-surface p-5 rounded-2xl border border-border hover:border-brand-400 transition-all flex items-center justify-between group shadow-sm"
                  >
                    <div>
                      <span className="text-xs uppercase text-brand-500 font-semibold">Auction #{auction.id}</span>
                      <h4 className="text-base font-serif font-medium text-brand-900 group-hover:text-brand-600 transition-colors">{auction.title}</h4>
                      <p className="text-xs text-brand-500 mt-1">
                        Your Escrow: <strong className="text-brand-900">{formatXlm(deposit)}</strong>
                      </p>
                    </div>
                    <ArrowRight className="w-5 h-5 text-brand-400 group-hover:text-brand-900 group-hover:translate-x-1 transition-all" />
                  </Link>
                ))}
              </div>
            )}
          </section>

          {/* My Created Auctions */}
          <section className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-serif text-brand-900 flex items-center gap-2">
                <Gavel className="w-5 h-5 text-brand-500" /> My Created Auctions ({createdAuctions.length})
              </h2>
              <Link to="/create" className="text-sm text-brand-600 font-medium hover:text-brand-900 transition-colors">
                + Create New
              </Link>
            </div>

            {createdAuctions.length === 0 ? (
              <div className="bg-surface border border-dashed border-brand-300 rounded-2xl p-8 text-center">
                <p className="text-brand-500 text-sm">You have not created any auctions yet.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                {createdAuctions.map(auction => (
                  <AuctionCard key={auction.id} auction={auction} />
                ))}
              </div>
            )}
          </section>
        </div>
      )}
    </div>
  );
}
