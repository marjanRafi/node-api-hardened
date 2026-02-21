const http = require("http");
const PORT = process.env.PORT || 8080;
const server = http.createServer((req, res) => {
  if (req.url === "/health") {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ status: "ok", pid: process.pid }));
    return;
  }
  res.writeHead(200, { "Content-Type": "application/json" });
  res.end(JSON.stringify({ message: "Zero to Production Hero: Episode 2" }));
});
process.on("SIGTERM", () => {
  console.log("SIGTERM received. Closing server gracefully...");
  server.close(() => { console.log("Server closed. Exiting."); process.exit(0); });
});
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}, PID: ${process.pid}`);
});
