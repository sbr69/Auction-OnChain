export const CONTRACT_ERRORS: Record<number, string> = {
  1: "Contract is already initialized.",
  2: "Contract is not initialized yet.",
  3: "This username is already taken by another wallet. Please choose another.",
  4: "Your wallet is already registered with a username.",
  5: "User is not registered. Please register a username first.",
  6: "Unauthorized action: Only the admin reviewer wallet can perform this action.",
  7: "Auction not found on-chain.",
  8: "Auction Not Approved: This auction is still pending reviewer approval and cannot accept bids yet.",
  9: "Auction Ended: Bidding is closed for this auction because the end time has passed.",
  10: "Auction Not Ended: You cannot finalize or claim refunds before the end time.",
  11: "Bid Too Low: Your total bid must meet the starting bid or exceed the current highest bid.",
  12: "Bid Below Minimum Increment: Your bid addition is too small. Please add at least the minimum increment.",
  13: "Insufficient Escrow Balance: Failed to process escrow token transfer.",
  14: "Cannot Bid On Own Auction: You cannot place a bid on an auction you created.",
  15: "Auction Already Reviewed: This auction has already been approved or rejected.",
  16: "No Bids To Refund: You have no escrowed funds to reclaim for this auction.",
  17: "Not A Loser: The winning bidder cannot claim a refund (funds are sent to creator).",
  18: "Auction Already Finalized: This auction has already concluded.",
  19: "Invalid Username: Username must be between 3 and 20 characters.",
  20: "Invalid End Time: End time must be in the future.",
  21: "Organisation not found on-chain.",
  22: "Not Organisation Owner: Only the org owner can perform this action.",
  23: "Already a member of this organisation.",
  24: "Not a member of this organisation. Please join first.",
};

export function parseContractError(error: any): string {
  if (!error) return "An unknown error occurred.";
  
  const errStr = typeof error === 'string' ? error : (error.message || JSON.stringify(error));
  
  // Check for numeric error code patterns in error string or object
  for (const [code, msg] of Object.entries(CONTRACT_ERRORS)) {
    if (errStr.includes(`HostError: Error(Contract, #${code})`) || errStr.includes(`Error(#${code})`) || errStr.includes(`ErrorCode:${code}`)) {
      return msg;
    }
  }

  if (errStr.includes("User rejected") || errStr.includes("Declined") || errStr.includes("cancelled")) {
    return "Transaction signing was rejected in your wallet.";
  }
  if (errStr.includes("insufficient balance") || errStr.includes("underfunded")) {
    return "Insufficient XLM balance in your wallet to perform this transaction.";
  }
  if (errStr.includes("Wallet not found")) {
    return "No compatible Stellar wallet found. Please install Freighter or xBull extension.";
  }

  return errStr.length > 150 ? `${errStr.substring(0, 150)}...` : errStr;
}
