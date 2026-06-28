import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { WalletService } from '../services/wallet';
import { checkUserRegistration, fetchAllOrgs } from '../services/contract';
import { Horizon } from '@stellar/stellar-sdk';
import { Organisation } from '../types';

interface WalletContextType {
  address: string | null;
  username: string | null;
  isRegistered: boolean;
  balance: number;
  isConnecting: boolean;
  ownedOrgs: Organisation[];
  joinedOrgIds: number[];
  connect: () => Promise<void>;
  disconnect: () => void;
  refreshUserInfo: () => Promise<void>;
  refreshOrgs: () => Promise<void>;
}

const WalletContext = createContext<WalletContextType | undefined>(undefined);

export const WalletProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [address, setAddress] = useState<string | null>(localStorage.getItem('stellar_bid_wallet'));
  const [username, setUsername] = useState<string | null>(null);
  const [isRegistered, setIsRegistered] = useState<boolean>(false);
  const [balance, setBalance] = useState<number>(0);
  const [isConnecting, setIsConnecting] = useState<boolean>(false);
  const [ownedOrgs, setOwnedOrgs] = useState<Organisation[]>([]);
  const [joinedOrgIds, setJoinedOrgIds] = useState<number[]>([]);

  const fetchBalance = useCallback(async (addr: string) => {
    try {
      const server = new Horizon.Server('https://horizon-testnet.stellar.org');
      const account = await server.loadAccount(addr);
      const nativeBalance = account.balances.find((b: any) => b.asset_type === 'native');
      setBalance(nativeBalance ? parseFloat(nativeBalance.balance) : 0);
    } catch {
      setBalance(0);
    }
  }, []);

  const refreshOrgs = useCallback(async () => {
    if (!address) {
      setOwnedOrgs([]);
      setJoinedOrgIds([]);
      return;
    }
    try {
      const allOrgs = await fetchAllOrgs();
      const owned = allOrgs.filter(o => o.owner.toUpperCase() === address.toUpperCase());
      setOwnedOrgs(owned);

      const ownedIds = owned.map(o => o.id);
      const memberIds: number[] = [...ownedIds];

      // Check membership for each org
      const { isOrgMember } = await import('../services/contract');
      for (const org of allOrgs) {
        if (ownedIds.includes(org.id)) continue;
        const isMember = await isOrgMember(org.id, address);
        if (isMember) memberIds.push(org.id);
      }
      setJoinedOrgIds(memberIds);
    } catch {
      setOwnedOrgs([]);
      setJoinedOrgIds([]);
    }
  }, [address]);

  const refreshUserInfo = useCallback(async () => {
    if (!address) {
      setUsername(null);
      setIsRegistered(false);
      setBalance(0);
      setOwnedOrgs([]);
      setJoinedOrgIds([]);
      return;
    }
    const reg = await checkUserRegistration(address);
    setIsRegistered(reg.isRegistered);
    setUsername(reg.username || null);
    await fetchBalance(address);
    await refreshOrgs();
  }, [address, fetchBalance, refreshOrgs]);

  useEffect(() => {
    if (address) {
      refreshUserInfo();
    }
  }, [address, refreshUserInfo]);

  const connect = async () => {
    setIsConnecting(true);
    try {
      const kit = WalletService.getKit();
      await kit.openModal({
        onWalletSelected: async (option) => {
          kit.setWallet(option.id);
          let publicAddress = '';
          if (typeof (kit as any).getPublicKey === 'function') {
            const res = await kit.getPublicKey();
            publicAddress = typeof res === 'string' ? res : (res.address || res.publicKey || String(res));
          } else if (typeof (kit as any).getAddress === 'function') {
            const res = await (kit as any).getAddress();
            publicAddress = typeof res === 'string' ? res : (res.address || res.publicKey || String(res));
          }
          if (publicAddress) {
            setAddress(publicAddress);
            localStorage.setItem('stellar_bid_wallet', publicAddress);
          }
        },
      });
    } catch (err) {
      console.error('Wallet connection failed:', err);
    } finally {
      setIsConnecting(false);
    }
  };

  const disconnect = () => {
    setAddress(null);
    setUsername(null);
    setIsRegistered(false);
    setBalance(0);
    setOwnedOrgs([]);
    setJoinedOrgIds([]);
    localStorage.removeItem('stellar_bid_wallet');
  };

  return (
    <WalletContext.Provider
      value={{
        address,
        username,
        isRegistered,
        balance,
        isConnecting,
        ownedOrgs,
        joinedOrgIds,
        connect,
        disconnect,
        refreshUserInfo,
        refreshOrgs,
      }}
    >
      {children}
    </WalletContext.Provider>
  );
};

export const useWallet = () => {
  const context = useContext(WalletContext);
  if (!context) throw new Error('useWallet must be used within WalletProvider');
  return context;
};
