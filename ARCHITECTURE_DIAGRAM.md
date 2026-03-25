# Architecture Diagram - Cloud Functions Timer

## 🏗️ System Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                         CLIENT LAYER                                 │
│                                                                      │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐            │
│  │    Admin     │  │     Team     │  │    Public    │            │
│  │   Portal     │  │   Portal     │  │    View      │            │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘            │
│         │                  │                  │                     │
│         │ Start Auction    │ Place Bid        │ Watch              │
│         │ Manual End       │ View Countdown   │ View Countdown     │
│         │ View Countdown   │                  │                     │
│         └──────────────────┴──────────────────┘                     │
│                            │                                         │
└────────────────────────────┼─────────────────────────────────────────┘
                             │
                             │ Real-time Sync
                             │ (onSnapshot)
                             ↓
┌─────────────────────────────────────────────────────────────────────┐
│                      FIRESTORE DATABASE                              │
│                                                                      │
│  ┌─────────────────────────────────────────────────────────────┐  │
│  │  Collection: auction                                         │  │
│  │  ┌────────────────────────────────────────────────────────┐ │  │
│  │  │  Document: state                                        │ │  │
│  │  │  {                                                      │ │  │
│  │  │    currentPlayerId: "player123",                       │ │  │
│  │  │    status: "Active",                                   │ │  │
│  │  │    startTime: 1711234567890,                          │ │  │
│  │  │    timeLeft: 30,                                       │ │  │
│  │  │    scheduledEndTime: 1711234597890, ← Set by Function │ │  │
│  │  │    highestBid: 200,                                    │ │  │
│  │  │    highestBidderId: "team456",                        │ │  │
│  │  │    bidHistory: [...]                                   │ │  │
│  │  │  }                                                      │ │  │
│  │  └────────────────────────────────────────────────────────┘ │  │
│  └─────────────────────────────────────────────────────────────┘  │
│                                                                      │
│  ┌─────────────────────────────────────────────────────────────┐  │
│  │  Collection: players                                         │  │
│  │  ┌────────────────────────────────────────────────────────┐ │  │
│  │  │  Document: player123                                    │ │  │
│  │  │  {                                                      │ │  │
│  │  │    name: "Virat Kohli",                                │ │  │
│  │  │    status: "Available" → "Sold",  ← Updated by Function│ │  │
│  │  │    soldTo: "team456",                                  │ │  │
│  │  │    soldPrice: 200                                      │ │  │
│  │  │  }                                                      │ │  │
│  │  └────────────────────────────────────────────────────────┘ │  │
│  └─────────────────────────────────────────────────────────────┘  │
│                                                                      │
│  ┌─────────────────────────────────────────────────────────────┐  │
│  │  Collection: teams                                           │  │
│  │  ┌────────────────────────────────────────────────────────┐ │  │
│  │  │  Document: team456                                      │ │  │
│  │  │  {                                                      │ │  │
│  │  │    name: "Mumbai Indians",                             │ │  │
│  │  │    remainingBudget: 800 → 600,  ← Updated by Function │ │  │
│  │  │    players: ["player123"]                              │ │  │
│  │  │  }                                                      │ │  │
│  │  └────────────────────────────────────────────────────────┘ │  │
│  └─────────────────────────────────────────────────────────────┘  │
└────────────────────────────┬─────────────────────────────────────────┘
                             │
                             │ Triggers & Reads
                             │
┌────────────────────────────┴─────────────────────────────────────────┐
│                    CLOUD FUNCTIONS LAYER                              │
│                                                                      │
│  ┌─────────────────────────────────────────────────────────────┐  │
│  │  Function: onAuctionStateChange                              │  │
│  │  Type: Firestore Trigger                                     │  │
│  │  Trigger: auction/state onUpdate                             │  │
│  │                                                               │  │
│  │  When status changes to 'Active':                            │  │
│  │    1. Calculate scheduledEndTime                             │  │
│  │       = startTime + (timeLeft * 1000)                        │  │
│  │    2. Store in Firestore                                     │  │
│  │                                                               │  │
│  │  When status changes from 'Active':                          │  │
│  │    1. Clear scheduledEndTime                                 │  │
│  └─────────────────────────────────────────────────────────────┘  │
│                                                                      │
│  ┌─────────────────────────────────────────────────────────────┐  │
│  │  Function: checkExpiredAuctions                              │  │
│  │  Type: Scheduled (Cloud Scheduler)                           │  │
│  │  Schedule: every 5 seconds                                   │  │
│  │                                                               │  │
│  │  Every 5 seconds:                                            │  │
│  │    1. Read auction/state                                     │  │
│  │    2. Check: now >= scheduledEndTime?                        │  │
│  │    3. If yes:                                                │  │
│  │       → Call endAuction()                                    │  │
│  │       → Transaction:                                         │  │
│  │         • Update auction: status='Ended'                     │  │
│  │         • Update player: status='Sold'/'Unsold'             │  │
│  │         • Update team: deduct budget, add player            │  │
│  │    4. Log operation                                          │  │
│  └─────────────────────────────────────────────────────────────┘  │
│                                                                      │
│  ┌─────────────────────────────────────────────────────────────┐  │
│  │  Function: endAuctionManually                                │  │
│  │  Type: HTTP Callable                                         │  │
│  │  Auth: Required (Admin only)                                 │  │
│  │                                                               │  │
│  │  When called:                                                │  │
│  │    1. Verify authentication                                  │  │
│  │    2. Verify admin role                                      │  │
│  │    3. Call endAuction()                                      │  │
│  │    4. Return success/error                                   │  │
│  └─────────────────────────────────────────────────────────────┘  │
│                                                                      │
│  ┌─────────────────────────────────────────────────────────────┐  │
│  │  Function: healthCheck                                       │  │
│  │  Type: HTTP Endpoint                                         │  │
│  │                                                               │  │
│  │  Returns:                                                    │  │
│  │    {                                                         │  │
│  │      status: "healthy",                                      │  │
│  │      timestamp: 1711234567890,                              │  │
│  │      service: "cricauction-functions",                      │  │
│  │      version: "1.0.0"                                        │  │
│  │    }                                                         │  │
│  └─────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────┘
                             ↑
                             │
                             │ Managed by
                             │
┌─────────────────────────────────────────────────────────────────────┐
│                    GOOGLE CLOUD PLATFORM                             │
│                                                                      │
│  ┌─────────────────────────────────────────────────────────────┐  │
│  │  Cloud Scheduler                                             │  │
│  │  • Triggers checkExpiredAuctions every 5 seconds             │  │
│  │  • Reliable, managed service                                 │  │
│  │  • Automatic retries on failure                              │  │
│  └─────────────────────────────────────────────────────────────┘  │
│                                                                      │
│  ┌─────────────────────────────────────────────────────────────┐  │
│  │  Cloud Functions Runtime                                     │  │
│  │  • Node.js 20 environment                                    │  │
│  │  • Auto-scaling                                              │  │
│  │  • Admin SDK privileges                                      │  │
│  └─────────────────────────────────────────────────────────────┘  │
│                                                                      │
│  ┌─────────────────────────────────────────────────────────────┐  │
│  │  Cloud Logging                                               │  │
│  │  • Centralized logs                                          │  │
│  │  • 30-day retention                                          │  │
│  │  • Real-time monitoring                                      │  │
│  └─────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 🔄 Sequence Diagram: Auction Lifecycle

```
Admin          Client          Firestore       Cloud Function      Cloud Scheduler
  │               │                │                  │                    │
  │ Start Auction │                │                  │                    │
  ├──────────────>│                │                  │                    │
  │               │ Write          │                  │                    │
  │               │ status=Active  │                  │                    │
  │               ├───────────────>│                  │                    │
  │               │                │ Trigger          │                    │
  │               │                │ onUpdate         │                    │
  │               │                ├─────────────────>│                    │
  │               │                │                  │ Calculate          │
  │               │                │                  │ scheduledEndTime   │
  │               │                │                  │                    │
  │               │                │<─────────────────┤ Write              │
  │               │                │  scheduledEndTime│                    │
  │               │<───────────────┤                  │                    │
  │               │ Real-time sync │                  │                    │
  │<──────────────┤                │                  │                    │
  │ Display       │                │                  │                    │
  │ Countdown     │                │                  │                    │
  │               │                │                  │                    │
  │ [Admin closes tab]             │                  │                    │
  │               │                │                  │                    │
  │               │                │                  │<───────────────────┤
  │               │                │                  │ Trigger (5s)       │
  │               │                │<─────────────────┤                    │
  │               │                │  Read auction    │                    │
  │               │                ├─────────────────>│                    │
  │               │                │  auction data    │                    │
  │               │                │                  │ Check:             │
  │               │                │                  │ now >= scheduled?  │
  │               │                │                  │ YES!               │
  │               │                │                  │                    │
  │               │                │                  │ Start Transaction  │
  │               │                │<─────────────────┤                    │
  │               │                │  Read player     │                    │
  │               │                ├─────────────────>│                    │
  │               │                │<─────────────────┤                    │
  │               │                │  Read team       │                    │
  │               │                ├─────────────────>│                    │
  │               │                │<─────────────────┤                    │
  │               │                │  Write updates   │                    │
  │               │                │  - auction       │                    │
  │               │                │  - player        │                    │
  │               │                │  - team          │                    │
  │               │                │                  │ Commit Transaction │
  │               │                │                  │                    │
  │               │<───────────────┤                  │                    │
  │               │ Real-time sync │                  │                    │
  │               │ status=Ended   │                  │                    │
  │               │                │                  │                    │
  │ [Admin reopens tab]            │                  │                    │
  │<──────────────┤                │                  │                    │
  │ See auction   │                │                  │                    │
  │ ended!        │                │                  │                    │
```

---

## 🎯 Key Design Decisions

### 1. Scheduled Function vs Individual Timers

**Chosen:** Scheduled function (every 5 seconds)

**Why:**
- ✅ Simpler implementation
- ✅ No need for Cloud Tasks/Scheduler per auction
- ✅ Handles multiple concurrent auctions
- ✅ Easy to monitor and debug
- ✅ Acceptable 5-second accuracy

**Alternative:** Individual Cloud Tasks per auction
- ❌ More complex setup
- ❌ Requires Cloud Tasks API
- ❌ More expensive at scale
- ✅ More accurate timing

### 2. Firestore Trigger vs HTTP Endpoint

**Chosen:** Firestore trigger for `onAuctionStateChange`

**Why:**
- ✅ Automatic execution on document update
- ✅ No client code needed
- ✅ Guaranteed to run
- ✅ Simpler architecture

**Alternative:** HTTP endpoint called by client
- ❌ Client must remember to call
- ❌ Can fail if client disconnects
- ❌ More error-prone

### 3. Transaction vs Batch Write

**Chosen:** Transaction for `endAuction()`

**Why:**
- ✅ Atomic updates (all or nothing)
- ✅ Prevents race conditions
- ✅ Can read before writing
- ✅ Ensures consistency

**Alternative:** Batch write
- ❌ No read capability
- ❌ Can't verify state before writing
- ✅ Slightly faster

### 4. scheduledEndTime vs Recalculation

**Chosen:** Store `scheduledEndTime` in Firestore

**Why:**
- ✅ Single source of truth
- ✅ Easy to query
- ✅ Visible to all clients
- ✅ Survives function restarts

**Alternative:** Recalculate from startTime + timeLeft
- ❌ Prone to drift
- ❌ Harder to debug
- ✅ Less storage

---

## 📊 Performance Characteristics

### Latency

| Operation | Latency | Notes |
|-----------|---------|-------|
| Start Auction | ~200ms | Firestore write + trigger |
| Display Update | ~50ms | Real-time listener |
| Auction End | 0-5s | Scheduled function interval |
| Manual End | ~500ms | Transaction + updates |

### Scalability

| Metric | Limit | Current | Headroom |
|--------|-------|---------|----------|
| Concurrent Auctions | Unlimited | 1-10 | ∞ |
| Function Invocations | 2M/month | 525K/month | 3.8x |
| Firestore Reads | 50K/day | ~1K/day | 50x |
| Firestore Writes | 20K/day | ~500/day | 40x |

### Reliability

- **Uptime:** 99.95% (Firebase SLA)
- **Accuracy:** ±5 seconds (function interval)
- **Consistency:** 100% (transactions)
- **Recovery:** Automatic (managed service)

---

## 🔒 Security Model

```
┌─────────────────────────────────────────────────────────┐
│                    Security Layers                       │
└─────────────────────────────────────────────────────────┘

Layer 1: Client Authentication
├─ Firebase Auth required for all users
├─ Admin role verified in Firestore
└─ Team role scoped to specific team

Layer 2: Firestore Security Rules
├─ Public read for auction/state (display)
├─ Admin write for auction/state
├─ Team write for bids only
└─ No direct player/team writes from client

Layer 3: Cloud Functions
├─ Run with Admin SDK (bypass rules)
├─ Server-side validation
├─ Transaction safety
└─ Audit logging

Layer 4: Google Cloud IAM
├─ Function deployment requires owner role
├─ Firestore access controlled by IAM
└─ Cloud Scheduler managed by GCP
```

---

## 💡 Future Enhancements

### Potential Improvements

1. **Notification System**
   ```
   When auction ends:
   → Send email to winning team
   → Send push notification to all teams
   → Post to Slack/Discord webhook
   ```

2. **Analytics**
   ```
   Track:
   → Average auction duration
   → Bid frequency per team
   → Price trends by category
   → Peak usage times
   ```

3. **Multi-Auction Support**
   ```
   Current: Single global auction
   Future: Multiple concurrent auctions
   → Auction rooms/channels
   → Different settings per auction
   → Separate player pools
   ```

4. **Advanced Scheduling**
   ```
   → Schedule auction start time
   → Auto-advance to next player
   → Batch auction mode
   → Time-based player rotation
   ```

---

**Created:** March 25, 2026  
**Version:** 1.0.0  
**Status:** Production Ready
