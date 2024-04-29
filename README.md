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