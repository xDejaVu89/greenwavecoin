# GreenWaveCoin Backend Coordinator

Backend service for managing GreenWaveCoin compute rewards, task distribution, and Merkle proof generation.

## Features

- **Task Queue Management**: Assign and track compute tasks
- **Result Validation**: Redundant validation of compute results
- **Reward Calculation**: Epoch-based reward distribution
- **Merkle Proof Generation**: On-chain claim proofs
- **REST API**: Endpoints for clients and admin operations

## Tech Stack

- Node.js + TypeScript
- Express.js
- PostgreSQL (via TypeORM)
- Redis (task queue)
- Ethers.js (blockchain interaction)
- MerkleTreeJS (proof generation)

## Setup

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Configure environment:**
   ```bash
   cp .env.example .env
   # Edit .env with your configuration
   ```

3. **Run development server:**
   ```bash
   npm run dev
   ```

4. **Build for production:**
   ```bash
   npm run build
   npm start
   ```

## API Endpoints

### Health Check
- `GET /health` - Server health status

### Rewards
- `GET /api/rewards/:address` - Get pending rewards for an address
- `POST /api/rewards/calculate` - Calculate and publish epoch rewards (admin)

### Tasks (Coming Soon)
- `GET /api/tasks` - Get available tasks
- `POST /api/tasks/assign` - Assign task to client
- `POST /api/results` - Submit compute result

## Development

```bash
# Run in watch mode
npm run dev

# Lint code
npm run lint

# Run tests
npm test
```

## Architecture

```
backend/
├── src/
│   ├── routes/          # API route handlers
│   ├── services/        # Business logic
│   │   └── merkle.service.ts
│   ├── models/          # Database models (TypeORM)
│   ├── config/          # Configuration
│   └── index.ts         # Entry point
├── package.json
├── tsconfig.json
└── .env.example
```

## Security

- Rate limiting on all API endpoints
- Helmet.js for security headers
- CORS configuration
- Environment-based secrets
- Timelock/multisig for Merkle root publishing

## License

MIT
