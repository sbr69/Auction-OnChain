import { useState, useEffect } from 'react';
import { Users, Search, ArrowRight, CheckCircle2 } from 'lucide-react';
import { fetchAllOrgs, isOrgMember } from '../services/contract';
import { Organisation } from '../types';
import { useWallet } from '../context/WalletContext';
import { shortenAddress } from '../utils/formatters';

interface JoinOrganizationProps {
  onCancel: () => void;
  onJoin: (orgId: number) => void;
}

export function JoinOrganization({ onCancel, onJoin }: JoinOrganizationProps) {
  const { address } = useWallet();
  const [searchQuery, setSearchQuery] = useState('');
  const [orgs, setOrgs] = useState<Organisation[]>([]);
  const [memberStatus, setMemberStatus] = useState<Record<number, boolean>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const allOrgs = await fetchAllOrgs();
        setOrgs(allOrgs);

        // Check membership for each org
        if (address) {
          const statusMap: Record<number, boolean> = {};
          for (const org of allOrgs) {
            statusMap[org.id] = await isOrgMember(org.id, address);
          }
          setMemberStatus(statusMap);
        }
      } catch (err) {
        console.error('Failed to load orgs:', err);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [address]);

  const filteredOrgs = orgs.filter(org =>
    org.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    org.description.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="max-w-3xl mx-auto py-12">
      <div className="text-center mb-10">
        <div className="w-16 h-16 bg-brand-100 rounded-full flex items-center justify-center mx-auto mb-6">
          <Users className="w-8 h-8 text-brand-600" />
        </div>
        <h1 className="text-3xl font-serif text-brand-900 mb-3">Join an Organisation</h1>
        <p className="text-brand-600 max-w-lg mx-auto">
          Discover and join existing organisations to participate in their exclusive auctions as a bidder or creator.
        </p>
      </div>

      <div className="bg-surface rounded-2xl border border-border shadow-sm overflow-hidden flex flex-col min-h-[500px]">
        <div className="p-6 border-b border-border bg-brand-50/50">
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-brand-400" />
            <input
              type="text"
              placeholder="Search organisations by name or description..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-12 pr-4 py-3 bg-surface border border-brand-200 rounded-xl text-brand-900 focus:outline-none focus:ring-2 focus:ring-brand-400 transition-all"
            />
          </div>
        </div>

        <div className="flex-grow p-6 overflow-y-auto bg-surface">
          {loading ? (
            <div className="flex justify-center py-12">
              <div className="w-8 h-8 border-2 border-brand-600 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : filteredOrgs.length === 0 ? (
            <div className="text-center py-12">
              {orgs.length === 0 ? (
                <p className="text-brand-500">No organisations exist yet. Be the first to create one!</p>
              ) : (
                <p className="text-brand-500">No organisations found matching "{searchQuery}"</p>
              )}
            </div>
          ) : (
            <div className="grid gap-4">
              {filteredOrgs.map(org => {
                const isMember = memberStatus[org.id] || false;
                return (
                  <div key={org.id} className="group flex flex-col sm:flex-row items-start sm:items-center justify-between p-5 rounded-xl border border-border hover:border-brand-300 hover:shadow-md transition-all gap-4">
                    <div className="flex-grow">
                      <h3 className="text-lg font-serif font-medium text-brand-900 mb-1">{org.name}</h3>
                      <p className="text-sm text-brand-600 line-clamp-2">{org.description}</p>
                      <p className="text-xs font-mono text-brand-500 mt-2">
                        {org.memberCount} members · Owner: {shortenAddress(org.owner, 6)}
                      </p>
                    </div>
                    {isMember ? (
                      <span className="flex items-center gap-2 px-5 py-2.5 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-lg text-sm font-medium whitespace-nowrap">
                        <CheckCircle2 className="w-4 h-4" /> Joined
                      </span>
                    ) : (
                      <button
                        onClick={() => onJoin(org.id)}
                        className="flex items-center gap-2 px-6 py-2.5 bg-brand-50 text-brand-900 border border-brand-200 rounded-lg font-medium hover:bg-brand-900 hover:text-surface hover:border-brand-900 transition-colors whitespace-nowrap w-full sm:w-auto justify-center"
                      >
                        Join
                        <ArrowRight className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="p-6 border-t border-border bg-brand-50/50 flex justify-center">
          <button
            onClick={onCancel}
            className="px-6 py-2.5 rounded-lg font-medium text-brand-600 hover:bg-brand-100 hover:text-brand-900 transition-colors"
          >
            Cancel & Return
          </button>
        </div>
      </div>
    </div>
  );
}
