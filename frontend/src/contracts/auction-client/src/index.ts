import { Buffer } from "buffer";
import { Address } from "@stellar/stellar-sdk";
import {
  AssembledTransaction,
  Client as ContractClient,
  ClientOptions as ContractClientOptions,
  MethodOptions,
  Result,
  Spec as ContractSpec,
} from "@stellar/stellar-sdk/contract";
import type {
  u32,
  i32,
  u64,
  i64,
  u128,
  i128,
  u256,
  i256,
  Option,
  Timepoint,
  Duration,
} from "@stellar/stellar-sdk/contract";
export * from "@stellar/stellar-sdk";
export * as contract from "@stellar/stellar-sdk/contract";
export * as rpc from "@stellar/stellar-sdk/rpc";

if (typeof window !== "undefined") {
  //@ts-ignore Buffer exists
  window.Buffer = window.Buffer || Buffer;
}


export const networks = {
  testnet: {
    networkPassphrase: "Test SDF Network ; September 2015",
    contractId: "CAJ264RMXHJLSIO35CZ6EYSQ5VYF6KAQI2GD7DUEJANVATXW7RMBYW5X",
  }
} as const

export const AuctionError = {
  1: {message:"AlreadyInitialized"},
  2: {message:"NotInitialized"},
  3: {message:"UsernameAlreadyClaimed"},
  4: {message:"UserAlreadyRegistered"},
  5: {message:"UserNotRegistered"},
  6: {message:"NotAdmin"},
  7: {message:"AuctionNotFound"},
  8: {message:"AuctionNotApproved"},
  9: {message:"AuctionEnded"},
  10: {message:"AuctionNotEnded"},
  11: {message:"BidTooLow"},
  12: {message:"BidBelowIncrement"},
  13: {message:"InsufficientBalance"},
  14: {message:"CannotBidOwnAuction"},
  15: {message:"AuctionAlreadyReviewed"},
  16: {message:"NoBidsToRefund"},
  17: {message:"NotLoser"},
  18: {message:"AlreadyFinalized"},
  19: {message:"InvalidUsername"},
  20: {message:"InvalidEndTime"}
}


/**
 * All data associated with a single auction.
 */
export interface AuctionData {
  /**
 * Wallet address of the user who created this auction
 */
creator: string;
  /**
 * Full description of the auctioned item/service
 */
description: string;
  /**
 * Unix timestamp when the auction closes
 */
end_time: u64;
  /**
 * Current highest bid amount (cumulative, in stroops)
 */
highest_bid: i128;
  /**
 * Address of the current highest bidder (creator address if no bids)
 */
highest_bidder: string;
  /**
 * Unique sequential auction ID
 */
id: u64;
  /**
 * IPFS URL for images or videos
 */
media_url: string;
  /**
 * Minimum increment above current highest bid (in stroops)
 */
min_increment: i128;
  /**
 * Minimum starting bid amount (in stroops: 1 XLM = 10_000_000)
 */
starting_bid: i128;
  /**
 * Current lifecycle status
 */
status: AuctionStatus;
  /**
 * Auction title (displayed in cards and detail page)
 */
title: string;
  /**
 * Total number of bid transactions placed
 */
total_bids: u32;
}

/**
 * The lifecycle status of an auction.
 */
export type AuctionStatus = {tag: "Pending", values: void} | {tag: "Approved", values: void} | {tag: "Rejected", values: void} | {tag: "Ended", values: void};

/**
 * Storage keys for all contract data.
 * 
 * Instance storage (loaded every invocation, kept small):
 * - Admin, TokenId, AuctionCount
 * 
 * Persistent storage (per-entity, long-lived):
 * - Username, UsernameExists, Auction, BidDeposit
 */
export type DataKey = {tag: "Admin", values: void} | {tag: "TokenId", values: void} | {tag: "AuctionCount", values: void} | {tag: "Username", values: readonly [string]} | {tag: "UsernameExists", values: readonly [string]} | {tag: "Auction", values: readonly [u64]} | {tag: "BidDeposit", values: readonly [u64, string]};

export interface Client {
  /**
   * Construct and simulate a get_admin transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Returns the admin address.
   */
  get_admin: (options?: MethodOptions) => Promise<AssembledTransaction<Result<string>>>

  /**
   * Construct and simulate a place_bid transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Places a bid on an approved auction. The `amount` is the ADDITIONAL XLM
   * to escrow. The contract tracks cumulative totals per bidder.
   * 
   * Validation:
   * - Auction must be Approved
   * - Current time < end_time
   * - Bidder ≠ creator
   * - cumulative_total ≥ starting_bid (if no bids yet)
   * - cumulative_total ≥ highest_bid + min_increment (if bids exist)
   */
  place_bid: ({bidder, auction_id, amount}: {bidder: string, auction_id: u64, amount: i128}, options?: MethodOptions) => Promise<AssembledTransaction<Result<void>>>

  /**
   * Construct and simulate a initialize transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Called once after deployment. Sets the admin (reviewer) wallet and the
   * XLM Stellar Asset Contract address. Cannot be called again.
   */
  initialize: ({admin, token_id}: {admin: string, token_id: string}, options?: MethodOptions) => Promise<AssembledTransaction<Result<void>>>

  /**
   * Construct and simulate a get_auction transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Returns auction data by ID.
   */
  get_auction: ({auction_id}: {auction_id: u64}, options?: MethodOptions) => Promise<AssembledTransaction<Result<AuctionData>>>

  /**
   * Construct and simulate a claim_refund transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Allows losing bidders to reclaim their escrowed XLM after an auction ends.
   * The winner cannot claim a refund (their funds went to the creator).
   */
  claim_refund: ({bidder, auction_id}: {bidder: string, auction_id: u64}, options?: MethodOptions) => Promise<AssembledTransaction<Result<void>>>

  /**
   * Construct and simulate a get_username transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Returns the username for a given wallet address.
   */
  get_username: ({user}: {user: string}, options?: MethodOptions) => Promise<AssembledTransaction<Result<string>>>

  /**
   * Construct and simulate a is_registered transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Checks if a wallet address has registered a username.
   */
  is_registered: ({user}: {user: string}, options?: MethodOptions) => Promise<AssembledTransaction<boolean>>

  /**
   * Construct and simulate a register_user transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Permanently claims a unique username for the caller's wallet address.
   * Once set, it can never be changed. Username must be 3-20 characters.
   */
  register_user: ({user, username}: {user: string, username: string}, options?: MethodOptions) => Promise<AssembledTransaction<Result<void>>>

  /**
   * Construct and simulate a create_auction transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Creates a new auction in Pending state. Only registered users can create.
   * Returns the new auction's ID.
   */
  create_auction: ({creator, title, description, media_url, starting_bid, min_increment, end_time}: {creator: string, title: string, description: string, media_url: string, starting_bid: i128, min_increment: i128, end_time: u64}, options?: MethodOptions) => Promise<AssembledTransaction<Result<u64>>>

  /**
   * Construct and simulate a review_auction transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Admin approves or rejects a pending auction.
   * Only the admin wallet set during initialization can call this.
   */
  review_auction: ({admin, auction_id, approved}: {admin: string, auction_id: u64, approved: boolean}, options?: MethodOptions) => Promise<AssembledTransaction<Result<void>>>

  /**
   * Construct and simulate a get_bid_deposit transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Returns a specific bidder's cumulative deposit for an auction.
   */
  get_bid_deposit: ({auction_id, bidder}: {auction_id: u64, bidder: string}, options?: MethodOptions) => Promise<AssembledTransaction<i128>>

  /**
   * Construct and simulate a finalize_auction transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Finalizes an auction after its end time. Anyone can call this.
   * Transfers the winner's escrowed XLM to the auction creator.
   */
  finalize_auction: ({caller, auction_id}: {caller: string, auction_id: u64}, options?: MethodOptions) => Promise<AssembledTransaction<Result<void>>>

  /**
   * Construct and simulate a get_auction_count transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Returns the total number of auctions ever created.
   */
  get_auction_count: (options?: MethodOptions) => Promise<AssembledTransaction<u64>>

}
export class Client extends ContractClient {
  static async deploy<T = Client>(
    /** Options for initializing a Client as well as for calling a method, with extras specific to deploying. */
    options: MethodOptions &
      Omit<ContractClientOptions, "contractId"> & {
        /** The hash of the Wasm blob, which must already be installed on-chain. */
        wasmHash: Buffer | string;
        /** Salt used to generate the contract's ID. Passed through to {@link Operation.createCustomContract}. Default: random. */
        salt?: Buffer | Uint8Array;
        /** The format used to decode `wasmHash`, if it's provided as a string. */
        format?: "hex" | "base64";
      }
  ): Promise<AssembledTransaction<T>> {
    return ContractClient.deploy(null, options)
  }
  constructor(public readonly options: ContractClientOptions) {
    super(
      new ContractSpec([ "AAAAAAAAABpSZXR1cm5zIHRoZSBhZG1pbiBhZGRyZXNzLgAAAAAACWdldF9hZG1pbgAAAAAAAAAAAAABAAAD6QAAABMAAAfQAAAADEF1Y3Rpb25FcnJvcg==",
        "AAAAAAAAAVNQbGFjZXMgYSBiaWQgb24gYW4gYXBwcm92ZWQgYXVjdGlvbi4gVGhlIGBhbW91bnRgIGlzIHRoZSBBRERJVElPTkFMIFhMTQp0byBlc2Nyb3cuIFRoZSBjb250cmFjdCB0cmFja3MgY3VtdWxhdGl2ZSB0b3RhbHMgcGVyIGJpZGRlci4KClZhbGlkYXRpb246Ci0gQXVjdGlvbiBtdXN0IGJlIEFwcHJvdmVkCi0gQ3VycmVudCB0aW1lIDwgZW5kX3RpbWUKLSBCaWRkZXIg4omgIGNyZWF0b3IKLSBjdW11bGF0aXZlX3RvdGFsIOKJpSBzdGFydGluZ19iaWQgKGlmIG5vIGJpZHMgeWV0KQotIGN1bXVsYXRpdmVfdG90YWwg4omlIGhpZ2hlc3RfYmlkICsgbWluX2luY3JlbWVudCAoaWYgYmlkcyBleGlzdCkAAAAACXBsYWNlX2JpZAAAAAAAAAMAAAAAAAAABmJpZGRlcgAAAAAAEwAAAAAAAAAKYXVjdGlvbl9pZAAAAAAABgAAAAAAAAAGYW1vdW50AAAAAAALAAAAAQAAA+kAAAPtAAAAAAAAB9AAAAAMQXVjdGlvbkVycm9y",
        "AAAAAAAAAIJDYWxsZWQgb25jZSBhZnRlciBkZXBsb3ltZW50LiBTZXRzIHRoZSBhZG1pbiAocmV2aWV3ZXIpIHdhbGxldCBhbmQgdGhlClhMTSBTdGVsbGFyIEFzc2V0IENvbnRyYWN0IGFkZHJlc3MuIENhbm5vdCBiZSBjYWxsZWQgYWdhaW4uAAAAAAAKaW5pdGlhbGl6ZQAAAAAAAgAAAAAAAAAFYWRtaW4AAAAAAAATAAAAAAAAAAh0b2tlbl9pZAAAABMAAAABAAAD6QAAA+0AAAAAAAAH0AAAAAxBdWN0aW9uRXJyb3I=",
        "AAAAAAAAABtSZXR1cm5zIGF1Y3Rpb24gZGF0YSBieSBJRC4AAAAAC2dldF9hdWN0aW9uAAAAAAEAAAAAAAAACmF1Y3Rpb25faWQAAAAAAAYAAAABAAAD6QAAB9AAAAALQXVjdGlvbkRhdGEAAAAH0AAAAAxBdWN0aW9uRXJyb3I=",
        "AAAAAAAAAI5BbGxvd3MgbG9zaW5nIGJpZGRlcnMgdG8gcmVjbGFpbSB0aGVpciBlc2Nyb3dlZCBYTE0gYWZ0ZXIgYW4gYXVjdGlvbiBlbmRzLgpUaGUgd2lubmVyIGNhbm5vdCBjbGFpbSBhIHJlZnVuZCAodGhlaXIgZnVuZHMgd2VudCB0byB0aGUgY3JlYXRvcikuAAAAAAAMY2xhaW1fcmVmdW5kAAAAAgAAAAAAAAAGYmlkZGVyAAAAAAATAAAAAAAAAAphdWN0aW9uX2lkAAAAAAAGAAAAAQAAA+kAAAPtAAAAAAAAB9AAAAAMQXVjdGlvbkVycm9y",
        "AAAAAAAAADBSZXR1cm5zIHRoZSB1c2VybmFtZSBmb3IgYSBnaXZlbiB3YWxsZXQgYWRkcmVzcy4AAAAMZ2V0X3VzZXJuYW1lAAAAAQAAAAAAAAAEdXNlcgAAABMAAAABAAAD6QAAABAAAAfQAAAADEF1Y3Rpb25FcnJvcg==",
        "AAAAAAAAADVDaGVja3MgaWYgYSB3YWxsZXQgYWRkcmVzcyBoYXMgcmVnaXN0ZXJlZCBhIHVzZXJuYW1lLgAAAAAAAA1pc19yZWdpc3RlcmVkAAAAAAAAAQAAAAAAAAAEdXNlcgAAABMAAAABAAAAAQ==",
        "AAAAAAAAAIpQZXJtYW5lbnRseSBjbGFpbXMgYSB1bmlxdWUgdXNlcm5hbWUgZm9yIHRoZSBjYWxsZXIncyB3YWxsZXQgYWRkcmVzcy4KT25jZSBzZXQsIGl0IGNhbiBuZXZlciBiZSBjaGFuZ2VkLiBVc2VybmFtZSBtdXN0IGJlIDMtMjAgY2hhcmFjdGVycy4AAAAAAA1yZWdpc3Rlcl91c2VyAAAAAAAAAgAAAAAAAAAEdXNlcgAAABMAAAAAAAAACHVzZXJuYW1lAAAAEAAAAAEAAAPpAAAD7QAAAAAAAAfQAAAADEF1Y3Rpb25FcnJvcg==",
        "AAAAAAAAAGdDcmVhdGVzIGEgbmV3IGF1Y3Rpb24gaW4gUGVuZGluZyBzdGF0ZS4gT25seSByZWdpc3RlcmVkIHVzZXJzIGNhbiBjcmVhdGUuClJldHVybnMgdGhlIG5ldyBhdWN0aW9uJ3MgSUQuAAAAAA5jcmVhdGVfYXVjdGlvbgAAAAAABwAAAAAAAAAHY3JlYXRvcgAAAAATAAAAAAAAAAV0aXRsZQAAAAAAABAAAAAAAAAAC2Rlc2NyaXB0aW9uAAAAABAAAAAAAAAACW1lZGlhX3VybAAAAAAAABAAAAAAAAAADHN0YXJ0aW5nX2JpZAAAAAsAAAAAAAAADW1pbl9pbmNyZW1lbnQAAAAAAAALAAAAAAAAAAhlbmRfdGltZQAAAAYAAAABAAAD6QAAAAYAAAfQAAAADEF1Y3Rpb25FcnJvcg==",
        "AAAAAAAAAGtBZG1pbiBhcHByb3ZlcyBvciByZWplY3RzIGEgcGVuZGluZyBhdWN0aW9uLgpPbmx5IHRoZSBhZG1pbiB3YWxsZXQgc2V0IGR1cmluZyBpbml0aWFsaXphdGlvbiBjYW4gY2FsbCB0aGlzLgAAAAAOcmV2aWV3X2F1Y3Rpb24AAAAAAAMAAAAAAAAABWFkbWluAAAAAAAAEwAAAAAAAAAKYXVjdGlvbl9pZAAAAAAABgAAAAAAAAAIYXBwcm92ZWQAAAABAAAAAQAAA+kAAAPtAAAAAAAAB9AAAAAMQXVjdGlvbkVycm9y",
        "AAAABAAAAAAAAAAAAAAADEF1Y3Rpb25FcnJvcgAAABQAAAAAAAAAEkFscmVhZHlJbml0aWFsaXplZAAAAAAAAQAAAAAAAAAOTm90SW5pdGlhbGl6ZWQAAAAAAAIAAAAAAAAAFlVzZXJuYW1lQWxyZWFkeUNsYWltZWQAAAAAAAMAAAAAAAAAFVVzZXJBbHJlYWR5UmVnaXN0ZXJlZAAAAAAAAAQAAAAAAAAAEVVzZXJOb3RSZWdpc3RlcmVkAAAAAAAABQAAAAAAAAAITm90QWRtaW4AAAAGAAAAAAAAAA9BdWN0aW9uTm90Rm91bmQAAAAABwAAAAAAAAASQXVjdGlvbk5vdEFwcHJvdmVkAAAAAAAIAAAAAAAAAAxBdWN0aW9uRW5kZWQAAAAJAAAAAAAAAA9BdWN0aW9uTm90RW5kZWQAAAAACgAAAAAAAAAJQmlkVG9vTG93AAAAAAAACwAAAAAAAAARQmlkQmVsb3dJbmNyZW1lbnQAAAAAAAAMAAAAAAAAABNJbnN1ZmZpY2llbnRCYWxhbmNlAAAAAA0AAAAAAAAAE0Nhbm5vdEJpZE93bkF1Y3Rpb24AAAAADgAAAAAAAAAWQXVjdGlvbkFscmVhZHlSZXZpZXdlZAAAAAAADwAAAAAAAAAOTm9CaWRzVG9SZWZ1bmQAAAAAABAAAAAAAAAACE5vdExvc2VyAAAAEQAAAAAAAAAQQWxyZWFkeUZpbmFsaXplZAAAABIAAAAAAAAAD0ludmFsaWRVc2VybmFtZQAAAAATAAAAAAAAAA5JbnZhbGlkRW5kVGltZQAAAAAAFA==",
        "AAAAAAAAAD5SZXR1cm5zIGEgc3BlY2lmaWMgYmlkZGVyJ3MgY3VtdWxhdGl2ZSBkZXBvc2l0IGZvciBhbiBhdWN0aW9uLgAAAAAAD2dldF9iaWRfZGVwb3NpdAAAAAACAAAAAAAAAAphdWN0aW9uX2lkAAAAAAAGAAAAAAAAAAZiaWRkZXIAAAAAABMAAAABAAAACw==",
        "AAAAAAAAAHpGaW5hbGl6ZXMgYW4gYXVjdGlvbiBhZnRlciBpdHMgZW5kIHRpbWUuIEFueW9uZSBjYW4gY2FsbCB0aGlzLgpUcmFuc2ZlcnMgdGhlIHdpbm5lcidzIGVzY3Jvd2VkIFhMTSB0byB0aGUgYXVjdGlvbiBjcmVhdG9yLgAAAAAAEGZpbmFsaXplX2F1Y3Rpb24AAAACAAAAAAAAAAZjYWxsZXIAAAAAABMAAAAAAAAACmF1Y3Rpb25faWQAAAAAAAYAAAABAAAD6QAAA+0AAAAAAAAH0AAAAAxBdWN0aW9uRXJyb3I=",
        "AAAAAAAAADJSZXR1cm5zIHRoZSB0b3RhbCBudW1iZXIgb2YgYXVjdGlvbnMgZXZlciBjcmVhdGVkLgAAAAAAEWdldF9hdWN0aW9uX2NvdW50AAAAAAAAAAAAAAEAAAAG",
        "AAAAAQAAACpBbGwgZGF0YSBhc3NvY2lhdGVkIHdpdGggYSBzaW5nbGUgYXVjdGlvbi4AAAAAAAAAAAALQXVjdGlvbkRhdGEAAAAADAAAADNXYWxsZXQgYWRkcmVzcyBvZiB0aGUgdXNlciB3aG8gY3JlYXRlZCB0aGlzIGF1Y3Rpb24AAAAAB2NyZWF0b3IAAAAAEwAAAC5GdWxsIGRlc2NyaXB0aW9uIG9mIHRoZSBhdWN0aW9uZWQgaXRlbS9zZXJ2aWNlAAAAAAALZGVzY3JpcHRpb24AAAAAEAAAACZVbml4IHRpbWVzdGFtcCB3aGVuIHRoZSBhdWN0aW9uIGNsb3NlcwAAAAAACGVuZF90aW1lAAAABgAAADNDdXJyZW50IGhpZ2hlc3QgYmlkIGFtb3VudCAoY3VtdWxhdGl2ZSwgaW4gc3Ryb29wcykAAAAAC2hpZ2hlc3RfYmlkAAAAAAsAAABCQWRkcmVzcyBvZiB0aGUgY3VycmVudCBoaWdoZXN0IGJpZGRlciAoY3JlYXRvciBhZGRyZXNzIGlmIG5vIGJpZHMpAAAAAAAOaGlnaGVzdF9iaWRkZXIAAAAAABMAAAAcVW5pcXVlIHNlcXVlbnRpYWwgYXVjdGlvbiBJRAAAAAJpZAAAAAAABgAAAB1JUEZTIFVSTCBmb3IgaW1hZ2VzIG9yIHZpZGVvcwAAAAAAAAltZWRpYV91cmwAAAAAAAAQAAAAOE1pbmltdW0gaW5jcmVtZW50IGFib3ZlIGN1cnJlbnQgaGlnaGVzdCBiaWQgKGluIHN0cm9vcHMpAAAADW1pbl9pbmNyZW1lbnQAAAAAAAALAAAAPE1pbmltdW0gc3RhcnRpbmcgYmlkIGFtb3VudCAoaW4gc3Ryb29wczogMSBYTE0gPSAxMF8wMDBfMDAwKQAAAAxzdGFydGluZ19iaWQAAAALAAAAGEN1cnJlbnQgbGlmZWN5Y2xlIHN0YXR1cwAAAAZzdGF0dXMAAAAAB9AAAAANQXVjdGlvblN0YXR1cwAAAAAAADJBdWN0aW9uIHRpdGxlIChkaXNwbGF5ZWQgaW4gY2FyZHMgYW5kIGRldGFpbCBwYWdlKQAAAAAABXRpdGxlAAAAAAAAEAAAACdUb3RhbCBudW1iZXIgb2YgYmlkIHRyYW5zYWN0aW9ucyBwbGFjZWQAAAAACnRvdGFsX2JpZHMAAAAAAAQ=",
        "AAAAAgAAACNUaGUgbGlmZWN5Y2xlIHN0YXR1cyBvZiBhbiBhdWN0aW9uLgAAAAAAAAAADUF1Y3Rpb25TdGF0dXMAAAAAAAAEAAAAAAAAAAAAAAAHUGVuZGluZwAAAAAAAAAAAAAAAAhBcHByb3ZlZAAAAAAAAAAAAAAACFJlamVjdGVkAAAAAAAAAAAAAAAFRW5kZWQAAAA=",
        "AAAAAgAAANlTdG9yYWdlIGtleXMgZm9yIGFsbCBjb250cmFjdCBkYXRhLgoKSW5zdGFuY2Ugc3RvcmFnZSAobG9hZGVkIGV2ZXJ5IGludm9jYXRpb24sIGtlcHQgc21hbGwpOgotIEFkbWluLCBUb2tlbklkLCBBdWN0aW9uQ291bnQKClBlcnNpc3RlbnQgc3RvcmFnZSAocGVyLWVudGl0eSwgbG9uZy1saXZlZCk6Ci0gVXNlcm5hbWUsIFVzZXJuYW1lRXhpc3RzLCBBdWN0aW9uLCBCaWREZXBvc2l0AAAAAAAAAAAAAAdEYXRhS2V5AAAAAAcAAAAAAAAALFRoZSBhZG1pbi9yZXZpZXdlciB3YWxsZXQgYWRkcmVzcyAoSW5zdGFuY2UpAAAABUFkbWluAAAAAAAAAAAAADFUaGUgWExNIFN0ZWxsYXIgQXNzZXQgQ29udHJhY3QgYWRkcmVzcyAoSW5zdGFuY2UpAAAAAAAAB1Rva2VuSWQAAAAAAAAAADNHbG9iYWwgY291bnRlciBvZiB0b3RhbCBhdWN0aW9ucyBjcmVhdGVkIChJbnN0YW5jZSkAAAAADEF1Y3Rpb25Db3VudAAAAAEAAAA6TWFwcyBhIHdhbGxldCBhZGRyZXNzIHRvIGl0cyBjbGFpbWVkIHVzZXJuYW1lIChQZXJzaXN0ZW50KQAAAAAACFVzZXJuYW1lAAAAAQAAABMAAAABAAAAYk1hcHMgYSB1c2VybmFtZSBzdHJpbmcgdG8gdGhlIHdhbGxldCB0aGF0IGNsYWltZWQgaXQgKFBlcnNpc3RlbnQpClVzZWQgZm9yIHVuaXF1ZW5lc3MgZW5mb3JjZW1lbnQuAAAAAAAOVXNlcm5hbWVFeGlzdHMAAAAAAAEAAAAQAAAAAQAAADlNYXBzIGFuIGF1Y3Rpb24gSUQgdG8gaXRzIEF1Y3Rpb25EYXRhIHN0cnVjdCAoUGVyc2lzdGVudCkAAAAAAAAHQXVjdGlvbgAAAAABAAAABgAAAAEAAAChTWFwcyAoYXVjdGlvbl9pZCwgYmlkZGVyX2FkZHJlc3MpIHRvIGN1bXVsYXRpdmUgYmlkIGRlcG9zaXQgaW4gc3Ryb29wcyAoUGVyc2lzdGVudCkKVGhpcyBpcyB0aGUga2V5IGRlc2lnbiBmb3IgdHJhY2tpbmcgY3VtdWxhdGl2ZSBiaWRzIHdpdGhvdXQgdW5ib3VuZGVkIGFycmF5cy4AAAAAAAAKQmlkRGVwb3NpdAAAAAAAAgAAAAYAAAAT" ]),
      options
    )
  }
  public readonly fromJSON = {
    get_admin: this.txFromJSON<Result<string>>,
        place_bid: this.txFromJSON<Result<void>>,
        initialize: this.txFromJSON<Result<void>>,
        get_auction: this.txFromJSON<Result<AuctionData>>,
        claim_refund: this.txFromJSON<Result<void>>,
        get_username: this.txFromJSON<Result<string>>,
        is_registered: this.txFromJSON<boolean>,
        register_user: this.txFromJSON<Result<void>>,
        create_auction: this.txFromJSON<Result<u64>>,
        review_auction: this.txFromJSON<Result<void>>,
        get_bid_deposit: this.txFromJSON<i128>,
        finalize_auction: this.txFromJSON<Result<void>>,
        get_auction_count: this.txFromJSON<u64>
  }
}