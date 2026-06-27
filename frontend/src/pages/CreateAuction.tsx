import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useWallet } from '../context/WalletContext';
import { useToast } from '../context/ToastContext';
import { xlmToStroops, resolveIpfsUrl } from '../utils/formatters';
import { parseContractError } from '../utils/errors';
import { Gavel, Image as ImageIcon, Sparkles, AlertCircle } from 'lucide-react';
import { rpc, Contract, TransactionBuilder, Address, xdr } from '@stellar/stellar-sdk';
import { CONTRACT_ID, NETWORK_PASSPHRASE, RPC_URL } from '../utils/constants';
import { WalletService } from '../services/wallet';

export const CreateAuction: React.FC = () => {
  const navigate = useNavigate();
  const { address, isRegistered, connect } = useWallet();
  const { setTxState, showToast } = useToast();

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [mediaUrl, setMediaUrl] = useState('');
  const [startingBid, setStartingBid] = useState('10');
  const [minIncrement, setMinIncrement] = useState('1');
  const [durationHours, setDurationHours] = useState('24');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!address) {
    return (
      <div className="glass-card max-w-lg mx-auto p-10 rounded-3xl text-center border border-white/10 space-y-4 my-12">
        <Gavel className="w-12 h-12 text-brand-400 mx-auto" />
        <h2 className="text-2xl font-bold text-white">Connect Wallet Required</h2>
        <p className="text-slate-400 text-sm">You must connect your Stellar wallet to create an auction on Soroban.</p>
        <button onClick={connect} className="px-6 py-3 bg-brand-600 hover:bg-brand-500 text-white font-bold rounded-xl text-sm transition-all">
          Connect Wallet
        </button>
      </div>
    );
  }

  if (!isRegistered) {
    return (
      <div className="glass-card max-w-lg mx-auto p-10 rounded-3xl text-center border border-amber-500/20 bg-amber-500/5 space-y-4 my-12">
        <Sparkles className="w-12 h-12 text-amber-400 mx-auto animate-pulse" />
        <h2 className="text-2xl font-bold text-white">Claim Username Required</h2>
        <p className="text-slate-300 text-sm">Please claim your unique on-chain username in the top navbar before creating auctions.</p>
      </div>
    );
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!address) return;

    const startXlm = Number(startingBid);
    const incXlm = Number(minIncrement);
    const hours = Number(durationHours);

    if (!title.trim() || !description.trim() || !mediaUrl.trim()) {
      setError('All fields are required.');
      return;
    }
    if (isNaN(startXlm) || startXlm <= 0 || isNaN(incXlm) || incXlm <= 0) {
      setError('Starting bid and minimum increment must be positive numbers.');
      return;
    }

    const endTimeUnix = Math.floor(Date.now() / 1000) + Math.round(hours * 3600);

    setIsSubmitting(true);
    setError(null);
    setTxState({ status: 'SIMULATING', message: 'Simulating auction creation on Soroban...' });

    try {
      const server = new rpc.Server(RPC_URL);
      const contract = new Contract(CONTRACT_ID);
      const account = await server.getAccount(address);

      const startStroops = xlmToStroops(startXlm);
      const incStroops = xlmToStroops(incXlm);

      const tx = await server.prepareTransaction(
        new TransactionBuilder(account, { fee: '200000', networkPassphrase: NETWORK_PASSPHRASE })
          .addOperation(
            contract.call(
              'create_auction',
              new Address(address).toScVal(),
              xdr.ScVal.scvString(title.trim()),
              xdr.ScVal.scvString(description.trim()),
              xdr.ScVal.scvString(mediaUrl.trim()),
              xdr.ScVal.scvI128(new (xdr as any).Int128([BigInt(0), startStroops])),
              xdr.ScVal.scvI128(new (xdr as any).Int128([BigInt(0), incStroops])),
              xdr.ScVal.scvU64(new xdr.Uint64(endTimeUnix))
            )
          )
          .setTimeout(30)
          .build()
      );

      setTxState({ status: 'SIGNING', message: 'Please confirm auction submission in your wallet...' });

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

      setTxState({ status: 'SUBMITTING', message: 'Broadcasting new auction to Stellar network...' });

      const signedTx = TransactionBuilder.fromXDR(signedXdr, NETWORK_PASSPHRASE);
      const sendRes = await server.sendTransaction(signedTx);

      if (sendRes.status === 'PENDING') {
        setTxState({ status: 'PENDING', txHash: sendRes.hash, message: 'Waiting for ledger confirmation...' });
        let txStatus = await server.getTransaction(sendRes.hash);
        while (txStatus.status === rpc.Api.GetTransactionStatus.NOT_FOUND) {
          await new Promise(r => setTimeout(r, 1500));
          txStatus = await server.getTransaction(sendRes.hash);
        }

        if (txStatus.status === rpc.Api.GetTransactionStatus.SUCCESS) {
          setTxState({ status: 'SUCCESS', txHash: sendRes.hash, message: 'Auction submitted for reviewer approval!' });
          showToast('success', 'Auction Submitted!', 'Your auction is now pending reviewer approval.');
          navigate('/profile');
        } else {
          throw new Error('Transaction execution failed');
        }
      }
    } catch (err: any) {
      console.error("Create auction error:", err);
      const parsedErr = parseContractError(err);
      setError(parsedErr);
      setTxState({ status: 'FAILED', error: parsedErr });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <div>
        <h1 className="text-3xl font-extrabold text-white">Create New Auction</h1>
        <p className="text-slate-400 text-sm">Submit your item to the StellarBid platform. Begins in Pending status.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        <form onSubmit={handleSubmit} className="lg:col-span-7 space-y-6 glass-card p-6 sm:p-8 rounded-3xl border border-white/10">
          <div>
            <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">Item Title</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Rare Cyberpunk NFT Artwork"
              disabled={isSubmitting}
              className="glass-input w-full px-4 py-3 rounded-xl text-sm font-semibold"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">Description</label>
            <textarea
              rows={4}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Describe the item, provenance, and details..."
              disabled={isSubmitting}
              className="glass-input w-full px-4 py-3 rounded-xl text-sm font-normal"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">IPFS Media URL (Image/Video)</label>
            <input
              type="text"
              value={mediaUrl}
              onChange={(e) => setMediaUrl(e.target.value)}
              placeholder="ipfs://Qm... or https://..."
              disabled={isSubmitting}
              className="glass-input w-full px-4 py-3 rounded-xl text-sm font-mono"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">Starting Bid (XLM)</label>
              <input
                type="number"
                step="1"
                value={startingBid}
                onChange={(e) => setStartingBid(e.target.value)}
                disabled={isSubmitting}
                className="glass-input w-full px-4 py-3 rounded-xl text-sm font-bold text-emerald-400"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">Min Increment (XLM)</label>
              <input
                type="number"
                step="0.5"
                value={minIncrement}
                onChange={(e) => setMinIncrement(e.target.value)}
                disabled={isSubmitting}
                className="glass-input w-full px-4 py-3 rounded-xl text-sm font-bold text-brand-400"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">Duration (Hours)</label>
            <select
              value={durationHours}
              onChange={(e) => setDurationHours(e.target.value)}
              disabled={isSubmitting}
              className="glass-input w-full px-4 py-3 rounded-xl text-sm font-semibold"
            >
              <option value="1" className="bg-dark-card">1 Hour (Fast Test)</option>
              <option value="12" className="bg-dark-card">12 Hours</option>
              <option value="24" className="bg-dark-card">24 Hours (1 Day)</option>
              <option value="72" className="bg-dark-card">72 Hours (3 Days)</option>
            </select>
          </div>

          {error && (
            <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs font-medium flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full py-4 bg-gradient-to-r from-brand-600 to-brand-accent hover:from-brand-500 hover:to-brand-accent/90 text-white font-extrabold text-sm rounded-2xl shadow-lg shadow-brand-500/25 transition-all flex items-center justify-center gap-2"
          >
            <Gavel className="w-5 h-5" />
            {isSubmitting ? 'Submitting to Soroban...' : 'Create Auction On-Chain'}
          </button>
        </form>

        <div className="lg:col-span-5 space-y-4">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">Live Preview</h3>
          <div className="glass-card rounded-2xl border border-white/10 overflow-hidden bg-dark-card">
            <div className="h-48 w-full bg-slate-900 overflow-hidden">
              {mediaUrl ? (
                <img src={resolveIpfsUrl(mediaUrl)} alt="Preview" className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex flex-col items-center justify-center text-slate-600 gap-2">
                  <ImageIcon className="w-8 h-8" />
                  <span className="text-xs">Media Preview</span>
                </div>
              )}
            </div>
            <div className="p-5 space-y-3">
              <h4 className="text-lg font-bold text-white">{title || 'Auction Title'}</h4>
              <p className="text-xs text-slate-400 line-clamp-2">{description || 'Item description will appear here...'}</p>
              <div className="pt-3 border-t border-white/5 flex justify-between items-end">
                <div>
                  <span className="text-[10px] text-slate-400 uppercase">Starting Bid</span>
                  <span className="text-base font-extrabold text-emerald-400 block">{startingBid || 0} XLM</span>
                </div>
                <span className="text-xs text-brand-400 font-bold">+{minIncrement || 0} Min Inc</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
