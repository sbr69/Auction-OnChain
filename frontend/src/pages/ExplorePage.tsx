import { useState, useEffect, useCallback } from 'react';
import { fetchAllAuctions, fetchAllOrgs } from '../services/contract';
import { Auction, Organisation } from '../types';
import { AuctionCard } from '../components/AuctionCard';
import { EventPoller } from '../services/events';
import { Gavel, AlertCircle, Building2, Users, Check, ArrowRight, Shield } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useWallet } from '../context/WalletContext';
import { useToast } from '../context/ToastContext';
import { signTransactionWithKit } from '../services/transactionHelper';
import { rpc, Contract, TransactionBuilder, Address, xdr } from '@stellar/stellar-sdk';
import { CONTRACT_ID, NETWORK_PASSPHRASE, RPC_URL } from '../utils/constants';
import { parseContractError } from '../utils/errors';

export function ExplorePage() {
  const { address, joinedOrgIds, ownedOrgs, refreshOrgs, isRegistered } = useWallet();
  const { showToast, setTxState } = useToast();
  
  const [activeTab, setActiveTab] = useState<'auctions' | 'orgs'>('auctions');
  const [auctions, setAuctions] = useState<Auction[]>([]);
  const [allOrgs, setAllOrgs] = useState<Organisation[]>([]);
  const [selectedOrgFilter, setSelectedOrgFilter] = useState<number | 'all'>('all');
  const [loading, setLoading] = useState(true);
  const [joiningOrgId, setJoiningOrgId] = useState<number | null>(null);

  // Automatically switch tab if no organisations are joined
  useEffect(() => {
    if (!loading) {
      if (joinedOrgIds.length === 0) {
        setActiveTab('orgs');
      } else {
        setActiveTab('auctions');
      }
    }
  }, [joinedOrgIds, loading]);

  const loadData = useCallback(async () => {
    try {
      const [auctionData, orgData] = await Promise.all([fetchAllAuctions(), fetchAllOrgs()]);
      // Show only approved/ended auctions from orgs user has joined
      const visibleAuctions = auctionData.filter(
        a => (a.status === 'Approved' || a.status === 'Ended') && joinedOrgIds.includes(a.orgId)
      );
      setAuctions(visibleAuctions);
      setAllOrgs(orgData);
    } catch (err) {
      console.error("Error loading explore data:", err);
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

  const handleJoinOrg = async (orgId: number) => {
    if (!address) {
      showToast('info', 'Connect Wallet', 'Please connect your wallet first.');
      return;
    }
    if (!isRegistered) {
      showToast('info', 'Username Required', 'Please claim your username in the navbar first.');
      return;
    }
    setJoiningOrgId(orgId);
    try {
      setTxState({ status: 'SIMULATING', message: 'Preparing to join organisation...' });

      const server = new rpc.Server(RPC_URL);
      const contract = new Contract(CONTRACT_ID);
      const account = await server.getAccount(address);

      const tx = await server.prepareTransaction(
        new TransactionBuilder(account, { fee: '200000', networkPassphrase: NETWORK_PASSPHRASE })
          .addOperation(
            contract.call(
              'join_org',
              new Address(address).toScVal(),
              xdr.ScVal.scvU64(xdr.Uint64.fromString(orgId.toString()))
            )
          )
          .setTimeout(30)
          .build()
      );

      setTxState({ status: 'SIGNING', message: 'Confirm in wallet...' });
      const signedXdr = await signTransactionWithKit(tx.toXDR(), address);

      setTxState({ status: 'SUBMITTING', message: 'Joining organisation on-chain...' });
      const signedTx = TransactionBuilder.fromXDR(signedXdr, NETWORK_PASSPHRASE);
      const sendRes = await server.sendTransaction(signedTx);

      if (sendRes.status === 'PENDING') {
        setTxState({ status: 'PENDING', txHash: sendRes.hash });
        let txStatus = await server.getTransaction(sendRes.hash);
        while (txStatus.status === rpc.Api.GetTransactionStatus.NOT_FOUND) {
          await new Promise(r => setTimeout(r, 1500));
          txStatus = await server.getTransaction(sendRes.hash);
        }

        if (txStatus.status === rpc.Api.GetTransactionStatus.SUCCESS) {
          setTxState({ status: 'SUCCESS', txHash: sendRes.hash, message: 'Joined organisation!' });
          showToast('success', 'Organisation Joined!', 'You can now view and bid on auctions in this organisation.');
          await refreshOrgs();
          await loadData();
        } else {
          throw new Error('Transaction failed');
        }
      }
    } catch (err: any) {
      const parsed = parseContractError(err);
      setTxState({ status: 'FAILED', error: parsed });
      showToast('error', 'Join Failed', parsed);
    } finally {
      setJoiningOrgId(null);
    }
  };

  const handleOrgClick = (orgId: number) => {
    setSelectedOrgFilter(orgId);
    setActiveTab('auctions');
  };

  const filteredAuctions = selectedOrgFilter === 'all'
    ? auctions
    : auctions.filter(a => a.orgId === selectedOrgFilter);

  const joinedOrgs = allOrgs.filter(o => joinedOrgIds.includes(o.id));
  const availableOrgs = allOrgs.filter(o => !joinedOrgIds.includes(o.id));

  const selectedOrg = selectedOrgFilter !== 'all' ? allOrgs.find(o => o.id === selectedOrgFilter) : null;
  const isSelectedOrgJoined = selectedOrgFilter === 'all' || joinedOrgIds.includes(selectedOrgFilter);

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

  return (
    <div className="py-12 space-y-8">
      {/* Page Header and Tab Selector */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 border-b border-border pb-6">
        <div>
          <h1 className="text-4xl font-serif text-brand-900 mb-3">Explore Marketplace</h1>
          <p className="text-brand-600">Discover rare digital & physical assets or manage organisation memberships.</p>
        </div>

        {/* Tab Controls */}
        <div className="flex bg-brand-50 p-1 rounded-xl self-start md:self-auto">
          <button
            onClick={() => joinedOrgIds.length > 0 && setActiveTab('auctions')}
            disabled={joinedOrgIds.length === 0}
            className={`px-6 py-2.5 rounded-lg text-sm font-medium transition-all ${
              activeTab === 'auctions'
                ? 'bg-surface text-brand-900 shadow-sm'
                : joinedOrgIds.length === 0
                ? 'text-brand-300 cursor-not-allowed'
                : 'text-brand-600 hover:text-brand-900'
            }`}
          >
            Live Auctions
          </button>
          <button
            onClick={() => setActiveTab('orgs')}
            className={`px-6 py-2.5 rounded-lg text-sm font-medium transition-all ${
              activeTab === 'orgs'
                ? 'bg-surface text-brand-900 shadow-sm'
                : 'text-brand-600 hover:text-brand-900'
            }`}
          >
            Organisations
          </button>
        </div>
      </div>

      {/* Loading State */}
      {loading && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-8">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="bg-surface rounded-2xl border border-border overflow-hidden animate-pulse">
              <div className="h-64 bg-brand-100" />
              <div className="p-6 space-y-4">
                <div className="h-6 bg-brand-100 rounded w-3/4" />
                <div className="h-4 bg-brand-50 rounded w-full" />
              </div>
            </div>
          ))}
        </div>
      )}

      {!loading && activeTab === 'auctions' && (
        <div className="space-y-8">
          {/* Auction filter bar */}
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-serif text-brand-900">
              {selectedOrgFilter === 'all' ? 'Active Listings' : `${selectedOrg?.name || 'Organisation'} Listings`} ({filteredAuctions.length})
            </h3>
            <div className="flex items-center gap-3">
              {joinedOrgs.length > 1 && (
                <select
                  value={selectedOrgFilter === 'all' ? 'all' : selectedOrgFilter}
                  onChange={(e) => setSelectedOrgFilter(e.target.value === 'all' ? 'all' : Number(e.target.value))}
                  className="px-4 py-2 bg-brand-50 border border-brand-200 rounded-lg text-sm text-brand-900 focus:outline-none focus:ring-2 focus:ring-brand-400"
                >
                  <option value="all">All Joined Organisations</option>
                  {joinedOrgs.map(org => (
                    <option key={org.id} value={org.id}>{org.name}</option>
                  ))}
                </select>
              )}
            </div>
          </div>

          {/* Active filter banner */}
          {selectedOrgFilter !== 'all' && isSelectedOrgJoined && (
            <div className="flex items-center justify-between bg-brand-50 border border-brand-200 rounded-xl px-4 py-3 text-sm text-brand-950 shadow-sm">
              <span className="flex items-center gap-2">
                <Building2 className="w-4 h-4 text-brand-600" />
                Filtering by: <span className="font-semibold">{selectedOrg?.name}</span>
              </span>
              <button
                onClick={() => setSelectedOrgFilter('all')}
                className="text-xs text-brand-600 hover:text-brand-900 font-medium underline"
              >
                Clear Filter
              </button>
            </div>
          )}

          {!isSelectedOrgJoined && selectedOrg ? (
            <div className="bg-surface border border-border rounded-2xl p-12 text-center max-w-xl mx-auto shadow-sm">
              <Building2 className="w-16 h-16 text-brand-500 mx-auto mb-4" />
              <h3 className="text-2xl font-serif text-brand-900 mb-3">Join {selectedOrg.name}</h3>
              <p className="text-brand-600 mb-6 leading-relaxed">
                You must join this organisation to view and bid on its live auctions.
              </p>
              <div className="flex gap-4 justify-center">
                <button
                  onClick={() => setSelectedOrgFilter('all')}
                  className="px-6 py-2.5 rounded-xl font-medium text-brand-600 hover:bg-brand-50 transition-colors"
                >
                  Back to All
                </button>
                <button
                  onClick={() => handleJoinOrg(selectedOrg.id)}
                  disabled={joiningOrgId !== null}
                  className="px-8 py-2.5 bg-brand-900 text-surface rounded-xl font-medium hover:bg-brand-800 transition-colors shadow-sm disabled:opacity-50"
                >
                  {joiningOrgId === selectedOrg.id ? 'Joining...' : 'Join Org'}
                </button>
              </div>
            </div>
          ) : filteredAuctions.length === 0 ? (
            <div className="bg-surface border border-dashed border-brand-300 rounded-2xl p-12 text-center">
              <Gavel className="w-12 h-12 text-brand-400 mx-auto mb-4" />
              <h3 className="text-xl font-serif text-brand-900 mb-2">No Live Auctions Found</h3>
              <p className="text-brand-500 mb-6">There are currently no approved auctions in this organisation.</p>
              <Link
                to="/create"
                className="inline-flex items-center gap-2 px-6 py-3 bg-brand-900 text-surface rounded-full font-medium hover:bg-brand-800 transition-all shadow-sm"
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
      )}

      {!loading && activeTab === 'orgs' && (
        <div className="space-y-10">
          {/* My Joined Orgs Section */}
          <section className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-xl font-serif text-brand-900 flex items-center gap-2">
                <Building2 className="w-5 h-5 text-brand-500" />
                My Organisations ({joinedOrgs.length})
              </h3>
              <Link
                to="/create-org"
                className="text-sm px-4 py-2 bg-brand-900 text-surface font-medium rounded-xl hover:bg-brand-800 transition-colors shadow-sm"
              >
                + Create Organisation
              </Link>
            </div>

            {joinedOrgs.length === 0 ? (
              <div className="bg-surface border border-dashed border-brand-300 rounded-2xl p-8 text-center">
                <p className="text-brand-500 text-sm">You haven't created or joined any organisations yet.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {joinedOrgs.map(org => {
                  const isOwner = ownedOrgs.some(o => o.id === org.id);
                  return (
                    <div
                      key={org.id}
                      onClick={() => handleOrgClick(org.id)}
                      className="bg-surface p-6 rounded-2xl border border-border shadow-sm flex flex-col justify-between cursor-pointer hover:border-brand-400 hover:shadow-md transition-all group"
                    >
                      <div>
                        <div className="flex items-center justify-between mb-3">
                          <h4 className="text-lg font-serif font-medium text-brand-900 group-hover:text-brand-700 transition-colors">{org.name}</h4>
                          {isOwner ? (
                            <span className="text-xs px-2.5 py-1 rounded-md bg-brand-100 text-brand-800 font-semibold flex items-center gap-1 border border-brand-200">
                              <Shield className="w-3 h-3" /> Owner
                            </span>
                          ) : (
                            <span className="text-xs px-2.5 py-1 rounded-md bg-emerald-50 text-emerald-700 font-semibold flex items-center gap-1 border border-emerald-100">
                              <Check className="w-3 h-3" /> Member
                            </span>
                          )}
                        </div>
                        <p className="text-sm text-brand-600 mb-4 leading-relaxed line-clamp-2">{org.description}</p>
                      </div>
                      <div className="flex items-center justify-between border-t border-brand-100 pt-4 mt-2">
                        <span className="text-xs font-mono text-brand-400 flex items-center gap-1.5">
                          <Users className="w-3.5 h-3.5 text-brand-400" />
                          {org.memberCount} members
                        </span>
                        {isOwner && (
                          <Link
                            to="/admin"
                            onClick={(e) => e.stopPropagation()}
                            className="text-xs text-brand-600 font-semibold flex items-center gap-1 hover:text-brand-900 transition-colors"
                          >
                            Manage Reviews <ArrowRight className="w-3.5 h-3.5" />
                          </Link>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>

          {/* Browse Available Orgs Section */}
          <section className="space-y-4">
            <h3 className="text-xl font-serif text-brand-900 flex items-center gap-2">
              <Users className="w-5 h-5 text-brand-500" />
              Browse All Organisations ({availableOrgs.length})
            </h3>

            {availableOrgs.length === 0 ? (
              <div className="bg-surface border border-dashed border-brand-300 rounded-2xl p-8 text-center">
                <p className="text-brand-500 text-sm">No other organisations available to join.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {availableOrgs.map(org => (
                  <div
                    key={org.id}
                    onClick={() => handleOrgClick(org.id)}
                    className="bg-surface p-6 rounded-2xl border border-border shadow-sm flex flex-col justify-between cursor-pointer hover:border-brand-400 hover:shadow-md transition-all group"
                  >
                    <div>
                      <h4 className="text-lg font-serif font-medium text-brand-900 mb-3 group-hover:text-brand-700 transition-colors">{org.name}</h4>
                      <p className="text-sm text-brand-600 mb-4 leading-relaxed line-clamp-2">{org.description}</p>
                    </div>
                    <div className="flex items-center justify-between border-t border-brand-100 pt-4 mt-2">
                      <span className="text-xs font-mono text-brand-400 flex items-center gap-1.5">
                        <Users className="w-3.5 h-3.5 text-brand-400" />
                        {org.memberCount} members
                      </span>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleJoinOrg(org.id);
                        }}
                        disabled={joiningOrgId !== null}
                        className="px-4 py-1.5 bg-brand-900 text-surface text-xs font-semibold rounded-lg hover:bg-brand-800 transition-all shadow-sm disabled:opacity-50"
                      >
                        {joiningOrgId === org.id ? 'Joining...' : 'Join Org'}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
      )}
    </div>
  );
}
