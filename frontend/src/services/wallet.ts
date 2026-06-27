import { StellarWalletsKit, WalletNetwork, allowAllModules } from '@creit.tech/stellar-wallets-kit';
import { NETWORK_PASSPHRASE } from '../utils/constants';

export class WalletService {
  private static instance: StellarWalletsKit | null = null;

  public static getKit(): StellarWalletsKit {
    if (!this.instance) {
      this.instance = new StellarWalletsKit({
        network: WalletNetwork.TESTNET,
        selectedWalletId: 'freighter',
        modules: allowAllModules(),
      });
    }
    return this.instance;
  }
}
