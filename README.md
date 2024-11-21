### Deployed Smart Contract

##### Version: November 21th, 2024

- Network: `Sepolia Arbitrum`
      
  - `Node Reward` contract: [https://sepolia.arbiscan.io/address/0x824c2443c0fd7e5ef0291ad2d88d5bcd69cfccce](https://sepolia.arbiscan.io/address/0x824c2443c0fd7e5ef0291ad2d88d5bcd69cfccce)
      
  - `KIP Token` contract: [https://sepolia.arbiscan.io/address/0xeceD87Aa8380efF7E5c53F887E6F67450D1bB319#writeContract#F1](https://sepolia.arbiscan.io/address/0xeceD87Aa8380efF7E5c53F887E6F67450D1bB319)
      
  - `KIP Node (NFT)` contract: [https://sepolia.arbiscan.io/address/0xfFb351E6f8d5d211E1c78e02BC74aE6d448F6D05#writeContract#F2](https://sepolia.arbiscan.io/address/0xfFb351E6f8d5d211E1c78e02BC74aE6d448F6D05)

##### Version: July 14th, 2024

- Network: `Sepolia Arbitrum`
      
  - `Node Reward` contract: [https://sepolia.arbiscan.io/address/0x6ccf70d5e6d2b5aa792697205fe2038a7ff2ec93](https://sepolia.arbiscan.io/address/0x6ccf70d5e6d2b5aa792697205fe2038a7ff2ec93)
      
  - `KIP Token` contract: [https://sepolia.arbiscan.io/token/0xf87c83a42719daa1055ddd2fc3c385e21a252f09](https://sepolia.arbiscan.io/token/0xf87c83a42719daa1055ddd2fc3c385e21a252f09)
      
  - `KIP Node (NFT)` contract: [https://sepolia.arbiscan.io/address/0xec5fbc86fd39cdd8a0ce1d4247ba2b0b09f5146e](https://sepolia.arbiscan.io/address/0xec5fbc86fd39cdd8a0ce1d4247ba2b0b09f5146e)


## Implementation

Description of requirements for the contract implementation:

Token owners who purchase our node NFT will download our node client to run on a VPS. The node client retrieves tasks, executes them, and reports the data.

Before running the node client, a temporary wallet needs to be created. In the contract, the token owner sets this temporary wallet as their delegation wallet.delegate their work to a temporary wallet on the blockchain.

After completing the tasks, the node client will display earnings on the KIP node portal. Earnings are claimed by obtaining a signed data and making a claim through the contract.

Once claimed, earnings can be immediately withdrawn, but withdrawals must be spaced at least 30 days apart.

We also have a penalty function reserved for cases where a node is found to be violating rules or not working diligently, allowing us to impose fines.

Earnings for each node are credited to the corresponding token ID. When a token owner transfers their token, the new token owner can manage these earnings.

## Development

```
npm ci
npx hardhat clean
npx compile
slither . --hardhat-artifacts-directory build/artifacts
```