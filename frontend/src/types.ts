export type AuctionStatusType = 'Pending' | 'Approved' | 'Rejected' | 'Ended';

export interface Organisation {
  id: number;
  name: string;
  description: string;
  owner: string;
  memberCount: number;
}

export interface Auction {
  id: number;
  orgId: number;
  creator: string;
  title: string;
  description: string;
  mediaUrl: string;
  startingBid: number; // in XLM
  minIncrement: number; // in XLM
  endTime: number; // unix timestamp seconds
  status: AuctionStatusType;
  highestBid: number; // in XLM
  highestBidder: string;
  totalBids: number;
}

export interface BidEvent {
  auctionId: number;
  bidder: string;
  totalBid: number;
  timestamp: number;
}

export type TxStatus = 'IDLE' | 'SIMULATING' | 'SIGNING' | 'SUBMITTING' | 'PENDING' | 'SUCCESS' | 'FAILED';

export interface TxState {
  status: TxStatus;
  message?: string;
  txHash?: string;
  error?: string;
}
