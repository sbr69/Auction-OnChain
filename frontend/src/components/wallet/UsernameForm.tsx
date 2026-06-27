import React, { useState } from 'react';
import { useWallet } from '../../context/WalletContext';
import { useToast } from '../../context/ToastContext';
import { CONTRACT_ID, NETWORK_PASSPHRASE, RPC_URL } from '../../utils/constants';
import { parseContractError } from '../../utils/errors';
import { WalletService } from '../../services/wallet';
import { UserCheck, Sparkles, AlertCircle } from 'lucide-react';
import { rpc, Contract, TransactionBuilder, Address, xdr } from '@stellar/stellar-sdk';

export const UsernameForm: React.FC<{ onSuccess?: () => void }> = ({ onSuccess }) => {
  const { address, refreshUserInfo } = useWallet();
  const { setTxState, showToast } = useToast();
  const [desiredUsername, setDesiredUsername] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!address) return;
    
    const cleanName = desiredUsername.trim();
    if (cleanName.length < 3 || cleanName.length > 20) {
      setError('Username must be between 3 and 20 characters.');
      return;
    }

    setIsSubmitting(true);
    setError(null);
    setTxState({ status: 'SIMULATING', message: 'Preparing username registration on Stellar Testnet...' });

    try {
      const server = new rpc.Server(RPC_URL);
      const contract = new Contract(CONTRACT_ID);
      const account = await server.getAccount(address);

      const tx = await server.prepareTransaction(
        new TransactionBuilder(account, { fee: '100000', networkPassphrase: NETWORK_PASSPHRASE })
          .addOperation(
            contract.call('register_user', new Address(address).toScVal(), xdr.ScVal.scvString(cleanName))
          )
          .setTimeout(30)
          .build()
      );

      setTxState({ status: 'SIGNING', message: 'Please sign username registration in your Stellar wallet...' });
      
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

      setTxState({ status: 'SUBMITTING', message: 'Broadcasting registration to network...' });
      
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
          setTxState({ status: 'SUCCESS', txHash: sendRes.hash, message: `Username "${cleanName}" permanently claimed on-chain!` });
          showToast('success', 'Username Registered!', `You are now known as @${cleanName}`);
          await refreshUserInfo();
          if (onSuccess) onSuccess();
        } else {
          throw new Error('Transaction execution failed on-chain');
        }
      } else {
        throw new Error('Failed to submit transaction to RPC');
      }
    } catch (err: any) {
      console.error("Registration error:", err);
      const parsedErr = parseContractError(err);
      setError(parsedErr);
      setTxState({ status: 'FAILED', error: parsedErr });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="glass-card p-6 rounded-2xl border border-brand-500/30 shadow-glow-purple bg-gradient-to-br from-brand-900/40 via-dark-card to-dark-bg">
      <div className="flex items-center gap-3 mb-4">
        <div className="w-10 h-10 rounded-xl bg-brand-500/20 border border-brand-500/40 flex items-center justify-center text-brand-400">
          <Sparkles className="w-5 h-5 animate-pulse" />
        </div>
        <div>
          <h3 className="text-lg font-bold text-white">Claim On-Chain Username</h3>
          <p className="text-xs text-slate-400">One-time registration permanently linked to your wallet.</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
            Desired Identity
          </label>
          <div className="relative">
            <span className="absolute left-3.5 top-3 text-slate-400 font-semibold">@</span>
            <input
              type="text"
              value={desiredUsername}
              onChange={(e) => setDesiredUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))}
              placeholder="sbr_trader"
              disabled={isSubmitting}
              className="glass-input w-full pl-8 pr-4 py-2.5 rounded-xl text-sm font-semibold tracking-wide placeholder:text-slate-600"
            />
          </div>
          <p className="text-[11px] text-slate-500 mt-1.5">
            3-20 lowercase characters (a-z, 0-9, underscores). Immutable once registered.
          </p>
        </div>

        {error && (
          <div className="flex items-center gap-2 p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs font-medium">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <button
          type="submit"
          disabled={isSubmitting || desiredUsername.trim().length < 3}
          className="w-full py-3 bg-gradient-to-r from-brand-600 to-brand-accent hover:from-brand-500 hover:to-brand-accent/90 text-white font-bold rounded-xl shadow-lg shadow-brand-500/25 transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <UserCheck className="w-4 h-4" />
          {isSubmitting ? 'Claiming on Soroban...' : 'Claim Permanent Username'}
        </button>
      </form>
    </div>
  );
};
