import {
  rpc,
  scValToNative,
  Address,
  Contract,
  TransactionBuilder,
  Account,
  xdr,
} from '@stellar/stellar-sdk';
import { CONTRACT_ID, NETWORK_PASSPHRASE, RPC_URL } from '../utils/constants';
import { stroopsToXlm } from '../utils/formatters';
import { Auction, AuctionStatusType, Organisation } from '../types';

const server = new rpc.Server(RPC_URL);
const contract = new Contract(CONTRACT_ID);

// A dummy account used only for simulation (no real signing needed for reads)
const DUMMY_ACCOUNT = new Account(
  'GA7BHAL7B6SZDSCOPWPQQA3ENQO6CELFX6YINE6JGVQ4F3E2VL6K7RSM',
  '0'
);

/**
 * Calls a read-only contract function via simulation and returns the result as a native JS value.
 */
async function simulateContractCall(functionName: string, ...args: xdr.ScVal[]): Promise<any> {
  const tx = new TransactionBuilder(DUMMY_ACCOUNT, {
    fee: '100',
    networkPassphrase: NETWORK_PASSPHRASE,
  })
    .addOperation(contract.call(functionName, ...args))
    .setTimeout(30)
    .build();

  const simResult = await server.simulateTransaction(tx);

  if (!rpc.Api.isSimulationSuccess(simResult)) {
    const errorResult = simResult as any;
    throw new Error(
      `Simulation failed for ${functionName}: ${errorResult.error ?? errorResult.reason ?? JSON.stringify(simResult)}`
    );
  }

  const results = (simResult as rpc.Api.SimulateTransactionSuccessResponse).result;
  if (!results || !results.retval) {
    return null;
  }

  return scValToNative(results.retval);
}

// ─── Organisation Queries ───

export async function fetchOrgCount(): Promise<number> {
  try {
    const count = await simulateContractCall('get_org_count');
    return Number(count ?? 0);
  } catch (err) {
    console.error('fetchOrgCount error:', err);
    return 0;
  }
}

export async function fetchOrg(id: number): Promise<Organisation | null> {
  try {
    const raw = await simulateContractCall(
      'get_org',
      xdr.ScVal.scvU64(xdr.Uint64.fromString(id.toString()))
    );
    if (!raw || raw.__type === 'error') return null;

    // raw might be the error enum or the actual data
    // If it's an object with an 'Err' key, the org doesn't exist
    if (raw && typeof raw === 'object' && 'Err' in raw) return null;

    return {
      id: Number(raw.id),
      name: String(raw.name),
      description: String(raw.description),
      owner: String(raw.owner),
      memberCount: Number(raw.member_count),
    };
  } catch (err: any) {
    // OrgNotFound errors are expected for ids that don't exist
    const msg = String(err?.message ?? '');
    if (msg.includes('OrgNotFound') || msg.includes('failed')) {
      return null;
    }
    console.error(`fetchOrg(${id}) error:`, err);
    return null;
  }
}

export async function fetchAllOrgs(): Promise<Organisation[]> {
  try {
    const count = await fetchOrgCount();
    console.log(`[fetchAllOrgs] OrgCount = ${count}`);
    if (count === 0) return [];

    const promises: Promise<Organisation | null>[] = [];
    for (let i = 1; i <= count; i++) {
      promises.push(fetchOrg(i));
    }

    const results = await Promise.all(promises);
    const orgs = results.filter((o): o is Organisation => o !== null);
    console.log(`[fetchAllOrgs] Found ${orgs.length} orgs:`, orgs);
    return orgs;
  } catch (err) {
    console.error('fetchAllOrgs error:', err);
    return [];
  }
}

export async function isOrgMember(orgId: number, address: string): Promise<boolean> {
  if (!address) return false;
  try {
    const result = await simulateContractCall(
      'is_org_member',
      xdr.ScVal.scvU64(xdr.Uint64.fromString(orgId.toString())),
      new Address(address).toScVal()
    );
    return Boolean(result);
  } catch (err) {
    console.error(`isOrgMember(${orgId}, ${address}) error:`, err);
    return false;
  }
}

// ─── Auction Queries ───

export async function fetchAuctionCount(): Promise<number> {
  try {
    const count = await simulateContractCall('get_auction_count');
    return Number(count ?? 0);
  } catch (err) {
    console.error('fetchAuctionCount error:', err);
    return 0;
  }
}

export async function fetchAuction(id: number): Promise<Auction | null> {
  try {
    const raw = await simulateContractCall(
      'get_auction',
      xdr.ScVal.scvU64(xdr.Uint64.fromString(id.toString()))
    );
    if (!raw || (raw && typeof raw === 'object' && 'Err' in raw)) return null;

    let statusStr: AuctionStatusType = 'Pending';
    if (typeof raw.status === 'string') {
      statusStr = raw.status as AuctionStatusType;
    } else if (Array.isArray(raw.status)) {
      statusStr = raw.status[0] as AuctionStatusType;
    } else if (raw.status && typeof raw.status === 'object') {
      statusStr = Object.keys(raw.status)[0] as AuctionStatusType;
    }

    return {
      id: Number(raw.id),
      orgId: Number(raw.org_id),
      creator: String(raw.creator),
      title: String(raw.title),
      description: String(raw.description),
      mediaUrl: String(raw.media_url),
      startingBid: stroopsToXlm(raw.starting_bid),
      minIncrement: stroopsToXlm(raw.min_increment),
      endTime: Number(raw.end_time),
      status: statusStr,
      highestBid: stroopsToXlm(raw.highest_bid),
      highestBidder: raw.highest_bidder ? String(raw.highest_bidder) : '',
      totalBids: Number(raw.total_bids),
    };
  } catch (err: any) {
    const msg = String(err?.message ?? '');
    if (msg.includes('AuctionNotFound') || msg.includes('failed')) return null;
    console.error(`fetchAuction(${id}) error:`, err);
    return null;
  }
}

export async function fetchAllAuctions(): Promise<Auction[]> {
  try {
    const count = await fetchAuctionCount();
    console.log(`[fetchAllAuctions] AuctionCount = ${count}`);
    if (count === 0) return [];

    const promises: Promise<Auction | null>[] = [];
    for (let i = 1; i <= count; i++) {
      promises.push(fetchAuction(i));
    }

    const results = await Promise.all(promises);
    return results.filter((a): a is Auction => a !== null);
  } catch (err) {
    console.error('fetchAllAuctions error:', err);
    return [];
  }
}

export async function fetchAuctionsByOrg(orgId: number): Promise<Auction[]> {
  const all = await fetchAllAuctions();
  return all.filter(a => a.orgId === orgId);
}

// ─── User Queries ───

export async function checkUserRegistration(address: string): Promise<{ isRegistered: boolean; username: string }> {
  if (!address) return { isRegistered: false, username: '' };
  try {
    // Call get_username directly to fetch the username.
    // If not registered, it will throw Error(Contract, #5), which we handle gracefully.
    const username = await simulateContractCall(
      'get_username',
      new Address(address).toScVal()
    );

    if (!username || (username && typeof username === 'object' && 'Err' in username)) {
      return { isRegistered: false, username: '' };
    }
    return { isRegistered: true, username: String(username) };
  } catch (err: any) {
    const errStr = String(err?.message ?? '');
    // Error code 5 is UserNotRegistered
    if (errStr.includes('Error(Contract, #5)') || errStr.includes('Error(#5)') || errStr.includes('ErrorCode:5')) {
      return { isRegistered: false, username: '' };
    }
    console.error('checkUserRegistration unexpected error:', err);
    return { isRegistered: false, username: '' };
  }
}

export async function fetchUserBidDeposit(auctionId: number, address: string): Promise<number> {
  if (!address) return 0;
  try {
    const deposit = await simulateContractCall(
      'get_bid_deposit',
      xdr.ScVal.scvU64(xdr.Uint64.fromString(auctionId.toString())),
      new Address(address).toScVal()
    );
    return stroopsToXlm(deposit ?? 0);
  } catch (err) {
    console.error(`fetchUserBidDeposit(${auctionId}, ${address}) error:`, err);
    return 0;
  }
}
