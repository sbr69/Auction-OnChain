import { rpc, scValToNative, Address, xdr } from '@stellar/stellar-sdk';
import { CONTRACT_ID, RPC_URL } from '../utils/constants';
import { stroopsToXlm } from '../utils/formatters';
import { Auction, AuctionStatusType } from '../types';

const server = new rpc.Server(RPC_URL);

export async function fetchAuctionCount(): Promise<number> {
  try {
    const key = xdr.ScVal.scvSymbol('AuctionCount');
    const result = await server.getContractData(CONTRACT_ID, key, 'instance' as any);
    if (!result || !result.val) return 0;

    const valObj: any = result.val;
    const scVal = valObj.val ? valObj.val() : valObj;
    const native = scValToNative(scVal);
    return Number(native);
  } catch {
    return 0;
  }
}

export async function fetchAuction(id: number): Promise<Auction | null> {
  try {
    const key = xdr.ScVal.scvVec([
      xdr.ScVal.scvSymbol('Auction'),
      xdr.ScVal.scvU64(new xdr.Uint64(id))
    ]);

    const entry = await server.getContractData(CONTRACT_ID, key, 'persistent' as any);
    if (!entry || !entry.val) return null;

    const valObj: any = entry.val;
    const scVal = valObj.val ? valObj.val() : valObj;
    const raw: any = scValToNative(scVal);

    let statusStr: AuctionStatusType = 'Pending';
    if (typeof raw.status === 'string') {
      statusStr = raw.status as AuctionStatusType;
    } else if (raw.status && typeof raw.status === 'object') {
      statusStr = Object.keys(raw.status)[0] as AuctionStatusType;
    }

    return {
      id: Number(raw.id),
      creator: raw.creator.toString(),
      title: raw.title,
      description: raw.description,
      mediaUrl: raw.media_url,
      startingBid: stroopsToXlm(raw.starting_bid),
      minIncrement: stroopsToXlm(raw.min_increment),
      endTime: Number(raw.end_time),
      status: statusStr,
      highestBid: stroopsToXlm(raw.highest_bid),
      highestBidder: raw.highest_bidder ? raw.highest_bidder.toString() : '',
      totalBids: Number(raw.total_bids),
    };
  } catch (err) {
    console.error(`Failed to fetch auction ${id}:`, err);
    return null;
  }
}

export async function fetchAllAuctions(): Promise<Auction[]> {
  try {
    const count = await fetchAuctionCount();
    if (count === 0) return [];

    const promises: Promise<Auction | null>[] = [];
    for (let i = 1; i <= count; i++) {
      promises.push(fetchAuction(i));
    }

    const results = await Promise.all(promises);
    return results.filter((a): a is Auction => a !== null);
  } catch {
    return [];
  }
}

export async function checkUserRegistration(address: string): Promise<{ isRegistered: boolean; username: string }> {
  if (!address) return { isRegistered: false, username: '' };
  try {
    const key = xdr.ScVal.scvVec([
      xdr.ScVal.scvSymbol('Username'),
      new Address(address).toScVal()
    ]);

    const entry = await server.getContractData(CONTRACT_ID, key, 'persistent' as any);
    if (!entry || !entry.val) return { isRegistered: false, username: '' };

    const valObj: any = entry.val;
    const scVal = valObj.val ? valObj.val() : valObj;
    const username = scValToNative(scVal);
    return { isRegistered: true, username: String(username) };
  } catch {
    return { isRegistered: false, username: '' };
  }
}

export async function fetchUserBidDeposit(auctionId: number, address: string): Promise<number> {
  if (!address) return 0;
  try {
    const key = xdr.ScVal.scvVec([
      xdr.ScVal.scvSymbol('BidDeposit'),
      xdr.ScVal.scvU64(new xdr.Uint64(auctionId)),
      new Address(address).toScVal()
    ]);

    const entry = await server.getContractData(CONTRACT_ID, key, 'persistent' as any);
    if (!entry || !entry.val) return 0;

    const valObj: any = entry.val;
    const scVal = valObj.val ? valObj.val() : valObj;
    const depositStroops = scValToNative(scVal);
    return stroopsToXlm(depositStroops);
  } catch {
    return 0;
  }
}
