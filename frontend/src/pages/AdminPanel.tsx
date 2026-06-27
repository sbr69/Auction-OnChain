import React, { useState, useEffect, useCallback } from 'react';
import { useWallet } from '../context/WalletContext';
import { useToast } from '../context/ToastContext';
import { fetchAllAuctions } from '../services/contract';
import { Auction } from '../types';
import { parseContractError } from '../utils/errors';
import { WalletService } from '../services/wallet';
import { formatXlm, resolveIpfsUrl, shortenAddress } from '../utils/formatters';
import { Loader } from '../components/ui/Loader';
import { ShieldCheck, CheckCircle2, XCircle, AlertTriangle } from 'lucide-react';
import { rpc, Contract, TransactionBuilder, Address, xdr } from '@stellar/stellar-sdk';
import { CONTRACT_ID, NETWORK_PASSPHRASE, RPC_URL } from '../utils/constants';

export const AdminPanel: React.FC = () => {
  const { address, isAdmin, connect } = useWallet();
  const { setTxState, showToast } = useToast();
  const [pendingAuctions, setPendingAuctions] = useState<Auction[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  const loadPending = useCallback(async () => {
    try {
      const all = await fetchAllAuctions();
      setPendingAuctions(all.filter(a => a.status === 'Pending'));
    } catch (err) {
      console.error("Error loading pending auctions:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadPending();
  }, [loadPending]);

  if (!address) {
    return (
      <div className="glass-card max-w-lg mx-auto p-10 rounded-3xl text-center border border-white/10 space-y-4 my-12">
        <ShieldCheck className="w-12 h-12 text-brand-400 mx-auto" />
        <h2 className="text-2xl font-bold text-white">Reviewer Portal Login</h2>
        <p className="text-slate-400 text-sm">Connect the authorized reviewer wallet to access administrative controls.</p>
        <button onClick={connect} className="px-6 py-3 bg-brand-600 hover:bg-brand-500 text-white font-bold rounded-xl text-sm transition-all">
          Connect Reviewer Wallet
        </button>
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="glass-card max-w-lg mx-auto p-10 rounded-3xl text-center border border-rose-500/20 bg-rose-500/5 space-y-4 my-12">
        <AlertTriangle className="w-12 h-12 text-rose-400 mx-auto" />
        <h2 className="text-2xl font-bold text-white">Unauthorized Access</h2>
        <p className="text-slate-300 text-sm">
          Your wallet (<span className="font-mono text-white font-bold">{shortenAddress(address)}</span>) is not authorized as the contract reviewer.
        </p>
      </div>
    );
  }

  const handleReview = async (auctionId: number, approve: boolean) => {
    setTxState({ status: 'SIMULATING', message: `Simulating auction ${approve ? 'approval' : 'rejection'}...` });
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

      setTxState({ status: 'SIGNING', message: 'Confirm review decision in wallet...' });

      const kit = WalletService.getKit();
      const signRes: any = await (kit as any).signTx({
        xdr: tx.toXDR(),
        networkPassphrase: NETWORK_PASSPHRASE,
        publicKey: address,
      }).catch(async () => {
        return await (kit as any).signTransaction(tx.toXDR(), {
          networkPassphrase: NETWORK_PASSPHRASE,
          address,
        });
      });

      const signedXdr = typeof signRes === 'string' ? signRes : (signRes.result || signRes.signedTxXdr || signRes.xdr);

      const signedTx = TransactionBuilder.fromXDR(signedXdr, NETWORK_PASSPHRASE);
      const sendRes = await server.sendTransaction(signedTx);

      if (sendRes.status === 'PENDING') {
        setTxState({ status: 'PENDING', txHash: sendRes.hash, message: 'Updating on-chain auction state...' });
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
    }
  };

  return (
    <div className="space-y-8 max-w-5xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-extrabold text-white flex items-center gap-2">
            <ShieldCheck className="w-8 h-8 text-amber-400" /> Reviewer Dashboard
          </h1>
          <p className="text-slate-400 text-sm">Verify auction legitimacy before approving them for public bidding.</p>
        </div>
        <span className="px-3 py-1.5 rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/20 text-xs font-bold">
          {pendingAuctions.length} Pending
        </span>
      </div>

      {loading ? (
        <Loader label="Loading pending submissions..." />
      ) : pendingAuctions.length === 0 ? (
        <div className="glass-card rounded-3xl p-12 text-center border border-white/5 space-y-3">
          <CheckCircle2 className="w-12 h-12 text-emerald-400 mx-auto" />
          <h3 className="text-xl font-bold text-white">All Submissions Reviewed</h3>
          <p className="text-slate-400 text-sm">There are no pending auctions requiring reviewer verification right now.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {pendingAuctions.map((auction) => (
            <div key={auction.id} className="glass-card p-6 rounded-3xl border border-white/10 flex flex-col md:flex-row gap-6 items-start md:items-center justify-between bg-dark-card/90">
              <div className="flex gap-4 items-center">
                <img
                  src={resolveIpfsUrl(auction.mediaUrl)}
                  alt={auction.title}
                  className="w-24 h-24 rounded-2xl object-cover border border-white/10 shrink-0"
                />
                <div className="space-y-1">
                  <span className="text-[11px] font-mono text-amber-400 font-semibold">Auction #{auction.id}</span>
                  <h3 className="text-lg font-bold text-white">{auction.title}</h3>
                  <p className="text-xs text-slate-400 line-clamp-1">{auction.description}</p>
                  <p className="text-xs text-slate-400">
                    Creator: <span className="font-mono text-slate-200">{shortenAddress(auction.creator)}</span> | Starting: <strong className="text-emerald-400">{formatXlm(auction.startingBid)}</strong>
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-3 w-full md:w-auto justify-end pt-4 md:pt-0 border-t md:border-t-0 border-white/5">
                <button
                  onClick={() => handleReview(auction.id, false)}
                  className="px-4 py-2.5 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/30 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5"
                >
                  <XCircle className="w-4 h-4" /> Reject
                </button>
                <button
                  onClick={() => handleReview(auction.id, true)}
                  className="px-5 py-2.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 rounded-xl text-xs font-black transition-all flex items-center gap-1.5 shadow-lg shadow-emerald-500/20"
                >
                  <CheckCircle2 className="w-4 h-4" /> Approve for Feed
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
