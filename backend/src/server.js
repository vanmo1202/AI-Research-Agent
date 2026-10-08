require("dotenv").config();

const express = require("express");

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

app.listen(PORT, () => {
    console.log(`Server is running at http://localhost:${PORT}`);
});