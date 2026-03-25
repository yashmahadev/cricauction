# Migration Guide: Client Timer → Cloud Functions

This guide helps you migrate from the client-side auction timer to the Cloud Functions-based timer.

---

## 🎯 What Changed

### Before (Client-Side Timer)
- Timer ran in admin's browser using `setInterval()`
- Admin's browser called `endAuction()` when timer reached 0
- **Problem:** Closing admin tab = frozen auction

### After (Cloud Functions Timer)
- Timer runs on Firebase servers (Cloud Functions)
- Cloud Function automatically ends auction at scheduled time
- **Benefit:** Auction ends reliably regardless of client connectivity

---

## 📋 Migration Steps

### Step 1: Backup Current Data

Before deploying, backup your Firestore data:

```bash
# Export all collections
firebase firestore:export gs://YOUR-PROJECT-ID.appspot.com/backups/$(date +%Y%m%d)
```

### Step 2: Deploy Cloud Functions

Follow the instructions in `CLOUD_FUNCTIONS_SETUP.md`:

```bash
cd functions
npm install
npm run build
firebase deploy --only functions
```

### Step 3: Deploy Updated Client Code

Build and deploy the updated React app:

```bash
npm run build
firebase deploy --only hosting
```

### Step 4: Verify Deployment

1. **Check Functions are Running:**
   ```bash
   firebase functions:log
   ```

2. **Test with a Short Auction:**
   - Login as admin
   - Start an auction with 10-second timer
   - Close the admin tab
   - Wait 10 seconds
   - Reopen and verify auction ended automatically

3. **Monitor Logs:**
   ```bash
   firebase functions:log --only checkExpiredAuctions
   ```

   You should see:
   ```
   Auction expired, ending now { playerId: '...', delay: 234 }
   ```

---

## 🔄 Rollback Plan

If something goes wrong, you can rollback:

### Option 1: Rollback Functions Only

```bash
# Delete the new functions
firebase functions:delete checkExpiredAuctions
firebase functions:delete onAuctionStateChange
firebase functions:delete endAuctionManually
firebase functions:delete healthCheck
```

Then revert the client code changes in `src/App.tsx`.

### Option 2: Full Rollback

```bash
# Restore from backup
firebase firestore:import gs://YOUR-PROJECT-ID.appspot.com/backups/YYYYMMDD

# Revert to previous deployment
git revert HEAD
npm run build
firebase deploy
```

---

## ⚠️ Important Notes

### Active Auctions During Deployment

If you have an active auction during deployment:

1. **Pause the auction** before deploying
2. Deploy the functions
3. Deploy the client
4. Resume the auction

This prevents any timing inconsistencies.

### Scheduled End Time

The new system adds a `scheduledEndTime` field to `auction/state`:

```typescript
{
  status: 'Active',
  startTime: 1711234567890,
  timeLeft: 30,
  scheduledEndTime: 1711234597890  // NEW FIELD
}
```

This field is automatically managed by the Cloud Function.

### Existing Auctions

Auctions that were active before the migration will:
- Continue to display countdown on client
- **Not** have `scheduledEndTime` set
- Need to be manually ended or restarted

**Recommendation:** End all active auctions before deploying.

---

## 🧪 Testing Checklist

After deployment, test these scenarios:

- [ ] Start auction as admin
- [ ] Verify countdown displays correctly
- [ ] Close admin tab
- [ ] Wait for timer to expire
- [ ] Reopen and verify auction ended
- [ ] Check player status (Sold/Unsold)
- [ ] Check team budget updated correctly
- [ ] Verify bid history preserved
- [ ] Test pause/resume functionality
- [ ] Test manual end auction button
- [ ] Check Firebase Functions logs for errors

---

## 📊 Monitoring

### Key Metrics to Watch

1. **Function Invocations:**
   - Firebase Console → Functions → Metrics
   - Should see ~12 invocations/minute for `checkExpiredAuctions`

2. **Function Errors:**
   - Firebase Console → Functions → Logs
   - Filter by "Error" severity
   - Should be 0 errors

3. **Auction End Accuracy:**
   - Compare scheduled end time vs actual end time
   - Should be within 5 seconds (function runs every 5s)

### Alerts to Set Up

Consider setting up alerts in Google Cloud Console:

1. **Function Error Rate > 1%**
2. **Function Execution Time > 10s**
3. **Auction End Delay > 10s**

---

## 🐛 Troubleshooting

### Issue: Auction doesn't end automatically

**Possible Causes:**
1. Cloud Function not deployed
2. Cloud Scheduler not enabled
3. Firestore rules blocking function

**Solution:**
```bash
# Check function status
firebase functions:list

# Check logs
firebase functions:log --only checkExpiredAuctions

# Redeploy
firebase deploy --only functions
```

### Issue: "scheduledEndTime" not set

**Cause:** `onAuctionStateChange` trigger not working

**Solution:**
```bash
# Check trigger status
firebase functions:log --only onAuctionStateChange

# Verify Firestore rules allow function writes
```

### Issue: Multiple auctions ending simultaneously

**Cause:** Race condition in `checkExpiredAuctions`

**Solution:** Already handled by transaction in `endAuction()`. Check logs for details.

---

## 💡 Best Practices

### 1. Monitor Regularly

Set up a daily check:
```bash
firebase functions:log --since 1d | grep -i error
```

### 2. Test Before Major Events

Before a big auction:
1. Run a test auction
2. Verify timer accuracy
3. Check all functions are healthy

### 3. Keep Functions Updated

```bash
cd functions
npm outdated
npm update
npm run build
firebase deploy --only functions
```

### 4. Document Custom Changes

If you modify the Cloud Functions, document:
- What changed
- Why it changed
- How to test it

---

## 📞 Support

If you encounter issues during migration:

1. **Check Logs:**
   ```bash
   firebase functions:log
   ```

2. **Test Locally:**
   ```bash
   cd functions
   npm run serve
   ```

3. **Verify Configuration:**
   ```bash
   firebase functions:config:get
   ```

4. **Contact Support:**
   - Firebase Support: https://firebase.google.com/support
   - GitHub Issues: [Your repo URL]

---

## ✅ Post-Migration Checklist

- [ ] Cloud Functions deployed successfully
- [ ] Client code deployed successfully
- [ ] Test auction completed successfully
- [ ] Admin tab close test passed
- [ ] Logs show no errors
- [ ] Monitoring alerts configured
- [ ] Team notified of changes
- [ ] Documentation updated
- [ ] Backup created and verified

---

**Migration Date:** March 25, 2026  
**Version:** 2.0.0  
**Status:** Production Ready
