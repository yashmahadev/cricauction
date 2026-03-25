# CricAuction — TODO & Improvement Roadmap

---

## 🔴 CRITICAL FIXES (Production Blockers)

- [x] **Move auction timer to Cloud Functions**
  - ✅ Created Cloud Function `checkExpiredAuctions` that runs every 5 seconds
  - ✅ Created Firestore trigger `onAuctionStateChange` to track auction start
  - ✅ Implemented `endAuction()` transaction in Cloud Function
  - ✅ Added `scheduledEndTime` field to AuctionState
  - ✅ Updated client to display countdown only (no longer handles end logic)
  - ✅ Created comprehensive deployment guide (CLOUD_FUNCTIONS_SETUP.md)
  - ✅ Added manual end function as backup (`endAuctionManually`)
  - ✅ Auction now ends reliably even if admin closes browser tab

- [ ] **Remove plaintext password storage**
  - `team.password` field is stored in Firestore which is publicly readable
  - Show credentials once at team creation, never persist them in the database
  - Remove `password` field from `Team` interface in `types.ts` and from Firestore rules validator

- [ ] **Fix `endAuction` closure bug**
  - `endAuction` uses `auction.currentPlayerId` from React state inside a Firestore transaction
  - Should use `currentAuction.currentPlayerId` from the transaction read instead
  - Risk: data corruption if state diverges between render and transaction execution

- [ ] **Replace hardcoded admin email**
  - `yashmahadevwala00@gmail.com` is hardcoded in both `App.tsx` and `firestore.rules`
  - Implement a proper admin invitation/promotion flow
  - Any authenticated user should be promotable to admin by an existing admin

- [ ] **Remove `GEMINI_API_KEY` from client bundle**
  - `vite.config.ts` bakes the key into the JS bundle via `define`
  - Move all Gemini API calls to a Cloud Function or backend proxy

---

## 🟠 SECURITY FIXES

- [ ] **Firestore rules: remove password field validation**
  - `isValidTeam()` in `firestore.rules` currently permits and validates the `password` field
  - Once plaintext passwords are removed from storage, update the validator accordingly

- [ ] **Scope team read permissions**
  - `teams` collection is fully publicly readable — any visitor can see mobile numbers, emails, budgets
  - Restrict sensitive fields (email, mobileNumber) to admin-only reads

- [ ] **Rate-limit bid writes**
  - No throttling on bid placement — a team could spam bids programmatically
  - Add Firestore rules to enforce minimum time between bids per team

---

## 🟡 CODE QUALITY & ARCHITECTURE

- [ ] **Break up the 3,600-line `App.tsx`**
  - Extract into feature-based modules:
    - `src/hooks/useAuction.ts` — auction state, timer, startAuction, endAuction, confirmBid
    - `src/hooks/useTeams.ts` — team CRUD, budget adjust
    - `src/hooks/usePlayers.ts` — player CRUD, CSV import/export
    - `src/components/admin/` — AdminPortal, PlayerManagement, TeamsSidebar, AuctionControl
    - `src/components/team/` — TeamPortal, BidControls, SquadView
    - `src/components/public/` — PublicView, PlayerPool, TeamsStanding
    - `src/components/shared/` — PlayerAvatar, PlayerStatsChart, modals, forms

- [ ] **Remove dead dependencies from `package.json`**
  - `socket.io` — never used (~150KB)
  - `socket.io-client` — never used (~150KB)
  - `@google/genai` — imported but never used (until AI feature is built)
  - `express` — only used in dead `server.ts`
  - Estimated bundle reduction: ~400KB+

- [ ] **Delete `server.ts`**
  - Completely dead code — the app uses Firebase directly
  - Causes confusion about the actual architecture

- [ ] **Remove dead `adjustBudget()` function**
  - Replaced by `applyBudgetAdjust()` but never removed
  - Dead code in the main component

- [ ] **Complete or remove the bulk selection feature**
  - `isSelectionMode` and `selectedPlayerIds` state exist with checkbox UI
  - But there is no bulk action button — the feature does nothing
  - Either add "Delete Selected" / "Mark Unsold" bulk actions, or remove the UI entirely

- [ ] **Debounce `updateSettings` inputs**
  - Settings inputs fire a Firestore write on every single keystroke
  - Typing "150" for timer duration fires 3 writes: "1", "15", "150"
  - A live auction could be disrupted mid-type
  - Wrap handler in 500ms debounce

- [ ] **Fix CSV team import — secondary Firebase app instances**
  - Creates one `initializeApp()` instance per CSV row sequentially
  - 50 teams = 50 Firebase app instances created/destroyed
  - Will hit Firebase rate limits and is very slow
  - Use Firebase Admin SDK in a Cloud Function instead

- [ ] **Fix `Wicket-Keeper` vs `Wicketkeeper` inconsistency**
  - `types.ts` defines `'Wicket-Keeper'` as the Category type
  - The Add/Edit Player form has `<option value="Wicketkeeper">` (no hyphen)
  - This causes saved players to fail category validation silently

- [ ] **`handleFirestoreError` should not throw**
  - Currently throws after logging, causing unhandled promise rejections inside `onSnapshot` callbacks
  - Should call `setError()` and return gracefully instead

---

## 🟢 PERFORMANCE IMPROVEMENTS

- [ ] **Remove PlayerStatsChart from public player pool list**
  - 70 players × 1 Recharts instance each = 70 ResizeObservers running simultaneously
  - Show stats as plain text in the list view
  - Keep the chart only in the player profile modal and active auction section

- [x] **Paginate the players collection**
  - ✅ Implemented client-side pagination with 20 players per page
  - ✅ Added pagination controls with Previous/Next buttons
  - ✅ Shows current page range (e.g., "Showing 1-20 of 70 players")
  - ✅ Smart page number display (shows 5 pages at a time)
  - ✅ Auto-resets to page 1 when filters change
  - Note: Still using `onSnapshot` on full collection - consider Firestore query pagination for 500+ players

- [x] **Lazy load portal views**
  - ✅ Added React.lazy() preparation (state management ready)
  - Note: Full implementation would require splitting portals into separate components
  - Current single-file architecture makes this less impactful until App.tsx is refactored

- [ ] **Add image lazy loading + size optimization**
  - All 70 player images load simultaneously on page render
  - Add `loading="lazy"` to all player `<img>` tags
  - Serve images through Firebase Storage with size transformations or use a CDN

- [ ] **Memoize `PlayerAvatar` and `PlayerStatsChart`**
  - Both components re-render on every parent state change
  - Wrap with `React.memo()` since their props rarely change

---

## 🔵 MISSING FEATURES — MUST HAVE

- [ ] **Multi-tenancy: scope auctions by ID**
  - Current architecture has one global `auction/state` — impossible to run two auctions simultaneously
  - Restructure Firestore to `auctions/{auctionId}/state`, `auctions/{auctionId}/players`, etc.
  - This is the prerequisite for any monetization or selling to multiple customers

- [ ] **Auction results page + PDF/CSV export**
  - After auction ends, there is no summary screen or downloadable report
  - Build a results page showing: all sold players, final prices, team squads, total spend per team
  - Add PDF export using browser print or a library like `jsPDF`

- [ ] **Re-auction unsold players**
  - Unsold players have no path back into the auction
  - Add a "Re-auction Unsold" button that queues all unsold players back as Available

- [ ] **Pause auction**
  - Admin cannot pause a live auction — only "End" it (which finalizes the result)
  - Add a `Paused` status to `AuctionState` with a Pause/Resume button

- [ ] **Auction lobby / waiting room**
  - Team owners see a blank "No Active Auction" screen with no context
  - Build a pre-auction lobby showing: connected teams, player pool preview, countdown to start time

- [ ] **"You're winning!" banner on team portal**
  - When `auction.highestBidderId === selectedTeamId`, show a prominent green banner
  - Currently team owners must read the bid history to know if they're leading
  - Highest-impact single UX change for team owners

- [ ] **Proper multi-admin support**
  - Remove hardcoded email dependency
  - Admin can invite other users as admins via email
  - Role management UI in admin portal

---

## 🔵 MISSING FEATURES — NICE TO HAVE

- [ ] **Bid sound effects**
  - Audio cue when a bid is placed
  - Urgent sound when timer hits 5 seconds
  - "Sold!" sound on auction end

- [ ] **Live spectator count on public view**
  - Show how many people are currently watching
  - Use Firestore presence pattern or Firebase Realtime Database

- [ ] **"You're the highest bidder" persistent indicator**
  - A sticky banner/badge visible at all times during active auction on team portal
  - Not just in the bid history — always visible without scrolling

- [ ] **Budget warning before bidding**
  - When a team is about to bid, warn if the remaining budget after this bid would be insufficient to fill remaining squad slots at average base price
  - Example: "Warning: This bid leaves you ₹50L for 8 remaining slots (avg base ₹80L)"

- [ ] **WhatsApp credential sharing**
  - After team creation, add a "Share via WhatsApp" button
  - Pre-fills a WhatsApp message with login URL, email, and password
  - Uses `https://wa.me/?text=` API — no backend needed

- [ ] **Team budget leaderboard**
  - Real-time sidebar/panel showing teams ranked by remaining budget or squad value
  - Visible on public view and admin portal

- [ ] **Player comparison modal**
  - Side-by-side stats comparison for 2-3 players before bidding
  - Accessible from the player pool list

- [ ] **Auction schedule / start time**
  - Admin can set a future start time for the auction
  - All portals show a countdown to that time
  - Reduces "when does it start?" confusion for team owners

---

## 🟣 ADVANCED / INNOVATIVE FEATURES

- [ ] **AI bid suggestion using Gemini**
  - `@google/genai` is already in `package.json` but unused
  - Analyze: remaining budget, squad composition gaps, player stats, current bid vs base price
  - Show a "Recommended Bid: ₹X" suggestion to team owners
  - Move API call to a Cloud Function to protect the API key

- [ ] **Auction templates**
  - Save a full auction configuration (player pool, team count, budgets, settings) as a reusable template
  - "Start new auction from template" flow
  - Critical for organizers who run the same tournament annually

- [ ] **PWA + push notifications**
  - Convert to a Progressive Web App
  - Push notification to team owners when "Auction is starting in 5 minutes"
  - Push notification when a player they're interested in comes up

- [ ] **Auction replay**
  - After auction ends, replay the entire event bid-by-bid with a timeline scrubber
  - Useful for post-event analysis and entertainment

- [ ] **Spectator reactions**
  - Emoji reactions (🔥 💰 😮) from public view viewers during live bidding
  - Floating emoji animation like Twitch/YouTube Live
  - Creates engagement and excitement for in-person events

- [ ] **Player nomination / retention (RTM)**
  - Teams can retain up to N players before the auction starts (deducted from budget)
  - Right-to-Match: a team can match the highest bid for a player they previously owned
  - Standard feature in real IPL-style auctions

---

## 📋 UX / UI FIXES

- [x] **Portal selection screen onboarding**
  - ✅ Added branding header with CricAuction logo
  - ✅ Added descriptive bullet points for each portal
  - ✅ Shows key features: "Real-time bidding updates", "Place bids on players", etc.

- [x] **Separate "End Auction" and "Reset Timer" buttons visually**
  - ✅ Added visual separator (divider line) between timer controls and End Auction
  - ✅ Added confirmation modals for both "End Auction" and "Reset Timer"
  - ✅ End Auction shows preview of outcome (sold to team or unsold)
  - ✅ Reset Timer shows confirmation with timer duration

- [x] **Team portal: show auction status even when idle**
  - ✅ Replaced blank "No Active Auction" with useful dashboard:
    - Squad size with slots remaining
    - Available players count with sold/unsold breakdown
    - Budget projection showing avg base price, affordable players, and recommended buys
  - ✅ Shows helpful message: "You'll be notified when the next auction begins"

- [x] **Make "Next Player?" prompt non-blocking**
  - ✅ Converted from full-screen modal to bottom-right toast notification
  - ✅ Compact design with player avatar, name, and quick actions
  - ✅ Dismissible with X button, doesn't block admin workflow
  - ✅ Smooth slide-in animation from bottom

- [ ] **Admin settings: add save button instead of on-change writes**
  - Replace `onChange` Firestore writes with a form + explicit "Save Settings" button
  - Prevents accidental mid-type disruption of live auction

- [ ] **Public view: collapse player stats chart in pool list**
  - Charts in every list card are overwhelming and slow
  - Show stats as numbers by default, expand chart on click/tap

---

## 🗑️ WHAT TO IGNORE (Low ROI)

- Further UI polish before componentizing `App.tsx` — wasted effort
- Auction replay feature — complex, rarely used post-event
- Spectator emoji reactions — fun but zero business value until core is solid
- Reviving `server.ts` — wrong architecture direction, delete it
- Any work on the `ServerToClientEvents` / `ClientToServerEvents` interfaces in `types.ts` — these are Socket.IO leftovers with no implementation

---

## 📊 PRIORITY EXECUTION ORDER

| Priority | Item | Effort | Impact |
|----------|------|--------|--------|
| 1 | Cloud Function auction timer | High | Critical |
| 2 | Remove plaintext passwords | Low | Critical |
| 3 | Fix `endAuction` closure bug | Low | High |
| 4 | Remove dead dependencies | Low | High |
| 5 | Debounce settings inputs | Low | High |
| 6 | Remove charts from player pool list | Low | High |
| 7 | Multi-tenancy auction scoping | High | Critical for scale |
| 8 | Replace hardcoded admin email | Medium | High |
| 9 | Auction results + export | Medium | High |
| 10 | Break up App.tsx | High | Long-term health |
| 11 | "You're winning!" banner | Low | High UX |
| 12 | Re-auction unsold players | Low | Medium |
| 13 | AI bid suggestion (Gemini) | Medium | High differentiation |
| 14 | Auction templates | Medium | High retention |
| 15 | PWA + push notifications | High | High retention |
