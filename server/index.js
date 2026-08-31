import express from "express";
import cookieParser from "cookie-parser";
import { authRouter } from "./routes/auth.js";
import { consumersRouter } from "./routes/consumers.js";

const app = express();

app.use(express.json()); // parse JSON request bodies
app.use(cookieParser()); // populate req.cookies from the Cookie header

app.use("/api/auth", authRouter);
app.use("/api/consumers", consumersRouter);

app.get("/api/health", (_req, res) => res.json({ ok: true }));

const PORT = process.env.PORT || 8787;
app.listen(PORT, () => {
  console.log(`API server listening on http://localhost:${PORT}`);
});
