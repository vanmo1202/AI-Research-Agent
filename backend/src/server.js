require("./config/environment").loadEnvironment();

const express = require("express");
const cors = require("cors");

const { initializeDatabase } = require("./config/database");
const researchRoutes = require("./routes/research.routes");
const logger = require("./utils/logger");
const { getSettings } = require("./utils/settings");

const app = express();
// Only explicitly configured proxy addresses may supply a client address.
const trustedProxies = (process.env.TRUSTED_PROXY_CIDRS || '').split(',').map(s => s.trim()).filter(Boolean);
if (trustedProxies.length) app.set('trust proxy', trustedProxies);

// Chỉ cho phép frontend dev gọi API từ browser; không thay đổi logic workflow.
app.use(cors({ exposedHeaders: ['Content-Disposition'], credentials: true, origin: process.env.FRONTEND_ORIGIN || "http://localhost:5173" }));
app.use(express.json({ limit: "128kb" }));

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

const auth = require('./auth');
app.use('/api/auth', auth.router);
app.use('/api', auth.csrf, auth.authenticate);
app.get('/api/dashboard', require('./auth/dashboard'));
app.use('/api/research', require('./auth/ownership').researchAccess);
const v2 = require("./routes/run.routes");
app.use("/api/research", v2.router);
v2.internal.use('/research', require('./auth/internal').internalResearchOwner,
  require('./auth/ownership').researchAccess, v2.router, researchRoutes);
app.use("/internal", v2.internal);
app.use("/api/research", researchRoutes);
const knowledge = require("./knowledge/routes");
app.use("/api", knowledge.router);
app.use("/internal/knowledge", knowledge.internal);

// JSON lỗi thống nhất, kể cả body JSON sai cú pháp.
app.use((error, req, res, next) => {
    if (res.headersSent) return next(error);
    const status = error.status || 500;
    const message = error.type === "entity.parse.failed" ? "Invalid JSON body"
        : status === 413 ? "Request body too large"
        : status >= 500 && !error.requestId && !error.safeKnowledge ? "Internal server error" : error.message;
    logger.error("Server", `Request failed (HTTP ${status})`);
    res.status(status).json({ success: false, error: message,
        ...(error.safeKnowledge && error.code ? {code:error.code,stage:error.stage} : {}),
        ...(error.requestId ? { requestId: error.requestId } : {}) });
});

// Tạo bảng xong mới nhận request để tránh truy vấn khi database chưa sẵn sàng.
async function start() {
    try {
        const settings = getSettings();
        await initializeDatabase();
        const server = await new Promise((resolve, reject) => {
            const listener = app.listen(settings.port, "0.0.0.0");
            listener.once("error", reject);
            listener.once("listening", () => {
                console.log(`Server is running at http://localhost:${listener.address().port}`);
                resolve(listener);
            });
        });
        const shutdown = () => server.close(() => process.exit(0));
        process.once("SIGTERM", shutdown);
        process.once("SIGINT", shutdown);
        return server;
    } catch (error) {
        logger.error("Server", `Startup failed (${error.code || "configuration or database error"}); check environment, database and PORT`);
        process.exit(1);
    }
}
if (require.main === module) start();
module.exports = { app, start };
