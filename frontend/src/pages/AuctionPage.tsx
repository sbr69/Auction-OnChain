import React, { useState, useEffect, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import { fetchAuction, fetchUserBidDeposit } from '../services/contract';
import { Auction } from '../types';
import { useWallet } from '../context/WalletContext';
import { useToast } from '../context/ToastContext';
import { xlmToStroops, formatXlm, resolveIpfsUrl, shortenAddress } from '../utils/formatters';
import { parseContractError } from '../utils/errors';
import { WalletService } from '../services/wallet';
import { EventPoller } from '../services/events';
import { AuctionTimer } from '../components/auction/AuctionTimer';
import { AuctionStatusBadge } from '../components/auction/AuctionStatusBadge';
import { BidHistory } from '../components/auction/BidHistory';
import { Loader } from '../components/ui/Loader';
import { Modal } from '../components/ui/Modal';
import { Gavel, TrendingUp, User, ArrowLeft, AlertCircle, Trophy, Coins } from 'lucide-react';
import { rpc, Contract, TransactionBuilder, Address, xdr } from '@stellar/stellar-sdk';
import { CONTRACT_ID, NETWORK_PASSPHRASE, RPC_URL } from '../utils/constants';
import confetti from 'canvas-confetti';

export const AuctionPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const auctionId = Number(id);
  const { address, isRegistered, balance, refreshUserInfo } = useWallet();
  const { setTxState, showToast } = useToast();

  const [auction, setAuction] = useState<Auction | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [userDeposit, setUserDeposit] = useState<number>(0);
  const [bidAddition, setBidAddition] = useState<string>('');
  const [showBidModal, setShowBidModal] = useState<boolean>(false);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [bidError, setBidError] = useState<string | null>(null);

  const loadAuctionDetails = useCallback(async () => {
    if (!auctionId) return;
    try {
      const data = await fetchAuction(auctionId);
      setAuction(data);
      if (address) {
        const deposit = await fetchUserBidDeposit(auctionId, address);
        setUserDeposit(deposit);
      }
    } catch (err) {
      console.error("Failed to load auction details:", err);
    } finally {
      setLoading(false);
    }
  }, [auctionId, address]);

  useEffect(() => {
    loadAuctionDetails();
    const unsub = EventPoller.subscribe((ev) => {
      if (ev.type === 'placed' || ev.type === 'ended' || ev.type === 'approved') {
        loadAuctionDetails();
      }
    });
    return () => unsub();
  }, [loadAuctionDetails]);

  if (loading) return <Loader label="Fetching on-chain auction state..." />;
  if (!auction) {
    return (
      <div className="text-center py-16 space-y-4">
        <h2 className="text-2xl font-bold text-white">Auction Not Found</h2>
        <p className="text-slate-400">The requested auction ID does not exist on Stellar Testnet.</p>
        <Link to="/" className="inline-flex items-center gap-2 px-4 py-2 bg-brand-600 text-white rounded-xl text-sm">
          <ArrowLeft className="w-4 h-4" /> Back to Explore
        </Link>
      </div>
    );
  }

  const isExpired = auction.endTime <= Math.floor(Date.now() / 1000);
  const isCreator = address && address.toUpperCase() === auction.creator.toUpperCase();
  const isWinner = isExpired && auction.totalBids > 0 && address && address.toUpperCase() === auction.highestBidder.toUpperCase();
  const isLoser = isExpired && auction.totalBids > 0 && !isWinner && userDeposit > 0;

  const minRequiredTotal = auction.totalBids === 0 
    ? auction.startingBid 
    : auction.highestBid + auction.minIncrement;

  const currentTotalWithAddition = userDeposit + (Number(bidAddition) || 0);

  const signAndSend = async (server: rpc.Server, tx: any) => {
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
    return await server.sendTransaction(signedTx);
  };

  const handlePlaceBidSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!address || !auction) return;

    const additionNum = Number(bidAddition);
    if (isNaN(additionNum) || additionNum <= 0) {
      setBidError('Please enter a valid additional bid amount.');
      return;
    }

    if (currentTotalWithAddition < minRequiredTotal) {
      setBidError(`Bid Too Low: Your cumulative total (${currentTotalWithAddition} XLM) must be at least ${minRequiredTotal} XLM.`);
      return;
    }

    if (additionNum > balance) {
      setBidError(`Insufficient Balance: You only have ${balance.toFixed(2)} XLM available.`);
      return;
    }

    setIsSubmitting(true);
    setBidError(null);
    setTxState({ status: 'SIMULATING', message: 'Simulating bid escrow transaction on Soroban...' });

    try {
      const server = new rpc.Server(RPC_URL);
      const contract = new Contract(CONTRACT_ID);
      const account = await server.getAccount(address);
      const additionStroops = xlmToStroops(additionNum);

      const tx = await server.prepareTransaction(
        new TransactionBuilder(account, { fee: '200000', networkPassphrase: NETWORK_PASSPHRASE })
          .addOperation(
            contract.call(
              'place_bid',
              new Address(address).toScVal(),
              xdr.ScVal.scvU64(new xdr.Uint64(auction.id)),
              xdr.ScVal.scvI128(new (xdr as any).Int128([BigInt(0), additionStroops]))
            )
          )
          .setTimeout(30)
          .build()
      );

      setTxState({ status: 'SIGNING', message: 'Please confirm XLM escrow transfer in your wallet...' });
      const sendRes = await signAndSend(server, tx);

      if (sendRes.status === 'PENDING') {
        setTxState({ status: 'PENDING', txHash: sendRes.hash, message: 'Waiting for ledger inclusion...' });
        let txStatus = await server.getTransaction(sendRes.hash);
        while (txStatus.status === rpc.Api.GetTransactionStatus.NOT_FOUND) {
          await new Promise(r => setTimeout(r, 1500));
          txStatus = await server.getTransaction(sendRes.hash);
        }

        if (txStatus.status === rpc.Api.GetTransactionStatus.SUCCESS) {
          setTxState({ status: 'SUCCESS', txHash: sendRes.hash, message: `Bid of +${additionNum} XLM placed successfully!` });
          showToast('success', 'Bid Placed!', `Your cumulative bid is now ${currentTotalWithAddition} XLM.`);
          confetti({ particleCount: 80, spread: 60, origin: { y: 0.7 } });
          setShowBidModal(false);
          setBidAddition('');
          await loadAuctionDetails();
          await refreshUserInfo();
        } else {
          throw new Error('Bid invocation failed on-chain.');
        }
      }
    } catch (err: any) {
      console.error("Bid error:", err);
      const parsedErr = parseContractError(err);
      setBidError(parsedErr);
      setTxState({ status: 'FAILED', error: parsedErr });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleFinalizeAuction = async () => {
    if (!address || !auction) return;
    setTxState({ status: 'SIMULATING', message: 'Finalizing auction on Soroban...' });
    try {
      const server = new rpc.Server(RPC_URL);
      const contract = new Contract(CONTRACT_ID);
      const account = await server.getAccount(address);

      const tx = await server.prepareTransaction(
        new TransactionBuilder(account, { fee: '200000', networkPassphrase: NETWORK_PASSPHRASE })
          .addOperation(
            contract.call('finalize_auction', new Address(address).toScVal(), xdr.ScVal.scvU64(new xdr.Uint64(auction.id)))
          )
          .setTimeout(30)
          .build()
      );

      setTxState({ status: 'SIGNING', message: 'Confirm finalization in wallet...' });
      const sendRes = await signAndSend(server, tx);

      if (sendRes.status === 'PENDING') {
        setTxState({ status: 'PENDING', txHash: sendRes.hash, message: 'Processing payout...' });
        let txStatus = await server.getTransaction(sendRes.hash);
        while (txStatus.status === rpc.Api.GetTransactionStatus.NOT_FOUND) {
          await new Promise(r => setTimeout(r, 1500));
          txStatus = await server.getTransaction(sendRes.hash);
        }
        if (txStatus.status === rpc.Api.GetTransactionStatus.SUCCESS) {
          setTxState({ status: 'SUCCESS', txHash: sendRes.hash, message: 'Auction finalized and funds transferred to creator!' });
          showToast('success', 'Auction Finalized!', 'Winning payout completed.');
          await loadAuctionDetails();
        }
      }
    } catch (err: any) {
      const parsedErr = parseContractError(err);
      setTxState({ status: 'FAILED', error: parsedErr });
    }
  };

  const handleClaimRefund = async () => {
    if (!address || !auction) return;
    setTxState({ status: 'SIMULATING', message: 'Reclaiming escrowed XLM...' });
    try {
      const server = new rpc.Server(RPC_URL);
      const contract = new Contract(CONTRACT_ID);
      const account = await server.getAccount(address);

      const tx = await server.prepareTransaction(
        new TransactionBuilder(account, { fee: '200000', networkPassphrase: NETWORK_PASSPHRASE })
          .addOperation(
            contract.call('claim_refund', new Address(address).toScVal(), xdr.ScVal.scvU64(new xdr.Uint64(auction.id)))
          )
          .setTimeout(30)
          .build()
      );

      setTxState({ status: 'SIGNING', message: 'Confirm refund request in wallet...' });
      const sendRes = await signAndSend(server, tx);

      if (sendRes.status === 'PENDING') {
        setTxState({ status: 'PENDING', txHash: sendRes.hash, message: 'Refunding XLM to your wallet...' });
        let txStatus = await server.getTransaction(sendRes.hash);
        while (txStatus.status === rpc.Api.GetTransactionStatus.NOT_FOUND) {
          await new Promise(r => setTimeout(r, 1500));
          txStatus = await server.getTransaction(sendRes.hash);
        }
        if (txStatus.status === rpc.Api.GetTransactionStatus.SUCCESS) {
          setTxState({ status: 'SUCCESS', txHash: sendRes.hash, message: `Refund of ${userDeposit} XLM completed!` });
          showToast('success', 'Refund Claimed!', `${userDeposit} XLM returned to your wallet.`);
          await loadAuctionDetails();
          await refreshUserInfo();
        }
      }
    } catch (err: any) {
      const parsedErr = parseContractError(err);
      setTxState({ status: 'FAILED', error: parsedErr });
    }
  };

  return (
    <div className="space-y-8 max-w-5xl mx-auto">
      <Link to="/" className="inline-flex items-center gap-2 text-xs font-semibold text-slate-400 hover:text-white transition-colors">
        <ArrowLeft className="w-4 h-4" /> Back to All Auctions
      </Link>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        <div className="lg:col-span-7 space-y-6">
          <div className="glass-card rounded-3xl overflow-hidden border border-white/10 bg-dark-card/90">
            <img
              src={resolveIpfsUrl(auction.mediaUrl)}
              alt={auction.title}
              className="w-full max-h-[450px] object-cover"
              onError={(e) => {
                (e.target as HTMLImageElement).src = 'https://placehold.co/800x600/121420/8b5cf6?text=Auction+Item';
              }}
            />
          </div>

          <div className="glass-card p-6 rounded-3xl border border-white/10 space-y-4">
            <div className="flex items-center justify-between">
              <AuctionStatusBadge status={auction.status} />
              <span className="text-xs text-slate-400 font-mono">ID: #{auction.id}</span>
            </div>

            <h1 className="text-2xl sm:text-3xl font-extrabold text-white">{auction.title}</h1>
            <p className="text-slate-300 text-sm leading-relaxed whitespace-pre-line">{auction.description}</p>

            <div className="pt-4 border-t border-white/5 flex items-center justify-between text-xs text-slate-400">
              <div className="flex items-center gap-2">
                <User className="w-4 h-4 text-brand-400" />
                <span>Created by <span className="font-mono text-slate-200 font-bold">{shortenAddress(auction.creator)}</span></span>
              </div>
              <a href={resolveIpfsUrl(auction.mediaUrl)} target="_blank" rel="noreferrer" className="text-brand-400 hover:underline">
                IPFS Source Link
              </a>
            </div>
          </div>
        </div>

        <div className="lg:col-span-5 space-y-6">
          <AuctionTimer endTime={auction.endTime} />

          <div className="glass-card p-6 rounded-3xl border border-white/10 space-y-4 bg-gradient-to-br from-dark-card to-brand-900/20">
            <div className="flex items-center justify-between">
              <span className="text-xs uppercase tracking-wider font-bold text-slate-400">Current Highest Bid</span>
              <span className="text-xs text-brand-400 font-semibold">{auction.totalBids} Bids</span>
            </div>

            <div className="text-3xl sm:text-4xl font-black text-white flex items-center gap-2">
              <TrendingUp className="w-8 h-8 text-emerald-400" />
              {formatXlm(auction.totalBids > 0 ? auction.highestBid : auction.startingBid)}
            </div>

            <div className="grid grid-cols-2 gap-2 pt-2 text-xs">
              <div className="bg-white/5 p-2.5 rounded-xl">
                <span className="text-slate-400 block">Starting Bid</span>
                <span className="font-bold text-white">{formatXlm(auction.startingBid)}</span>
              </div>
              <div className="bg-white/5 p-2.5 rounded-xl">
                <span className="text-slate-400 block">Min Increment</span>
                <span className="font-bold text-brand-400">+{formatXlm(auction.minIncrement)}</span>
              </div>
            </div>

            {address && userDeposit > 0 && (
              <div className="p-3.5 rounded-xl bg-brand-500/10 border border-brand-500/30 flex items-center justify-between">
                <div className="flex items-center gap-2 text-xs text-slate-300">
                  <Coins className="w-4 h-4 text-brand-400" /> Your Cumulative Escrow:
                </div>
                <span className="text-sm font-extrabold text-white">{formatXlm(userDeposit)}</span>
              </div>
            )}

            {auction.status === 'Approved' && !isExpired && (
              <button
                onClick={() => {
                  if (!address) {
                    showToast('info', 'Connect Wallet', 'Please connect your wallet to place a bid.');
                    return;
                  }
                  if (!isRegistered) {
                    showToast('info', 'Claim Username First', 'Please claim your username in the navbar to bid.');
                    return;
                  }
                  setShowBidModal(true);
                }}
                disabled={Boolean(isCreator)}
                className="w-full py-4 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 font-black text-base rounded-2xl shadow-lg shadow-emerald-500/25 transition-all flex items-center justify-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <Gavel className="w-5 h-5" />
                {isCreator ? 'Cannot Bid On Own Auction' : 'Place / Add To Bid'}
              </button>
            )}

            {auction.status === 'Approved' && isExpired && (
              <div className="space-y-3 pt-2">
                <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-center">
                  <Trophy className="w-8 h-8 text-amber-400 mx-auto mb-2" />
                  <h4 className="text-sm font-bold text-white">Auction Finished</h4>
                  <p className="text-xs text-slate-300 mt-1">
                    Winner: <span className="font-mono text-amber-400 font-bold">{shortenAddress(auction.highestBidder)}</span>
                  </p>
                </div>

                <button
                  onClick={handleFinalizeAuction}
                  className="w-full py-3 bg-brand-600 hover:bg-brand-500 text-white font-bold rounded-xl text-xs transition-all"
                >
                  Finalize Auction & Transfer Winning Funds
                </button>
              </div>
            )}

            {auction.status === 'Ended' && isLoser && (
              <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-center space-y-3">
                <p className="text-xs text-slate-300">You have <span className="font-bold text-white">{formatXlm(userDeposit)}</span> in escrow available for refund.</p>
                <button
                  onClick={handleClaimRefund}
                  className="w-full py-3 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-extrabold rounded-xl text-xs shadow-lg shadow-emerald-500/20 transition-all"
                >
                  Claim Full Escrow Refund
                </button>
              </div>
            )}

            {auction.status === 'Pending' && (
              <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-center text-xs text-amber-300 font-medium">
                This auction is awaiting reviewer approval before bidding opens.
              </div>
            )}
          </div>

          <BidHistory highestBid={auction.highestBid} highestBidder={auction.highestBidder} totalBids={auction.totalBids} />
        </div>
      </div>

      <Modal isOpen={showBidModal} onClose={() => setShowBidModal(false)} title="Place / Increase Cumulative Bid">
        <form onSubmit={handlePlaceBidSubmit} className="space-y-4">
          <div className="p-3.5 rounded-xl bg-white/5 border border-white/5 space-y-2 text-xs text-slate-300">
            <div className="flex justify-between">
              <span>Your Current Escrow:</span>
              <span className="font-bold text-white">{formatXlm(userDeposit)}</span>
            </div>
            <div className="flex justify-between">
              <span>Required Total Target:</span>
              <span className="font-bold text-emerald-400">At least {formatXlm(minRequiredTotal)}</span>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
              Additional XLM to Add to Escrow
            </label>
            <div className="relative">
              <input
                type="number"
                step="0.1"
                value={bidAddition}
                onChange={(e) => setBidAddition(e.target.value)}
                placeholder={`e.g. ${(minRequiredTotal - userDeposit).toFixed(1)}`}
                disabled={isSubmitting}
                className="glass-input w-full px-4 py-3 rounded-xl text-lg font-bold"
              />
              <span className="absolute right-4 top-3.5 text-xs font-bold text-slate-400">XLM</span>
            </div>
            <p className="text-[11px] text-slate-400 mt-1.5 flex justify-between">
              <span>Wallet Available: {balance.toFixed(2)} XLM</span>
              <span>New Cumulative: <strong className="text-white">{currentTotalWithAddition.toFixed(2)} XLM</strong></span>
            </p>
          </div>

          {bidError && (
            <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs font-medium flex items-start gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{bidError}</span>
            </div>
          )}

          <button
            type="submit"
            disabled={isSubmitting || !bidAddition}
            className="w-full py-3.5 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 font-black text-sm rounded-xl shadow-lg shadow-emerald-500/25 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
          >
            <Gavel className="w-4 h-4" />
            {isSubmitting ? 'Escrowing XLM...' : `Confirm +${bidAddition || 0} XLM Bid Addition`}
          </button>
        </form>
      </Modal>
    </div>
  );
};
