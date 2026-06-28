use soroban_sdk::{contracttype, Address, String};

#[contracttype]
#[derive(Clone)]
pub enum DataKey {
    Admin,
    TokenId,
    AuctionCount,
    Username(Address),
    UsernameExists(String),
    Auction(u64),
    BidDeposit(u64, Address),
    OrgCount,
    Org(u64),
    OrgMember(u64, Address),
}
