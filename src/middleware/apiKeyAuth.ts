import type { NextFunction, Request, Response } from "express";
import { config } from "../config";

export function apiKeyAuth(req: Request, res: Response, next: NextFunction) {
  // El paso de código del Salesbot de Kommo no permite headers personalizados,
  // así que la clave también puede venir como query param (?api_key=...).
  const providedKey = req.header("X-API-KEY") ?? req.query.api_key;

  if (!providedKey || providedKey !== config.KOMMO_API_KEY) {
    res.status(401).json({ error: "unauthorized" });
    return;
  }

  next();
}
