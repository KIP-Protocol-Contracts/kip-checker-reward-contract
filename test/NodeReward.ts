import { expect } from "chai";
import { ethers } from "hardhat";
import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";
import { CKIP, CKIP__factory, KIPNode, KIPNode__factory, NodeReward, NodeReward__factory } from "../typechain-types";
import { time } from "@nomicfoundation/hardhat-network-helpers";


describe("NodeReward testing", () => {
    let owner: HardhatEthersSigner;
    let fundAddress: HardhatEthersSigner;
    let newFundAddress: HardhatEthersSigner;
    let payMaster: HardhatEthersSigner;
    let newPayMaster: HardhatEthersSigner;
    let accounts: HardhatEthersSigner[];
    let ckip: CKIP;
    let kipNode: KIPNode;
    let nodeReward: NodeReward;

    beforeEach(async () => {
        [owner, fundAddress, newFundAddress, payMaster, newPayMaster, ...accounts] = await ethers.getSigners();

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

        const ERC1967Proxy = await ethers.getContractFactory('Proxy1967');
        const nodeRewardImpl = await NodeReward.deploy();
        const nodeRewardProxy = await ERC1967Proxy.deploy(
            await nodeRewardImpl.getAddress(),
            NodeReward.interface.encodeFunctionData("initialize", [
                owner.address,
                await kipNode.getAddress(),
                await ckip.getAddress(),
                await fundAddress.getAddress()
            ])
        )
        nodeReward = NodeReward.attach(await nodeRewardProxy.getAddress()) as NodeReward;
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
                    .setDelegation("1", "1", (await accounts[1].getAddress()))
            ).to.be.revertedWithCustomError(nodeReward, "InvalidTokenOwner");
        });

        it("Should return address 0 when getDelegation not set", async () => {
            expect(await nodeReward.getDelegation("1", "1"))
                .to.equal("0x0000000000000000000000000000000000000000");
        });

        it("Should set delegation correctly", async () => {
            await kipNode.mint((await accounts[0].getAddress()), "1");

            await expect(
                nodeReward.connect(accounts[0])
                    .setDelegation("1", "1", (await accounts[1].getAddress())
                    ))
                .to.emit(nodeReward, "DelegationChanged").withArgs(await accounts[0].getAddress(), "1", "1", await accounts[1].getAddress());

            expect(await nodeReward.getDelegation("1", "1"))
                .to.equal((await accounts[1].getAddress()));
        });
    });

    describe("penalty testing", () => {
        let falsyPayMaster: HardhatEthersSigner;

        beforeEach(async () => {
            [falsyPayMaster] = await ethers.getSigners();
            await nodeReward.connect(owner).setAuditor((await falsyPayMaster.getAddress()), false);
            await nodeReward.connect(owner).setAuditor((await payMaster.getAddress()), true);
        });

        it("Should revert if amount 0", async () => {
            await expect(
                nodeReward.connect(owner).penalty("1", "0", ethers.encodeBytes32String("foo"))
            ).to.be.revertedWithCustomError(nodeReward, "AmountIsZero");
        });

        it("Should revert if non-paymaster call", async () => {
            await expect(
                nodeReward.connect(accounts[0]).penalty("1", "1", ethers.encodeBytes32String("foo"))
            ).to.be.revertedWithCustomError(nodeReward, "InvalidAuditor");
        });

        it("Should revert if falsy paymaster call", async () => {
            await expect(
                nodeReward.connect(falsyPayMaster).penalty("1", "1", ethers.encodeBytes32String("foo"))
            ).to.be.revertedWithCustomError(nodeReward, "InvalidAuditor");
        });

        it("Should call penalty", async () => {
            await expect(
                nodeReward.connect(payMaster).penalty("1", "100", ethers.encodeBytes32String("foo"))
            ).to.emit(nodeReward, "Penalty").withArgs(payMaster.address, "1", "100", ethers.encodeBytes32String("foo"));
        });
    });

    describe("pause/unpause testing", () => {
        it("Should revert if non-owner pause", async () => {
            await expect(
                nodeReward.connect(accounts[0]).pause()
            ).to.be.revertedWithCustomError(nodeReward, "OwnableUnauthorizedAccount");
        });

        it("Should pause correctly", async () => {
            await expect(
                nodeReward.connect(owner).pause()
            ).to.emit(nodeReward, "Paused").withArgs(owner.address);
        });

        it("Should revert if non-owner unpause", async () => {
            await expect(
                nodeReward.connect(accounts[0]).unpause()
            ).to.be.revertedWithCustomError(nodeReward, "OwnableUnauthorizedAccount");
        });

        it("Should unpause correctly", async () => {
            await nodeReward.connect(owner).pause();
            await expect(
                nodeReward.connect(owner).unpause()
            ).to.emit(nodeReward, "Unpaused").withArgs(owner.address);
        });
    });

    describe("claim testing", () => {
        let falsyPayMaster: HardhatEthersSigner;
        let tokenOwner: HardhatEthersSigner;
        let nonTokenOwner: HardhatEthersSigner;
        const encoder = ethers.AbiCoder.defaultAbiCoder();
        const expirationTime = 1815874858;

        beforeEach(async () => {
            [falsyPayMaster, tokenOwner, nonTokenOwner] = await ethers.getSigners();
            await nodeReward.connect(owner).setPaymaster(falsyPayMaster.address, false);
            await nodeReward.connect(owner).setPaymaster(payMaster.address, true);
            await nodeReward.connect(owner).setTreasurer(falsyPayMaster.address, false);
            await nodeReward.connect(owner).setTreasurer(payMaster.address, true);
            await kipNode.mint(tokenOwner.address, "1");
        });

        it("Should revert if amount 0", async () => {
            await expect(
                nodeReward.connect(owner).claim(
                    "1",
                    "0",
                    payMaster.address,
                    ethers.encodeBytes32String("foo"),
                    ethers.encodeBytes32String("bar"),
                    expirationTime
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
                    ethers.encodeBytes32String("bar"),
                    expirationTime
                )
            ).to.be.revertedWithCustomError(nodeReward, "InvalidPayMaster");
        });

        it("Should revert if signature expired call", async () => {
            await expect(
                nodeReward.connect(tokenOwner).claim(
                    "1",
                    "1",
                    payMaster.address,
                    ethers.encodeBytes32String("foo"),
                    ethers.encodeBytes32String("bar"),
                    10001
                )
            ).to.be.revertedWithCustomError(nodeReward, "ExpiredSignature");
        });

        it("Should revert if non-token-owner call", async () => {
            await expect(
                nodeReward.connect(nonTokenOwner).claim(
                    "1",
                    "1",
                    payMaster.address,
                    ethers.encodeBytes32String("foo"),
                    ethers.encodeBytes32String("bar"),
                    expirationTime
                )
            ).to.be.revertedWithCustomError(nodeReward, "InvalidTokenOwner");
        });

        it("Should revert if non-token-owner call", async () => {
            await expect(
                nodeReward.connect(nonTokenOwner).claim(
                    "1",
                    "1",
                    payMaster.address,
                    ethers.encodeBytes32String("foo"),
                    ethers.encodeBytes32String("bar"),
                    expirationTime
                )
            ).to.be.revertedWithCustomError(nodeReward, "InvalidTokenOwner");
        });

        it("Should revert if non-owner setWithdrawInterval", async () => {
            await expect(
                nodeReward.connect(accounts[0]).setWithdrawInterval(1000)
            ).to.be.revertedWithCustomError(nodeReward, "OwnableUnauthorizedAccount");
        });

        it("Should setWithdrawInterval correctly", async () => {
            await expect(
                nodeReward.connect(owner).setWithdrawInterval(1000)
            ).to.emit(nodeReward, "WithdrawIntervalChanged").withArgs(owner.address, 1000);
            expect(await nodeReward.WITHDRAW_INTERVAL()).to.equal(1000);
        });

        it("Should revert if non-owner setClaimInterval", async () => {
            await expect(
                nodeReward.connect(accounts[0]).setClaimInterval(1000)
            ).to.be.revertedWithCustomError(nodeReward, "OwnableUnauthorizedAccount");
        });

        it("Should setClaimInterval correctly", async () => {
            await expect(
                nodeReward.connect(owner).setClaimInterval(1000)
            ).to.emit(nodeReward, "ClaimIntervalChanged").withArgs(owner.address, 1000);
            expect(await nodeReward.CLAIM_INTERVAL()).to.equal(1000);
        });

        it("Should revert if trying to claim with same reference_id", async () => {
            const chainIdBigInt = (await ethers.provider.getNetwork()).chainId;
            const chainId = Number(chainIdBigInt);
            const myContractDeployedAddress = (await nodeReward.getAddress());
            const tokenId = "1";
            const amounT = "10";
            const referenceId = ethers.encodeBytes32String("duplicate");

            const domain = {
                name: "KIPNODEREWARD",
                version: "1",
                chainId: chainId,
                verifyingContract: myContractDeployedAddress,
            };

            const types = {
                Claim: [
                    { name: "claimed", type: "uint256" },
                    { name: "token_id", type: "uint256" },
                    { name: "amount", type: "uint256" },
                    { name: "sender", type: "address" },
                    { name: "expiration_time", type: "uint64" },
                    { name: "reference_id", type: "bytes32" }
                ],
            };

            const signature = await payMaster.signTypedData(domain, types, {
                claimed: "0",
                token_id: tokenId,
                amount: amounT,
                sender: tokenOwner.address,
                expiration_time: expirationTime,
                reference_id: referenceId,
            });

            // First claim should succeed
            await nodeReward.connect(tokenOwner).claim(
                tokenId,
                amounT,
                payMaster.address,
                referenceId,
                signature,
                expirationTime
            );

            // Second claim with same reference_id should fail
            await expect(
                nodeReward.connect(tokenOwner).claim(
                    tokenId,
                    amounT,
                    payMaster.address,
                    referenceId,
                    signature,
                    expirationTime
                )
            ).to.be.reverted
        });

        it("Should revert if signature is invalid", async () => {
            const chainIdBigInt = (await ethers.provider.getNetwork()).chainId;
            const chainId = Number(chainIdBigInt);
            const myContractDeployedAddress = (await nodeReward.getAddress());
            const tokenId = "1";
            const amounT = "10";

            const domain = {
                name: "KIPNODEREWARD",
                version: "1",
                chainId: chainId,
                verifyingContract: myContractDeployedAddress,
            };

            const types = {
                Claim: [
                    { name: "claimed", type: "uint256" },
                    { name: "token_id", type: "uint256" },
                    { name: "amount", type: "uint256" },
                    { name: "sender", type: "address" },
                    { name: "expiration_time", type: "uint64" },
                    { name: "reference_id", type: "bytes32" }
                ],
            };

            // Sign with a different amount than what will be claimed
            const signature = await payMaster.signTypedData(domain, types, {
                claimed: "0",
                token_id: tokenId,
                amount: "20", // Different amount
                sender: tokenOwner.address,
                expiration_time: expirationTime,
                reference_id: ethers.encodeBytes32String("invalid"),
            });

            await expect(
                nodeReward.connect(tokenOwner).claim(
                    tokenId,
                    amounT, // Using different amount than what was signed
                    payMaster.address,
                    ethers.encodeBytes32String("invalid"),
                    signature,
                    expirationTime
                )
            ).to.be.revertedWithCustomError(nodeReward, "InvalidSignature");
        });

        it("Should claim correctly", async () => {
            const chainIdBigInt = (await ethers.provider.getNetwork()).chainId; //returns BigInt => 1337n for hardhat
            const chainId = Number(chainIdBigInt) // convert to interger;
            console.log(chainId) // 1337
            const myContractDeployedAddress = (await nodeReward.getAddress());
            console.log(myContractDeployedAddress);
            const tokenId = "1";
            const amounT = "10";
            const domain = {
                name: "KIPNODEREWARD",
                version: "1",
                chainId: chainId,
                verifyingContract: myContractDeployedAddress,
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
                reference_id: ethers.encodeBytes32String("6"),
            });
            console.log(await newPayMaster.getAddress());
            console.log("reference_id : " + ethers.encodeBytes32String("6"));
            console.log("signature : " + signature);
            const tx = await nodeReward.connect(tokenOwner).claim(
                tokenId,
                amounT,
                payMaster.address,
                ethers.encodeBytes32String("6"),
                signature,
                expirationTime,
            )
            const blockTime = (await ethers.provider.getBlock(tx?.blockNumber))?.timestamp;
            await expect(tx).to.emit(nodeReward, "Claimed").withArgs(tokenOwner.address, tokenId, amounT, payMaster.address, ethers.encodeBytes32String("6"), blockTime);
        });

        it("Should withdraw correctly after claim", async () => {
            const chainIdBigInt = (await ethers.provider.getNetwork()).chainId; //returns BigInt => 1337n for hardhat
            const chainId = Number(chainIdBigInt) // convert to interger;
            console.log(chainId) // 1337
            const myContractDeployedAddress = (await nodeReward.getAddress());
            console.log(myContractDeployedAddress);
            const tokenId = "1";
            const amounT = "10";
            const domain = {
                name: "KIPNODEREWARD",
                version: "1",
                chainId: chainId,
                verifyingContract: myContractDeployedAddress,
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
                reference_id: ethers.encodeBytes32String("6"),
            });
            console.log(await newPayMaster.getAddress());
            console.log("reference_id : " + ethers.encodeBytes32String("6"));
            console.log("signature : " + signature);
            const tx = await nodeReward.connect(tokenOwner).claim(
                tokenId,
                amounT,
                payMaster.address,
                ethers.encodeBytes32String("6"),
                signature,
                expirationTime,
            )
            const blockTime = (await ethers.provider.getBlock(tx?.blockNumber))?.timestamp;
            await expect(tx).to.emit(nodeReward, "Claimed").withArgs(tokenOwner.address, tokenId, amounT, payMaster.address, ethers.encodeBytes32String("6"), blockTime);

            const withDrawTypes = {
                Withdraw: [{ name: "withdrawn", type: "uint256" }, { name: "token_id", type: "uint256" }, { name: "amount", type: "uint256" }, { name: "sender", type: "address" }, { name: "expiration_time", type: "uint64" }, { name: "reference_id", type: "bytes32" }],
            };

            const withDrawSignature = await payMaster.signTypedData(domain, withDrawTypes, {
                withdrawn: "0",
                token_id: tokenId,
                amount: amounT,
                sender: tokenOwner.address,
                expiration_time: expirationTime,
                reference_id: ethers.encodeBytes32String("6"),
            });

            await time.increase(86400 + 1);
            await ckip.mint(await fundAddress.getAddress(), amounT);
            await ckip.connect(fundAddress).approve(await nodeReward.getAddress(), amounT);
            const txWithdraw = await nodeReward.connect(tokenOwner).withdraw(
                tokenId,
                amounT,
                payMaster.address,
                ethers.encodeBytes32String("6"),
                withDrawSignature,
                expirationTime,
            );
            const blockTimeWithdraw = (await ethers.provider.getBlock(txWithdraw?.blockNumber))?.timestamp;
            await expect(txWithdraw).to.emit(nodeReward, "Withdraw").withArgs(tokenOwner.address, tokenId, amounT, payMaster.address, ethers.encodeBytes32String("6"), blockTimeWithdraw);
        })
    })
});