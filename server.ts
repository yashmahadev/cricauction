import express from "express";
import { createServer } from "http";
import { Server } from "socket.io";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";
import { Player, Team, AuctionState, AuctionSettings } from "./src/types";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Initial Data
let players: Player[] = [
  {
    id: "p1",
    name: "Virat Kohli",
    category: "Batsman",
    basePrice: 200,
    imageUrl: "https://picsum.photos/seed/virat/400/400",
    stats: { matches: 234, runs: 7263, strikeRate: 130.02 },
    status: "Available",
  },
  {
    id: "p2",
    name: "Jasprit Bumrah",
    category: "Bowler",
    basePrice: 200,
    imageUrl: "https://picsum.photos/seed/bumrah/400/400",
    stats: { matches: 120, wickets: 145, economy: 7.39 },
    status: "Available",
  },
  {
    id: "p3",
    name: "Hardik Pandya",
    category: "All-Rounder",
    basePrice: 150,
    imageUrl: "https://picsum.photos/seed/hardik/400/400",
    stats: { matches: 107, runs: 1963, wickets: 50, strikeRate: 145.86 },
    status: "Available",
  },
  {
    id: "p4",
    name: "Rashid Khan",
    category: "Bowler",
    basePrice: 150,
    imageUrl: "https://picsum.photos/seed/rashid/400/400",
    stats: { matches: 92, wickets: 112, economy: 6.33 },
    status: "Available",
  },
  {
    id: "p5",
    name: "Jos Buttler",
    category: "Wicket-Keeper",
    basePrice: 150,
    imageUrl: "https://picsum.photos/seed/buttler/400/400",
    stats: { matches: 82, runs: 2831, strikeRate: 148.32 },
    status: "Available",
  },
  {
    id: "p6",
    name: "Glenn Maxwell",
    category: "All-Rounder",
    basePrice: 100,
    imageUrl: "https://picsum.photos/seed/maxwell/400/400",
    stats: { matches: 110, runs: 2319, wickets: 28, strikeRate: 154.67 },
    status: "Available",
  },
  {
    id: "p7",
    name: "Trent Boult",
    category: "Bowler",
    basePrice: 100,
    imageUrl: "https://picsum.photos/seed/boult/400/400",
    stats: { matches: 78, wickets: 92, economy: 8.24 },
    status: "Available",
  },
  {
    id: "p8",
    name: "KL Rahul",
    category: "Batsman",
    basePrice: 150,
    imageUrl: "https://picsum.photos/seed/klrahul/400/400",
    stats: { matches: 109, runs: 3889, strikeRate: 136.22 },
    status: "Available",
  },
  {
    id: "p9",
    name: "Andre Russell",
    category: "All-Rounder",
    basePrice: 150,
    imageUrl: "https://picsum.photos/seed/russell/400/400",
    stats: { matches: 98, runs: 2035, wickets: 89, strikeRate: 177.88 },
    status: "Available",
  },
  {
    id: "p10",
    name: "Quinton de Kock",
    category: "Wicket-Keeper",
    basePrice: 100,
    imageUrl: "https://picsum.photos/seed/qdk/400/400",
    stats: { matches: 77, runs: 2256, strikeRate: 130.93 },
    status: "Available",
  },
];

let teams: Team[] = [
  { id: "t1", name: "Mumbai Indians", totalBudget: 1000, remainingBudget: 1000, players: [], color: "#004BA0", logoUrl: "https://picsum.photos/seed/mi/200/200" },
  { id: "t2", name: "Chennai Super Kings", totalBudget: 1000, remainingBudget: 1000, players: [], color: "#FDB913", logoUrl: "https://picsum.photos/seed/csk/200/200" },
  { id: "t3", name: "Royal Challengers Bangalore", totalBudget: 1000, remainingBudget: 1000, players: [], color: "#2B2A29", logoUrl: "https://picsum.photos/seed/rcb/200/200" },
  { id: "t4", name: "Gujarat Titans", totalBudget: 1000, remainingBudget: 1000, players: [], color: "#1B2133", logoUrl: "https://picsum.photos/seed/gt/200/200" },
];

let auctionSettings: AuctionSettings = {
  maxPlayersPerTeam: 15,
  minBidIncrement: 10,
  timerDuration: 30,
};

let auctionState: AuctionState = {
  currentPlayerId: null,
  highestBid: 0,
  highestBidderId: null,
  timeLeft: 0,
  status: "Idle",
  bidHistory: [],
};

let timerInterval: NodeJS.Timeout | null = null;

async function startServer() {
  const app = express();
  const httpServer = createServer(app);
  const io = new Server(httpServer, {
    cors: { origin: "*" },
  });

  app.use(express.json());

  // API Routes
  app.get("/api/players", (req, res) => res.json(players));
  app.get("/api/teams", (req, res) => res.json(teams));
  app.get("/api/auction", (req, res) => res.json(auctionState));
  app.get("/api/settings", (req, res) => res.json(auctionSettings));

  // Socket.IO Logic
  io.on("connection", (socket) => {
    console.log("Client connected:", socket.id);

    // Send initial state
    socket.emit("players:update", players);
    socket.emit("teams:update", teams);
    socket.emit("auction:update", auctionState);
    socket.emit("settings:update", auctionSettings);

    socket.on("admin:start-auction", (playerId) => {
      const player = players.find((p) => p.id === playerId);
      if (!player || player.status !== "Available") return;

      if (auctionState.status === "Active") return;

      auctionState = {
        currentPlayerId: playerId,
        highestBid: player.basePrice,
        highestBidderId: null,
        timeLeft: auctionSettings.timerDuration,
        status: "Active",
        bidHistory: [],
      };

      io.emit("auction:update", auctionState);
      io.emit("auction:start", player);

      if (timerInterval) clearInterval(timerInterval);
      timerInterval = setInterval(() => {
        auctionState.timeLeft--;
        if (auctionState.timeLeft <= 0) {
          endAuction();
        } else {
          io.emit("auction:update", auctionState);
        }
      }, 1000);
    });

    socket.on("bid:place", ({ playerId, amount, teamId }) => {
      if (auctionState.status !== "Active" || auctionState.currentPlayerId !== playerId) {
        return socket.emit("error", "Auction is not active for this player");
      }

      const team = teams.find((t) => t.id === teamId);
      if (!team) return socket.emit("error", "Team not found");

      // Check if player is a captain or vice-captain of any team
      const isProtectedPlayer = teams.some(t => t.captainId === playerId || t.viceCaptainId === playerId);
      if (isProtectedPlayer) {
        return socket.emit("error", "Cannot bid on a Team Captain or Vice Captain!");
      }

      if (amount < auctionState.highestBid + auctionSettings.minBidIncrement && amount !== auctionState.highestBid) {
        // Allow the first bid to be at base price if no highest bidder yet
        if (auctionState.highestBidderId === null && amount === auctionState.highestBid) {
           // This is fine
        } else {
           return socket.emit("error", `Bid must be at least ₹${auctionState.highestBid + auctionSettings.minBidIncrement}L`);
        }
      }

      if (amount > team.remainingBudget) {
        return socket.emit("error", "Insufficient budget");
      }

      if (team.players.length >= auctionSettings.maxPlayersPerTeam) {
        return socket.emit("error", "Team has reached maximum player limit");
      }

      // Valid bid
      auctionState.highestBid = amount;
      auctionState.highestBidderId = teamId;
      auctionState.bidHistory.unshift({
        amount,
        bidderId: teamId,
        bidderName: team.name,
        timestamp: Date.now()
      });
      
      // Reset timer if bid in last 5 seconds
      if (auctionState.timeLeft < 5) {
        auctionState.timeLeft = 10;
      }

      io.emit("auction:update", auctionState);
      io.emit("bid:update", { amount, bidderId: teamId, bidderName: team.name });
    });

    socket.on("admin:add-player", (playerData) => {
      const newPlayer: Player = {
        ...playerData,
        id: "p" + (players.length + 1),
        status: "Available"
      };
      players.push(newPlayer);
      io.emit("players:update", players);
    });

    socket.on("admin:edit-player", (playerData) => {
      const index = players.findIndex(p => p.id === playerData.id);
      if (index !== -1) {
        players[index] = playerData;
        io.emit("players:update", players);
      }
    });

    socket.on("admin:delete-player", (playerId) => {
      players = players.filter(p => p.id !== playerId);
      io.emit("players:update", players);
    });

    socket.on("admin:add-team", (teamData) => {
      if (teamData.captainId && teamData.viceCaptainId && teamData.captainId === teamData.viceCaptainId) {
        return socket.emit("error", "Captain and Vice Captain must be different players");
      }

      const newTeam: Team = {
        ...teamData,
        id: "t" + (teams.length + 1),
        remainingBudget: teamData.totalBudget,
        players: [],
        captainId: teamData.captainId || undefined,
        viceCaptainId: teamData.viceCaptainId || undefined
      };

      teams.push(newTeam);
      io.emit("teams:update", teams);
    });

    socket.on("admin:edit-team", (teamData) => {
      const index = teams.findIndex(t => t.id === teamData.id);
      if (index !== -1) {
        // Validation
        if (teamData.captainId && teamData.viceCaptainId && teamData.captainId === teamData.viceCaptainId) {
          return socket.emit("error", "Captain and Vice Captain must be different players");
        }

        // Update budget logic: if total budget changed, adjust remaining budget
        const oldTotal = teams[index].totalBudget;
        const diff = teamData.totalBudget - oldTotal;
        teams[index] = {
          ...teamData,
          remainingBudget: teams[index].remainingBudget + diff,
          captainId: teamData.captainId || undefined,
          viceCaptainId: teamData.viceCaptainId || undefined
        };
        io.emit("teams:update", teams);
      }
    });

    socket.on("admin:delete-team", (teamId) => {
      teams = teams.filter(t => t.id !== teamId);
      io.emit("teams:update", teams);
    });

    socket.on("admin:adjust-budget", ({ teamId, amount }) => {
      const teamIndex = teams.findIndex(t => t.id === teamId);
      if (teamIndex !== -1) {
        teams[teamIndex].remainingBudget += amount;
        teams[teamIndex].totalBudget += amount;
        io.emit("teams:update", teams);
      }
    });

    socket.on("admin:update-settings", (settings) => {
      auctionSettings = settings;
      io.emit("settings:update", auctionSettings);
    });

    socket.on("admin:reset", () => {
      players = players.map(p => ({ ...p, status: 'Available', soldTo: undefined, soldPrice: undefined }));
      teams = teams.map(t => ({ ...t, remainingBudget: t.totalBudget, players: [] }));
      auctionState = { currentPlayerId: null, highestBid: 0, highestBidderId: null, timeLeft: 0, status: "Idle", bidHistory: [] };
      if (timerInterval) clearInterval(timerInterval);
      io.emit("players:update", players);
      io.emit("teams:update", teams);
      io.emit("auction:update", auctionState);
    });
  });

  function endAuction() {
    if (timerInterval) clearInterval(timerInterval);
    
    const playerId = auctionState.currentPlayerId;
    const teamId = auctionState.highestBidderId;
    const price = auctionState.highestBid;

    if (playerId) {
      const playerIndex = players.findIndex(p => p.id === playerId);
      if (teamId) {
        // Sold
        players[playerIndex].status = "Sold";
        players[playerIndex].soldTo = teamId;
        players[playerIndex].soldPrice = price;

        const teamIndex = teams.findIndex(t => t.id === teamId);
        teams[teamIndex].remainingBudget -= price;
        teams[teamIndex].players.push(playerId);
      } else {
        // Unsold
        players[playerIndex].status = "Unsold";
      }
    }

    auctionState.status = "Ended";
    io.emit("auction:end", { playerId: playerId!, teamId, price });
    io.emit("auction:update", auctionState);
    io.emit("players:update", players);
    io.emit("teams:update", teams);

    // Reset after 5 seconds
    setTimeout(() => {
      auctionState = {
        currentPlayerId: null,
        highestBid: 0,
        highestBidderId: null,
        timeLeft: 0,
        status: "Idle",
        bidHistory: [],
      };
      io.emit("auction:update", auctionState);
    }, 5000);
  }

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  httpServer.listen(3000, "0.0.0.0", () => {
    console.log("Server running on http://localhost:3000");
  });
}

startServer();
