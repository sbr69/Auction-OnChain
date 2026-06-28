import { Wallet, ArrowRight, Shield, Globe, Zap, Building2, Users } from 'lucide-react';
import { useWallet } from '../context/WalletContext';
import { useNavigate } from 'react-router-dom';

export function Landing() {
  const { address, connect } = useWallet();
  const navigate = useNavigate();

  return (
    <div className="py-20 flex flex-col items-center text-center">
      <h1 className="text-5xl md:text-7xl font-serif text-brand-900 mb-6 tracking-tight">
        The Future of <span className="italic text-brand-600">On-Chain</span> Auctions
      </h1>
      <p className="text-xl text-brand-600 max-w-2xl mx-auto mb-12 leading-relaxed">
        StellarBid brings trustless, real-time bidding to the Soroban network. Discover rare digital and physical assets with verifiable provenance.
      </p>

      {address ? (
        <div className="flex flex-col sm:flex-row gap-4 items-center justify-center">
          <button
            onClick={() => navigate('/explore')}
            className="group flex items-center justify-center gap-3 px-8 py-4 bg-brand-900 text-surface rounded-full text-lg font-medium hover:bg-brand-800 transition-all shadow-lg hover:shadow-brand-900/20 w-full sm:w-auto"
          >
            Explore Auctions
            <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
          </button>
          <button
            onClick={() => navigate('/create-org')}
            className="group flex items-center justify-center gap-3 px-8 py-4 bg-surface border border-brand-200 text-brand-900 rounded-full text-lg font-medium hover:bg-brand-50 transition-all shadow-sm w-full sm:w-auto"
          >
            <Building2 className="w-5 h-5" />
            Create Organisation
          </button>
          <button
            onClick={() => navigate('/join-org')}
            className="group flex items-center justify-center gap-3 px-8 py-4 bg-surface border border-brand-200 text-brand-900 rounded-full text-lg font-medium hover:bg-brand-50 transition-all shadow-sm w-full sm:w-auto"
          >
            <Users className="w-5 h-5" />
            Join Organisation
          </button>
        </div>
      ) : (
        <button
          onClick={connect}
          className="flex items-center gap-3 px-8 py-4 bg-brand-900 text-surface rounded-full text-lg font-medium hover:bg-brand-800 transition-all shadow-lg hover:shadow-brand-900/20"
        >
          <Wallet className="w-5 h-5" />
          Connect Wallet to Begin
        </button>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mt-32 max-w-5xl mx-auto text-left">
        <FeatureCard
          icon={<Shield className="w-8 h-8 text-brand-500" />}
          title="Trustless Escrow"
          description="Bids are secured in Soroban smart contracts. Funds are automatically refunded to losing bidders."
        />
        <FeatureCard
          icon={<Zap className="w-8 h-8 text-brand-500" />}
          title="Real-Time Execution"
          description="Experience lightning-fast finality on the Stellar network, ensuring your bids are processed instantly."
        />
        <FeatureCard
          icon={<Globe className="w-8 h-8 text-brand-500" />}
          title="Verifiable Provenance"
          description="Every asset listing and transaction history is permanently recorded on-chain for complete transparency."
        />
      </div>
    </div>
  );
}

function FeatureCard({ icon, title, description }: { icon: React.ReactNode; title: string; description: string }) {
  return (
    <div className="p-8 rounded-3xl bg-surface border border-border shadow-sm hover:shadow-md transition-shadow">
      <div className="w-14 h-14 bg-brand-50 rounded-2xl flex items-center justify-center mb-6">
        {icon}
      </div>
      <h3 className="text-xl font-serif text-brand-900 mb-3">{title}</h3>
      <p className="text-brand-600 leading-relaxed">{description}</p>
    </div>
  );
}
