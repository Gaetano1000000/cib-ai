import express from "express";
import { runAgent } from "../agent/agent_run.js";

const router = express.Router();

router.post("/run", async (req, res) => {
  try {
    const out = await runAgent(req.body || {});
    res.json(out);
  } catch (e) {
    res.status(400).json({ ok: false, error: String(e?.message || e) });
  }
});

export default router;
