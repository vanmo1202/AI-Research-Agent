require("dotenv").config({ path: require("node:path").join(__dirname, "../.env"), quiet: true });

const express = require("express");

const { initializeDatabase } = require("./config/database");
const researchRoutes = require("./routes/research.routes");
const logger = require("./utils/logger");

const app = express();

const PORT = process.env.PORT || 3000;

app.use(express.json());

app.get("/", (req, res) => {
    res.json({
        message: "Welcome to AI Research Agent API"
    });
});

app.get("/health", (req, res) => {
    res.status(200).json({
        status: "ok",
        message: "AI Research Agent Backend is running"
    });
});

app.use("/api/research", researchRoutes);

// JSON lỗi thống nhất, kể cả body JSON sai cú pháp.
app.use((error, req, res, next) => {
    if (res.headersSent) return next(error);
    const status = error.status || 500;
    const message = error.type === "entity.parse.failed" ? "Invalid JSON body"
        : status === 413 ? "Request body too large"
        : status >= 500 && !error.requestId ? "Internal server error" : error.message;
    logger.error("Server", `Request failed (HTTP ${status})`);
    res.status(status).json({ success: false, error: message,
        ...(error.requestId ? { requestId: error.requestId } : {}) });
});

// Tạo bảng xong mới nhận request để tránh truy vấn khi database chưa sẵn sàng.
async function start() {
    try {
        await initializeDatabase();
        const server = app.listen(PORT, () => {
            console.log(`Server is running at http://localhost:${PORT}`);
        });
        server.on("error", () => {
            logger.error("Server", "Could not start HTTP server; check PORT");
            process.exit(1);
        });
        return server;
    } catch (error) {
        logger.error("Database", "Could not initialize database");
        process.exit(1);
    }
}
if (require.main === module) start();
module.exports = { app, start };
