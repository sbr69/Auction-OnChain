use soroban_sdk::{contracttype, Address, String};

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub enum AuctionStatus {
    Pending,
    Approved,
    Rejected,
    Ended,
}

#[contracttype]
#[derive(Clone, Debug)]
pub struct AuctionData {
    pub id: u64,
    pub org_id: u64,
    pub creator: Address,
    pub title: String,
    pub description: String,
    pub media_url: String,
    pub starting_bid: i128,
    pub min_increment: i128,
    pub end_time: u64,
    pub status: AuctionStatus,
    pub highest_bid: i128,
    pub highest_bidder: Address,
    pub total_bids: u32,
}

#[contracttype]
#[derive(Clone, Debug)]
pub struct OrgData {
    pub id: u64,
    pub name: String,
    pub description: String,
    pub owner: Address,
    pub member_count: u32,
}
