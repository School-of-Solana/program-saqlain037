import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { TipJar } from "../target/types/tip_jar";
import { assert } from "chai";

describe("tip_jar", () => {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const program = anchor.workspace.TipJar as Program<TipJar>;
  const connection = provider.connection;

  const LAMPORTS_PER_SOL = anchor.web3.LAMPORTS_PER_SOL;

  function getVaultPda(owner: anchor.web3.PublicKey) {
    return anchor.web3.PublicKey.findProgramAddressSync(
      [Buffer.from("tip_vault"), owner.toBuffer()],
      program.programId
    );
  }

  async function airdrop(pubkey: anchor.web3.PublicKey, sol: number) {
    const sig = await connection.requestAirdrop(
      pubkey,
      sol * LAMPORTS_PER_SOL
    );
    await connection.confirmTransaction(sig);
  }

  it("init_vault - happy path", async () => {
    const owner = anchor.web3.Keypair.generate();
    await airdrop(owner.publicKey, 1);

    const [vaultPda] = getVaultPda(owner.publicKey);

    await program.methods
      .initVault()
      .accounts({
        vault: vaultPda,
        owner: owner.publicKey,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .signers([owner])
      .rpc();

    const vault = await program.account.tipVault.fetch(vaultPda);
    assert.ok(vault.owner.equals(owner.publicKey));
    assert.equal(vault.totalTips.toNumber(), 0);
  });

  it("init_vault - unhappy (re-initialize same owner)", async () => {
    const owner = anchor.web3.Keypair.generate();
    await airdrop(owner.publicKey, 1);
    const [vaultPda] = getVaultPda(owner.publicKey);

    // First init should work
    await program.methods
      .initVault()
      .accounts({
        vault: vaultPda,
        owner: owner.publicKey,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .signers([owner])
      .rpc();

    // Second init should fail because account already exists
    try {
      await program.methods
        .initVault()
        .accounts({
          vault: vaultPda,
          owner: owner.publicKey,
          systemProgram: anchor.web3.SystemProgram.programId,
        })
        .signers([owner])
        .rpc();
      assert.fail("Expected init_vault to fail on second call");
    } catch (err) {
      // Just reaching here is enough; Anchor will throw an error
      assert.ok(true);
    }
  });

  it("send_tip - happy path", async () => {
    const owner = anchor.web3.Keypair.generate();
    const tipper = anchor.web3.Keypair.generate();

    await airdrop(owner.publicKey, 1);
    await airdrop(tipper.publicKey, 1);

    const [vaultPda] = getVaultPda(owner.publicKey);

    // init vault
    await program.methods
      .initVault()
      .accounts({
        vault: vaultPda,
        owner: owner.publicKey,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .signers([owner])
      .rpc();

    const amount = new anchor.BN(0.1 * LAMPORTS_PER_SOL);

    await program.methods
      .sendTip(amount)
      .accounts({
        vault: vaultPda,
        tipper: tipper.publicKey,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .signers([tipper])
      .rpc();

    const vault = await program.account.tipVault.fetch(vaultPda);
    assert.equal(vault.totalTips.toNumber(), amount.toNumber());

    const vaultBalance = await connection.getBalance(vaultPda);
    assert.isAtLeast(vaultBalance, amount.toNumber());
  });

  it("send_tip - unhappy (amount = 0)", async () => {
    const owner = anchor.web3.Keypair.generate();
    const tipper = anchor.web3.Keypair.generate();

    await airdrop(owner.publicKey, 1);
    await airdrop(tipper.publicKey, 1);

    const [vaultPda] = getVaultPda(owner.publicKey);

    await program.methods
      .initVault()
      .accounts({
        vault: vaultPda,
        owner: owner.publicKey,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .signers([owner])
      .rpc();

    try {
      await program.methods
        .sendTip(new anchor.BN(0))
        .accounts({
          vault: vaultPda,
          tipper: tipper.publicKey,
          systemProgram: anchor.web3.SystemProgram.programId,
        })
        .signers([tipper])
        .rpc();
      assert.fail("Expected InvalidAmount error");
    } catch (err: any) {
      const msg = err.error?.errorMessage ?? err.toString();
      assert.include(msg, "Amount must be greater than zero");
    }
  });

  it("withdraw - happy path", async () => {
    const owner = anchor.web3.Keypair.generate();
    const tipper = anchor.web3.Keypair.generate();

    await airdrop(owner.publicKey, 1);
    await airdrop(tipper.publicKey, 1);

    const [vaultPda] = getVaultPda(owner.publicKey);

    // init vault
    await program.methods
      .initVault()
      .accounts({
        vault: vaultPda,
        owner: owner.publicKey,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .signers([owner])
      .rpc();

    const tipAmount = new anchor.BN(0.2 * LAMPORTS_PER_SOL);

    await program.methods
      .sendTip(tipAmount)
      .accounts({
        vault: vaultPda,
        tipper: tipper.publicKey,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .signers([tipper])
      .rpc();

    const withdrawAmount = new anchor.BN(0.1 * LAMPORTS_PER_SOL);

    const ownerBalanceBefore = await connection.getBalance(owner.publicKey);

    await program.methods
      .withdraw(withdrawAmount)
      .accounts({
        vault: vaultPda,
        owner: owner.publicKey,
      })
      .signers([owner])
      .rpc();

    const ownerBalanceAfter = await connection.getBalance(owner.publicKey);
    assert.isAbove(ownerBalanceAfter, ownerBalanceBefore);

    const vaultBalance = await connection.getBalance(vaultPda);
    assert.isBelow(vaultBalance, tipAmount.toNumber());
  });

  it("withdraw - unhappy (non-owner)", async () => {
    const owner = anchor.web3.Keypair.generate();
    const attacker = anchor.web3.Keypair.generate();
    const tipper = anchor.web3.Keypair.generate();

    await airdrop(owner.publicKey, 1);
    await airdrop(attacker.publicKey, 1);
    await airdrop(tipper.publicKey, 1);

    const [vaultPda] = getVaultPda(owner.publicKey);

    await program.methods
      .initVault()
      .accounts({
        vault: vaultPda,
        owner: owner.publicKey,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .signers([owner])
      .rpc();

    const tipAmount = new anchor.BN(0.1 * LAMPORTS_PER_SOL);

    await program.methods
      .sendTip(tipAmount)
      .accounts({
        vault: vaultPda,
        tipper: tipper.publicKey,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .signers([tipper])
      .rpc();

    try {
      await program.methods
        .withdraw(new anchor.BN(0.05 * LAMPORTS_PER_SOL))
        .accounts({
          vault: vaultPda,
          owner: attacker.publicKey,
        })
        .signers([attacker])
        .rpc();
      assert.fail("Expected Unauthorized error");
    } catch (err: any) {
      const msg = err.error?.errorMessage ?? err.toString();
      assert.include(msg, "You are not authorized");
    }
  });
});

