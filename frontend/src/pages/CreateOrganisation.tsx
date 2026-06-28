import { useState } from 'react';
import { Building2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useWallet } from '../context/WalletContext';
import { useToast } from '../context/ToastContext';
import { parseContractError } from '../utils/errors';
import { WalletService } from '../services/wallet';
import { signTransactionWithKit } from '../services/transactionHelper';
import { rpc, Contract, TransactionBuilder, Address, xdr } from '@stellar/stellar-sdk';
import { CONTRACT_ID, NETWORK_PASSPHRASE, RPC_URL } from '../utils/constants';

export function CreateOrganisation() {
  const navigate = useNavigate();
  const { address, isRegistered } = useWallet();
  const { showToast, setTxState } = useToast();
  const { refreshOrgs } = useWallet();
  const [orgName, setOrgName] = useState('');
  const [orgDescription, setOrgDescription] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!address || !orgName.trim()) return;

    if (!isRegistered) {
      showToast('info', 'Username Required', 'Please claim your username in the navbar first.');
      return;
    }

    setIsSubmitting(true);
    try {
      setTxState({ status: 'SIMULATING', message: 'Preparing organisation creation...' });

      const server = new rpc.Server(RPC_URL);
      const contract = new Contract(CONTRACT_ID);
      const account = await server.getAccount(address);

      const tx = await server.prepareTransaction(
        new TransactionBuilder(account, { fee: '200000', networkPassphrase: NETWORK_PASSPHRASE })
          .addOperation(
            contract.call(
              'create_org',
              new Address(address).toScVal(),
              xdr.ScVal.scvString(orgName.trim()),
              xdr.ScVal.scvString(orgDescription.trim())
            )
          )
          .setTimeout(30)
          .build()
      );

      setTxState({ status: 'SIGNING', message: 'Confirm in wallet...' });
      const signedXdr = await signTransactionWithKit(tx.toXDR(), address);

      setTxState({ status: 'SUBMITTING', message: 'Creating organisation on-chain...' });
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
          setTxState({ status: 'SUCCESS', txHash: sendRes.hash, message: 'Organisation created!' });
          showToast('success', 'Organisation Created!', `"${orgName.trim()}" is now live on Soroban.`);
          await refreshOrgs();
          navigate('/admin');
        } else {
          throw new Error('Transaction failed');
        }
      }
    } catch (err: any) {
      const parsed = parseContractError(err);
      setTxState({ status: 'FAILED', error: parsed });
      showToast('error', 'Creation Failed', parsed);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!address) {
    return (
      <div className="max-w-xl mx-auto py-20 text-center">
        <div className="bg-surface p-8 rounded-2xl border border-border shadow-sm">
          <Building2 className="w-12 h-12 text-brand-600 mx-auto mb-4" />
          <h2 className="text-2xl font-serif text-brand-900 mb-3">Create an Organisation</h2>
          <p className="text-brand-600 mb-6">Connect your wallet to create an organisation on the Soroban network.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-xl mx-auto py-20">
      <div className="bg-surface p-8 rounded-2xl border border-border shadow-sm">
        <div className="w-16 h-16 bg-brand-100 rounded-full flex items-center justify-center mx-auto mb-6">
          <Building2 className="w-8 h-8 text-brand-600" />
        </div>
        <h2 className="text-2xl font-serif text-brand-900 mb-3 text-center">Create an Organisation</h2>
        <p className="text-brand-600 mb-8 text-center">Establish an organisation on the Soroban network to host verified auctions. As the owner, you will be the admin/reviewer who approves or rejects listings.</p>

        <form onSubmit={handleCreate} className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-brand-900 mb-2">Organisation Name</label>
            <input
              type="text"
              value={orgName}
              onChange={(e) => setOrgName(e.target.value)}
              placeholder="e.g. Stellar Art Foundation"
              disabled={isSubmitting}
              className="w-full px-4 py-3 bg-brand-50 border border-brand-200 rounded-xl text-brand-900 focus:outline-none focus:ring-2 focus:ring-brand-400 transition-all"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-brand-900 mb-2">Description</label>
            <textarea
              value={orgDescription}
              onChange={(e) => setOrgDescription(e.target.value)}
              placeholder="Describe your organisation..."
              rows={3}
              disabled={isSubmitting}
              className="w-full px-4 py-3 bg-brand-50 border border-brand-200 rounded-xl text-brand-900 focus:outline-none focus:ring-2 focus:ring-brand-400 transition-all resize-none"
            />
          </div>

          <div className="flex gap-4 justify-center pt-2">
            <button
              type="button"
              onClick={() => navigate('/')}
              disabled={isSubmitting}
              className="px-6 py-3 rounded-xl font-medium text-brand-600 hover:bg-brand-50 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting || !orgName.trim()}
              className="px-8 py-3 bg-brand-900 text-surface rounded-xl font-medium hover:bg-brand-800 transition-colors shadow-sm disabled:opacity-50"
            >
              {isSubmitting ? 'Creating...' : 'Create Organisation'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
