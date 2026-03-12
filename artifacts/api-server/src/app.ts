import express, { type Express, type Request, type Response } from "express";
import cors from "cors";
import path from "path";
import router from "./routes";

const app: Express = express();

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use("/api", router);

// Serve React frontend in production
if (process.env.NODE_ENV === "production") {
  // Static assets built to artifacts/tradesignal-pro/dist/public
  // Server runs from workspace root: node artifacts/api-server/dist/index.cjs
  const staticDir = path.resolve(process.cwd(), "artifacts/tradesignal-pro/dist/public");
  app.use(express.static(staticDir));

  // SPA fallback — regex wildcard required in Express 5
  app.get(/.*/, (_req: Request, res: Response) => {
    res.sendFile(path.join(staticDir, "index.html"));
  });
}

export default app;
