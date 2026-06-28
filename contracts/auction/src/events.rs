use soroban_sdk::{symbol_short, Address, Env, String};

pub fn user_registered(env: &Env, user: &Address, username: &String) {
    env.events().publish(
        (symbol_short!("user"), symbol_short!("register")),
        (user.clone(), username.clone()),
    );
}

pub fn org_created(env: &Env, org_id: u64, owner: &Address, name: &String) {
    env.events().publish(
        (symbol_short!("org"), symbol_short!("created")),
        (org_id, owner.clone(), name.clone()),
    );
}

pub fn org_joined(env: &Env, org_id: u64, user: &Address) {
    env.events().publish(
        (symbol_short!("org"), symbol_short!("joined")),
        (org_id, user.clone()),
    );
}

pub fn auction_created(env: &Env, auction_id: u64, org_id: u64, creator: &Address, title: &String) {
    env.events().publish(
        (symbol_short!("auction"), symbol_short!("created")),
        (auction_id, org_id, creator.clone(), title.clone()),
    );
}

pub fn auction_approved(env: &Env, auction_id: u64) {
    env.events().publish(
        (symbol_short!("auction"), symbol_short!("approved")),
        auction_id,
    );
}

pub fn auction_rejected(env: &Env, auction_id: u64) {
    env.events().publish(
        (symbol_short!("auction"), symbol_short!("rejected")),
        auction_id,
    );
}

pub fn bid_placed(env: &Env, auction_id: u64, bidder: &Address, total_bid: i128) {
    env.events().publish(
        (symbol_short!("bid"), symbol_short!("placed")),
        (auction_id, bidder.clone(), total_bid),
    );
}

pub fn auction_finalized(env: &Env, auction_id: u64, winner: &Address, winning_bid: i128) {
    env.events().publish(
        (symbol_short!("auction"), symbol_short!("ended")),
        (auction_id, winner.clone(), winning_bid),
    );
}

pub fn refund_claimed(env: &Env, auction_id: u64, bidder: &Address, amount: i128) {
    env.events().publish(
        (symbol_short!("refund"), symbol_short!("claimed")),
        (auction_id, bidder.clone(), amount),
    );
}
