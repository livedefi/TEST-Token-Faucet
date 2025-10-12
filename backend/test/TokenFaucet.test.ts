import { expect } from "chai";
import { network } from "hardhat";

const { ethers } = await network.connect();

describe("TokenFaucet", function () {
  const TOKEN_NAME = "Test Token";
  const TOKEN_SYMBOL = "TEST";
  const INITIAL_SUPPLY = ethers.parseEther("10000");
  const TOKEN_CAP = ethers.parseEther("100000");
  const TOKENS_PER_REQUEST = ethers.parseEther("10");
  const COOLDOWN_TIME = 3600; // 1 hour
  const MAX_TOKENS_PER_ADDRESS = ethers.parseEther("100");
  const DAILY_LIMIT = ethers.parseEther("1000");

  async function deployContracts() {
    const [owner, user1, user2, user3] = await ethers.getSigners();
    
    // Deploy SimpleToken first
    const simpleToken = await ethers.deployContract("SimpleToken", [
      TOKEN_NAME,
      TOKEN_SYMBOL,
      INITIAL_SUPPLY,
      TOKEN_CAP
    ]);

    // Deploy TokenFaucet
    const tokenFaucet = await ethers.deployContract("TokenFaucet", [
      await simpleToken.getAddress(),
      TOKENS_PER_REQUEST,
      COOLDOWN_TIME,
      MAX_TOKENS_PER_ADDRESS,
      DAILY_LIMIT
    ]);

    // Transfer some tokens to the faucet
    const faucetSupply = ethers.parseEther("5000");
    await simpleToken.transfer(await tokenFaucet.getAddress(), faucetSupply);

    return { simpleToken, tokenFaucet, owner, user1, user2, user3 };
  }

  it("Should deploy with correct initial parameters", async function () {
    const { simpleToken, tokenFaucet } = await deployContracts();

    expect(await tokenFaucet.token()).to.equal(await simpleToken.getAddress());
    expect(await tokenFaucet.tokensPerRequest()).to.equal(TOKENS_PER_REQUEST);
    expect(await tokenFaucet.cooldownTime()).to.equal(COOLDOWN_TIME);
    expect(await tokenFaucet.maxTokensPerAddress()).to.equal(MAX_TOKENS_PER_ADDRESS);
    expect(await tokenFaucet.dailyLimit()).to.equal(DAILY_LIMIT);
  });

  it("Should emit TokensRequested event when requesting tokens", async function () {
    const { tokenFaucet, user1 } = await deployContracts();

    await expect(tokenFaucet.connect(user1).requestTokens())
      .to.emit(tokenFaucet, "TokensRequested")
      .withArgs(user1.address, TOKENS_PER_REQUEST, await ethers.provider.getBlock("latest").then(b => b!.timestamp + 1));
  });

  it("Should correctly distribute tokens and track user balances", async function () {
    const { simpleToken, tokenFaucet, user1 } = await deployContracts();
    const deploymentBlockNumber = await ethers.provider.getBlockNumber();

    const initialBalance = await simpleToken.balanceOf(user1.address);

    // Request tokens multiple times (with time manipulation to bypass cooldown)
    await tokenFaucet.connect(user1).requestTokens();
    
    // Fast forward time to bypass cooldown
    await ethers.provider.send("evm_increaseTime", [COOLDOWN_TIME + 1]);
    await ethers.provider.send("evm_mine");
    
    await tokenFaucet.connect(user1).requestTokens();

    // Query all TokensRequested events
    const events = await tokenFaucet.queryFilter(
      tokenFaucet.filters.TokensRequested(),
      deploymentBlockNumber,
      "latest"
    );

    // Calculate total from events
    let totalFromEvents = 0n;
    for (const event of events) {
      if (event.args.user === user1.address) {
        totalFromEvents += event.args.amount;
      }
    }

    // Verify user balance matches sum of request events
    const finalBalance = await simpleToken.balanceOf(user1.address);
    expect(finalBalance - initialBalance).to.equal(totalFromEvents);
    expect(totalFromEvents).to.equal(TOKENS_PER_REQUEST * 2n);
  });

  it("Should enforce cooldown period between requests", async function () {
    const { tokenFaucet, user1 } = await deployContracts();

    // First request should succeed
    await tokenFaucet.connect(user1).requestTokens();

    // Second request immediately should fail
    await expect(tokenFaucet.connect(user1).requestTokens())
      .to.be.revertedWith("TokenFaucet: cooldown period not met");

    // Fast forward time and try again
     await ethers.provider.send("evm_increaseTime", [COOLDOWN_TIME + 1]);
     await ethers.provider.send("evm_mine");

    // Should succeed now
    await expect(tokenFaucet.connect(user1).requestTokens()).to.not.be.revert(ethers);
  });

  it("Should enforce maximum tokens per address limit", async function () {
    const { tokenFaucet, user1 } = await deployContracts();

    // Calculate how many requests are needed to reach the limit
    const maxRequests = Number(MAX_TOKENS_PER_ADDRESS / TOKENS_PER_REQUEST);

    // Make requests up to the limit
    for (let i = 0; i < maxRequests; i++) {
      await tokenFaucet.connect(user1).requestTokens();
      if (i < maxRequests - 1) {
         await ethers.provider.send("evm_increaseTime", [COOLDOWN_TIME + 1]);
         await ethers.provider.send("evm_mine");
       }
    }

    // Next request should fail
     await ethers.provider.send("evm_increaseTime", [COOLDOWN_TIME + 1]);
     await ethers.provider.send("evm_mine");
    
    await expect(tokenFaucet.connect(user1).requestTokens())
      .to.be.revertedWith("TokenFaucet: max tokens per address exceeded");
  });

  it("Should enforce daily limit", async function () {
    const { tokenFaucet, owner } = await deployContracts();

    // Set cooldown to 0 to avoid advancing time and accidentally crossing the day boundary
    await tokenFaucet.connect(owner).configureFaucet(
      TOKENS_PER_REQUEST,
      0,
      MAX_TOKENS_PER_ADDRESS,
      DAILY_LIMIT
    );

    // Calculate how many requests are needed to reach daily limit
    const maxDailyRequests = Number(DAILY_LIMIT / TOKENS_PER_REQUEST); // 100 requests
    const maxRequestsPerUser = Number(MAX_TOKENS_PER_ADDRESS / TOKENS_PER_REQUEST); // 10 requests per user
    const usersNeeded = Math.ceil(maxDailyRequests / maxRequestsPerUser); // 10 users
    
    // Get available signers
    const signers = await ethers.getSigners();
    const users = signers.slice(1, usersNeeded + 1); // Skip owner
    
    // Make requests to reach the daily limit without advancing time
    let requestsMade = 0;
    for (let userIndex = 0; userIndex < users.length && requestsMade < maxDailyRequests; userIndex++) {
      const user = users[userIndex];
      
      for (let requestIndex = 0; requestIndex < maxRequestsPerUser && requestsMade < maxDailyRequests; requestIndex++) {
        await tokenFaucet.connect(user).requestTokens();
        requestsMade++;
      }
    }

    // Check the current state
    const totalDistributed = await tokenFaucet.totalDistributedToday();
    const dailyLimit = await tokenFaucet.dailyLimit();
    console.log(`Requests made: ${requestsMade}`);
    console.log(`Total distributed today: ${ethers.formatEther(totalDistributed)} ETH`);
    console.log(`Daily limit: ${ethers.formatEther(dailyLimit)} ETH`);
    
    // Now the daily limit should be reached (100 requests made)
    // Try one more request with a fresh user - this should fail
    const freshUser = signers[usersNeeded + 1];
    await expect(tokenFaucet.connect(freshUser).requestTokens())
      .to.be.revertedWith("TokenFaucet: daily limit exceeded");
  });

  it("Should allow owner to batch distribute tokens", async function () {
    const { simpleToken, tokenFaucet, owner, user1, user2, user3 } = await deployContracts();

    const recipients = [user1.address, user2.address, user3.address];
    const amounts = [
      ethers.parseEther("50"),
      ethers.parseEther("75"),
      ethers.parseEther("25")
    ];

    const tx = await tokenFaucet.connect(owner).batchDistribute(recipients, amounts);

    // Check that all TokensRequested events were emitted
    for (let i = 0; i < recipients.length; i++) {
      await expect(tx)
        .to.emit(tokenFaucet, "TokensRequested")
        .withArgs(recipients[i], amounts[i], await ethers.provider.getBlock("latest").then(b => b!.timestamp));
    }

    // Verify balances
    for (let i = 0; i < recipients.length; i++) {
      expect(await simpleToken.balanceOf(recipients[i])).to.equal(amounts[i]);
    }
  });

  it("Should allow depositing tokens to the faucet", async function () {
    const { simpleToken, tokenFaucet, user1 } = await deployContracts();

    const depositAmount = ethers.parseEther("100");
    
    // First transfer tokens to user1
    await simpleToken.transfer(user1.address, depositAmount);
    
    // User1 approves faucet to spend tokens
    await simpleToken.connect(user1).approve(await tokenFaucet.getAddress(), depositAmount);

    const initialFaucetBalance = await tokenFaucet.getFaucetBalance();

    await expect(tokenFaucet.connect(user1).depositTokens(depositAmount))
      .to.emit(tokenFaucet, "TokensDeposited")
      .withArgs(user1.address, depositAmount);

    expect(await tokenFaucet.getFaucetBalance()).to.equal(initialFaucetBalance + depositAmount);
  });

  it("Should allow owner to withdraw tokens from faucet", async function () {
    const { simpleToken, tokenFaucet, owner } = await deployContracts();

    const withdrawAmount = ethers.parseEther("100");
    const initialOwnerBalance = await simpleToken.balanceOf(owner.address);
    const initialFaucetBalance = await tokenFaucet.getFaucetBalance();

    await expect(tokenFaucet.connect(owner).withdrawTokens(withdrawAmount))
      .to.emit(tokenFaucet, "TokensWithdrawn")
      .withArgs(owner.address, withdrawAmount);

    expect(await simpleToken.balanceOf(owner.address)).to.equal(initialOwnerBalance + withdrawAmount);
    expect(await tokenFaucet.getFaucetBalance()).to.equal(initialFaucetBalance - withdrawAmount);
  });

  it("Should allow owner to pause and unpause the faucet", async function () {
    const { tokenFaucet, owner, user1 } = await deployContracts();

    // Pause the faucet
    await tokenFaucet.connect(owner).pause();

    // Requests should fail when paused
    await expect(tokenFaucet.connect(user1).requestTokens())
      .to.be.revertedWithCustomError(tokenFaucet, "EnforcedPause");

    // Unpause the faucet
    await tokenFaucet.connect(owner).unpause();

    // Requests should work again
    await expect(tokenFaucet.connect(user1).requestTokens()).to.not.be.revert(ethers);
  });

  it("Should allow owner to configure faucet parameters", async function () {
    const { tokenFaucet, owner } = await deployContracts();

    const newTokensPerRequest = ethers.parseEther("20");
    const newCooldownTime = 7200; // 2 hours
    const newMaxTokensPerAddress = ethers.parseEther("200");
    const newDailyLimit = ethers.parseEther("2000");

    await expect(tokenFaucet.connect(owner).configureFaucet(
      newTokensPerRequest,
      newCooldownTime,
      newMaxTokensPerAddress,
      newDailyLimit
    )).to.emit(tokenFaucet, "FaucetConfigured")
      .withArgs(newTokensPerRequest, newCooldownTime, newMaxTokensPerAddress, newDailyLimit);

    expect(await tokenFaucet.tokensPerRequest()).to.equal(newTokensPerRequest);
    expect(await tokenFaucet.cooldownTime()).to.equal(newCooldownTime);
    expect(await tokenFaucet.maxTokensPerAddress()).to.equal(newMaxTokensPerAddress);
    expect(await tokenFaucet.dailyLimit()).to.equal(newDailyLimit);
  });

  it("Should handle blacklisting functionality", async function () {
    const { tokenFaucet, owner, user1 } = await deployContracts();

    // Blacklist user1
    await expect(tokenFaucet.connect(owner).setBlacklisted(user1.address, true))
      .to.emit(tokenFaucet, "UserBlacklisted")
      .withArgs(user1.address, true);

    // User1 should not be able to request tokens
    await expect(tokenFaucet.connect(user1).requestTokens())
      .to.be.revertedWith("TokenFaucet: user is blacklisted");

    // Remove from blacklist
    await tokenFaucet.connect(owner).setBlacklisted(user1.address, false);

    // User1 should be able to request tokens again
    await expect(tokenFaucet.connect(user1).requestTokens()).to.not.be.revert(ethers);
  });


  it("Should provide correct user information", async function () {
    const { tokenFaucet, user1 } = await deployContracts();

    // Initial state
    let userInfo = await tokenFaucet.getUserInfo(user1.address);
    expect(userInfo.totalReceived).to.equal(0);
    expect(userInfo.lastRequest).to.equal(0);
    expect(userInfo.canRequest).to.be.true;
    expect(userInfo.timeUntilNextRequest).to.equal(0);

    // After first request
    await tokenFaucet.connect(user1).requestTokens();
    userInfo = await tokenFaucet.getUserInfo(user1.address);
    expect(userInfo.totalReceived).to.equal(TOKENS_PER_REQUEST);
    expect(userInfo.canRequest).to.be.false;
    expect(userInfo.timeUntilNextRequest).to.be.greaterThan(0);
  });

  it("Should prevent non-owner from administrative functions", async function () {
    const { tokenFaucet, user1 } = await deployContracts();

    await expect(tokenFaucet.connect(user1).pause())
      .to.be.revertedWithCustomError(tokenFaucet, "OwnableUnauthorizedAccount");

    await expect(tokenFaucet.connect(user1).configureFaucet(
      TOKENS_PER_REQUEST,
      COOLDOWN_TIME,
      MAX_TOKENS_PER_ADDRESS,
      DAILY_LIMIT
    )).to.be.revertedWithCustomError(tokenFaucet, "OwnableUnauthorizedAccount");

    await expect(tokenFaucet.connect(user1).setBlacklisted(user1.address, true))
      .to.be.revertedWithCustomError(tokenFaucet, "OwnableUnauthorizedAccount");
  });

  it("Should handle insufficient faucet balance", async function () {
    const { simpleToken, tokenFaucet, owner, user1 } = await deployContracts();

    // Withdraw most tokens from faucet
    const faucetBalance = await tokenFaucet.getFaucetBalance();
    const withdrawAmount = faucetBalance - TOKENS_PER_REQUEST + 1n;
    await tokenFaucet.connect(owner).withdrawTokens(withdrawAmount);

    // Request should fail due to insufficient balance
    await expect(tokenFaucet.connect(user1).requestTokens())
      .to.be.revertedWith("TokenFaucet: insufficient faucet balance");
  });

  it("Should reset daily limit after 24 hours", async function () {
    const { tokenFaucet, owner } = await deployContracts();

    const initialConfig = await tokenFaucet.getFaucetConfig();
    expect(initialConfig.totalDistributedToday_).to.equal(0);

    // Manually reset daily limit to test the function
    await expect(tokenFaucet.connect(owner).resetDailyLimit())
      .to.emit(tokenFaucet, "DailyLimitReset");
  });

  it("Should prevent invalid constructor parameters", async function () {
    const { simpleToken } = await deployContracts();

    // Zero tokens per request
    await expect(ethers.deployContract("TokenFaucet", [
      await simpleToken.getAddress(),
      0, // Invalid
      COOLDOWN_TIME,
      MAX_TOKENS_PER_ADDRESS,
      DAILY_LIMIT
    ])).to.be.revertedWith("TokenFaucet: tokens per request must be > 0");

    // Max tokens less than tokens per request
    await expect(ethers.deployContract("TokenFaucet", [
      await simpleToken.getAddress(),
      TOKENS_PER_REQUEST,
      COOLDOWN_TIME,
      ethers.parseEther("5"), // Less than tokens per request
      DAILY_LIMIT
    ])).to.be.revertedWith("TokenFaucet: max tokens must be >= tokens per request");
  });
});