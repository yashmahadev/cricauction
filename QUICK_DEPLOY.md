# Quick Deploy Reference - Cloud Functions

## 🚀 First Time Setup

```bash
# 1. Install Firebase CLI
npm install -g firebase-tools

# 2. Login
firebase login

# 3. Select project
firebase use --add

# 4. Install function dependencies
cd functions
npm install

# 5. Build functions
npm run build

# 6. Deploy everything
cd ..
firebase deploy
```

---

## 🔄 Regular Updates

### Deploy Functions Only
```bash
cd functions
npm run build
firebase deploy --only functions
```

### Deploy Client Only
```bash
npm run build
firebase deploy --only hosting
```

### Deploy Everything
```bash
npm run build
cd functions && npm run build && cd ..
firebase deploy
```

---

## 🧪 Testing

### Test Locally
```bash
cd functions
npm run serve
```

### View Logs
```bash
firebase functions:log
```

### View Specific Function Logs
```bash
firebase functions:log --only checkExpiredAuctions
```

---

## 🐛 Quick Fixes

### Function Not Running
```bash
firebase functions:list
firebase deploy --only functions
```

### Build Errors
```bash
cd functions
rm -rf node_modules lib
npm install
npm run build
```

### Clear Cache
```bash
firebase functions:delete checkExpiredAuctions
firebase deploy --only functions
```

---

## 📊 Health Check

```bash
# Check function status
firebase functions:list

# Check recent logs
firebase functions:log --since 1h

# Check for errors
firebase functions:log --since 1d | grep -i error
```

---

## 🔧 Common Commands

```bash
# Build TypeScript
cd functions && npm run build

# Watch mode (auto-rebuild)
cd functions && npm run build:watch

# Deploy single function
firebase deploy --only functions:checkExpiredAuctions

# Delete function
firebase functions:delete functionName

# View function config
firebase functions:config:get

# Export Firestore backup
firebase firestore:export gs://YOUR-PROJECT.appspot.com/backups/$(date +%Y%m%d)
```

---

## 📞 Emergency Rollback

```bash
# Delete all new functions
firebase functions:delete checkExpiredAuctions
firebase functions:delete onAuctionStateChange
firebase functions:delete endAuctionManually
firebase functions:delete healthCheck

# Revert code
git revert HEAD

# Redeploy
npm run build
firebase deploy
```

---

## ✅ Pre-Deployment Checklist

- [ ] Code changes committed
- [ ] TypeScript compiles (`npm run build`)
- [ ] No linting errors (`npm run lint`)
- [ ] Functions build successfully (`cd functions && npm run build`)
- [ ] Tested locally with emulators
- [ ] Backup created
- [ ] Active auctions paused

---

## 📝 Quick Notes

- Functions run on Node.js 20
- Scheduled function runs every 5 seconds
- Free tier: 2M invocations/month
- Logs retained for 30 days
- Max function timeout: 540 seconds (9 minutes)

---

**Last Updated:** March 25, 2026
