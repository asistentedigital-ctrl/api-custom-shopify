import type { NextFunction, Request, Response } from "express";
import { logger } from "../logger";

export function notFoundHandler(req: Request, res: Response) {
  res.status(404).json({ error: "not_found" });
}

export function errorHandler(err: unknown, req: Request, res: Response, _next: NextFunction) {
  logger.error({ err }, "unhandled_error");
  res.status(500).json({ error: "internal_error" });
}
