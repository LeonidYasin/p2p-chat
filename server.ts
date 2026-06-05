import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { spawn, execSync, ChildProcess } from "child_process";

const app = express();
const PORT = 3000;

app.use(express.json());

let goProcess: ChildProcess | null = null;
let goLogs: string[] = [];
let isCompileSucceeded = false;

// Compile the Go binary during server startup
try {
  console.log("[Go Compiler] Building Go P2P Node binary...");
  // Use go build which respects socket_unix.go and ignores socket_windows.go on Linux Container
  execSync("go build -o p2pnode .", { stdio: "inherit" });
  console.log("[Go Compiler] Compilation complete: ./p2pnode created");
  isCompileSucceeded = true;
} catch (error) {
  console.error("[Go Compiler] Compilation failed. Will attempt to run using 'go run main.go socket_unix.go'. Error:", error);
}

function startGoNode(room: string = "chat-with-rendezvous") {
  if (goProcess) {
    try {
      goProcess.kill();
    } catch (e) {}
  }

  goLogs = [];
  const args = ["-port", "4001", "-nick", "Device #3 (Bootstrap Relay)", "-room", room];
  
  if (isCompileSucceeded) {
    console.log("[Go Daemon] Spawning compiled P2P binary `./p2pnode` with args:", args);
    goProcess = spawn("./p2pnode", args);
  } else {
    console.log("[Go Daemon] Spawning P2P node via `go run` with args:", args);
    goProcess = spawn("go", ["run", "main.go", "socket_unix.go", ...args]);
  }

  // Capture stdout and feed log events array
  goProcess.stdout?.on("data", (data) => {
    const chunk = data.toString();
    console.log("[Go stdout]", chunk.trim());
    goLogs.push(chunk);
  });

  // Capture stderr
  goProcess.stderr?.on("data", (data) => {
    const chunk = data.toString();
    console.error("[Go stderr]", chunk.trim());
    goLogs.push(chunk);
  });

  goProcess.on("close", (code) => {
    const closedLine = `\n[*] Daemon process exited with code ${code}\n`;
    console.log("[Go Daemon]", closedLine.trim());
    goLogs.push(closedLine);
    goProcess = null;
  });
}

// API Routes for Relay controls
app.get("/api/relay/state", (req, res) => {
  res.json({
    running: goProcess !== null,
    logs: goLogs.join(""),
  });
});

app.post("/api/relay/toggle", (req, res) => {
  const { action, room } = req.body;
  if (action === "start") {
    startGoNode(room || "chat-with-rendezvous");
    res.json({ success: true, message: "Go node started" });
  } else {
    if (goProcess) {
      // Send interrupt signal for graceful shutdown
      goProcess.kill("SIGINT");
      res.json({ success: true, message: "Go node shutdown triggered" });
    } else {
      res.json({ success: true, message: "Go node was not running" });
    }
  }
});

app.post("/api/relay/command", (req, res) => {
  const { command } = req.body;
  if (goProcess && goProcess.stdin) {
    console.log("[Go stdin <-]", command);
    goProcess.stdin.write(command + "\n");
    res.json({ success: true });
  } else {
    res.status(400).json({ success: false, error: "Go process is not running" });
  }
});

// Vite Middleware & Asset Serving
async function startServer() {
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

  // Auto-start Go P2P Daemon on server boot
  try {
    startGoNode();
  } catch (e) {
    console.error("Failed to auto-start Go node on startup:", e);
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`[Express] Full-stack Server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer();
