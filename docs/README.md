# GreenWaveCoin docs

This small docs folder contains deployment and upgrade instructions for the project.

- `DEPLOYMENT.md` — step-by-step deployment instructions for local and public networks
- `UPGRADES.md` — how to perform UUPS upgrades safely
# GreenWaveCoin Documentation

## Overview

GreenWaveCoin (GWV) is an ERC20 token implemented on the Polygon network. It features a fixed supply of 1,000,000 tokens with 18 decimal places.

## Token Details

- **Name:** GreenWaveCoin
- **Symbol:** GWV
- **Decimals:** 18
- **Total Supply:** 1,000,000 GWV
- **Contract Address (Amoy):** `0x0ed9f9a71c5FB7f432BEdD4aF04dEA4B28Be58D2`

## Features

- Fixed supply (no additional minting)
- Standard ERC20 functionality
- OpenZeppelin implementation
- Comprehensive test coverage
- Gas optimized

## Gas Usage

Based on our benchmarks:

- First transfer: ~51,000 gas
- Subsequent transfers: ~34,000 gas
- Approvals: ~46,000 gas
- TransferFrom: ~54,000 gas

*Note: Actual gas costs may vary based on network conditions*

## Development

### Prerequisites

- Node.js v20+
- npm v9+
- Hardhat

### Installation

```bash
npm install
```

### Testing

Run the test suite:

```bash
npm test
```

Run gas benchmarks:

```bash
npm run test:gas
```

Generate coverage report:

```bash
npm run coverage
```

### Deployment

1. Set up your `.env` file:
   ```
   PRIVATE_KEY=your_private_key_here
   ```

2. Deploy to Polygon Amoy:
   ```bash
   npm run deploy
   ```

## Security

The contract has been developed with security best practices:

- Uses OpenZeppelin's audited contracts
- Comprehensive test suite
- CI/CD with automated testing
- Solidity version pinned to ^0.8.28
- Fixed supply (no mint function)

## Contributing

1. Fork the repository
2. Create your feature branch
3. Add tests for any new functionality
4. Ensure all tests pass
5. Submit a pull request

## License

MIT