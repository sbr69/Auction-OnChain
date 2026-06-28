import { useState, useEffect, useCallback } from 'react';
import { useWallet } from '../context/WalletContext';
import { useToast } from '../context/ToastContext';
import { fetchAllAuctions, fetchOrg } from '../services/contract';
import { Auction, Organisation } from '../types';
import { formatXlm, resolveIpfsUrl, shortenAddress } from '../utils/formatters';
import { parseContractError } from '../utils/errors';
import { WalletService } from '../services/wallet';
import { signTransactionWithKit } from '../services/transactionHelper';
import { ShieldCheck, CheckCircle2, XCircle, AlertTriangle, Shield, Building2 } from 'lucide-react';
import { rpc, Contract, TransactionBuilder, Address, xdr } from '@stellar/stellar-sdk';
import { CONTRACT_ID, NETWORK_PASSPHRASE, RPC_URL } from '../utils/constants';
import { Link } from 'react-router-dom';

export function AdminPanel() {
  const { address, ownedOrgs, connect } = useWallet();
  const { setTxState, showToast } = useToast();
  const [pendingByOrg, setPendingByOrg] = useState<Record<number, { org: Organisation; auctions: Auction[] }>>({});
  const [loading, setLoading] = useState(true);

  const loadPending = useCallback(async () => {
    if (ownedOrgs.length === 0) { setLoading(false); return; }
    try {
      const all = await fetchAllAuctions();
      const grouped: Record<number, { org: Organisation; auctions: Auction[] }> = {};

      for (const myOrg of ownedOrgs) {
        const orgAuctions = all.filter(a => a.orgId === myOrg.id && a.status === 'Pending');
        if (orgAuctions.length > 0 || true) {
          grouped[myOrg.id] = { org: myOrg, auctions: orgAuctions };
        }
      }
      setPendingByOrg(grouped);
    } catch (err) {
      console.error("Error loading pending auctions:", err);
    } finally {
      setLoading(false);
    }
  }, [ownedOrgs]);

  useEffect(() => {
    loadPending();
  }, [loadPending]);

  if (!address) {
    return (
      <div className="max-w-lg mx-auto py-20 text-center">
        <div className="bg-surface rounded-2xl border border-border p-10 shadow-sm">
          <ShieldCheck className="w-12 h-12 text-brand-600 mx-auto mb-4" />
          <h2 className="text-2xl font-serif text-brand-900 mb-3">Admin Portal</h2>
          <p className="text-brand-600 text-sm mb-6">Connect your wallet to access organisation admin controls.</p>
          <button onClick={connect} className="px-6 py-3 bg-brand-900 text-surface font-medium rounded-xl hover:bg-brand-800 transition-colors">
            Connect Wallet
          </button>
        </div>
      </div>
    );
  }

  if (ownedOrgs.length === 0) {
    return (
      <div className="max-w-lg mx-auto py-20 text-center">
        <div className="bg-surface rounded-2xl border border-border p-10 shadow-sm">
          <AlertTriangle className="w-12 h-12 text-amber-500 mx-auto mb-4" />
          <h2 className="text-2xl font-serif text-brand-900 mb-3">No Organisations Owned</h2>
          <p className="text-brand-600 text-sm mb-6">
            You don't own any organisations yet. Create one to become an admin/reviewer.
          </p>
          <Link
            to="/create-org"
            className="inline-flex items-center gap-2 px-6 py-3 bg-brand-900 text-surface font-medium rounded-xl hover:bg-brand-800 transition-colors"
          >
            <Building2 className="w-4 h-4" />
            Create Organisation
          </Link>
        </div>
      </div>
    );
  }

  const handleReview = async (auctionId: number, approve: boolean) => {
    setTxState({ status: 'SIMULATING', message: `Simulating ${approve ? 'approval' : 'rejection'}...` });
    try {
      const server = new rpc.Server(RPC_URL);
      const contract = new Contract(CONTRACT_ID);
      const account = await server.getAccount(address);

      const tx = await server.prepareTransaction(
        new TransactionBuilder(account, { fee: '200000', networkPassphrase: NETWORK_PASSPHRASE })
          .addOperation(
            contract.call(
              'review_auction',
              new Address(address).toScVal(),
              xdr.ScVal.scvU64(new xdr.Uint64(auctionId)),
              xdr.ScVal.scvBool(approve)
            )
          )
          .setTimeout(30)
          .build()
      );

      setTxState({ status: 'SIGNING', message: 'Confirm in wallet...' });
      const signedXdr = await signTransactionWithKit(tx.toXDR(), address);
      const signedTx = TransactionBuilder.fromXDR(signedXdr, NETWORK_PASSPHRASE);
      const sendRes = await server.sendTransaction(signedTx);

      if (sendRes.status === 'PENDING') {
        setTxState({ status: 'PENDING', txHash: sendRes.hash, message: 'Updating on-chain...' });
        let txStatus = await server.getTransaction(sendRes.hash);
        while (txStatus.status === rpc.Api.GetTransactionStatus.NOT_FOUND) {
          await new Promise(r => setTimeout(r, 1500));
          txStatus = await server.getTransaction(sendRes.hash);
        }

        if (txStatus.status === rpc.Api.GetTransactionStatus.SUCCESS) {
          setTxState({ status: 'SUCCESS', txHash: sendRes.hash, message: `Auction #${auctionId} ${approve ? 'Approved' : 'Rejected'}!` });
          showToast(approve ? 'success' : 'info', `Auction #${auctionId} ${approve ? 'Approved' : 'Rejected'}`);
          await loadPending();
        }
      }
    } catch (err: any) {
      const parsedErr = parseContractError(err);
      setTxState({ status: 'FAILED', error: parsedErr });
      showToast('error', 'Review Failed', parsedErr);
    }
  };

  const totalPending = Object.values(pendingByOrg).reduce((s, g) => s + g.auctions.length, 0);

  return (
    <div className="py-12 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-10">
        <div>
          <h1 className="text-3xl font-serif text-brand-900 mb-2 flex items-center gap-2">
            <Shield className="w-7 h-7 text-brand-600" /> Admin Panel
          </h1>
          <p className="text-brand-600">Review and approve pending auction listings in your organisations.</p>
        </div>
        <span className="px-4 py-2 rounded-xl bg-amber-50 text-amber-800 border border-amber-200 text-sm font-semibold">
          {totalPending} Pending
        </span>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="w-8 h-8 border-2 border-brand-600 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <div className="space-y-8">
          {Object.values(pendingByOrg).map(({ org, auctions }) => (
            <div key={org.id} className="space-y-4">
              <div className="flex items-center gap-3 pb-2 border-b border-border">
                <Building2 className="w-5 h-5 text-brand-500" />
                <h2 className="text-lg font-serif font-medium text-brand-900">{org.name}</h2>
                <span className="text-xs text-brand-500 font-mono">#{org.id} · {org.memberCount} members</span>
              </div>

              {auctions.length === 0 ? (
                <div className="bg-surface border border-dashed border-brand-300 rounded-2xl p-8 text-center">
                  <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto mb-2" />
                  <p className="text-brand-500 text-sm">No pending auctions in this organisation.</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {auctions.map((auction) => (
                    <div key={auction.id} className="bg-surface p-6 rounded-2xl border border-border flex flex-col md:flex-row gap-6 items-start md:items-center justify-between shadow-sm">
                      <div className="flex gap-4 items-center">
                        <img
                          src={resolveIpfsUrl(auction.mediaUrl)}
                          alt={auction.title}
                          className="w-24 h-24 rounded-2xl object-cover border border-border shrink-0"
                        />
                        <div className="space-y-1">
                          <span className="text-xs font-mono text-amber-700 font-semibold">Auction #{auction.id}</span>
                          <h3 className="text-lg font-serif font-medium text-brand-900">{auction.title}</h3>
                          <p className="text-xs text-brand-600 line-clamp-1">{auction.description}</p>
                          <p className="text-xs text-brand-500">
                            Creator: <span className="font-mono text-brand-900">{shortenAddress(auction.creator, 6)}</span> | Starting: <strong className="text-brand-900">{formatXlm(auction.startingBid)}</strong>
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-3 w-full md:w-auto justify-end pt-4 md:pt-0 border-t md:border-t-0 border-border">
                        <button
                          onClick={() => handleReview(auction.id, false)}
                          className="flex-1 md:flex-none flex items-center justify-center gap-2 px-5 py-2.5 bg-rose-50 text-rose-600 border border-rose-200 rounded-xl text-sm font-medium hover:bg-rose-100 transition-colors"
                        >
                          <XCircle className="w-4 h-4" /> Reject
                        </button>
                        <button
                          onClick={() => handleReview(auction.id, true)}
                          className="flex-1 md:flex-none flex items-center justify-center gap-2 px-5 py-2.5 bg-emerald-600 text-white rounded-xl text-sm font-semibold hover:bg-emerald-700 transition-colors shadow-sm"
                        >
                          <CheckCircle2 className="w-4 h-4" /> Approve
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
