import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useWallet } from '../context/WalletContext';
import { useToast } from '../context/ToastContext';
import { JoinOrganization } from '../components/JoinOrganization';
import { WalletService } from '../services/wallet';
import { signTransactionWithKit } from '../services/transactionHelper';
import { parseContractError } from '../utils/errors';
import { rpc, Contract, TransactionBuilder, Address, xdr } from '@stellar/stellar-sdk';
import { CONTRACT_ID, NETWORK_PASSPHRASE, RPC_URL } from '../utils/constants';

export function JoinOrganisationPage() {
  const navigate = useNavigate();
  const { address, isRegistered, refreshOrgs } = useWallet();
  const { showToast, setTxState } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleJoin = async (orgId: number) => {
    if (!address) {
      showToast('info', 'Connect Wallet', 'Please connect your wallet first.');
      return;
    }
    if (!isRegistered) {
      showToast('info', 'Username Required', 'Please claim your username in the navbar first.');
      return;
    }
    if (isSubmitting) return;

    setIsSubmitting(true);
    try {
      setTxState({ status: 'SIMULATING', message: 'Preparing to join organisation...' });

      const server = new rpc.Server(RPC_URL);
      const contract = new Contract(CONTRACT_ID);
      const account = await server.getAccount(address);

      const tx = await server.prepareTransaction(
        new TransactionBuilder(account, { fee: '200000', networkPassphrase: NETWORK_PASSPHRASE })
          .addOperation(
            contract.call(
              'join_org',
              new Address(address).toScVal(),
              xdr.ScVal.scvU64(new xdr.Uint64(orgId))
            )
          )
          .setTimeout(30)
          .build()
      );

      setTxState({ status: 'SIGNING', message: 'Confirm in wallet...' });
      const signedXdr = await signTransactionWithKit(tx.toXDR(), address);

      setTxState({ status: 'SUBMITTING', message: 'Joining organisation on-chain...' });
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
          setTxState({ status: 'SUCCESS', txHash: sendRes.hash, message: 'Joined successfully!' });
          showToast('success', 'Joined Organisation!', 'You can now browse and create auctions in this org.');
          await refreshOrgs();
          navigate('/explore');
        } else {
          throw new Error('Transaction failed');
        }
      }
    } catch (err: any) {
      const parsed = parseContractError(err);
      setTxState({ status: 'FAILED', error: parsed });
      showToast('error', 'Join Failed', parsed);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <JoinOrganization
      onCancel={() => navigate('/')}
      onJoin={handleJoin}
    />
  );
}
