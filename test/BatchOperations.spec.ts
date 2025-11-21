import { expect } from "chai";
import { ethers } from "hardhat";
import { ArcSmartAccount, ArcSmartAccount__factory } from "../typechain-types";

describe("Batch Operations", function () {
    let smartAccount: ArcSmartAccount;
    let owner: any;
    let recipient1: any;
    let recipient2: any;
    let entryPoint: any;

    beforeEach(async function () {
        [owner, recipient1, recipient2] = await ethers.getSigners();

        // Deploy Mock EntryPoint
        const EntryPointFactory = await ethers.getContractFactory("MockEntryPoint");
        entryPoint = await EntryPointFactory.deploy();

        // Deploy Smart Account
        const SmartAccountFactory = await ethers.getContractFactory("ArcSmartAccount");
        smartAccount = await SmartAccountFactory.deploy(await entryPoint.getAddress(), owner.address);

        // Fund Smart Account
        await owner.sendTransaction({
            to: await smartAccount.getAddress(),
            value: ethers.parseEther("1.0")
        });
    });

    it("Should execute batch transfers successfully", async function () {
        const dest = [recipient1.address, recipient2.address];
        const value = [ethers.parseEther("0.1"), ethers.parseEther("0.2")];
        const func = ["0x", "0x"];

        const balance1Before = await ethers.provider.getBalance(recipient1.address);
        const balance2Before = await ethers.provider.getBalance(recipient2.address);

        await smartAccount.connect(owner).executeBatch(dest, value, func);

        const balance1After = await ethers.provider.getBalance(recipient1.address);
        const balance2After = await ethers.provider.getBalance(recipient2.address);

        expect(balance1After - balance1Before).to.equal(ethers.parseEther("0.1"));
        expect(balance2After - balance2Before).to.equal(ethers.parseEther("0.2"));
    });

    it("Should revert if array lengths mismatch", async function () {
        const dest = [recipient1.address];
        const value = [ethers.parseEther("0.1"), ethers.parseEther("0.2")];
        const func = ["0x", "0x"];

        await expect(
            smartAccount.connect(owner).executeBatch(dest, value, func)
        ).to.be.revertedWith("wrong array lengths");
    });
});
