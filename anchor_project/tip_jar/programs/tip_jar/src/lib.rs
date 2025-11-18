use anchor_lang::prelude::*;
use anchor_lang::system_program::{transfer, Transfer};

declare_id!("Gu7sMSSwiYm4JhKisQxAEA8EyJhiKfE2WRQuPFiUjinK");

#[program]
pub mod tip_jar {
    use super::*;

    /// Create a PDA vault for the caller.
    pub fn init_vault(ctx: Context<InitVault>) -> Result<()> {
        let vault = &mut ctx.accounts.vault;
        vault.owner = ctx.accounts.owner.key();
        vault.total_tips = 0;
        Ok(())
    }

    /// Anyone can send a tip (SOL) into the vault PDA.
    pub fn send_tip(ctx: Context<SendTip>, amount: u64) -> Result<()> {
        require!(amount > 0, TipJarError::InvalidAmount);

        let tipper = &ctx.accounts.tipper;
        let vault = &ctx.accounts.vault;
        let system_program = &ctx.accounts.system_program;

        // CPI to system program: transfer lamports from tipper -> vault PDA
        let cpi_ctx = CpiContext::new(
            system_program.to_account_info(),
            Transfer {
                from: tipper.to_account_info(),
                to: vault.to_account_info(),
            },
        );
        transfer(cpi_ctx, amount)?;

        // Update stats
        let vault_data = &mut ctx.accounts.vault;
        vault_data.total_tips = vault_data
            .total_tips
            .checked_add(amount)
            .ok_or(TipJarError::MathOverflow)?;

        Ok(())
    }

    /// Vault owner can withdraw SOL from their PDA.
    pub fn withdraw(ctx: Context<Withdraw>, amount: u64) -> Result<()> {
        require!(amount > 0, TipJarError::InvalidAmount);

        let vault = &ctx.accounts.vault;
        let owner = &ctx.accounts.owner;

        // Only owner can withdraw
        require_keys_eq!(vault.owner, owner.key(), TipJarError::Unauthorized);

        // Check vault has enough lamports
        let vault_lamports = vault.to_account_info().lamports();
        require!(vault_lamports >= amount, TipJarError::InsufficientFunds);

        // Move lamports directly (PDA -> owner)
        let vault_info = vault.to_account_info();
        let owner_info = owner.to_account_info();

        **vault_info.try_borrow_mut_lamports()? -= amount;
        **owner_info.try_borrow_mut_lamports()? += amount;

        Ok(())
    }
}

#[derive(Accounts)]
pub struct InitVault<'info> {
    #[account(
        init,
        payer = owner,
        space = 8 + 32 + 8, // discriminator + owner + total_tips
        seeds = [b"tip_vault", owner.key().as_ref()],
        bump
    )]
    pub vault: Account<'info, TipVault>,

    #[account(mut)]
    pub owner: Signer<'info>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct SendTip<'info> {
    #[account(
        mut,
        seeds = [b"tip_vault", vault.owner.as_ref()],
        bump
    )]
    pub vault: Account<'info, TipVault>,

    #[account(mut)]
    pub tipper: Signer<'info>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct Withdraw<'info> {
    #[account(
        mut,
        seeds = [b"tip_vault", vault.owner.as_ref()],
        bump
    )]
    pub vault: Account<'info, TipVault>,

    #[account(mut)]
    pub owner: Signer<'info>,
}

#[account]
pub struct TipVault {
    pub owner: Pubkey,   // who controls this vault
    pub total_tips: u64, // total lamports ever tipped
}

#[error_code]
pub enum TipJarError {
    #[msg("Amount must be greater than zero")]
    InvalidAmount,
    #[msg("You are not authorized to perform this action")]
    Unauthorized,
    #[msg("Insufficient funds in the vault")]
    InsufficientFunds,
    #[msg("Math overflow")]
    MathOverflow,
}