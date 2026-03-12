import { Router, type IRouter } from "express";
import healthRouter from "./health.js";
import authRouter from "./auth.js";
import marketRouter from "./market.js";
import ordersRouter from "./orders.js";
import portfolioRouter from "./portfolio.js";
import gttRouter from "./gtt.js";
import signalsRouter from "./signals.js";
import symbolsRouter from "./symbols.js";
import liveRouter from "./live.js";
import aiRouter from "./ai.js";
import paperRouter from "./paper.js";

const router: IRouter = Router();

router.use(healthRouter);
router.use("/auth", authRouter);
router.use("/market", marketRouter);
router.use("/orders", ordersRouter);
router.use("/portfolio", portfolioRouter);
router.use("/gtt", gttRouter);
router.use("/signals", signalsRouter);
router.use("/indicators", signalsRouter);
router.use("/scanner", signalsRouter);
router.use("/symbols", symbolsRouter);
router.use("/live", liveRouter);
router.use("/ai", aiRouter);
router.use("/paper", paperRouter);

export default router;
