import { rpc, scValToNative, Address, xdr } from '@stellar/stellar-sdk';
import { CONTRACT_ID, RPC_URL } from '../utils/constants';
import { stroopsToXlm } from '../utils/formatters';
import { Auction, AuctionStatusType, Organisation } from '../types';

const server = new rpc.Server(RPC_URL);

/**
 * Extracts the ScVal from the ledger entry returned by getContractData.
 * Accounts for different versions of stellar-sdk and union/non-union representation.
 */
function getScVal(entry: any): xdr.ScVal {
  if (!entry || !entry.val) {
    throw new Error("No ledger entry value found");
  }
  // Standard way in newer SDKs: entry.val is LedgerEntryData, which is a union
  if (typeof entry.val.contractData === 'function') {
    return entry.val.contractData().val();
  }
  // Fallbacks for older SDK versions or alternative shapes
  if (typeof entry.val.val === 'function') {
    return entry.val.val();
  }
  if (entry.val.val !== undefined) {
    return entry.val.val;
  }
  return entry.val;
}

// ─── Organisation Queries ───

export async function fetchOrgCount(): Promise<number> {
  try {
    const key = xdr.ScVal.scvSymbol('OrgCount');
    const result = await server.getContractData(CONTRACT_ID, key, 'instance' as any);
    if (!result || !result.val) return 0;
    const scVal = getScVal(result);
    return Number(scValToNative(scVal));
  } catch (err) {
    console.error("fetchOrgCount error:", err);
    return 0;
  }
}

export async function fetchOrg(id: number): Promise<Organisation | null> {
  try {
    const key = xdr.ScVal.scvVec([
      xdr.ScVal.scvSymbol('Org'),
      xdr.ScVal.scvU64(new xdr.Uint64(id))
    ]);

    const entry = await server.getContractData(CONTRACT_ID, key, 'persistent' as any);
    if (!entry || !entry.val) return null;

    const scVal = getScVal(entry);
    const raw: any = scValToNative(scVal);

    return {
      id: Number(raw.id),
      name: raw.name,
      description: raw.description,
      owner: raw.owner.toString(),
      memberCount: Number(raw.member_count),
    };
  } catch (err) {
    console.error(`Failed to fetch org ${id}:`, err);
    return null;
  }
}

export async function fetchAllOrgs(): Promise<Organisation[]> {
  try {
    const count = await fetchOrgCount();
    if (count === 0) return [];

    const promises: Promise<Organisation | null>[] = [];
    for (let i = 1; i <= count; i++) {
      promises.push(fetchOrg(i));
    }

    const results = await Promise.all(promises);
    return results.filter((o): o is Organisation => o !== null);
  } catch (err) {
    console.error("fetchAllOrgs error:", err);
    return [];
  }
}

export async function isOrgMember(orgId: number, address: string): Promise<boolean> {
  if (!address) return false;
  try {
    const key = xdr.ScVal.scvVec([
      xdr.ScVal.scvSymbol('OrgMember'),
      xdr.ScVal.scvU64(new xdr.Uint64(orgId)),
      new Address(address).toScVal()
    ]);

    const entry = await server.getContractData(CONTRACT_ID, key, 'persistent' as any);
    if (!entry || !entry.val) return false;

    const scVal = getScVal(entry);
    return Boolean(scValToNative(scVal));
  } catch (err) {
    console.error(`isOrgMember error for org ${orgId}, user ${address}:`, err);
    return false;
  }
}

// ─── Auction Queries ───

export async function fetchAuctionCount(): Promise<number> {
  try {
    const key = xdr.ScVal.scvSymbol('AuctionCount');
    const result = await server.getContractData(CONTRACT_ID, key, 'instance' as any);
    if (!result || !result.val) return 0;

    const scVal = getScVal(result);
    const native = scValToNative(scVal);
    return Number(native);
  } catch (err) {
    console.error("fetchAuctionCount error:", err);
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

    const scVal = getScVal(entry);
    const raw: any = scValToNative(scVal);

    let statusStr: AuctionStatusType = 'Pending';
    if (typeof raw.status === 'string') {
      statusStr = raw.status as AuctionStatusType;
    } else if (raw.status && typeof raw.status === 'object') {
      statusStr = Object.keys(raw.status)[0] as AuctionStatusType;
    }

    return {
      id: Number(raw.id),
      orgId: Number(raw.org_id),
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
  } catch (err) {
    console.error("fetchAllAuctions error:", err);
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
    const key = xdr.ScVal.scvVec([
      xdr.ScVal.scvSymbol('Username'),
      new Address(address).toScVal()
    ]);

    const entry = await server.getContractData(CONTRACT_ID, key, 'persistent' as any);
    if (!entry || !entry.val) return { isRegistered: false, username: '' };

    const scVal = getScVal(entry);
    const username = scValToNative(scVal);
    return { isRegistered: true, username: String(username) };
  } catch (err) {
    // If it's a 404 error from getContractData, it means the entry isn't found, which is expected for unregistered users
    const is404 = err && typeof err === 'object' && ('code' in err && (err as any).code === 404 || 'message' in err && String((err as any).message).includes('not found'));
    if (!is404) {
      console.error("checkUserRegistration unexpected error for address:", address, err);
    }
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

    const scVal = getScVal(entry);
    const depositStroops = scValToNative(scVal);
    return stroopsToXlm(depositStroops);
  } catch (err) {
    const is404 = err && typeof err === 'object' && ('code' in err && (err as any).code === 404 || 'message' in err && String((err as any).message).includes('not found'));
    if (!is404) {
      console.error(`fetchUserBidDeposit unexpected error for auctionId ${auctionId}, address ${address}:`, err);
    }
    return 0;
  }
}
