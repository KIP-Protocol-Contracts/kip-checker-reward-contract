import { expect } from "chai";
import { ethers } from "hardhat";
import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";
import { CKIP, CKIP__factory, KIPNode, KIPNode__factory, NodeReward, NodeReward__factory } from "../typechain-types";
import { token } from "../typechain-types/@openzeppelin/contracts";

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
            owner.address,
            await kipNode.getAddress(),
            await ckip.getAddress(),
            await fundAddress.getAddress(),
            await payMaster.getAddress(),
        );
    });

    it("Should init contract correctly", async () => {
        expect(await nodeReward.owner()).to.equal(owner.address);
        expect(await nodeReward.fundAddress()).to.equal(fundAddress.address);
        expect(await nodeReward.kipNode()).to.equal(await kipNode.getAddress());
        expect(await nodeReward.cKIP()).to.equal(await ckip.getAddress());
    });

    describe("setPaymaster testing", () => {
        it("Should fails if non-owner setPaymaster", async () => {
            await expect(
                nodeReward.connect(accounts[0])
                    .setPaymaster(payMaster.address, true)
            ).to.be.revertedWithCustomError(nodeReward, "OwnableUnauthorizedAccount");
        });

        it("Should set paymaster correctly", async () => {
            await expect(
                nodeReward.connect(owner).setPaymaster(payMaster.address, true)
            ).to.emit(nodeReward, "PaymasterChanged").withArgs(payMaster.address, true);
        });

        it("Should set paymaster with false correctly", async () => {
            await expect(
                nodeReward.connect(owner).setPaymaster(payMaster.address, false)
            ).to.emit(nodeReward, "PaymasterChanged").withArgs(payMaster.address, false);
        });
    });

    describe("setFundAddress testing", () => {
        it("Should fails if non-owner setFundAddress", async () => {
            await expect(
                nodeReward.connect(accounts[0])
                    .setFundAddress(accounts[1].address)
            ).to.be.revertedWithCustomError(nodeReward, "OwnableUnauthorizedAccount");
        });

        it("Should set fundAddress correctly", async () => {
            await nodeReward.connect(owner)
                .setFundAddress(newFundAddress.address)

            expect(await nodeReward.fundAddress()).to.equal(newFundAddress.address);
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
                .to.emit(nodeReward, "DelegationChanged").withArgs(await accounts[0].getAddress(), "1", await accounts[1].getAddress());

            expect(await nodeReward.getDelegation("1"))
                .to.equal((await accounts[1].getAddress()));
        });
    });

    describe("penalty testing", () => {
        let falsyPayMaster: HardhatEthersSigner;

        beforeEach(async () => {
            [falsyPayMaster] = await ethers.getSigners();
            await nodeReward.connect(owner).setPaymaster((await falsyPayMaster.getAddress()), false);
            await nodeReward.connect(owner).setPaymaster((await payMaster.getAddress()), true);
        });

        it("Should revert if amount 0", async () => {
            await expect(
                nodeReward.connect(owner).penalty("1", "0", ethers.encodeBytes32String("foo"))
            ).to.be.revertedWithCustomError(nodeReward, "AmountIsZero");
        });

        it("Should revert if non-paymaster call", async () => {
            await expect(
                nodeReward.connect(accounts[0]).penalty("1", "1", ethers.encodeBytes32String("foo"))
            ).to.be.revertedWithCustomError(nodeReward, "InvalidPayMaster");
        });

        it("Should revert if falsy paymaster call", async () => {
            await expect(
                nodeReward.connect(falsyPayMaster).penalty("1", "1", ethers.encodeBytes32String("foo"))
            ).to.be.revertedWithCustomError(nodeReward, "InvalidPayMaster");
        });

        it("Should call penalty", async () => {
            await expect(
                nodeReward.connect(payMaster).penalty("1", "100", ethers.encodeBytes32String("foo"))
            ).to.emit(nodeReward, "Penalty").withArgs(payMaster.address, "1", "100", ethers.encodeBytes32String("foo"));
        });
    });

    describe("claim testing", () => {
        let falsyPayMaster: HardhatEthersSigner;
        let tokenOwner: HardhatEthersSigner;
        let nonTokenOwner: HardhatEthersSigner;
        const encoder = ethers.AbiCoder.defaultAbiCoder();

        beforeEach(async () => {
            [falsyPayMaster, tokenOwner, nonTokenOwner] = await ethers.getSigners();
            await nodeReward.connect(owner).setPaymaster(falsyPayMaster.address, false);
            await nodeReward.connect(owner).setPaymaster(payMaster.address, true);
            await kipNode.mint(tokenOwner.address, "1");
        });

        it("Should revert if amount 0", async () => {
            await expect(
                nodeReward.connect(owner).claim(
                    "1",
                    "0",
                    payMaster.address,
                    ethers.encodeBytes32String("foo"),
                    ethers.encodeBytes32String("bar")
                )
            ).to.be.revertedWithCustomError(nodeReward, "AmountIsZero");
        });

        it("Should revert if non-paymaster call", async () => {
            await expect(
                nodeReward.connect(owner).claim(
                    "1",
                    "1",
                    accounts[0].address,
                    ethers.encodeBytes32String("foo"),
                    ethers.encodeBytes32String("bar")
                )
            ).to.be.revertedWithCustomError(nodeReward, "InvalidPayMaster");
        });

        it("Should revert if falsy paymaster call", async () => {
            await expect(
                nodeReward.connect(owner).claim(
                    "1",
                    "1",
                    falsyPayMaster.address,
                    ethers.encodeBytes32String("foo"),
                    ethers.encodeBytes32String("bar")
                )
            ).to.be.revertedWithCustomError(nodeReward, "InvalidPayMaster");
        });

        it("Should revert if non-token-owner call", async () => {
            await expect(
                nodeReward.connect(nonTokenOwner).claim(
                    "1",
                    "1",
                    payMaster.address,
                    ethers.encodeBytes32String("foo"),
                    ethers.encodeBytes32String("bar")
                )
            ).to.be.revertedWithCustomError(nodeReward, "InvalidTokenOwner");
        });

        it("Should claim correctly", async () => {
            const tokenId = "1";
            const expirationTime = "1815874858";
            const amounT = "10";
			const domain = {
				name: "KIPNODEREWARD",
				version: "1",
			};
			const types = {
			Claim: [{ name: "claimed", type: "uint256" }, { name: "token_id", type: "uint256" }, { name: "amount", type: "uint256" }, { name: "sender", type: "address" }, { name: "expiration_time", type: "uint64" }, { name: "reference_id", type: "bytes32" }],
			};

			const signature = await payMaster.signTypedData(domain, types, {
				claimed: "0",
				token_id: tokenId,
				amount: amounT,
				sender: tokenOwner.address,
				expiration_time: expirationTime,
				reference_id: ethers.encodeBytes32String("foo"),
			});
            await expect(
                nodeReward.connect(tokenOwner).claim(
                    tokenId,
                    amounT,
                    payMaster.address,
                    ethers.encodeBytes32String("foo"),
                    signature,
                )
            ).to.emit(nodeReward, "Claimed").withArgs(tokenOwner.address, tokenId, amounT, payMaster.address, expirationTime, ethers.encodeBytes32String("foo"));
        });
    })
});