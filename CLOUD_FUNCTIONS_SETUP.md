# Cloud Functions Setup Guide - Auction Timer

## Overview

This guide explains how to deploy the Cloud Functions that handle the auction timer independently of client browsers. This fixes the critical issue where closing the admin's browser tab would freeze the auction.

---

## 🎯 Problem Solved

**Before:** The auction timer ran in the admin's browser using JavaScript `setInterval()`. If the admin closed their tab or lost internet connection, the auction would freeze indefinitely.

**After:** The auction timer runs on Firebase Cloud Functions (Google's servers). The auction will automatically end at the correct time regardless of client connectivity.

---

## 📋 Prerequisites

1. **Firebase CLI** installed globally:
   ```bash
   npm install -g firebase-tools
   ```

2. **Firebase Project** with Blaze (pay-as-you-go) plan:
   - Cloud Functions require the Blaze plan
   - Free tier includes 2M invocations/month (more than enough)
   - Visit: https://console.firebase.google.com

3. **Node.js 20** or higher installed

---

## 🚀 Deployment Steps

### Step 1: Install Dependencies

Navigate to the functions directory and install packages:

```bash
cd functions
npm install
```

### Step 2: Login to Firebase

```bash
firebase login
```

This will open a browser window for authentication.

### Step 3: Initialize Firebase Project (if not already done)

```bash
firebase use --add
```

Select your Firebase project from the list.

### Step 4: Build the Functions

```bash
npm run build
```

This compiles TypeScript to JavaScript in the `lib/` directory.

### Step 5: Deploy to Firebase

```bash
firebase deploy --only functions
```

This will deploy all Cloud Functions. Expected output:

```
✔  functions[onAuctionStateChange(us-central1)] Successful create operation.
✔  functions[checkExpiredAuctions(us-central1)] Successful create operation.
✔  functions[endAuctionManually(us-central1)] Successful create operation.
✔  functions[healthCheck(us-central1)] Successful create operation.

✔  Deploy complete!
```

### Step 6: Verify Deployment

Check the Firebase Console:
1. Go to https://console.firebase.google.com
2. Select your project
3. Navigate to **Functions** in the left sidebar
4. You should see 4 deployed functions:
   - `onAuctionStateChange` (Firestore trigger)
   - `checkExpiredAuctions` (Scheduled, every 5 seconds)
   - `endAuctionManually` (HTTP callable)
   - `healthCheck` (HTTP endpoint)

---

## 🔧 How It Works

### 1. **onAuctionStateChange** (Firestore Trigger)
- Triggers whenever `auction/state` document is updated
- When status changes to `Active`, calculates `scheduledEndTime`
- Stores `scheduledEndTime` in Firestore for tracking

### 2. **checkExpiredAuctions** (Scheduled Function)
- Runs every 5 seconds via Cloud Scheduler
- Checks if current time >= `scheduledEndTime`
- If expired, calls `endAuction()` to finalize the auction
- Handles the transaction to update player, team, and auction state

### 3. **endAuctionManually** (Callable Function)
- Backup function for manual auction end
- Requires admin authentication
- Can be called from client if needed

### 4. **healthCheck** (HTTP Endpoint)
- Simple health check for monitoring
- Returns JSON with status and timestamp

---

## 📊 Architecture Diagram

```
┌─────────────────────────────────────────────────────────┐
│                    Client Browser                        │
│  (Admin/Team/Public - displays countdown only)          │
└────────────────┬────────────────────────────────────────┘
                 │
                 │ Firestore Listener
                 │ (real-time updates)
                 ↓
┌─────────────────────────────────────────────────────────┐
│                  Firestore Database                      │
│                                                          │
│  auction/state:                                          │
│  {                                                       │
│    status: 'Active',                                     │
│    startTime: 1711234567890,                            │
│    timeLeft: 30,                                         │
│    scheduledEndTime: 1711234597890  ← Set by Function   │
│  }                                                       │
└────────────┬────────────────────────────────────────────┘
             │
             │ Firestore Trigger
             │ (on document update)
             ↓
┌─────────────────────────────────────────────────────────┐
│         Cloud Function: onAuctionStateChange             │
│  • Detects status change to 'Active'                    │
│  • Calculates scheduledEndTime                          │
│  • Stores in Firestore                                  │
└─────────────────────────────────────────────────────────┘

             ┌────────────────────────────────────────────┐
             │  Cloud Scheduler (every 5 seconds)         │
             └────────────┬───────────────────────────────┘
                          │
                          ↓
┌─────────────────────────────────────────────────────────┐
│         Cloud Function: checkExpiredAuctions             │
│  • Reads auction/state                                  │
│  • Checks if now >= scheduledEndTime                    │
│  • If expired, calls endAuction()                       │
│  • Updates player, team, auction in transaction         │
└─────────────────────────────────────────────────────────┘
```

---

## 💰 Cost Estimate

### Cloud Functions Pricing (Blaze Plan)

**Free Tier (per month):**
- 2M invocations
- 400,000 GB-seconds
- 200,000 GHz-seconds

**Estimated Usage:**
- `checkExpiredAuctions`: 12 invocations/minute × 60 min × 24 hours = 17,280/day
- `onAuctionStateChange`: ~100 invocations/day (depends on auction activity)
- Total: ~17,500 invocations/day = 525,000/month

**Cost:** $0/month (well within free tier)

Even with 10x traffic, you'd stay within free tier limits.

---

## 🧪 Testing

### Test Locally with Emulators

```bash
cd functions
npm run serve
```

This starts the Firebase Emulators Suite. You can test functions locally before deploying.

### Test in Production

1. Start an auction from the admin portal
2. Watch the Firebase Console Functions logs:
   ```bash
   firebase functions:log
   ```
3. You should see:
   ```
   Auction started { playerId: 'abc123', startTime: ..., scheduledEndTime: ... }
   ```
4. Wait for the timer to expire (or set a short duration for testing)
5. You should see:
   ```
   Auction expired, ending now { playerId: 'abc123', delay: 234 }
   Player sold { playerId: 'abc123', teamName: 'Mumbai Indians', price: 200 }
   ```

### Manual Test via Callable Function

You can also test the manual end function:

```javascript
import { getFunctions, httpsCallable } from 'firebase/functions';

const functions = getFunctions();
const endAuction = httpsCallable(functions, 'endAuctionManually');

// Call from admin client
await endAuction({ playerId: 'player123' });
```

---

## 🔍 Monitoring & Debugging

### View Logs

```bash
firebase functions:log
```

Or in Firebase Console: **Functions** → Select function → **Logs** tab

### Common Issues

#### 1. "Billing account not configured"
**Solution:** Upgrade to Blaze plan in Firebase Console

#### 2. "Permission denied"
**Solution:** Ensure you're logged in with correct account:
```bash
firebase logout
firebase login
```

#### 3. "Function deployment failed"
**Solution:** Check TypeScript compilation:
```bash
cd functions
npm run build
```

#### 4. "Scheduled function not running"
**Solution:** Cloud Scheduler needs to be enabled:
- Go to Google Cloud Console
- Enable Cloud Scheduler API
- Redeploy functions

---

## 🔄 Updating Functions

After making changes to `functions/src/index.ts`:

```bash
cd functions
npm run build
firebase deploy --only functions
```

To deploy a specific function:

```bash
firebase deploy --only functions:checkExpiredAuctions
```

---

## 🛡️ Security Rules

The Cloud Functions run with admin privileges and bypass Firestore security rules. This is intentional and secure because:

1. Functions are server-side code (not exposed to clients)
2. `endAuctionManually` requires admin authentication
3. `checkExpiredAuctions` only ends auctions that have naturally expired

No additional security rules needed.

---

## 📝 Client-Side Changes

The client code has been updated to:

1. **Remove** the `setInterval` timer logic that called `endAuction()`
2. **Keep** the display countdown (purely visual)
3. **Trust** the Cloud Function to end auctions automatically

The admin can still manually end auctions via the UI, which calls the existing `endAuction()` function in the client.

---

## 🎉 Benefits

✅ **Reliability:** Auction ends on time even if admin closes browser  
✅ **Consistency:** All clients see the same countdown  
✅ **Scalability:** Handles multiple concurrent auctions  
✅ **Accuracy:** Server-side timing is more precise  
✅ **Monitoring:** Centralized logs for debugging  

---

## 🚨 Rollback Plan

If you need to rollback to client-side timer:

1. Revert the changes in `src/App.tsx`:
   - Restore the `endAuctionRef.current()` call in the timer useEffect
   - Remove the comment about Cloud Function

2. Delete the Cloud Functions:
   ```bash
   firebase functions:delete onAuctionStateChange
   firebase functions:delete checkExpiredAuctions
   firebase functions:delete endAuctionManually
   firebase functions:delete healthCheck
   ```

---

## 📞 Support

If you encounter issues:

1. Check Firebase Console logs
2. Run `firebase functions:log` for real-time logs
3. Test with emulators first: `npm run serve`
4. Verify Blaze plan is active

---

## ✅ Deployment Checklist

- [ ] Firebase CLI installed (`npm install -g firebase-tools`)
- [ ] Logged in to Firebase (`firebase login`)
- [ ] Project selected (`firebase use --add`)
- [ ] Blaze plan enabled (check Firebase Console)
- [ ] Dependencies installed (`cd functions && npm install`)
- [ ] TypeScript compiled (`npm run build`)
- [ ] Functions deployed (`firebase deploy --only functions`)
- [ ] Verified in Firebase Console (4 functions visible)
- [ ] Tested with a live auction
- [ ] Checked logs for errors (`firebase functions:log`)

---

**Deployment Date:** March 25, 2026  
**Version:** 1.0.0  
**Status:** Production Ready
