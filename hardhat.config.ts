import { HardhatUserConfig } from "hardhat/config";
import "@openzeppelin/hardhat-upgrades";
import "@nomicfoundation/hardhat-toolbox";
import "@nomiclabs/hardhat-solhint";
import "@typechain/hardhat";
import "hardhat-gas-reporter";
import "solidity-coverage";
import * as dotenv from "dotenv";
dotenv.config();

const config: HardhatUserConfig = {
    networks: {
        mainnet: {
            url: process.env.MAINNET_RPC || "",
            accounts:
                process.env.MAINNET_DEPLOYER !== undefined
                    ? [process.env.MAINNET_DEPLOYER]
                    : [],
            timeout: 900000,
            chainId: 1,
        },
        sepolia: {
            url: process.env.SEPOLIA_RPC || "",
            accounts:
                process.env.TESTNET_DEPLOYER !== undefined
                    ? [process.env.TESTNET_DEPLOYER]
                    : [],
        },
        arbitrumSepolia: {
            url: process.env.ARB_TESTNET_RPC || "",
            accounts:
                process.env.TESTNET_DEPLOYER !== undefined
                    ? [process.env.TESTNET_DEPLOYER]
                    : [],
        },
    },

    solidity: {
        compilers: [
            {
                version: "0.8.22",
            },
        ],
    },

    gasReporter: {
        enabled: true,
    },

    paths: {
        sources: "./contracts",
        tests: "./test",
        cache: "./build/cache",
        artifacts: "./build/artifacts",
    },

    etherscan: {
        apiKey: {
            arbitrumSepolia: process.env.ARB_API_KEY,
        },

        customChains: [
            // blockscout
            // {
            //     network: "arbitrumSepolia",
            //     chainId: 421614,
            //     urls: {
            //         apiURL: "https://arbitrum-sepolia.blockscout.com/api",
            //         browserURL: "https://arbitrum-sepolia.blockscout.com",
            //     }
            // },
            // arbiscan
            {
                network: "arbitrumSepolia",
                chainId: 421614,
                urls: {
                    apiURL: "https://api-sepolia.arbiscan.io/api",
                    browserURL: "https://sepolia.arbiscan.io",
                }
            }
        ]
    },
};

export default config;