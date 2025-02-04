import { ethers, upgrades } from "hardhat";
import hre from "hardhat";


async function main() {
    const [deployer] = await ethers.getSigners();
    console.log("Upgrading NodeReward with the account:", deployer.address);

    const NodeRewardV2Test = await ethers.getContractFactory("NodeRewardV2Test");

    if (!process.env.NODE_REWARD_PROXY_ADDRESS) {
        throw new Error("Missing environment variables");
    }

    // Address of the existing NodeReward proxy contract that needs to be upgraded
    const PROXY_ADDRESS = process.env.NODE_REWARD_PROXY_ADDRESS;

    console.log("Upgrading NodeReward to NodeRewardV2Test...");

    const nodeReward = await upgrades.upgradeProxy(PROXY_ADDRESS, NodeRewardV2Test, {
        kind: "uups"
    });

    console.log("Waiting for block confirmations...");
    await nodeReward.deploymentTransaction()?.wait(3);

    // Verify implementation
    const implementationAddress = await upgrades.erc1967.getImplementationAddress(
        "0xfad2f4d055fec46770b38881fc5fb129dfba8ae4"
    );
        
    // Verify the implementation contract
    await hre.run("verify:verify", {
        address: implementationAddress,
        constructorArguments: []
    });

    console.log("NodeReward upgraded to NodeRewardV2Test successfully");
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
