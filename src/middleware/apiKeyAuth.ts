import type { NextFunction, Request, Response } from "express";
import { config } from "../config";

export function apiKeyAuth(req: Request, res: Response, next: NextFunction) {
  const providedKey = req.header("X-API-KEY");

  if (!providedKey || providedKey !== config.KOMMO_API_KEY) {
    res.status(401).json({ error: "unauthorized" });
    return;
  }

  next();
}
