import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useWallet } from '../context/WalletContext';
import { useToast } from '../context/ToastContext';
import { WalletService } from '../services/wallet';
import { signTransactionWithKit } from '../services/transactionHelper';
import { parseContractError } from '../utils/errors';
import { xlmToStroops } from '../utils/formatters';
import { fetchAllOrgs, isOrgMember } from '../services/contract';
import { Organisation } from '../types';
import { rpc, Contract, TransactionBuilder, Address, xdr } from '@stellar/stellar-sdk';
import { CONTRACT_ID, NETWORK_PASSPHRASE, RPC_URL } from '../utils/constants';
import { Gavel, Image, ArrowLeft, Building2 } from 'lucide-react';
import { Link } from 'react-router-dom';

export function CreateAuction() {
  const navigate = useNavigate();
  const { address, isRegistered } = useWallet();
  const { showToast, setTxState } = useToast();

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [mediaUrl, setMediaUrl] = useState('');
  const [startingBid, setStartingBid] = useState('');
  const [minIncrement, setMinIncrement] = useState('');
  const [endTime, setEndTime] = useState('');
  const [selectedOrgId, setSelectedOrgId] = useState<number>(0);
  const [myOrgs, setMyOrgs] = useState<Organisation[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [loadingOrgs, setLoadingOrgs] = useState(true);

  useEffect(() => {
    const loadOrgs = async () => {
      if (!address) { setLoadingOrgs(false); return; }
      try {
        const allOrgs = await fetchAllOrgs();
        const memberOrgs: Organisation[] = [];
        for (const org of allOrgs) {
          const isMember = await isOrgMember(org.id, address);
          if (isMember) memberOrgs.push(org);
        }
        setMyOrgs(memberOrgs);
        if (memberOrgs.length > 0) {
          setSelectedOrgId(memberOrgs[0].id);
        }
      } catch {
        setMyOrgs([]);
      } finally {
        setLoadingOrgs(false);
      }
    };
    loadOrgs();
  }, [address]);

  if (!address) {
    return (
      <div className="flex flex-col items-center justify-center py-32 text-center">
        <Gavel className="w-12 h-12 text-brand-400 mb-4" />
        <h2 className="text-2xl font-serif text-brand-900 mb-3">Create an Auction</h2>
        <p className="text-brand-600 mb-6">Connect your wallet to create an auction listing.</p>
      </div>
    );
  }

  if (!isRegistered) {
    return (
      <div className="flex flex-col items-center justify-center py-32 text-center">
        <Gavel className="w-12 h-12 text-brand-400 mb-4" />
        <h2 className="text-2xl font-serif text-brand-900 mb-3">Username Required</h2>
        <p className="text-brand-600 mb-6">Please claim your username in the navbar before creating auctions.</p>
      </div>
    );
  }

  if (!loadingOrgs && myOrgs.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-32 text-center">
        <Building2 className="w-12 h-12 text-brand-400 mb-4" />
        <h2 className="text-2xl font-serif text-brand-900 mb-3">Join an Organisation First</h2>
        <p className="text-brand-600 mb-6 max-w-md">You need to be a member of at least one organisation to create an auction.</p>
        <Link to="/join-org" className="px-6 py-3 bg-brand-900 text-surface rounded-full font-medium hover:bg-brand-800 transition-colors">
          Browse Organisations
        </Link>
      </div>
    );
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!address || !selectedOrgId) return;
    setIsSubmitting(true);

    try {
      const endTimestamp = Math.floor(new Date(endTime).getTime() / 1000);
      const startingBidStroops = xlmToStroops(parseFloat(startingBid));
      const minIncrementStroops = xlmToStroops(parseFloat(minIncrement));

      setTxState({ status: 'SIMULATING', message: 'Simulating auction creation...' });

      const server = new rpc.Server(RPC_URL);
      const contract = new Contract(CONTRACT_ID);
      const account = await server.getAccount(address);

      const tx = await server.prepareTransaction(
        new TransactionBuilder(account, { fee: '200000', networkPassphrase: NETWORK_PASSPHRASE })
          .addOperation(
            contract.call(
              'create_auction',
              new Address(address).toScVal(),
              xdr.ScVal.scvU64(new xdr.Uint64(selectedOrgId)),
              xdr.ScVal.scvString(title.trim()),
              xdr.ScVal.scvString(description.trim()),
              xdr.ScVal.scvString(mediaUrl.trim()),
              xdr.ScVal.scvI128(new xdr.Int128Parts({
                lo: new xdr.Uint64(startingBidStroops & BigInt('0xFFFFFFFFFFFFFFFF')),
                hi: new xdr.Int64(startingBidStroops >> BigInt(64)),
              })),
              xdr.ScVal.scvI128(new xdr.Int128Parts({
                lo: new xdr.Uint64(minIncrementStroops & BigInt('0xFFFFFFFFFFFFFFFF')),
                hi: new xdr.Int64(minIncrementStroops >> BigInt(64)),
              })),
              xdr.ScVal.scvU64(new xdr.Uint64(endTimestamp))
            )
          )
          .setTimeout(30)
          .build()
      );

      setTxState({ status: 'SIGNING', message: 'Confirm in wallet...' });
      const signedXdr = await signTransactionWithKit(tx.toXDR(), address);

      setTxState({ status: 'SUBMITTING', message: 'Broadcasting to Stellar...' });
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
          setTxState({ status: 'SUCCESS', txHash: sendRes.hash, message: 'Auction created!' });
          showToast('success', 'Auction Created!', 'Your listing is pending org owner review.');
          navigate('/profile');
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

  return (
    <div className="py-12 max-w-3xl mx-auto">
      <Link to="/explore" className="inline-flex items-center gap-2 text-sm font-medium text-brand-600 hover:text-brand-900 transition-colors mb-8">
        <ArrowLeft className="w-4 h-4" />
        Back to Marketplace
      </Link>

      <div className="bg-surface rounded-2xl border border-border shadow-sm overflow-hidden">
        <div className="p-8 border-b border-border bg-brand-50/50 text-center">
          <h1 className="text-3xl font-serif text-brand-900 mb-2">Create Auction Listing</h1>
          <p className="text-brand-600">Submit a new auction for review by the organisation owner.</p>
        </div>

        <form onSubmit={handleSubmit} className="p-8 space-y-6">
          {/* Organisation selector */}
          <div>
            <label className="block text-sm font-medium text-brand-900 mb-2">Organisation</label>
            {loadingOrgs ? (
              <div className="w-full px-4 py-3 bg-brand-50 border border-brand-200 rounded-xl text-brand-400">
                Loading your organisations...
              </div>
            ) : (
              <select
                value={selectedOrgId}
                onChange={(e) => setSelectedOrgId(Number(e.target.value))}
                disabled={isSubmitting}
                className="w-full px-4 py-3 bg-brand-50 border border-brand-200 rounded-xl text-brand-900 focus:outline-none focus:ring-2 focus:ring-brand-400 transition-all"
              >
                {myOrgs.map(org => (
                  <option key={org.id} value={org.id}>
                    {org.name} (#{org.id})
                  </option>
                ))}
              </select>
            )}
          </div>

          {/* Title */}
          <div>
            <label className="block text-sm font-medium text-brand-900 mb-2">Auction Title</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Vintage Rolex Submariner"
              required
              disabled={isSubmitting}
              className="w-full px-4 py-3 bg-brand-50 border border-brand-200 rounded-xl text-brand-900 focus:outline-none focus:ring-2 focus:ring-brand-400 transition-all"
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-medium text-brand-900 mb-2">Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Describe the item, its condition, history, and provenance..."
              rows={4}
              required
              disabled={isSubmitting}
              className="w-full px-4 py-3 bg-brand-50 border border-brand-200 rounded-xl text-brand-900 focus:outline-none focus:ring-2 focus:ring-brand-400 transition-all resize-none"
            />
          </div>

          {/* Media URL */}
          <div>
            <label className="block text-sm font-medium text-brand-900 mb-2">
              <Image className="w-4 h-4 inline mr-2" />
              Media URL
            </label>
            <input
              type="url"
              value={mediaUrl}
              onChange={(e) => setMediaUrl(e.target.value)}
              placeholder="IPFS or Cloudinary URL"
              required
              disabled={isSubmitting}
              className="w-full px-4 py-3 bg-brand-50 border border-brand-200 rounded-xl text-brand-900 focus:outline-none focus:ring-2 focus:ring-brand-400 transition-all"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            {/* Starting Bid */}
            <div>
              <label className="block text-sm font-medium text-brand-900 mb-2">Starting Bid (XLM)</label>
              <input
                type="number"
                value={startingBid}
                onChange={(e) => setStartingBid(e.target.value)}
                placeholder="100"
                step="0.1"
                min="0.1"
                required
                disabled={isSubmitting}
                className="w-full px-4 py-3 bg-brand-50 border border-brand-200 rounded-xl text-brand-900 font-mono focus:outline-none focus:ring-2 focus:ring-brand-400 transition-all"
              />
            </div>

            {/* Min Increment */}
            <div>
              <label className="block text-sm font-medium text-brand-900 mb-2">Min Increment (XLM)</label>
              <input
                type="number"
                value={minIncrement}
                onChange={(e) => setMinIncrement(e.target.value)}
                placeholder="10"
                step="0.1"
                min="0.1"
                required
                disabled={isSubmitting}
                className="w-full px-4 py-3 bg-brand-50 border border-brand-200 rounded-xl text-brand-900 font-mono focus:outline-none focus:ring-2 focus:ring-brand-400 transition-all"
              />
            </div>
          </div>

          {/* End Time */}
          <div>
            <label className="block text-sm font-medium text-brand-900 mb-2">End Date & Time</label>
            <input
              type="datetime-local"
              value={endTime}
              onChange={(e) => setEndTime(e.target.value)}
              required
              disabled={isSubmitting}
              className="w-full px-4 py-3 bg-brand-50 border border-brand-200 rounded-xl text-brand-900 focus:outline-none focus:ring-2 focus:ring-brand-400 transition-all"
            />
          </div>

          <div className="flex gap-4 pt-4">
            <button
              type="button"
              onClick={() => navigate(-1)}
              disabled={isSubmitting}
              className="flex-1 py-3.5 rounded-xl font-medium text-brand-600 hover:bg-brand-50 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting || !title.trim() || !selectedOrgId}
              className="flex-1 py-3.5 bg-brand-900 hover:bg-brand-800 text-surface font-semibold rounded-xl shadow-sm transition-all flex items-center justify-center gap-2 disabled:opacity-50"
            >
              <Gavel className="w-4 h-4" />
              {isSubmitting ? 'Creating...' : 'Submit for Review'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
