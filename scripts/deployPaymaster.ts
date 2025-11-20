import { ethers } from "hardhat";

/**
 * Deploy ArcPaymaster contract to Arc Testnet
 * 
 * Usage:
 *   npx hardhat run scripts/deployPaymaster.ts --network arcTestnet
 */
async function main() {
    console.log("🚀 Deploying ArcPaymaster...\n");

    // Configuration
    const ENTRYPOINT_ADDRESS = "0x5FF137D4b0FDCD49DcA30c7CF57E578a026d2789"; // Standard ERC-4337 EntryPoint
    const INITIAL_DEPOSIT = ethers.parseEther("10"); // 10 ETH
    const INITIAL_STAKE = ethers.parseEther("1");    // 1 ETH stake
    const UNSTAKE_DELAY = 86400; // 1 day in seconds

    // Get deployer
    const [deployer] = await ethers.getSigners();
    console.log("📝 Deploying from:", deployer.address);
    console.log("💰 Balance:", ethers.formatEther(await ethers.provider.getBalance(deployer.address)), "ETH\n");

    // Deploy ArcPaymaster
    console.log("📦 Deploying ArcPaymaster contract...");
    const ArcPaymaster = await ethers.getContractFactory("ArcPaymaster");
    const paymaster = await ArcPaymaster.deploy(ENTRYPOINT_ADDRESS, deployer.address);
    await paymaster.waitForDeployment();

    const paymasterAddress = await paymaster.getAddress();
    console.log("✅ ArcPaymaster deployed to:", paymasterAddress, "\n");

    // Deposit initial funds
    console.log("💵 Depositing", ethers.formatEther(INITIAL_DEPOSIT), "ETH...");
    const depositTx = await paymaster.deposit({ value: INITIAL_DEPOSIT });
    await depositTx.wait();
    console.log("✅ Deposit successful\n");

    // Add stake for reputation
    console.log("🔒 Adding stake of", ethers.formatEther(INITIAL_STAKE), "ETH...");
    const stakeTx = await paymaster.addStake(UNSTAKE_DELAY, { value: INITIAL_STAKE });
    await stakeTx.wait();
    console.log("✅ Stake added\n");

    // Configure initial policies
    console.log("⚙️  Configuring policies...");

    // Enable whitelist mode
    const whitelistTx = await paymaster.setWhitelistPolicy(true);
    await whitelistTx.wait();
    console.log("  ✓ Whitelist mode enabled");

    // Set budget policy (disabled by default)
    const budgetTx = await paymaster.setBudgetPolicy(
        false, // disabled
        ethers.parseEther("0.01"), // max 0.01 ETH per op
        ethers.parseEther("1")     // max 1 ETH per day
    );
    await budgetTx.wait();
    console.log("  ✓ Budget policy configured (disabled)");

    // Set rate limit policy (disabled by default)
    const rateLimitTx = await paymaster.setRateLimitPolicy(
        false, // disabled
        10     // max 10 ops per hour
    );
    await rateLimitTx.wait();
    console.log("  ✓ Rate limit policy configured (disabled)\n");

    // Add deployer to whitelist for testing
    console.log("👤 Adding deployer to whitelist...");
    const addWhitelistTx = await paymaster.setWhitelist([deployer.address], true);
    await addWhitelistTx.wait();
    console.log("✅ Deployer whitelisted\n");

    // Get final stats
    const stats = await paymaster.getStats();
    const balance = await paymaster.getBalance();

    console.log("📊 Deployment Summary:");
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log("Contract Address:", paymasterAddress);
    console.log("EntryPoint:", ENTRYPOINT_ADDRESS);
    console.log("Owner:", deployer.address);
    console.log("Balance:", ethers.formatEther(balance), "ETH");
    console.log("Total Sponsored:", stats[0].toString());
    console.log("Total Cost:", ethers.formatEther(stats[1]), "ETH");
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");

    console.log("🎉 Deployment complete!");
    console.log("\n📝 Next steps:");
    console.log("1. Verify contract on explorer");
    console.log("2. Add user addresses to whitelist");
    console.log("3. Update frontend with paymaster address");
    console.log("4. Test sponsored transactions\n");

    // Save deployment info
    const deploymentInfo = {
        network: "arcTestnet",
        paymasterAddress,
        entryPointAddress: ENTRYPOINT_ADDRESS,
        owner: deployer.address,
        deployedAt: new Date().toISOString(),
        initialDeposit: ethers.formatEther(INITIAL_DEPOSIT),
        initialStake: ethers.formatEther(INITIAL_STAKE),
    };

    console.log("💾 Deployment info:");
    console.log(JSON.stringify(deploymentInfo, null, 2));
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
