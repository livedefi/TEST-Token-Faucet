import { expect } from "chai";
import { network } from "hardhat";

const { ethers } = await network.connect();

describe("SimpleToken", function () {
  const TOKEN_NAME = "Test Token";
  const TOKEN_SYMBOL = "TEST";
  const INITIAL_SUPPLY = ethers.parseEther("1000");
  const TOKEN_CAP = ethers.parseEther("10000");

  it("Should deploy with correct initial parameters", async function () {
    const simpleToken = await ethers.deployContract("SimpleToken", [
      TOKEN_NAME,
      TOKEN_SYMBOL,
      INITIAL_SUPPLY,
      TOKEN_CAP
    ]);

    expect(await simpleToken.name()).to.equal(TOKEN_NAME);
    expect(await simpleToken.symbol()).to.equal(TOKEN_SYMBOL);
    expect(await simpleToken.totalSupply()).to.equal(INITIAL_SUPPLY);
    expect(await simpleToken.cap()).to.equal(TOKEN_CAP);
  });

  it("Should emit Mint event when minting tokens", async function () {
    const [owner, recipient] = await ethers.getSigners();
    const simpleToken = await ethers.deployContract("SimpleToken", [
      TOKEN_NAME,
      TOKEN_SYMBOL,
      0,
      TOKEN_CAP
    ]);

    const mintAmount = ethers.parseEther("100");

    await expect(simpleToken.mint(recipient.address, mintAmount))
      .to.emit(simpleToken, "Mint")
      .withArgs(recipient.address, mintAmount);
  });

  it("Should correctly track total supply after multiple mints", async function () {
    const [owner, recipient1, recipient2] = await ethers.getSigners();
    const simpleToken = await ethers.deployContract("SimpleToken", [
      TOKEN_NAME,
      TOKEN_SYMBOL,
      0,
      TOKEN_CAP
    ]);

    const deploymentBlockNumber = await ethers.provider.getBlockNumber();

    const amounts = [
      ethers.parseEther("100"),
      ethers.parseEther("200"),
      ethers.parseEther("300")
    ];

    // Mint tokens to different addresses
    await simpleToken.mint(recipient1.address, amounts[0]);
    await simpleToken.mint(recipient2.address, amounts[1]);
    await simpleToken.mint(recipient1.address, amounts[2]);

    // Query all Mint events
    const events = await simpleToken.queryFilter(
      simpleToken.filters.Mint(),
      deploymentBlockNumber,
      "latest"
    );

    // Calculate total from events
    let totalFromEvents = 0n;
    for (const event of events) {
      totalFromEvents += event.args.amount;
    }

    // Verify total supply matches sum of mint events
    expect(await simpleToken.totalSupply()).to.equal(totalFromEvents);
    expect(totalFromEvents).to.equal(amounts[0] + amounts[1] + amounts[2]);
  });

  it("Should prevent minting beyond cap", async function () {
    const [owner, recipient] = await ethers.getSigners();
    const smallCap = ethers.parseEther("100");
    const simpleToken = await ethers.deployContract("SimpleToken", [
      TOKEN_NAME,
      TOKEN_SYMBOL,
      0,
      smallCap
    ]);

    const exceedingAmount = ethers.parseEther("101");

    await expect(simpleToken.mint(recipient.address, exceedingAmount))
      .to.be.revertedWith("SimpleToken: cap exceeded");
  });

  it("Should allow batch minting to multiple addresses", async function () {
    const [owner, recipient1, recipient2, recipient3] = await ethers.getSigners();
    const simpleToken = await ethers.deployContract("SimpleToken", [
      TOKEN_NAME,
      TOKEN_SYMBOL,
      0,
      TOKEN_CAP
    ]);

    const recipients = [recipient1.address, recipient2.address, recipient3.address];
    const amounts = [
      ethers.parseEther("100"),
      ethers.parseEther("200"),
      ethers.parseEther("300")
    ];

    const tx = await simpleToken.batchMint(recipients, amounts);

    // Check that all Mint events were emitted
    for (let i = 0; i < recipients.length; i++) {
      await expect(tx)
        .to.emit(simpleToken, "Mint")
        .withArgs(recipients[i], amounts[i]);
    }

    // Verify balances
    for (let i = 0; i < recipients.length; i++) {
      expect(await simpleToken.balanceOf(recipients[i])).to.equal(amounts[i]);
    }
  });

  it("Should prevent batch minting with mismatched arrays", async function () {
    const [owner, recipient1, recipient2] = await ethers.getSigners();
    const simpleToken = await ethers.deployContract("SimpleToken", [
      TOKEN_NAME,
      TOKEN_SYMBOL,
      0,
      TOKEN_CAP
    ]);

    const recipients = [recipient1.address, recipient2.address];
    const amounts = [ethers.parseEther("100")]; // Mismatched length

    await expect(simpleToken.batchMint(recipients, amounts))
      .to.be.revertedWith("SimpleToken: arrays length mismatch");
  });

  it("Should allow pausing and unpausing by owner", async function () {
    const [owner, user] = await ethers.getSigners();
    const simpleToken = await ethers.deployContract("SimpleToken", [
      TOKEN_NAME,
      TOKEN_SYMBOL,
      INITIAL_SUPPLY,
      TOKEN_CAP
    ]);

    // Pause the contract
    await simpleToken.pause();
    expect(await simpleToken.paused()).to.be.true;

    // Transfers should be blocked when paused
    await expect(simpleToken.transfer(user.address, ethers.parseEther("10")))
      .to.be.revertedWithCustomError(simpleToken, "EnforcedPause");

    // Unpause the contract
    await simpleToken.unpause();
    expect(await simpleToken.paused()).to.be.false;

    // Transfers should work again
    await expect(simpleToken.transfer(user.address, ethers.parseEther("10")))
      .to.not.be.revert(ethers);
  });

  it("Should prevent non-owner from minting", async function () {
    const [owner, nonOwner] = await ethers.getSigners();
    const simpleToken = await ethers.deployContract("SimpleToken", [
      TOKEN_NAME,
      TOKEN_SYMBOL,
      0,
      TOKEN_CAP
    ]);

    await expect(simpleToken.connect(nonOwner).mint(nonOwner.address, ethers.parseEther("100")))
      .to.be.revertedWithCustomError(simpleToken, "OwnableUnauthorizedAccount");
  });

  it("Should correctly calculate remaining mintable supply", async function () {
    const simpleToken = await ethers.deployContract("SimpleToken", [
      TOKEN_NAME,
      TOKEN_SYMBOL,
      INITIAL_SUPPLY,
      TOKEN_CAP
    ]);

    const expectedRemaining = TOKEN_CAP - INITIAL_SUPPLY;
    expect(await simpleToken.remainingMintableSupply()).to.equal(expectedRemaining);

    // Mint some tokens and check again
    const mintAmount = ethers.parseEther("500");
    const [owner, recipient] = await ethers.getSigners();
    await simpleToken.mint(recipient.address, mintAmount);

    const newExpectedRemaining = expectedRemaining - mintAmount;
    expect(await simpleToken.remainingMintableSupply()).to.equal(newExpectedRemaining);
  });

  it("Should allow token burning by holders", async function () {
    const [owner, user] = await ethers.getSigners();
    const simpleToken = await ethers.deployContract("SimpleToken", [
      TOKEN_NAME,
      TOKEN_SYMBOL,
      INITIAL_SUPPLY,
      TOKEN_CAP
    ]);

    const burnAmount = ethers.parseEther("100");
    
    // Transfer some tokens to user first
    await simpleToken.transfer(user.address, burnAmount);
    
    const initialSupply = await simpleToken.totalSupply();
    const initialUserBalance = await simpleToken.balanceOf(user.address);

    // User burns their tokens
    await simpleToken.connect(user).burn(burnAmount);

    expect(await simpleToken.totalSupply()).to.equal(initialSupply - burnAmount);
    expect(await simpleToken.balanceOf(user.address)).to.equal(initialUserBalance - burnAmount);
  });

  it("Should prevent minting to zero address", async function () {
    const simpleToken = await ethers.deployContract("SimpleToken", [
      TOKEN_NAME,
      TOKEN_SYMBOL,
      0,
      TOKEN_CAP
    ]);

    await expect(simpleToken.mint(ethers.ZeroAddress, ethers.parseEther("100")))
      .to.be.revertedWith("SimpleToken: mint to zero address");
  });

  it("Should revert when cap is zero in constructor", async function () {
    await expect(ethers.deployContract("SimpleToken", [
      TOKEN_NAME,
      TOKEN_SYMBOL,
      0,
      0 // Zero cap
    ])).to.be.revertedWith("SimpleToken: cap must be greater than 0");
  });

  it("Should revert when initial supply exceeds cap", async function () {
    const cap = ethers.parseEther("100");
    const excessiveInitialSupply = ethers.parseEther("200");

    await expect(ethers.deployContract("SimpleToken", [
      TOKEN_NAME,
      TOKEN_SYMBOL,
      excessiveInitialSupply,
      cap
    ])).to.be.revertedWith("SimpleToken: initial supply exceeds cap");
  });
});