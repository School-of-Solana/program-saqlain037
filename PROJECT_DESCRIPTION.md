# Project Description
Solana Tip Jar dApp

**Deployed Frontend URL:** (https://program-saqlain037-2lkg0c6w3-saqlain-gulamhuseins-projects.vercel.app)

**Solana Program ID:** Gu7sMSSwiYm4JhKisQxAEA8EyJhiKfE2WRQuPFiUjinK

## Project Overview

### Description
This project is a Solana Tip Jar dApp built with Anchor on the backend and Next.js + wallet-adapter on the frontend.

Each user can:
Initialize a personal tip vault (a PDA owned by the program and associated with their wallet).
Share their wallet address with others.
Receive SOL tips into their vault from any other wallet.
Withdraw SOL from their vault back into their own wallet.

The vault is a PDA derived from the user’s wallet address, so:
The user never has to manage a separate keypair.
The address is deterministic and can be recomputed on the frontend.
Only the vault owner is allowed to withdraw from it.

The frontend is a simple, focused UI that demonstrates:
Wallet connection on Devnet
Direct interaction with the deployed Anchor program
Calling all three instructions: init_vault, send_tip, and withdraw

### Key Features
PDA-based per-user vaults
Each wallet can initialize one vault PDA that holds their received tips.

Send Tips (SOL)
Any wallet can tip someone by entering the recipient’s wallet address and the tip amount in SOL.
Tips are transferred from the tipper’s wallet into the recipient’s vault PDA.

Withdraw Tips
The vault owner can withdraw any amount of SOL from their vault back into their own wallet.
The program enforces that only the owner can withdraw.

Validation & Error Handling
Amount must be greater than zero.
Withdrawals fail if the vault doesn’t have enough funds.
Re-initializing the same vault is prevented and surfaced as a friendly message in the UI.

Modern Frontend Stack
Next.js 16 with App Router and Tailwind CSS.
@solana/wallet-adapter for wallet connection (Phantom / Solflare).
Frontend constructs and sends transactions directly with @solana/web3.js.
  
### How to Use the dApp
1. Open the dApp
    Navigate to the deployed frontend URL (Vercel link you’ll add above).
    Make sure your wallet (e.g. Phantom) is set to the Devnet network and has some devnet SOL.
2. Connect Wallet
    Click the “Connect Wallet” button (wallet adapter UI).
    Approve the connection in your wallet.
3. Initialize Your Vault
    In the “My Vault” section, click “Init My Vault”.
    Approve the transaction.
    After success, you'll see:
    Your Vault PDA (a derived address).
    Your Vault balance (SOL), initially empty.
    If you click again after it’s already initialized, the UI will show:
    “Your vault is already initialized ✅”.
4. Sending Tips
    Go to the “Send Tip” section.
    Paste a recipient wallet address:
    For testing, you can paste your own wallet address.
    Enter an amount in SOL, e.g. 0.01.
    Click “Send Tip” and approve the transaction.
    If you tipped your own address, your vault balance will increase.
5. Withdrawing From Your Vault
    Go to the “Withdraw” section.
    Enter an amount in SOL to withdraw (must be ≤ vault balance).
    Click “Withdraw” and approve the transaction.
    Your wallet balance goes up, and the vault balance goes down.

## Program Architecture
The on-chain program is an Anchor program named tip_jar, deployed on Devnet.

It exposes three instructions:
1. init_vault
2. send_tip
3. withdraw

and uses a PDA-based vault account for each user.

### PDA Usage
PDA Usage

Each user's vault is a Program Derived Address (PDA) derived from:
    Seeds: ["tip_vault", owner_pubkey]
    Bump: found via Pubkey::find_program_address

In Rust (conceptually):
let (vault_pda, _bump) = Pubkey::find_program_address(
    &[
        b"tip_vault",
        owner.key().as_ref(),
    ],
    ctx.program_id,
);

Why this design?

Each wallet gets exactly one vault (per program).
No private key is needed for the vault; the program controls it.
The vault address can be recomputed and used on both the backend and frontend.
The vault is clearly namespaced to avoid collisions ("tip_vault" prefix).

**PDAs Used:**
Vault PDA
Seeds: ["tip_vault", owner_pubkey]
    Purpose: Holds SOL tips for a given owner. Only the owner can withdraw.

### Program Instructions
1. init_vault
    Accounts:
        vault (PDA, init, payer = owner)
        owner (signer)
        system_program
    Purpose:
        Initializes the user’s vault PDA.
        Sets the owner field on the vault.
        Initializes total_tips to zero.
    Constraints:
        Can only be successfully called once per owner vault.
        Re-initializing fails with an “account already in use” error.

2. send_tip(amount: u64)
    Accounts:
        vault (PDA for the recipient)
        tipper (signer, payer of SOL)
        system_program
    Purpose:
        Transfers amount lamports from the tipper to the recipient’s vault PDA.
        Increments vault.total_tips by amount.
    Validation:
    amount > 0:
        If not, the program returns InvalidAmount (custom error code 6000).
    Uses System Program transfer to move the SOL.
    Typical Flow:
        Frontend derives vault PDA from the recipient wallet address.
        Tipper signs the transaction and pays the SOL.

3. withdraw(amount: u64)
    Accounts:
        vault (PDA of the caller’s vault)
        owner (signer, must match vault.owner)
    Purpose:
        Withdraws amount lamports from the vault PDA to the owner.
        Decrements vault.total_tips by amount (or keeps track as desired).
    Validation:
        amount > 0 → otherwise InvalidAmount (6000).
        owner must match vault.owner → otherwise Unauthorized (6001).
        Vault must have at least amount lamports:
            Otherwise InsufficientFunds (6002). 

### Account Structure
Main Account TipVault

#[account]
pub struct TipVault {
    /// Owner of this vault (wallet that can withdraw)
    pub owner: Pubkey,

    /// Total amount of tips ever received (in lamports)
    pub total_tips: u64,
}

The balance actually held in the account is the SOL owned by the PDA.
total_tips provides a simple counter / metric of all received tips over time.

## Testing

Test Coverage

The project includes TypeScript tests using ts-mocha, with both happy and unhappy paths for each instruction.

Happy Path Tests:
    init_vault - happy path
        Initializes a new vault PDA for a given owner.
        Asserts that the vault exists and the owner/fields are correct.
    send_tip - happy path
        Sends a non-zero tip from a tipper to a recipient’s vault.
        Asserts that:
            Vault balance increases.
            total_tips is incremented.
    withdraw - happy path
        Withdraws a valid amount from the owner’s vault.
        Asserts that:
            Vault balance decreases.
            Owner wallet balance increases (relative check).

Unhappy Path Tests:
    init_vault - unhappy (re-initialize same owner)
        Calls init_vault twice for the same owner.
        The second call fails because the PDA already exists.
    send_tip - unhappy (amount = 0)
        Attempts to send a tip with amount = 0.
        Expects the transaction to fail with the InvalidAmount error.
    withdraw - unhappy (non-owner / authorization error or insufficient funds)
        Attempts either:
            Withdraw from a vault using a different signer, or
            Withdraw more than the vault balance.
        Expects a custom error (Unauthorized or InsufficientFunds).

### Running Tests

From the anchor_project/tip_jar
```bash
# Commands to run your tests
anchor test
```
This will:
    Build the Anchor program.
    Run the TypeScript test suite:
        Located under tests/.
        Using ts-mocha as configured in Anchor.toml.

### Additional Notes for Evaluators

The program is written with Anchor and deployed on Devnet.
The PDA derivation (["tip_vault", owner]) is used consistently:
    On-chain (in the Anchor program).
    In tests.
    In the frontend (pure @solana/web3.js).

The frontend does not rely on the Anchor JS client:
    It manually computes instruction discriminators using @noble/hashes (sha256("global:<ix_name>") first 8 bytes).
    It builds and sends transactions with @solana/web3.js and @solana/wallet-adapter.

The UI includes:
    Clear feedback for common error states (zero amount, insufficient funds, already initialized, etc.).
    A simple, focused UX that demonstrates understanding of:
        PDAs
        System Program transfers
        Custom errors
        Wallet integration on Devnet