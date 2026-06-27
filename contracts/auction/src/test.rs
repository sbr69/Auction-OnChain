#![cfg(test)]

use super::*;
use soroban_sdk::{
    testutils::{Address as _, Ledger, LedgerInfo},
    token, Address, Env, String,
};
use token::StellarAssetClient;


fn setup_env() -> (Env, Address, Address, StellarBidAuctionClient<'static>) {
    let env = Env::default();
    env.mock_all_auths();

    let contract_id = env.register(StellarBidAuction, ());
    let client = StellarBidAuctionClient::new(&env, &contract_id);

    let admin = Address::generate(&env);

    let token_admin = Address::generate(&env);
    let token_contract = env.register_stellar_asset_contract_v2(token_admin.clone());
    let token_id = token_contract.address();
    let token_admin_client = StellarAssetClient::new(&env, &token_id);

    client.initialize(&admin, &token_id);

    let env: &'static Env = Box::leak(Box::new(env));
    let client = StellarBidAuctionClient::new(env, &contract_id);

    drop(client);

    let env = Env::default();
    env.mock_all_auths();

    let contract_id = env.register(StellarBidAuction, ());
    let client = StellarBidAuctionClient::new(&env, &contract_id);

    let admin = Address::generate(&env);
    let token_admin = Address::generate(&env);
    let token_contract = env.register_stellar_asset_contract_v2(token_admin.clone());
    let token_id = token_contract.address();

    client.initialize(&admin, &token_id);

    (env, admin, token_id, client)
}

fn create_registered_user(env: &Env, token_id: &Address, name: &str) -> Address {
    let user = Address::generate(env);
    // Fund the user with XLM for bidding
    let token_admin_client = StellarAssetClient::new(env, token_id);
    token_admin_client.mint(&user, &10_000_0000000); // 10,000 XLM
    user
}

fn set_ledger_timestamp(env: &Env, timestamp: u64) {
    env.ledger().set(LedgerInfo {
        timestamp,
        protocol_version: 22,
        sequence_number: env.ledger().sequence(),
        network_id: Default::default(),
        base_reserve: 10,
        min_temp_entry_ttl: 10,
        min_persistent_entry_ttl: 10,
        max_entry_ttl: 3110400,
    });
}


#[test]
fn test_initialize_and_double_init_fails() {
    let env = Env::default();
    env.mock_all_auths();

    let contract_id = env.register(StellarBidAuction, ());
    let client = StellarBidAuctionClient::new(&env, &contract_id);

    let admin = Address::generate(&env);
    let token_admin = Address::generate(&env);
    let token_contract = env.register_stellar_asset_contract_v2(token_admin);
    let token_id = token_contract.address();

    // First init should succeed
    client.initialize(&admin, &token_id);

    // Second init should fail
    let result = client.try_initialize(&admin, &token_id);
    assert_eq!(result, Err(Ok(AuctionError::AlreadyInitialized)));
}


#[test]
fn test_register_user_success() {
    let env = Env::default();
    env.mock_all_auths();

    let contract_id = env.register(StellarBidAuction, ());
    let client = StellarBidAuctionClient::new(&env, &contract_id);

    let admin = Address::generate(&env);
    let token_admin = Address::generate(&env);
    let token_contract = env.register_stellar_asset_contract_v2(token_admin);
    let token_id = token_contract.address();

    client.initialize(&admin, &token_id);

    let user = Address::generate(&env);
    let username = String::from_str(&env, "alice");

    client.register_user(&user, &username);

    assert_eq!(client.get_username(&user), username);
    assert!(client.is_registered(&user));
}

#[test]
fn test_register_duplicate_username_fails() {
    let env = Env::default();
    env.mock_all_auths();

    let contract_id = env.register(StellarBidAuction, ());
    let client = StellarBidAuctionClient::new(&env, &contract_id);

    let admin = Address::generate(&env);
    let token_admin = Address::generate(&env);
    let token_contract = env.register_stellar_asset_contract_v2(token_admin);
    let token_id = token_contract.address();

    client.initialize(&admin, &token_id);

    let user1 = Address::generate(&env);
    let user2 = Address::generate(&env);
    let username = String::from_str(&env, "alice");

    client.register_user(&user1, &username);

    let result = client.try_register_user(&user2, &username);
    assert_eq!(result, Err(Ok(AuctionError::UsernameAlreadyClaimed)));
}

#[test]
fn test_register_same_user_twice_fails() {
    let env = Env::default();
    env.mock_all_auths();

    let contract_id = env.register(StellarBidAuction, ());
    let client = StellarBidAuctionClient::new(&env, &contract_id);

    let admin = Address::generate(&env);
    let token_admin = Address::generate(&env);
    let token_contract = env.register_stellar_asset_contract_v2(token_admin);
    let token_id = token_contract.address();

    client.initialize(&admin, &token_id);

    let user = Address::generate(&env);
    let username1 = String::from_str(&env, "alice");
    let username2 = String::from_str(&env, "alice2");

    client.register_user(&user, &username1);

    let result = client.try_register_user(&user, &username2);
    assert_eq!(result, Err(Ok(AuctionError::UserAlreadyRegistered)));
}

#[test]
fn test_register_invalid_username_fails() {
    let env = Env::default();
    env.mock_all_auths();

    let contract_id = env.register(StellarBidAuction, ());
    let client = StellarBidAuctionClient::new(&env, &contract_id);

    let admin = Address::generate(&env);
    let token_admin = Address::generate(&env);
    let token_contract = env.register_stellar_asset_contract_v2(token_admin);
    let token_id = token_contract.address();

    client.initialize(&admin, &token_id);

    let user = Address::generate(&env);
    // Too short (2 chars)
    let short_name = String::from_str(&env, "ab");

    let result = client.try_register_user(&user, &short_name);
    assert_eq!(result, Err(Ok(AuctionError::InvalidUsername)));
}


#[test]
fn test_create_auction_success() {
    let env = Env::default();
    env.mock_all_auths();

    let contract_id = env.register(StellarBidAuction, ());
    let client = StellarBidAuctionClient::new(&env, &contract_id);

    let admin = Address::generate(&env);
    let token_admin = Address::generate(&env);
    let token_contract = env.register_stellar_asset_contract_v2(token_admin);
    let token_id = token_contract.address();

    client.initialize(&admin, &token_id);

    // Register the creator
    let creator = Address::generate(&env);
    let username = String::from_str(&env, "seller");
    client.register_user(&creator, &username);

    // Set timestamp before end_time
    set_ledger_timestamp(&env, 1000);

    let auction_id = client.create_auction(
        &creator,
        &String::from_str(&env, "Vintage Watch"),
        &String::from_str(&env, "A beautiful vintage watch"),
        &String::from_str(&env, "ipfs://QmTest123"),
        &1000000000_i128,  // 100 XLM starting bid
        &100000000_i128,   // 10 XLM min increment
        &2000u64,          // ends at timestamp 2000
    );

    assert_eq!(auction_id, 1);
    assert_eq!(client.get_auction_count(), 1);

    let auction = client.get_auction(&auction_id);
    assert_eq!(auction.status, AuctionStatus::Pending);
    assert_eq!(auction.total_bids, 0);
}

#[test]
fn test_create_auction_unregistered_user_fails() {
    let env = Env::default();
    env.mock_all_auths();

    let contract_id = env.register(StellarBidAuction, ());
    let client = StellarBidAuctionClient::new(&env, &contract_id);

    let admin = Address::generate(&env);
    let token_admin = Address::generate(&env);
    let token_contract = env.register_stellar_asset_contract_v2(token_admin);
    let token_id = token_contract.address();

    client.initialize(&admin, &token_id);

    let creator = Address::generate(&env); // NOT registered
    set_ledger_timestamp(&env, 1000);

    let result = client.try_create_auction(
        &creator,
        &String::from_str(&env, "Test"),
        &String::from_str(&env, "Desc"),
        &String::from_str(&env, "ipfs://test"),
        &100_i128,
        &10_i128,
        &2000u64,
    );

    assert_eq!(result, Err(Ok(AuctionError::UserNotRegistered)));
}


#[test]
fn test_admin_approve_auction() {
    let env = Env::default();
    env.mock_all_auths();

    let contract_id = env.register(StellarBidAuction, ());
    let client = StellarBidAuctionClient::new(&env, &contract_id);

    let admin = Address::generate(&env);
    let token_admin = Address::generate(&env);
    let token_contract = env.register_stellar_asset_contract_v2(token_admin);
    let token_id = token_contract.address();

    client.initialize(&admin, &token_id);

    let creator = Address::generate(&env);
    client.register_user(&creator, &String::from_str(&env, "seller"));
    set_ledger_timestamp(&env, 1000);

    let auction_id = client.create_auction(
        &creator,
        &String::from_str(&env, "Test Item"),
        &String::from_str(&env, "Description"),
        &String::from_str(&env, "ipfs://test"),
        &100_i128,
        &10_i128,
        &2000u64,
    );

    // Admin approves
    client.review_auction(&admin, &auction_id, &true);
    let auction = client.get_auction(&auction_id);
    assert_eq!(auction.status, AuctionStatus::Approved);
}

#[test]
fn test_admin_reject_auction() {
    let env = Env::default();
    env.mock_all_auths();

    let contract_id = env.register(StellarBidAuction, ());
    let client = StellarBidAuctionClient::new(&env, &contract_id);

    let admin = Address::generate(&env);
    let token_admin = Address::generate(&env);
    let token_contract = env.register_stellar_asset_contract_v2(token_admin);
    let token_id = token_contract.address();

    client.initialize(&admin, &token_id);

    let creator = Address::generate(&env);
    client.register_user(&creator, &String::from_str(&env, "seller"));
    set_ledger_timestamp(&env, 1000);

    let auction_id = client.create_auction(
        &creator,
        &String::from_str(&env, "Test"),
        &String::from_str(&env, "Desc"),
        &String::from_str(&env, "ipfs://test"),
        &100_i128,
        &10_i128,
        &2000u64,
    );

    client.review_auction(&admin, &auction_id, &false);
    let auction = client.get_auction(&auction_id);
    assert_eq!(auction.status, AuctionStatus::Rejected);
}

#[test]
fn test_non_admin_review_fails() {
    let env = Env::default();
    env.mock_all_auths();

    let contract_id = env.register(StellarBidAuction, ());
    let client = StellarBidAuctionClient::new(&env, &contract_id);

    let admin = Address::generate(&env);
    let fake_admin = Address::generate(&env);
    let token_admin = Address::generate(&env);
    let token_contract = env.register_stellar_asset_contract_v2(token_admin);
    let token_id = token_contract.address();

    client.initialize(&admin, &token_id);

    let creator = Address::generate(&env);
    client.register_user(&creator, &String::from_str(&env, "seller"));
    set_ledger_timestamp(&env, 1000);

    let auction_id = client.create_auction(
        &creator,
        &String::from_str(&env, "Test"),
        &String::from_str(&env, "Desc"),
        &String::from_str(&env, "ipfs://test"),
        &100_i128,
        &10_i128,
        &2000u64,
    );

    let result = client.try_review_auction(&fake_admin, &auction_id, &true);
    assert_eq!(result, Err(Ok(AuctionError::NotAdmin)));
}


#[test]
fn test_place_bid_success() {
    let env = Env::default();
    env.mock_all_auths();

    let contract_id = env.register(StellarBidAuction, ());
    let client = StellarBidAuctionClient::new(&env, &contract_id);

    let admin = Address::generate(&env);
    let token_admin = Address::generate(&env);
    let token_contract = env.register_stellar_asset_contract_v2(token_admin.clone());
    let token_id = token_contract.address();
    let token_admin_client = StellarAssetClient::new(&env, &token_id);

    client.initialize(&admin, &token_id);

    let creator = Address::generate(&env);
    client.register_user(&creator, &String::from_str(&env, "seller"));
    set_ledger_timestamp(&env, 1000);

    let auction_id = client.create_auction(
        &creator,
        &String::from_str(&env, "Test"),
        &String::from_str(&env, "Desc"),
        &String::from_str(&env, "ipfs://test"),
        &100_i128,
        &10_i128,
        &2000u64,
    );
    client.review_auction(&admin, &auction_id, &true);

    let bidder = Address::generate(&env);
    token_admin_client.mint(&bidder, &10000_i128);

    client.place_bid(&bidder, &auction_id, &150_i128);

    let auction = client.get_auction(&auction_id);
    assert_eq!(auction.highest_bid, 150);
    assert_eq!(auction.highest_bidder, bidder);
    assert_eq!(auction.total_bids, 1);

    assert_eq!(client.get_bid_deposit(&auction_id, &bidder), 150);
}

#[test]
fn test_cumulative_bidding() {
    let env = Env::default();
    env.mock_all_auths();

    let contract_id = env.register(StellarBidAuction, ());
    let client = StellarBidAuctionClient::new(&env, &contract_id);

    let admin = Address::generate(&env);
    let token_admin = Address::generate(&env);
    let token_contract = env.register_stellar_asset_contract_v2(token_admin.clone());
    let token_id = token_contract.address();
    let token_admin_client = StellarAssetClient::new(&env, &token_id);

    client.initialize(&admin, &token_id);

    let creator = Address::generate(&env);
    client.register_user(&creator, &String::from_str(&env, "seller"));
    set_ledger_timestamp(&env, 1000);

    let auction_id = client.create_auction(
        &creator,
        &String::from_str(&env, "Test"),
        &String::from_str(&env, "Desc"),
        &String::from_str(&env, "ipfs://test"),
        &100_i128,
        &10_i128,
        &2000u64,
    );
    client.review_auction(&admin, &auction_id, &true);

    let bidder1 = Address::generate(&env);
    token_admin_client.mint(&bidder1, &10000_i128);

    client.place_bid(&bidder1, &auction_id, &200_i128);
    assert_eq!(client.get_bid_deposit(&auction_id, &bidder1), 200);

    let bidder2 = Address::generate(&env);
    token_admin_client.mint(&bidder2, &10000_i128);
    client.place_bid(&bidder2, &auction_id, &215_i128);

    client.place_bid(&bidder1, &auction_id, &50_i128);

    assert_eq!(client.get_bid_deposit(&auction_id, &bidder1), 250);

    let auction = client.get_auction(&auction_id);
    assert_eq!(auction.highest_bid, 250);
    assert_eq!(auction.highest_bidder, bidder1);
}

#[test]
fn test_bid_too_low_fails() {
    let env = Env::default();
    env.mock_all_auths();

    let contract_id = env.register(StellarBidAuction, ());
    let client = StellarBidAuctionClient::new(&env, &contract_id);

    let admin = Address::generate(&env);
    let token_admin = Address::generate(&env);
    let token_contract = env.register_stellar_asset_contract_v2(token_admin.clone());
    let token_id = token_contract.address();
    let token_admin_client = StellarAssetClient::new(&env, &token_id);

    client.initialize(&admin, &token_id);

    let creator = Address::generate(&env);
    client.register_user(&creator, &String::from_str(&env, "seller"));
    set_ledger_timestamp(&env, 1000);

    let auction_id = client.create_auction(
        &creator,
        &String::from_str(&env, "Test"),
        &String::from_str(&env, "Desc"),
        &String::from_str(&env, "ipfs://test"),
        &100_i128,
        &10_i128,
        &2000u64,
    );
    client.review_auction(&admin, &auction_id, &true);

    let bidder = Address::generate(&env);
    token_admin_client.mint(&bidder, &10000_i128);

    let result = client.try_place_bid(&bidder, &auction_id, &50_i128);
    assert_eq!(result, Err(Ok(AuctionError::BidTooLow)));
}

#[test]
fn test_bid_on_unapproved_auction_fails() {
    let env = Env::default();
    env.mock_all_auths();

    let contract_id = env.register(StellarBidAuction, ());
    let client = StellarBidAuctionClient::new(&env, &contract_id);

    let admin = Address::generate(&env);
    let token_admin = Address::generate(&env);
    let token_contract = env.register_stellar_asset_contract_v2(token_admin.clone());
    let token_id = token_contract.address();
    let token_admin_client = StellarAssetClient::new(&env, &token_id);

    client.initialize(&admin, &token_id);

    let creator = Address::generate(&env);
    client.register_user(&creator, &String::from_str(&env, "seller"));
    set_ledger_timestamp(&env, 1000);

    let auction_id = client.create_auction(
        &creator,
        &String::from_str(&env, "Test"),
        &String::from_str(&env, "Desc"),
        &String::from_str(&env, "ipfs://test"),
        &100_i128,
        &10_i128,
        &2000u64,
    );
    // NOT approved!

    let bidder = Address::generate(&env);
    token_admin_client.mint(&bidder, &10000_i128);

    let result = client.try_place_bid(&bidder, &auction_id, &200_i128);
    assert_eq!(result, Err(Ok(AuctionError::AuctionNotApproved)));
}

#[test]
fn test_bid_after_end_time_fails() {
    let env = Env::default();
    env.mock_all_auths();

    let contract_id = env.register(StellarBidAuction, ());
    let client = StellarBidAuctionClient::new(&env, &contract_id);

    let admin = Address::generate(&env);
    let token_admin = Address::generate(&env);
    let token_contract = env.register_stellar_asset_contract_v2(token_admin.clone());
    let token_id = token_contract.address();
    let token_admin_client = StellarAssetClient::new(&env, &token_id);

    client.initialize(&admin, &token_id);

    let creator = Address::generate(&env);
    client.register_user(&creator, &String::from_str(&env, "seller"));
    set_ledger_timestamp(&env, 1000);

    let auction_id = client.create_auction(
        &creator,
        &String::from_str(&env, "Test"),
        &String::from_str(&env, "Desc"),
        &String::from_str(&env, "ipfs://test"),
        &100_i128,
        &10_i128,
        &2000u64,
    );
    client.review_auction(&admin, &auction_id, &true);

    set_ledger_timestamp(&env, 3000);

    let bidder = Address::generate(&env);
    token_admin_client.mint(&bidder, &10000_i128);

    let result = client.try_place_bid(&bidder, &auction_id, &200_i128);
    assert_eq!(result, Err(Ok(AuctionError::AuctionEnded)));
}

#[test]
fn test_creator_cannot_bid_own_auction() {
    let env = Env::default();
    env.mock_all_auths();

    let contract_id = env.register(StellarBidAuction, ());
    let client = StellarBidAuctionClient::new(&env, &contract_id);

    let admin = Address::generate(&env);
    let token_admin = Address::generate(&env);
    let token_contract = env.register_stellar_asset_contract_v2(token_admin.clone());
    let token_id = token_contract.address();
    let token_admin_client = StellarAssetClient::new(&env, &token_id);

    client.initialize(&admin, &token_id);

    let creator = Address::generate(&env);
    client.register_user(&creator, &String::from_str(&env, "seller"));
    token_admin_client.mint(&creator, &10000_i128);
    set_ledger_timestamp(&env, 1000);

    let auction_id = client.create_auction(
        &creator,
        &String::from_str(&env, "Test"),
        &String::from_str(&env, "Desc"),
        &String::from_str(&env, "ipfs://test"),
        &100_i128,
        &10_i128,
        &2000u64,
    );
    client.review_auction(&admin, &auction_id, &true);

    let result = client.try_place_bid(&creator, &auction_id, &200_i128);
    assert_eq!(result, Err(Ok(AuctionError::CannotBidOwnAuction)));
}


#[test]
fn test_finalize_and_refund_full_lifecycle() {
    let env = Env::default();
    env.mock_all_auths();

    let contract_id = env.register(StellarBidAuction, ());
    let client = StellarBidAuctionClient::new(&env, &contract_id);

    let admin = Address::generate(&env);
    let token_admin = Address::generate(&env);
    let token_contract = env.register_stellar_asset_contract_v2(token_admin.clone());
    let token_id = token_contract.address();
    let token_admin_client = StellarAssetClient::new(&env, &token_id);
    let token_client = token::Client::new(&env, &token_id);

    client.initialize(&admin, &token_id);

    let creator = Address::generate(&env);
    client.register_user(&creator, &String::from_str(&env, "seller"));
    set_ledger_timestamp(&env, 1000);

    let auction_id = client.create_auction(
        &creator,
        &String::from_str(&env, "Vintage Watch"),
        &String::from_str(&env, "A fine timepiece"),
        &String::from_str(&env, "ipfs://QmWatch"),
        &100_i128,
        &10_i128,
        &2000u64,
    );
    client.review_auction(&admin, &auction_id, &true);

    let bob = Address::generate(&env);
    token_admin_client.mint(&bob, &1000_i128);
    client.place_bid(&bob, &auction_id, &150_i128);

    let carol = Address::generate(&env);
    token_admin_client.mint(&carol, &1000_i128);
    client.place_bid(&carol, &auction_id, &200_i128);

    client.place_bid(&bob, &auction_id, &60_i128);

    let auction = client.get_auction(&auction_id);
    assert_eq!(auction.highest_bid, 210);
    assert_eq!(auction.highest_bidder, bob);

    let creator_balance_before = token_client.balance(&creator);

    set_ledger_timestamp(&env, 3000);
    client.finalize_auction(&admin, &auction_id);

    let auction = client.get_auction(&auction_id);
    assert_eq!(auction.status, AuctionStatus::Ended);

    let creator_balance_after = token_client.balance(&creator);
    assert_eq!(creator_balance_after - creator_balance_before, 210);

    let carol_balance_before = token_client.balance(&carol);
    client.claim_refund(&carol, &auction_id);
    let carol_balance_after = token_client.balance(&carol);
    assert_eq!(carol_balance_after - carol_balance_before, 200);

    let result = client.try_claim_refund(&bob, &auction_id);
    assert_eq!(result, Err(Ok(AuctionError::NotLoser)));
}

#[test]
fn test_finalize_before_end_time_fails() {
    let env = Env::default();
    env.mock_all_auths();

    let contract_id = env.register(StellarBidAuction, ());
    let client = StellarBidAuctionClient::new(&env, &contract_id);

    let admin = Address::generate(&env);
    let token_admin = Address::generate(&env);
    let token_contract = env.register_stellar_asset_contract_v2(token_admin.clone());
    let token_id = token_contract.address();

    client.initialize(&admin, &token_id);

    let creator = Address::generate(&env);
    client.register_user(&creator, &String::from_str(&env, "seller"));
    set_ledger_timestamp(&env, 1000);

    let auction_id = client.create_auction(
        &creator,
        &String::from_str(&env, "Test"),
        &String::from_str(&env, "Desc"),
        &String::from_str(&env, "ipfs://test"),
        &100_i128,
        &10_i128,
        &2000u64,
    );
    client.review_auction(&admin, &auction_id, &true);

    let result = client.try_finalize_auction(&admin, &auction_id);
    assert_eq!(result, Err(Ok(AuctionError::AuctionNotEnded)));
}

#[test]
fn test_refund_before_auction_ends_fails() {
    let env = Env::default();
    env.mock_all_auths();

    let contract_id = env.register(StellarBidAuction, ());
    let client = StellarBidAuctionClient::new(&env, &contract_id);

    let admin = Address::generate(&env);
    let token_admin = Address::generate(&env);
    let token_contract = env.register_stellar_asset_contract_v2(token_admin.clone());
    let token_id = token_contract.address();
    let token_admin_client = StellarAssetClient::new(&env, &token_id);

    client.initialize(&admin, &token_id);

    let creator = Address::generate(&env);
    client.register_user(&creator, &String::from_str(&env, "seller"));
    set_ledger_timestamp(&env, 1000);

    let auction_id = client.create_auction(
        &creator,
        &String::from_str(&env, "Test"),
        &String::from_str(&env, "Desc"),
        &String::from_str(&env, "ipfs://test"),
        &100_i128,
        &10_i128,
        &2000u64,
    );
    client.review_auction(&admin, &auction_id, &true);

    let bidder = Address::generate(&env);
    token_admin_client.mint(&bidder, &1000_i128);
    client.place_bid(&bidder, &auction_id, &200_i128);

    let result = client.try_claim_refund(&bidder, &auction_id);
    assert_eq!(result, Err(Ok(AuctionError::AuctionNotEnded)));
}
