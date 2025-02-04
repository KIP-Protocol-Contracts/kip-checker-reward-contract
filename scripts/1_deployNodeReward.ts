import { ethers, upgrades } from "hardhat";
import hre from "hardhat";

async function main() {
    const [deployer] = await ethers.getSigners();
    console.log("Deploying NodeReward with the account:", deployer.address);

    // Currently use for arbitrum sepolia
    // FUND_ADDRESS=0x02aff773DB681E8bC12FEEfA2be6f0c87de046C3
    // KIP_NODE_ADDRESS=0x79B7D02135f6fC3eD4A2a04C48830eaD0f4Ca3F2
    // KIP_TOKEN_ADDRESS=0x5948Ef23B9E5E272B397eE42B750a747D49dd954
    //
    if (!process.env.KIP_NODE_ADDRESS || !process.env.KIP_TOKEN_ADDRESS || !process.env.FUND_ADDRESS) {
        throw new Error("Missing environment variables");
    }
    
    const NodeReward = await ethers.getContractFactory("NodeReward");
    const nodeReward = await upgrades.deployProxy(NodeReward, [
        deployer.address,
        process.env.KIP_NODE_ADDRESS,
        process.env.KIP_TOKEN_ADDRESS,
        process.env.FUND_ADDRESS,
    ], { 
        initializer: "initialize",
        kind: "uups"
    });
    
    console.log("Waiting for block confirmations...");
    await nodeReward.deploymentTransaction()?.wait(3);
    console.log("NodeReward Proxy deployed to:", await nodeReward.getAddress());

    // Verify implementation
    const implementationAddress = await upgrades.erc1967.getImplementationAddress(
        await nodeReward.getAddress()
    );
    
    // Verify the implementation contract
    await hre.run("verify:verify", {
        address: implementationAddress,
        constructorArguments: []
    });

    console.log("NodeReward implementation verified at:", implementationAddress);
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});