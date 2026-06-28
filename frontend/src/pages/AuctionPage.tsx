import { useState, useEffect, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useWallet } from '../context/WalletContext';
import { useToast } from '../context/ToastContext';
import { fetchAuction, fetchUserBidDeposit } from '../services/contract';
import { EventPoller } from '../services/events';
import { Auction } from '../types';
import { formatTimeRemaining, formatXlm, resolveIpfsUrl, shortenAddress, xlmToStroops } from '../utils/formatters';
import { parseContractError } from '../utils/errors';
import { WalletService } from '../services/wallet';
import { signTransactionWithKit } from '../services/transactionHelper';
import { rpc, Contract, TransactionBuilder, Address, xdr } from '@stellar/stellar-sdk';
import { CONTRACT_ID, NETWORK_PASSPHRASE, RPC_URL } from '../utils/constants';
import { Gavel, Clock, ArrowLeft, Trophy, Coins, AlertCircle, RefreshCcw, ExternalLink } from 'lucide-react';

export function AuctionPage() {
  const { id } = useParams<{ id: string }>();
  const { address, isRegistered, balance } = useWallet();
  const { showToast, setTxState } = useToast();

  const [auction, setAuction] = useState<Auction | null>(null);
  const [userDeposit, setUserDeposit] = useState(0);
  const [loading, setLoading] = useState(true);
  const [showBidModal, setShowBidModal] = useState(false);
  const [bidAddition, setBidAddition] = useState('');
  const [bidError, setBidError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [timeStr, setTimeStr] = useState('');
  const [isExpired, setIsExpired] = useState(false);

  const auctionId = parseInt(id || '0');

  const loadData = useCallback(async () => {
    try {
      const auc = await fetchAuction(auctionId);
      setAuction(auc);
      if (address && auc) {
        const dep = await fetchUserBidDeposit(auc.id, address);
        setUserDeposit(dep);
      }
    } catch (err) {
      console.error('Failed to load auction:', err);
    } finally {
      setLoading(false);
    }
  }, [auctionId, address]);

  useEffect(() => {
    loadData();
    const unsub = EventPoller.subscribe(() => loadData());
    return () => unsub();
  }, [loadData]);

  useEffect(() => {
    if (!auction) return;
    const tick = () => {
      const tr = formatTimeRemaining(auction.endTime);
      setIsExpired(tr.isExpired);
      if (tr.isExpired) {
        setTimeStr('Ended');
      } else if (tr.days > 0) {
        setTimeStr(`${tr.days}d ${tr.hours}h ${tr.minutes}m`);
      } else if (tr.hours > 0) {
        setTimeStr(`${tr.hours}h ${tr.minutes}m ${tr.seconds}s`);
      } else {
        setTimeStr(`${tr.minutes}m ${tr.seconds}s`);
      }
    };
    tick();
    const timer = setInterval(tick, 1000);
    return () => clearInterval(timer);
  }, [auction]);

  if (loading) {
    return (
      <div className="py-12 flex justify-center">
        <div className="w-8 h-8 border-2 border-brand-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!auction) {
    return (
      <div className="py-20 text-center">
        <h2 className="text-2xl font-serif text-brand-900 mb-3">Auction Not Found</h2>
        <p className="text-brand-600 mb-6">This auction doesn't exist on-chain.</p>
        <Link to="/explore" className="px-6 py-3 bg-brand-900 text-surface rounded-full font-medium">Back to Explore</Link>
      </div>
    );
  }

  const isCreator = address && auction.creator.toUpperCase() === address.toUpperCase();
  const isWinner = address && auction.highestBidder.toUpperCase() === address.toUpperCase();
  const isLoser = address && !isWinner && userDeposit > 0 && auction.status === 'Ended';

  const minRequiredTotal = auction.totalBids > 0
    ? auction.highestBid + auction.minIncrement
    : auction.startingBid;

  const currentTotalWithAddition = userDeposit + parseFloat(bidAddition || '0');

  const handlePlaceBid = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!address || !bidAddition) return;
    setBidError('');
    setIsSubmitting(true);

    const additionXlm = parseFloat(bidAddition);
    const newTotal = userDeposit + additionXlm;

    if (newTotal < minRequiredTotal) {
      setBidError(`Your total deposit (${newTotal.toFixed(2)} XLM) must be at least ${minRequiredTotal.toFixed(2)} XLM`);
      setIsSubmitting(false);
      return;
    }

    try {
      const additionStroops = xlmToStroops(additionXlm);
      setTxState({ status: 'SIMULATING', message: 'Simulating bid...' });

      const server = new rpc.Server(RPC_URL);
      const contract = new Contract(CONTRACT_ID);
      const account = await server.getAccount(address);

      const tx = await server.prepareTransaction(
        new TransactionBuilder(account, { fee: '200000', networkPassphrase: NETWORK_PASSPHRASE })
          .addOperation(
            contract.call(
              'place_bid',
              new Address(address).toScVal(),
              xdr.ScVal.scvU64(new xdr.Uint64(auctionId)),
              xdr.ScVal.scvI128(new xdr.Int128Parts({
                lo: new xdr.Uint64(additionStroops & BigInt('0xFFFFFFFFFFFFFFFF')),
                hi: new xdr.Int64(additionStroops >> BigInt(64)),
              }))
            )
          )
          .setTimeout(30)
          .build()
      );

      setTxState({ status: 'SIGNING', message: 'Confirm bid in wallet...' });
      const signedXdr = await signTransactionWithKit(tx.toXDR(), address);

      setTxState({ status: 'SUBMITTING', message: 'Escrowing XLM on-chain...' });
      const signedTx = TransactionBuilder.fromXDR(signedXdr, NETWORK_PASSPHRASE);
      const sendRes = await server.sendTransaction(signedTx);

      if (sendRes.status === 'PENDING') {
        setTxState({ status: 'PENDING', txHash: sendRes.hash, message: 'Waiting for confirmation...' });
        let txStatus = await server.getTransaction(sendRes.hash);
        while (txStatus.status === rpc.Api.GetTransactionStatus.NOT_FOUND) {
          await new Promise(r => setTimeout(r, 1500));
          txStatus = await server.getTransaction(sendRes.hash);
        }

        if (txStatus.status === rpc.Api.GetTransactionStatus.SUCCESS) {
          setTxState({ status: 'SUCCESS', txHash: sendRes.hash, message: 'Bid placed!' });
          showToast('success', 'Bid Placed!', `Successfully added ${additionXlm} XLM to escrow.`);
          setShowBidModal(false);
          setBidAddition('');
          await loadData();
        } else {
          throw new Error('Transaction failed');
        }
      }
    } catch (err: any) {
      const parsed = parseContractError(err);
      setBidError(parsed);
      setTxState({ status: 'FAILED', error: parsed });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleFinalize = async () => {
    if (!address) return;
    setIsSubmitting(true);
    try {
      setTxState({ status: 'SIMULATING', message: 'Simulating finalization...' });
      const server = new rpc.Server(RPC_URL);
      const contract = new Contract(CONTRACT_ID);
      const account = await server.getAccount(address);

      const tx = await server.prepareTransaction(
        new TransactionBuilder(account, { fee: '200000', networkPassphrase: NETWORK_PASSPHRASE })
          .addOperation(
            contract.call(
              'finalize_auction',
              new Address(address).toScVal(),
              xdr.ScVal.scvU64(new xdr.Uint64(auctionId))
            )
          )
          .setTimeout(30)
          .build()
      );

      setTxState({ status: 'SIGNING', message: 'Confirm in wallet...' });
      const signedXdr = await signTransactionWithKit(tx.toXDR(), address);

      setTxState({ status: 'SUBMITTING', message: 'Finalizing auction...' });
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
          setTxState({ status: 'SUCCESS', txHash: sendRes.hash, message: 'Auction finalized!' });
          showToast('success', 'Auction Finalized!', 'Winning funds have been transferred.');
          await loadData();
        }
      }
    } catch (err: any) {
      const parsed = parseContractError(err);
      setTxState({ status: 'FAILED', error: parsed });
      showToast('error', 'Finalization Failed', parsed);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClaimRefund = async () => {
    if (!address) return;
    setIsSubmitting(true);
    try {
      setTxState({ status: 'SIMULATING', message: 'Simulating refund claim...' });
      const server = new rpc.Server(RPC_URL);
      const contract = new Contract(CONTRACT_ID);
      const account = await server.getAccount(address);

      const tx = await server.prepareTransaction(
        new TransactionBuilder(account, { fee: '200000', networkPassphrase: NETWORK_PASSPHRASE })
          .addOperation(
            contract.call(
              'claim_refund',
              new Address(address).toScVal(),
              xdr.ScVal.scvU64(new xdr.Uint64(auctionId))
            )
          )
          .setTimeout(30)
          .build()
      );

      setTxState({ status: 'SIGNING', message: 'Confirm in wallet...' });
      const signedXdr = await signTransactionWithKit(tx.toXDR(), address);

      setTxState({ status: 'SUBMITTING', message: 'Claiming refund...' });
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
          setTxState({ status: 'SUCCESS', txHash: sendRes.hash, message: 'Refund claimed!' });
          showToast('success', 'Refund Claimed!', `${formatXlm(userDeposit)} returned to your wallet.`);
          await loadData();
        }
      }
    } catch (err: any) {
      const parsed = parseContractError(err);
      setTxState({ status: 'FAILED', error: parsed });
      showToast('error', 'Refund Failed', parsed);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="py-12 max-w-6xl mx-auto">
      <Link to="/explore" className="inline-flex items-center gap-2 text-sm font-medium text-brand-600 hover:text-brand-900 transition-colors mb-8">
        <ArrowLeft className="w-4 h-4" />
        Back to Marketplace
      </Link>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Left: Image & Description */}
        <div className="lg:col-span-7 space-y-6">
          <div className="rounded-2xl overflow-hidden border border-border shadow-sm">
            <img
              src={resolveIpfsUrl(auction.mediaUrl)}
              alt={auction.title}
              className="w-full h-80 lg:h-[450px] object-cover"
            />
          </div>

          <div className="bg-surface rounded-2xl border border-border p-8">
            <h1 className="text-3xl font-serif text-brand-900 mb-4">{auction.title}</h1>
            <p className="text-brand-600 leading-relaxed mb-6">{auction.description}</p>
            <div className="flex items-center gap-4 text-sm text-brand-500">
              <span>Created by <span className="font-mono text-brand-900">{shortenAddress(auction.creator, 6)}</span></span>
              <span>•</span>
              <span>Auction #{auction.id}</span>
            </div>
          </div>
        </div>

        {/* Right: Bid Panel */}
        <div className="lg:col-span-5 space-y-6">
          {/* Timer */}
          <div className="bg-surface rounded-2xl border border-border p-6 text-center">
            <div className="flex items-center justify-center gap-2 text-brand-500 text-sm font-medium mb-2">
              <Clock className="w-4 h-4" />
              {isExpired ? 'Auction has ended' : 'Time Remaining'}
            </div>
            <p className="text-3xl font-mono font-bold text-brand-900">{timeStr}</p>
          </div>

          {/* Bid Info */}
          <div className="bg-surface rounded-2xl border border-border p-6 space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-xs uppercase tracking-wider font-semibold text-brand-500">Current Highest Bid</span>
              <span className="text-xs text-brand-500 font-semibold">{auction.totalBids} Bids</span>
            </div>

            <p className="text-3xl font-mono font-bold text-brand-900">
              {auction.totalBids > 0 ? formatXlm(auction.highestBid) : formatXlm(auction.startingBid)}
            </p>

            <div className="grid grid-cols-2 gap-3 pt-2 text-sm">
              <div className="bg-brand-50 p-3 rounded-xl">
                <span className="text-brand-500 text-xs block">Starting Bid</span>
                <span className="font-mono font-semibold text-brand-900">{formatXlm(auction.startingBid)}</span>
              </div>
              <div className="bg-brand-50 p-3 rounded-xl">
                <span className="text-brand-500 text-xs block">Min Increment</span>
                <span className="font-mono font-semibold text-brand-900">+{formatXlm(auction.minIncrement)}</span>
              </div>
            </div>

            {address && userDeposit > 0 && (
              <div className="p-3.5 rounded-xl bg-brand-50 border border-brand-200 flex items-center justify-between">
                <div className="flex items-center gap-2 text-sm text-brand-600">
                  <Coins className="w-4 h-4 text-brand-500" /> Your Escrow:
                </div>
                <span className="text-sm font-mono font-bold text-brand-900">{formatXlm(userDeposit)}</span>
              </div>
            )}

            {/* Place Bid Button */}
            {auction.status === 'Approved' && !isExpired && (
              <button
                onClick={() => {
                  if (!address) {
                    showToast('info', 'Connect Wallet', 'Please connect your wallet to place a bid.');
                    return;
                  }
                  if (!isRegistered) {
                    showToast('info', 'Username Required', 'Please claim your username in the navbar to bid.');
                    return;
                  }
                  setShowBidModal(true);
                }}
                disabled={Boolean(isCreator) || isSubmitting}
                className="w-full py-4 bg-brand-900 hover:bg-brand-800 text-surface font-semibold text-base rounded-xl shadow-sm transition-all flex items-center justify-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <Gavel className="w-5 h-5" />
                {isCreator ? 'Cannot Bid On Own Auction' : 'Place / Add To Bid'}
              </button>
            )}

            {/* Finalize Button */}
            {auction.status === 'Approved' && isExpired && (
              <div className="space-y-3 pt-2">
                <div className="p-4 rounded-xl bg-brand-50 border border-brand-200 text-center">
                  <Trophy className="w-8 h-8 text-brand-600 mx-auto mb-2" />
                  <h4 className="text-sm font-semibold text-brand-900">Auction Finished</h4>
                  <p className="text-xs text-brand-600 mt-1">
                    Winner: <span className="font-mono font-bold">{shortenAddress(auction.highestBidder, 6)}</span>
                  </p>
                </div>
                <button
                  onClick={handleFinalize}
                  disabled={isSubmitting}
                  className="w-full py-3 bg-brand-900 hover:bg-brand-800 text-surface font-medium rounded-xl text-sm transition-all disabled:opacity-50"
                >
                  Finalize Auction & Transfer Winning Funds
                </button>
              </div>
            )}

            {/* Refund Button */}
            {isLoser && (
              <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-center space-y-3">
                <p className="text-sm text-brand-600">You have <span className="font-bold text-brand-900">{formatXlm(userDeposit)}</span> in escrow available for refund.</p>
                <button
                  onClick={handleClaimRefund}
                  disabled={isSubmitting}
                  className="w-full py-3 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold rounded-xl text-sm shadow-sm transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  <RefreshCcw className="w-4 h-4" />
                  Claim Full Escrow Refund
                </button>
              </div>
            )}

            {/* Winner badge */}
            {auction.status === 'Ended' && isWinner && (
              <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-center">
                <p className="font-semibold text-sm text-emerald-800 mb-1">🎉 You Won This Auction!</p>
                <p className="text-xs text-emerald-700">The asset is being transferred to your wallet.</p>
              </div>
            )}

            {/* Pending notice */}
            {auction.status === 'Pending' && (
              <div className="p-4 rounded-xl bg-amber-50 border border-amber-200 text-center text-sm text-amber-800 font-medium">
                This auction is awaiting reviewer approval before bidding opens.
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Bid Modal */}
      {showBidModal && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-brand-950/40 backdrop-blur-sm">
          <div className="bg-surface rounded-2xl border border-border w-full max-w-md shadow-xl overflow-hidden p-8">
            <h3 className="font-serif text-2xl font-medium text-brand-900 mb-6">Place / Increase Bid</h3>

            <form onSubmit={handlePlaceBid}>
              <div className="p-4 rounded-xl bg-brand-50 border border-brand-100 space-y-2 text-sm text-brand-600 mb-6">
                <div className="flex justify-between">
                  <span>Your Current Escrow:</span>
                  <span className="font-bold text-brand-900">{formatXlm(userDeposit)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Required Total:</span>
                  <span className="font-bold text-emerald-600">At least {formatXlm(minRequiredTotal)}</span>
                </div>
              </div>

              <div className="mb-6">
                <label className="block text-sm font-medium text-brand-900 mb-2">
                  Additional XLM to Add to Escrow
                </label>
                <div className="relative">
                  <input
                    type="number"
                    step="0.1"
                    value={bidAddition}
                    onChange={(e) => setBidAddition(e.target.value)}
                    placeholder={`e.g. ${Math.max(0, minRequiredTotal - userDeposit).toFixed(1)}`}
                    disabled={isSubmitting}
                    className="w-full px-4 py-3 bg-brand-50 border border-brand-200 rounded-xl text-brand-900 font-mono focus:outline-none focus:ring-2 focus:ring-brand-400 transition-all"
                  />
                  <span className="absolute right-4 top-1/2 -translate-y-1/2 text-xs font-semibold text-brand-400">XLM</span>
                </div>
                <p className="text-xs text-brand-500 mt-1.5 flex justify-between">
                  <span>Wallet: {balance.toFixed(2)} XLM</span>
                  <span>New Total: <strong className="text-brand-900">{currentTotalWithAddition.toFixed(2)} XLM</strong></span>
                </p>
              </div>

              {bidError && (
                <div className="mb-4 p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-medium flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>{bidError}</span>
                </div>
              )}

              <div className="flex gap-4">
                <button
                  type="button"
                  onClick={() => { setShowBidModal(false); setBidError(''); }}
                  disabled={isSubmitting}
                  className="flex-1 py-3 rounded-xl font-medium text-brand-600 hover:bg-brand-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting || !bidAddition}
                  className="flex-1 py-3 bg-brand-900 text-surface font-medium rounded-xl hover:bg-brand-800 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  <Gavel className="w-4 h-4" />
                  {isSubmitting ? 'Escrowing...' : `Add +${bidAddition || 0} XLM`}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
