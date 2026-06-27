import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { WalletService } from '../services/wallet';
import { checkUserRegistration } from '../services/contract';
import { Horizon } from '@stellar/stellar-sdk';
import { ADMIN_ADDRESS } from '../utils/constants';

interface WalletContextType {
  address: string | null;
  username: string | null;
  isRegistered: boolean;
  isAdmin: boolean;
  balance: number;
  isConnecting: boolean;
  connect: () => Promise<void>;
  disconnect: () => void;
  refreshUserInfo: () => Promise<void>;
}

const WalletContext = createContext<WalletContextType | undefined>(undefined);

export const WalletProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [address, setAddress] = useState<string | null>(localStorage.getItem('stellar_bid_wallet'));
  const [username, setUsername] = useState<string | null>(null);
  const [isRegistered, setIsRegistered] = useState<boolean>(false);
  const [balance, setBalance] = useState<number>(0);
  const [isConnecting, setIsConnecting] = useState<boolean>(false);

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

  const refreshUserInfo = useCallback(async () => {
    if (!address) {
      setUsername(null);
      setIsRegistered(false);
      setBalance(0);
      return;
    }
    const reg = await checkUserRegistration(address);
    setIsRegistered(reg.isRegistered);
    setUsername(reg.username || null);
    await fetchBalance(address);
  }, [address, fetchBalance]);

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
          const res: any = await (kit as any).getAddress().catch(() => (kit as any).getPublicKey());
          const publicAddress = typeof res === 'string' ? res : (res.address || res.publicKey || res);
          setAddress(publicAddress);
          localStorage.setItem('stellar_bid_wallet', publicAddress);
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
    localStorage.removeItem('stellar_bid_wallet');
  };

  const isAdmin = Boolean(address && address.toUpperCase() === ADMIN_ADDRESS.toUpperCase());

  return (
    <WalletContext.Provider
      value={{
        address,
        username,
        isRegistered,
        isAdmin,
        balance,
        isConnecting,
        connect,
        disconnect,
        refreshUserInfo,
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
