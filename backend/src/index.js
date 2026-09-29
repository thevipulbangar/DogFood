import express from "express";
import cors from "cors";
import { authRouter } from "./routes/auth.js";
import { eventsRouter } from "./routes/events.js";
import { teamsRouter } from "./routes/teams.js";
import { submissionsRouter } from "./routes/submissions.js";
import { galleryRouter } from "./routes/gallery.js";
import { judgingRouter } from "./routes/judging.js";
import { usersRouter } from "./routes/users.js";

const app = express();
app.use(cors());
app.use(express.json());

app.get("/health", (_req, res) => {
  res.json({ status: "ok" });
});

app.use("/api/auth", authRouter);
app.use("/api/events", eventsRouter);
app.use("/api/teams", teamsRouter);
app.use("/api/submissions", submissionsRouter);
app.use("/api/gallery", galleryRouter);
app.use("/api/judging", judgingRouter);
app.use("/api/users", usersRouter);

// Catch anything an async route handler throws so it becomes a JSON 500
// instead of an unhandled-rejection crash.
app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({ error: "internal server error" });
});

const port = process.env.PORT ?? 8000;
app.listen(port, () => {
  console.log(`backend listening on http://localhost:${port}`);
});
