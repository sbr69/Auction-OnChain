#![no_std]
use soroban_sdk::{contract, contracterror, contractimpl, token, Address, Env, String};

mod types;
mod storage;
mod events;

#[cfg(test)]
mod test;

use types::{AuctionData, AuctionStatus, OrgData};
use storage::DataKey;

#[contracterror]
#[derive(Copy, Clone, Debug, Eq, PartialEq, PartialOrd, Ord)]
#[repr(u32)]
pub enum AuctionError {
    AlreadyInitialized = 1,
    NotInitialized = 2,
    UsernameAlreadyClaimed = 3,
    UserAlreadyRegistered = 4,
    UserNotRegistered = 5,
    NotAdmin = 6,
    AuctionNotFound = 7,
    AuctionNotApproved = 8,
    AuctionEnded = 9,
    AuctionNotEnded = 10,
    BidTooLow = 11,
    BidBelowIncrement = 12,
    InsufficientBalance = 13,
    CannotBidOwnAuction = 14,
    AuctionAlreadyReviewed = 15,
    NoBidsToRefund = 16,
    NotLoser = 17,
    AlreadyFinalized = 18,
    InvalidUsername = 19,
    InvalidEndTime = 20,
    OrgNotFound = 21,
    NotOrgOwner = 22,
    AlreadyOrgMember = 23,
    NotOrgMember = 24,
    OrgAlreadyExists = 25,
}

#[contract]
pub struct StellarBidAuction;

#[contractimpl]
impl StellarBidAuction {
    pub fn initialize(
        env: Env,
        admin: Address,
        token_id: Address,
    ) -> Result<(), AuctionError> {
        if env.storage().instance().has(&DataKey::Admin) {
            return Err(AuctionError::AlreadyInitialized);
        }

        env.storage().instance().set(&DataKey::Admin, &admin);
        env.storage().instance().set(&DataKey::TokenId, &token_id);
        env.storage().instance().set(&DataKey::AuctionCount, &0u64);
        env.storage().instance().set(&DataKey::OrgCount, &0u64);

        Ok(())
    }

    // ─── User Registration ───

    pub fn register_user(
        env: Env,
        user: Address,
        username: String,
    ) -> Result<(), AuctionError> {
        user.require_auth();

        if !env.storage().instance().has(&DataKey::Admin) {
            return Err(AuctionError::NotInitialized);
        }

        let len = username.len() as u32;
        if len < 3 || len > 20 {
            return Err(AuctionError::InvalidUsername);
        }

        if env.storage().persistent().has(&DataKey::Username(user.clone())) {
            return Err(AuctionError::UserAlreadyRegistered);
        }

        if env.storage().persistent().has(&DataKey::UsernameExists(username.clone())) {
            return Err(AuctionError::UsernameAlreadyClaimed);
        }

        env.storage().persistent().set(&DataKey::Username(user.clone()), &username);
        env.storage().persistent().set(&DataKey::UsernameExists(username.clone()), &user);

        events::user_registered(&env, &user, &username);

        Ok(())
    }

    pub fn get_username(env: Env, user: Address) -> Result<String, AuctionError> {
        env.storage()
            .persistent()
            .get(&DataKey::Username(user))
            .ok_or(AuctionError::UserNotRegistered)
    }

    pub fn is_registered(env: Env, user: Address) -> bool {
        env.storage().persistent().has(&DataKey::Username(user))
    }

    // ─── Organisation Management ───

    pub fn create_org(
        env: Env,
        owner: Address,
        name: String,
        description: String,
    ) -> Result<u64, AuctionError> {
        owner.require_auth();

        if !env.storage().instance().has(&DataKey::Admin) {
            return Err(AuctionError::NotInitialized);
        }

        if !env.storage().persistent().has(&DataKey::Username(owner.clone())) {
            return Err(AuctionError::UserNotRegistered);
        }

        if env.storage().persistent().has(&DataKey::OrgExists(name.clone())) {
            return Err(AuctionError::OrgAlreadyExists);
        }

        let mut org_count: u64 = env.storage().instance().get(&DataKey::OrgCount).unwrap_or(0);
        org_count += 1;

        let org = OrgData {
            id: org_count,
            name: name.clone(),
            description,
            owner: owner.clone(),
            member_count: 1, // owner is automatically a member
        };

        env.storage().persistent().set(&DataKey::Org(org_count), &org);
        env.storage().persistent().set(&DataKey::OrgExists(name.clone()), &org_count);
        env.storage().instance().set(&DataKey::OrgCount, &org_count);

        // Owner is automatically a member of their own org
        env.storage().persistent().set(&DataKey::OrgMember(org_count, owner.clone()), &true);

        events::org_created(&env, org_count, &owner, &name);

        Ok(org_count)
    }

    pub fn join_org(
        env: Env,
        user: Address,
        org_id: u64,
    ) -> Result<(), AuctionError> {
        user.require_auth();

        if !env.storage().persistent().has(&DataKey::Username(user.clone())) {
            return Err(AuctionError::UserNotRegistered);
        }

        let mut org: OrgData = env.storage().persistent()
            .get(&DataKey::Org(org_id))
            .ok_or(AuctionError::OrgNotFound)?;

        if env.storage().persistent().has(&DataKey::OrgMember(org_id, user.clone())) {
            return Err(AuctionError::AlreadyOrgMember);
        }

        env.storage().persistent().set(&DataKey::OrgMember(org_id, user.clone()), &true);

        org.member_count += 1;
        env.storage().persistent().set(&DataKey::Org(org_id), &org);

        events::org_joined(&env, org_id, &user);

        Ok(())
    }

    pub fn get_org(env: Env, org_id: u64) -> Result<OrgData, AuctionError> {
        env.storage().persistent()
            .get(&DataKey::Org(org_id))
            .ok_or(AuctionError::OrgNotFound)
    }

    pub fn get_org_count(env: Env) -> u64 {
        env.storage().instance().get(&DataKey::OrgCount).unwrap_or(0)
    }

    pub fn is_org_member(env: Env, org_id: u64, user: Address) -> bool {
        env.storage().persistent()
            .get(&DataKey::OrgMember(org_id, user))
            .unwrap_or(false)
    }

    // ─── Auction Management ───

    pub fn create_auction(
        env: Env,
        creator: Address,
        org_id: u64,
        title: String,
        description: String,
        media_url: String,
        starting_bid: i128,
        min_increment: i128,
        end_time: u64,
    ) -> Result<u64, AuctionError> {
        creator.require_auth();

        if !env.storage().instance().has(&DataKey::Admin) {
            return Err(AuctionError::NotInitialized);
        }

        if !env.storage().persistent().has(&DataKey::Username(creator.clone())) {
            return Err(AuctionError::UserNotRegistered);
        }

        // Verify org exists
        if !env.storage().persistent().has(&DataKey::Org(org_id)) {
            return Err(AuctionError::OrgNotFound);
        }

        // Creator must be a member of the org
        if !env.storage().persistent().get(&DataKey::OrgMember(org_id, creator.clone())).unwrap_or(false) {
            return Err(AuctionError::NotOrgMember);
        }

        let current_time = env.ledger().timestamp();
        if end_time <= current_time {
            return Err(AuctionError::InvalidEndTime);
        }

        let mut auction_count: u64 = env.storage().instance().get(&DataKey::AuctionCount).unwrap_or(0);
        auction_count += 1;

        let auction = AuctionData {
            id: auction_count,
            org_id,
            creator: creator.clone(),
            title: title.clone(),
            description,
            media_url,
            starting_bid,
            min_increment,
            end_time,
            status: AuctionStatus::Pending,
            highest_bid: 0,
            highest_bidder: creator.clone(),
            total_bids: 0,
        };

        env.storage().persistent().set(&DataKey::Auction(auction_count), &auction);
        env.storage().instance().set(&DataKey::AuctionCount, &auction_count);

        events::auction_created(&env, auction_count, org_id, &creator, &title);

        Ok(auction_count)
    }

    pub fn review_auction(
        env: Env,
        reviewer: Address,
        auction_id: u64,
        approved: bool,
    ) -> Result<(), AuctionError> {
        reviewer.require_auth();

        let mut auction: AuctionData = env.storage().persistent()
            .get(&DataKey::Auction(auction_id))
            .ok_or(AuctionError::AuctionNotFound)?;

        // Get the org this auction belongs to and verify the reviewer is the org owner
        let org: OrgData = env.storage().persistent()
            .get(&DataKey::Org(auction.org_id))
            .ok_or(AuctionError::OrgNotFound)?;

        if reviewer != org.owner {
            return Err(AuctionError::NotOrgOwner);
        }

        if auction.status != AuctionStatus::Pending {
            return Err(AuctionError::AuctionAlreadyReviewed);
        }

        if approved {
            auction.status = AuctionStatus::Approved;
            env.storage().persistent().set(&DataKey::Auction(auction_id), &auction);
            events::auction_approved(&env, auction_id);
        } else {
            auction.status = AuctionStatus::Rejected;
            env.storage().persistent().set(&DataKey::Auction(auction_id), &auction);
            events::auction_rejected(&env, auction_id);
        }

        Ok(())
    }

    // ─── Bidding ───

    pub fn place_bid(
        env: Env,
        bidder: Address,
        auction_id: u64,
        amount: i128,
    ) -> Result<(), AuctionError> {
        bidder.require_auth();

        let mut auction: AuctionData = env.storage().persistent()
            .get(&DataKey::Auction(auction_id))
            .ok_or(AuctionError::AuctionNotFound)?;

        if auction.status != AuctionStatus::Approved {
            return Err(AuctionError::AuctionNotApproved);
        }

        let current_time = env.ledger().timestamp();
        if current_time >= auction.end_time {
            return Err(AuctionError::AuctionEnded);
        }

        if bidder == auction.creator {
            return Err(AuctionError::CannotBidOwnAuction);
        }

        if amount <= 0 {
            return Err(AuctionError::BidTooLow);
        }

        let existing_deposit: i128 = env.storage().persistent()
            .get(&DataKey::BidDeposit(auction_id, bidder.clone()))
            .unwrap_or(0);
        let new_total = existing_deposit + amount;

        if auction.total_bids == 0 {
            if new_total < auction.starting_bid {
                return Err(AuctionError::BidTooLow);
            }
        } else {
            let min_required = auction.highest_bid + auction.min_increment;
            if new_total < min_required {
                return Err(AuctionError::BidBelowIncrement);
            }
        }

        let token_id: Address = env.storage().instance()
            .get(&DataKey::TokenId)
            .ok_or(AuctionError::NotInitialized)?;
        let token_client = token::Client::new(&env, &token_id);
        token_client.transfer(&bidder, &env.current_contract_address(), &amount);

        env.storage().persistent().set(&DataKey::BidDeposit(auction_id, bidder.clone()), &new_total);

        auction.highest_bid = new_total;
        auction.highest_bidder = bidder.clone();
        auction.total_bids += 1;
        env.storage().persistent().set(&DataKey::Auction(auction_id), &auction);

        events::bid_placed(&env, auction_id, &bidder, new_total);

        Ok(())
    }

    // ─── Finalization & Refunds ───

    pub fn finalize_auction(
        env: Env,
        caller: Address,
        auction_id: u64,
    ) -> Result<(), AuctionError> {
        caller.require_auth();

        let mut auction: AuctionData = env.storage().persistent()
            .get(&DataKey::Auction(auction_id))
            .ok_or(AuctionError::AuctionNotFound)?;

        if auction.status == AuctionStatus::Ended {
            return Err(AuctionError::AlreadyFinalized);
        }
        if auction.status != AuctionStatus::Approved {
            return Err(AuctionError::AuctionNotApproved);
        }

        let current_time = env.ledger().timestamp();
        if current_time < auction.end_time {
            return Err(AuctionError::AuctionNotEnded);
        }

        if auction.total_bids > 0 {
            let token_id: Address = env.storage().instance()
                .get(&DataKey::TokenId)
                .ok_or(AuctionError::NotInitialized)?;
            let token_client = token::Client::new(&env, &token_id);
            token_client.transfer(
                &env.current_contract_address(),
                &auction.creator,
                &auction.highest_bid,
            );
        }

        auction.status = AuctionStatus::Ended;
        env.storage().persistent().set(&DataKey::Auction(auction_id), &auction);

        events::auction_finalized(&env, auction_id, &auction.highest_bidder, auction.highest_bid);

        Ok(())
    }

    pub fn claim_refund(
        env: Env,
        bidder: Address,
        auction_id: u64,
    ) -> Result<(), AuctionError> {
        bidder.require_auth();

        let auction: AuctionData = env.storage().persistent()
            .get(&DataKey::Auction(auction_id))
            .ok_or(AuctionError::AuctionNotFound)?;

        if auction.status != AuctionStatus::Ended {
            return Err(AuctionError::AuctionNotEnded);
        }

        if auction.total_bids > 0 && bidder == auction.highest_bidder {
            return Err(AuctionError::NotLoser);
        }

        let deposit: i128 = env.storage().persistent()
            .get(&DataKey::BidDeposit(auction_id, bidder.clone()))
            .unwrap_or(0);

        if deposit <= 0 {
            return Err(AuctionError::NoBidsToRefund);
        }

        let token_id: Address = env.storage().instance()
            .get(&DataKey::TokenId)
            .ok_or(AuctionError::NotInitialized)?;
        let token_client = token::Client::new(&env, &token_id);
        token_client.transfer(&env.current_contract_address(), &bidder, &deposit);

        env.storage().persistent().set(&DataKey::BidDeposit(auction_id, bidder.clone()), &0i128);

        events::refund_claimed(&env, auction_id, &bidder, deposit);

        Ok(())
    }

    // ─── Read-only Queries ───

    pub fn get_auction(env: Env, auction_id: u64) -> Result<AuctionData, AuctionError> {
        env.storage().persistent()
            .get(&DataKey::Auction(auction_id))
            .ok_or(AuctionError::AuctionNotFound)
    }

    pub fn get_auction_count(env: Env) -> u64 {
        env.storage().instance().get(&DataKey::AuctionCount).unwrap_or(0)
    }

    pub fn get_bid_deposit(env: Env, auction_id: u64, bidder: Address) -> i128 {
        env.storage().persistent()
            .get(&DataKey::BidDeposit(auction_id, bidder))
            .unwrap_or(0)
    }

    pub fn get_admin(env: Env) -> Result<Address, AuctionError> {
        env.storage().instance()
            .get(&DataKey::Admin)
            .ok_or(AuctionError::NotInitialized)
    }
}
