import { WalletService } from './wallet';
import { WalletNetwork } from '@creit.tech/stellar-wallets-kit';
import { NETWORK_PASSPHRASE } from '../utils/constants';

export async function signTransactionWithKit(txXdr: string, address: string): Promise<string> {
  const kit = WalletService.getKit();

  // kit.signTx() requires publicKeys as an array (per the kit's module interface)
  const result = await kit.signTx({
    xdr: txXdr,
    publicKeys: [address],
    network: WalletNetwork.TESTNET,
  });

  return result.result;
}
