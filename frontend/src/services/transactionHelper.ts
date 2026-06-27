import { WalletService } from './wallet';
import { NETWORK_PASSPHRASE } from '../utils/constants';
import { TransactionBuilder } from '@stellar/stellar-sdk';

export async function signAndSubmitTransaction(server: any, tx: any, address: string): Promise<string> {
  const kit = WalletService.getKit();
  const txXdr = tx.toXDR();

  let signedXdr: string = '';
  try {
    const res: any = await (kit as any).signTx({
      xdr: txXdr,
      networkPassphrase: NETWORK_PASSPHRASE,
      publicKey: address,
    });
    signedXdr = typeof res === 'string' ? res : (res.result || res.signedTxXdr || res.xdr);
  } catch {
    const res: any = await (kit as any).signTransaction(txXdr, {
      networkPassphrase: NETWORK_PASSPHRASE,
      address,
    });
    signedXdr = typeof res === 'string' ? res : (res.result || res.signedTxXdr || res.xdr);
  }

  const signedTx = TransactionBuilder.fromXDR(signedXdr, NETWORK_PASSPHRASE);
  const sendRes = await server.sendTransaction(signedTx);

  if (sendRes.status === 'PENDING') {
    let txStatus = await server.getTransaction(sendRes.hash);
    while (txStatus.status === 'NOT_FOUND') {
      await new Promise(r => setTimeout(r, 1500));
      txStatus = await server.getTransaction(sendRes.hash);
    }

    if (txStatus.status === 'SUCCESS' || (txStatus as any).status === 1) {
      return sendRes.hash;
    } else {
      throw new Error('Transaction execution failed on-chain.');
    }
  } else {
    throw new Error('Failed to submit transaction to Stellar RPC.');
  }
}
