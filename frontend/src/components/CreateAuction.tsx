import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useWallet } from '../context/WalletContext';
import { useToast } from '../context/ToastContext';
import { WalletService } from '../services/wallet';
import { signTransactionWithKit } from '../services/transactionHelper';
import { parseContractError } from '../utils/errors';
import { xlmToStroops } from '../utils/formatters';
import { fetchAllOrgs, isOrgMember } from '../services/contract';
import { uploadImageToIPFS } from '../services/ipfs';
import { Organisation } from '../types';
import { rpc, Contract, TransactionBuilder, Address, xdr } from '@stellar/stellar-sdk';
import { CONTRACT_ID, NETWORK_PASSPHRASE, RPC_URL } from '../utils/constants';
import { Gavel, UploadCloud, X, ArrowLeft, Building2, Image } from 'lucide-react';
import { Link } from 'react-router-dom';

export function CreateAuction() {
  const navigate = useNavigate();
  const { address, isRegistered } = useWallet();
  const { showToast, setTxState } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [manualUrl, setManualUrl] = useState('');
  const [useManualUrl, setUseManualUrl] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
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
        if (memberOrgs.length > 0) setSelectedOrgId(memberOrgs[0].id);
      } catch {
        setMyOrgs([]);
      } finally {
        setLoadingOrgs(false);
      }
    };
    loadOrgs();
  }, [address]);

  const handleFileSelect = useCallback((file: File | null) => {
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      showToast('error', 'Invalid File', 'Please select an image file (JPG, PNG, GIF, WebP, etc.)');
      return;
    }
    if (file.size > 50 * 1024 * 1024) {
      showToast('error', 'File Too Large', 'Please choose an image smaller than 50MB.');
      return;
    }
    setImageFile(file);
    const reader = new FileReader();
    reader.onload = (e) => setImagePreview(e.target?.result as string);
    reader.readAsDataURL(file);
  }, [showToast]);

  const handleDrop = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0] ?? null;
    handleFileSelect(file);
  }, [handleFileSelect]);

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => setIsDragging(false);

  const clearImage = () => {
    setImageFile(null);
    setImagePreview(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

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

    // Validate we have a media source
    if (!imageFile && !manualUrl.trim()) {
      showToast('error', 'Media Required', 'Please upload an image or paste a URL for your auction item.');
      return;
    }

    setIsSubmitting(true);
    try {
      let finalMediaUrl = manualUrl.trim();

      // Upload to IPFS if user provided a file
      if (imageFile && !useManualUrl) {
        setIsUploading(true);
        setTxState({ status: 'SIMULATING', message: 'Uploading image to IPFS...' });
        const result = await uploadImageToIPFS(imageFile);
        finalMediaUrl = result.ipfsUrl;
        setIsUploading(false);
        showToast('info', 'Image Pinned!', `Your image is live on IPFS: ${result.cid.slice(0, 12)}...`);
      }

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
              xdr.ScVal.scvString(finalMediaUrl),
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
      setIsUploading(false);
      const parsed = parseContractError(err);
      setTxState({ status: 'FAILED', error: parsed });
      showToast('error', 'Creation Failed', parsed);
    } finally {
      setIsSubmitting(false);
      setIsUploading(false);
    }
  };

  const busy = isSubmitting || isUploading;

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
                disabled={busy}
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
              disabled={busy}
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
              disabled={busy}
              className="w-full px-4 py-3 bg-brand-50 border border-brand-200 rounded-xl text-brand-900 focus:outline-none focus:ring-2 focus:ring-brand-400 transition-all resize-none"
            />
          </div>

          {/* Image Upload Section */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-medium text-brand-900 flex items-center gap-2">
                <Image className="w-4 h-4" />
                Item Image
              </label>
              <button
                type="button"
                onClick={() => { setUseManualUrl(v => !v); clearImage(); setManualUrl(''); }}
                className="text-xs text-brand-500 hover:text-brand-800 underline transition-colors"
              >
                {useManualUrl ? 'Upload an image instead' : 'Paste a URL instead'}
              </button>
            </div>

            {useManualUrl ? (
              <input
                type="url"
                value={manualUrl}
                onChange={(e) => setManualUrl(e.target.value)}
                placeholder="https://... or ipfs://..."
                disabled={busy}
                className="w-full px-4 py-3 bg-brand-50 border border-brand-200 rounded-xl text-brand-900 focus:outline-none focus:ring-2 focus:ring-brand-400 transition-all"
              />
            ) : imagePreview ? (
              /* Preview of selected image */
              <div className="relative rounded-2xl overflow-hidden border border-border shadow-sm group">
                <img
                  src={imagePreview}
                  alt="Preview"
                  className="w-full h-64 object-cover"
                />
                {!busy && (
                  <button
                    type="button"
                    onClick={clearImage}
                    className="absolute top-3 right-3 w-8 h-8 rounded-full bg-brand-900/80 backdrop-blur-sm text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-600"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
                {isUploading && (
                  <div className="absolute inset-0 bg-brand-900/60 backdrop-blur-sm flex flex-col items-center justify-center gap-3">
                    <div className="w-10 h-10 border-4 border-white/30 border-t-white rounded-full animate-spin" />
                    <p className="text-white text-sm font-medium">Pinning to IPFS...</p>
                  </div>
                )}
                <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-brand-900/80 to-transparent p-4">
                  <p className="text-white text-xs truncate">{imageFile?.name}</p>
                  <p className="text-white/70 text-xs">{imageFile ? (imageFile.size / 1024 / 1024).toFixed(2) + ' MB' : ''}</p>
                </div>
              </div>
            ) : (
              /* Drag-and-drop zone */
              <div
                onDrop={handleDrop}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onClick={() => fileInputRef.current?.click()}
                className={`relative flex flex-col items-center justify-center gap-4 px-6 py-12 rounded-2xl border-2 border-dashed cursor-pointer transition-all ${
                  isDragging
                    ? 'border-brand-500 bg-brand-50 scale-[1.01]'
                    : 'border-brand-200 hover:border-brand-400 hover:bg-brand-50/50'
                }`}
              >
                <div className={`w-16 h-16 rounded-full flex items-center justify-center transition-colors ${isDragging ? 'bg-brand-100' : 'bg-brand-50'}`}>
                  <UploadCloud className={`w-8 h-8 transition-colors ${isDragging ? 'text-brand-700' : 'text-brand-400'}`} />
                </div>
                <div className="text-center">
                  <p className="text-sm font-semibold text-brand-900">
                    {isDragging ? 'Drop your image here' : 'Drag & drop or click to upload'}
                  </p>
                  <p className="text-xs text-brand-500 mt-1">JPG, PNG, GIF, WebP · Max 50 MB · Stored on IPFS</p>
                </div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => handleFileSelect(e.target.files?.[0] ?? null)}
                />
              </div>
            )}
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
                disabled={busy}
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
                disabled={busy}
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
              disabled={busy}
              className="w-full px-4 py-3 bg-brand-50 border border-brand-200 rounded-xl text-brand-900 focus:outline-none focus:ring-2 focus:ring-brand-400 transition-all"
            />
          </div>

          <div className="flex gap-4 pt-4">
            <button
              type="button"
              onClick={() => navigate(-1)}
              disabled={busy}
              className="flex-1 py-3.5 rounded-xl font-medium text-brand-600 hover:bg-brand-50 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={busy || !title.trim() || !selectedOrgId || (!imageFile && !manualUrl.trim() && !useManualUrl)}
              className="flex-1 py-3.5 bg-brand-900 hover:bg-brand-800 text-surface font-semibold rounded-xl shadow-sm transition-all flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {isUploading ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Uploading to IPFS...
                </>
              ) : isSubmitting ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Creating Auction...
                </>
              ) : (
                <>
                  <Gavel className="w-4 h-4" />
                  Submit for Review
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
