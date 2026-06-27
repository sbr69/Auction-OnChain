use soroban_sdk::{symbol_short, Address, Env, String};

/// Emitted when a new user registers a username.
pub fn user_registered(env: &Env, user: &Address, username: &String) {
    env.events().publish(
        (symbol_short!("user"), symbol_short!("register")),
        (user.clone(), username.clone()),
    );
}

/// Emitted when a new auction is created (in Pending state).
pub fn auction_created(env: &Env, auction_id: u64, creator: &Address, title: &String) {
    env.events().publish(
        (symbol_short!("auction"), symbol_short!("created")),
        (auction_id, creator.clone(), title.clone()),
    );
}

/// Emitted when the admin approves an auction.
pub fn auction_approved(env: &Env, auction_id: u64) {
    env.events().publish(
        (symbol_short!("auction"), symbol_short!("approved")),
        auction_id,
    );
}

/// Emitted when the admin rejects an auction.
pub fn auction_rejected(env: &Env, auction_id: u64) {
    env.events().publish(
        (symbol_short!("auction"), symbol_short!("rejected")),
        auction_id,
    );
}

/// Emitted when a bid is placed. Includes the bidder's new cumulative total.
pub fn bid_placed(env: &Env, auction_id: u64, bidder: &Address, total_bid: i128) {
    env.events().publish(
        (symbol_short!("bid"), symbol_short!("placed")),
        (auction_id, bidder.clone(), total_bid),
    );
}

/// Emitted when an auction is finalized after its end time.
pub fn auction_finalized(env: &Env, auction_id: u64, winner: &Address, winning_bid: i128) {
    env.events().publish(
        (symbol_short!("auction"), symbol_short!("ended")),
        (auction_id, winner.clone(), winning_bid),
    );
}

/// Emitted when a losing bidder claims their refund.
pub fn refund_claimed(env: &Env, auction_id: u64, bidder: &Address, amount: i128) {
    env.events().publish(
        (symbol_short!("refund"), symbol_short!("claimed")),
        (auction_id, bidder.clone(), amount),
    );
}
