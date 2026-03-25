# CricAuction Cloud Functions

Server-side functions for managing auction timers and critical operations.

## Functions

### 1. onAuctionStateChange
**Type:** Firestore Trigger  
**Trigger:** `auction/state` document updates  
**Purpose:** Schedules auction end time when status becomes Active

### 2. checkExpiredAuctions
**Type:** Scheduled (every 5 seconds)  
**Purpose:** Checks for expired auctions and automatically ends them

### 3. endAuctionManually
**Type:** HTTP Callable  
**Auth:** Requires admin role  
**Purpose:** Allows manual auction end from client

### 4. healthCheck
**Type:** HTTP Endpoint  
**Purpose:** Health monitoring and status check

## Development

### Install Dependencies
```bash
npm install
```

### Build TypeScript
```bash
npm run build
```

### Watch Mode (auto-rebuild)
```bash
npm run build:watch
```

### Test Locally
```bash
npm run serve
```

### Deploy
```bash
npm run deploy
```

### View Logs
```bash
npm run logs
```

## Environment

- **Node.js:** 20
- **TypeScript:** 5.8
- **Firebase Admin SDK:** 12.0
- **Firebase Functions:** 5.0

## Architecture

```
src/
  index.ts          # Main functions file
lib/                # Compiled JavaScript (gitignored)
node_modules/       # Dependencies (gitignored)
package.json        # Dependencies and scripts
tsconfig.json       # TypeScript configuration
```

## Security

- Functions run with admin privileges
- `endAuctionManually` requires authentication and admin role
- All operations use Firestore transactions for consistency

## Monitoring

View logs in Firebase Console or via CLI:
```bash
firebase functions:log
```

Filter by function:
```bash
firebase functions:log --only checkExpiredAuctions
```

## Cost

All functions stay within Firebase free tier for typical usage:
- 2M invocations/month free
- Estimated usage: ~525K invocations/month

## Support

See `CLOUD_FUNCTIONS_SETUP.md` in the root directory for detailed setup instructions.
