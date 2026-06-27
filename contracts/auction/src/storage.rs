use soroban_sdk::{contracttype, Address, String};

/// Storage keys for all contract data.
///
/// Instance storage (loaded every invocation, kept small):
///   - Admin, TokenId, AuctionCount
///
/// Persistent storage (per-entity, long-lived):
///   - Username, UsernameExists, Auction, BidDeposit
#[contracttype]
#[derive(Clone)]
pub enum DataKey {
    /// The admin/reviewer wallet address (Instance)
    Admin,
    /// The XLM Stellar Asset Contract address (Instance)
    TokenId,
    /// Global counter of total auctions created (Instance)
    AuctionCount,
    /// Maps a wallet address to its claimed username (Persistent)
    Username(Address),
    /// Maps a username string to the wallet that claimed it (Persistent)
    /// Used for uniqueness enforcement.
    UsernameExists(String),
    /// Maps an auction ID to its AuctionData struct (Persistent)
    Auction(u64),
    /// Maps (auction_id, bidder_address) to cumulative bid deposit in stroops (Persistent)
    /// This is the key design for tracking cumulative bids without unbounded arrays.
    BidDeposit(u64, Address),
}
