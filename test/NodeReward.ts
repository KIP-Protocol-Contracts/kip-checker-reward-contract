import { expect } from "chai";
import { ethers } from "hardhat";
import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";
import { CKIP, CKIP__factory, KIPNode, KIPNode__factory, NodeReward, NodeReward__factory } from "../typechain-types";

describe("NodeReward testing", () => {
    let owner: HardhatEthersSigner;
    let fundAddress: HardhatEthersSigner;
    let newFundAddress: HardhatEthersSigner;
    let payMaster: HardhatEthersSigner;
    let accounts: HardhatEthersSigner[];
    let ckip: CKIP;
    let kipNode: KIPNode;
    let nodeReward: NodeReward;

    beforeEach(async () => {
        [owner, fundAddress, newFundAddress, payMaster, ...accounts] = await ethers.getSigners();

        const ERC20 = (await ethers.getContractFactory(
            "CKIP",
            owner,
        )) as CKIP__factory;
        ckip = await ERC20.deploy("CKIP Token", "CKIP");

        const KIPNode = (await ethers.getContractFactory(
            "KIPNode",
            owner,
        )) as KIPNode__factory;
        kipNode = await KIPNode.deploy();

        const NodeReward = (await ethers.getContractFactory(
            "NodeReward",
            owner,
        )) as NodeReward__factory;
        nodeReward = await NodeReward.deploy(
            (await owner.getAddress()),
            (await kipNode.getAddress()),
            (await ckip.getAddress()),
            (await fundAddress.getAddress()),
        );
    });

    it("Should init contract correctly", async () => {
        expect(await nodeReward.owner()).to.equal(await owner.getAddress());
        expect(await nodeReward.fundAddress()).to.equal(await fundAddress.getAddress());
        expect(await nodeReward.kipNode()).to.equal(await kipNode.getAddress());
        expect(await nodeReward.cKIP()).to.equal(await ckip.getAddress());
    });

    describe("setPaymaster testing", () => {
        it("Should fails if non-owner setPaymaster", async () => {
            await expect(
                nodeReward.connect(accounts[0])
                    .setPaymaster((await payMaster.getAddress()), true)
            ).to.be.revertedWithCustomError(nodeReward, "OwnableUnauthorizedAccount");
        });

        it("Should set paymaster correctly", async () => {
            await expect(
                nodeReward.connect(owner).setPaymaster((await payMaster.getAddress()), true)
            ).to.emit(nodeReward, "PaymasterChanged").withArgs((await payMaster.getAddress()), true);
        });

        it("Should set paymaster with false correctly", async () => {
            await expect(
                nodeReward.connect(owner).setPaymaster((await payMaster.getAddress()), false)
            ).to.emit(nodeReward, "PaymasterChanged").withArgs((await payMaster.getAddress()), false);
        });
    });

    describe("setFundAddress testing", () => {
        it("Should fails if non-owner setFundAddress", async () => {
            await expect(
                nodeReward.connect(accounts[0])
                    .setFundAddress((await accounts[1].getAddress()))
            ).to.be.revertedWithCustomError(nodeReward, "OwnableUnauthorizedAccount");
        });

        it("Should set fundAddress correctly", async () => {
            await nodeReward.connect(owner)
                .setFundAddress((await newFundAddress.getAddress()))

            expect(await nodeReward.fundAddress()).to.equal(await newFundAddress.getAddress());
        });
    });

    describe("setDelegation/getDelegation testing", () => {
        it("Should fails if non-token-owner setDelegation", async () => {
            await kipNode.mint((await accounts[2].getAddress()), "1")
            await expect(
                nodeReward.connect(accounts[0])
                    .setDelegation("1", (await accounts[1].getAddress()))
            ).to.be.revertedWithCustomError(nodeReward, "InvalidTokenOwner");
        });

        it("Should return address 0 when getDelegation not set", async () => {
            expect(await nodeReward.getDelegation("1"))
                .to.equal("0x0000000000000000000000000000000000000000");
        });

        it("Should set delegation correctly", async () => {
            await kipNode.mint((await accounts[0].getAddress()), "1");

            await expect(
                nodeReward.connect(accounts[0])
                    .setDelegation("1", (await accounts[1].getAddress())
                    ))
                .to.emit(nodeReward, "DelegationChanged").withArgs("1", await accounts[1].getAddress());

            expect(await nodeReward.getDelegation("1"))
                .to.equal((await accounts[1].getAddress()));
        });
    });

    // describe("claim testing", () => {
    //     it("Should revert if amount 0", async () => {
    //         await expect(
    //             nodeReward.connect(owner).claim("1", "0", (await payMaster.getAddress()), ethers.utils.formatBytes32String("foo"), "0x0")
    //         ).to.be.revertedWithCustomError(nodeReward, "InvalidAmount");
    //     });
    // })
});