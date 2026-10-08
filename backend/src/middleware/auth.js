import jwt from "jsonwebtoken";
import { env } from "../lib/env.js";
import { User } from "../models/User.js";

/**
 * Express middleware that verifies the Bearer JWT.
 * On success, attaches `req.userId` (string) for downstream handlers.
 */
export async function requireAuth(req, res, next) {
  const auth = req.headers.authorization;
  if (!auth?.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Missing Authorization header" });
  }
  const token = auth.slice("Bearer ".length);
  try {

    const payload = jwt.verify(token, env.JWT_SECRET);

    if(!payload.sub || !payload.said){
      return res.status(401).json({error: "invalid token"});
    }
    
    const user = await User.findById(payload.sub).select("actionSession");
    if(!user) {
      return res.status(401).json({error: "user not found"});
    }

    if(payload.sid && user.activeSession?.sessionId && user.activeSesssion.sessionId !== payload.sid){
        return res.status(401).json({
          error: "session_taken_over",
          message: "Your session was ended bcz this account was logged into on another device.",
      });
    }

    req.userId = payload.sub;
    next();
  } catch {
    return res.status(401).json({ error: "Invalid token" });
  }
}
