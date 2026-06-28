import { useState } from 'react';
import { Shield, Gavel, LogOut, Wallet, UserPlus } from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';
import { useWallet } from '../context/WalletContext';
import { useToast } from '../context/ToastContext';
import { shortenAddress } from '../utils/formatters';
import { rpc, Contract, TransactionBuilder, Address, xdr } from '@stellar/stellar-sdk';
import { CONTRACT_ID, NETWORK_PASSPHRASE, RPC_URL } from '../utils/constants';
import { WalletService } from '../services/wallet';
import { signTransactionWithKit } from '../services/transactionHelper';
import { parseContractError } from '../utils/errors';

export function Navbar() {
  const { address, username, isRegistered, ownedOrgs, connect, disconnect, refreshUserInfo } = useWallet();
  const { showToast, setTxState } = useToast();
  const location = useLocation();
  const isLanding = location.pathname === '/';

  const [showUsernameModal, setShowUsernameModal] = useState(false);
  const [newUsername, setNewUsername] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const hasAdminOrgs = ownedOrgs.length > 0;

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!address || !newUsername.trim()) return;
    setIsSubmitting(true);
    setTxState({ status: 'SIMULATING', message: 'Preparing username registration...' });

    try {
      const server = new rpc.Server(RPC_URL);
      const contract = new Contract(CONTRACT_ID);
      const account = await server.getAccount(address);

      const tx = await server.prepareTransaction(
        new TransactionBuilder(account, { fee: '200000', networkPassphrase: NETWORK_PASSPHRASE })
          .addOperation(
            contract.call(
              'register_user',
              new Address(address).toScVal(),
              xdr.ScVal.scvString(newUsername.trim())
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
          setTxState({ status: 'SUCCESS', txHash: sendRes.hash, message: 'Username claimed!' });
          showToast('success', 'Username Claimed!', `You are now @${newUsername.trim()}`);
          setShowUsernameModal(false);
          setNewUsername('');
          await refreshUserInfo();
        } else {
          throw new Error('Transaction failed');
        }
      }
    } catch (err: any) {
      const parsed = parseContractError(err);
      setTxState({ status: 'FAILED', error: parsed });
      showToast('error', 'Registration Failed', parsed);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      <header className="sticky top-0 z-50 bg-surface/80 backdrop-blur-md border-b border-border">
        <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
          <div className="flex items-center gap-8">
            <Link
              to="/"
              className="flex items-center gap-2 cursor-pointer"
            >
              <Gavel className="w-6 h-6 text-brand-600" />
              <span className="font-serif text-2xl font-semibold tracking-tight text-brand-900">
                StellarBid
              </span>
            </Link>

            {address && !isLanding && (
              <nav className="hidden md:flex items-center gap-1">
                <NavLink to="/explore" active={location.pathname === '/explore'}>
                  Marketplace
                </NavLink>
                <NavLink to="/create" active={location.pathname === '/create'}>
                  Create
                </NavLink>
                <NavLink to="/profile" active={location.pathname === '/profile'}>
                  Profile
                </NavLink>
                {hasAdminOrgs && (
                  <NavLink to="/admin" active={location.pathname === '/admin'} icon={<Shield className="w-4 h-4 mr-2" />}>
                    Admin
                  </NavLink>
                )}
              </nav>
            )}
          </div>

          <div className="flex items-center gap-4">
            {address ? (
              <div className="flex items-center gap-4">
                {!isRegistered && (
                  <button
                    onClick={() => setShowUsernameModal(true)}
                    className="flex items-center gap-2 px-4 py-2 bg-brand-100 text-brand-900 rounded-full text-sm font-medium hover:bg-brand-200 transition-colors"
                  >
                    <UserPlus className="w-4 h-4" />
                    Claim Username
                  </button>
                )}
                <div className="flex flex-col items-end">
                  <span className="text-sm font-medium text-brand-900">
                    {username ? `@${username}` : shortenAddress(address)}
                  </span>
                  <span className="text-xs font-mono text-brand-500">{shortenAddress(address, 6)}</span>
                </div>
                <button
                  onClick={disconnect}
                  className="p-2 rounded-full hover:bg-brand-50 text-brand-600 transition-colors"
                  title="Disconnect Wallet"
                >
                  <LogOut className="w-5 h-5" />
                </button>
              </div>
            ) : (
              <button
                onClick={connect}
                className="flex items-center gap-2 px-6 py-2.5 bg-brand-900 text-surface rounded-full font-medium hover:bg-brand-800 transition-colors shadow-sm"
              >
                <Wallet className="w-4 h-4" />
                Connect Wallet
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Username Registration Modal */}
      {showUsernameModal && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-brand-950/40 backdrop-blur-sm">
          <div className="bg-surface rounded-2xl border border-border w-full max-w-md shadow-xl overflow-hidden p-8">
            <h3 className="font-serif text-2xl font-medium text-brand-900 mb-2">Claim Your Username</h3>
            <p className="text-brand-600 text-sm mb-6">
              Register a permanent on-chain identity. 3–20 characters.
            </p>
            <form onSubmit={handleRegister}>
              <input
                type="text"
                value={newUsername}
                onChange={(e) => setNewUsername(e.target.value)}
                placeholder="e.g. stellar_whale"
                minLength={3}
                maxLength={20}
                disabled={isSubmitting}
                className="w-full px-4 py-3 bg-brand-50 border border-brand-200 rounded-xl text-brand-900 focus:outline-none focus:ring-2 focus:ring-brand-400 transition-all mb-6"
              />
              <div className="flex gap-4 justify-end">
                <button
                  type="button"
                  onClick={() => setShowUsernameModal(false)}
                  disabled={isSubmitting}
                  className="px-6 py-3 rounded-xl font-medium text-brand-600 hover:bg-brand-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting || newUsername.trim().length < 3}
                  className="px-8 py-3 bg-brand-900 text-surface rounded-xl font-medium hover:bg-brand-800 transition-colors shadow-sm disabled:opacity-50"
                >
                  {isSubmitting ? 'Registering...' : 'Claim Username'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}

function NavLink({ to, active, children, icon }: { to: string; active: boolean; children: React.ReactNode; icon?: React.ReactNode }) {
  return (
    <Link
      to={to}
      className={`flex items-center px-4 py-2 rounded-full text-sm font-medium transition-all ${
        active
          ? 'bg-brand-100 text-brand-900'
          : 'text-brand-600 hover:text-brand-900 hover:bg-brand-50'
      }`}
    >
      {icon}
      {children}
    </Link>
  );
}
