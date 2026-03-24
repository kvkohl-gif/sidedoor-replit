import express from "express";
import { supabaseAdmin as supabase } from "../lib/supabaseClient";

const router = express.Router();

router.get("/", async (_req, res) => {
  const { data, error } = await supabase
    .from("users")
    .select("*")
    .limit(1);

  if (error) {
    console.error("Supabase connection error:", error);
    return res.status(500).json({ ok: false, error: error.message });
  }

  return res.json({ ok: true, data });
});

export default router;
