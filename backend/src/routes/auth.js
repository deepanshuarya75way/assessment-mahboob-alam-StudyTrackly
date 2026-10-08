import crypto from "node:crypto";
import { Router } from "express";
import { OAuth2Client } from "google-auth-library";
import jwt from "jsonwebtoken";
import { env, isGoogleOAuthConfigured } from "../lib/env.js";
import { User } from "../models/User.js";

const router = Router();
// fucntion for device names
export function parseDeviceName(userAgent = ""){
  if(!userAgent || typeof userAgent !== "string") return "Unknown Device";
  let os = "Device";
  if (/window/i.test(userAgent)) os = "Windows";
  else if(/macintosh | mac os x/i.test(userAgent)) os = "macOS";
  // else if (/iphone | ipad | ipod/t.test(userAgent)) os = "iOS";
  else if(/android/i.test(userAgent)) os = "Android";
  else if(/linux/i.test(userAgent)) os = "Linux";

  let browser = "Browser";
  if(/edg\//i.test(userAgent)) browser = "Edge";
  else if(/chrome|crio/i.test(userAgent)) browser = "Chrome";
  else if(/firebox|fxios/i.test(userAgent)) browser = "Firebox";
  else if(/safari/i.test(userAgent) && !/chrome|crios/i.test(userAgent)) browser = "Safari";

  return `${browser} on ${os}`;

}

function getOAuth2Client() {
  return new OAuth2Client(
    env.GOOGLE_CLIENT_ID,
    env.GOOGLE_CLIENT_SECRET,
    env.GOOGLE_CALLBACK_URL
  );
}

const GOOGLE_SCOPES = [
  "openid",
  "https://www.googleapis.com/auth/userinfo.email",
  "https://www.googleapis.com/auth/userinfo.profile",
];
// token with user ID and session ID (added session id for token issue)
function issueToken(userId, sessionId) {
  return jwt.sign(
    { sub: userId, 
      sid: sessionId 
    }, 
    env.JWT_SECRET, 
    { 
      expiresIn: "15m"
    }
  );
  
}

function issueTokenTaken(userId, pendingSessionId, newDeviceName){
  return jwt.sign(
    {sub: userId, sid: pendingSessionId, dev: newDeviceName, typ: "takeover"},
    env.JWT_SECRET,
    {expiresIn: "5m"}
  );
}

function createOAuthState() {
  return jwt.sign({ typ: "oauth_state" }, env.JWT_SECRET, { expiresIn: "10m" });
}

function verifyOAuthState(state) {
  if (typeof state !== "string" || !state) return false;
  try {
    const p = jwt.verify(state, env.JWT_SECRET);
    return p.typ === "oauth_state";
    // return (typeof payload === "object" && payload!==null)
  } catch {
    return false;
  }
}

/** Start Google OAuth — redirect browser to Google consent screen. */
router.get("/google", (_req, res, next) => {
  try {
    const front = env.FRONTEND_URL.replace(/\/$/, "");
    if (!isGoogleOAuthConfigured()) {
      return res.redirect(302, `${front}/signin?error=oauth_not_configured`);
    }
    const oauth2Client = getOAuth2Client();
    const state = createOAuthState();
    const url = oauth2Client.generateAuthUrl({
      access_type: "online",
      scope: GOOGLE_SCOPES,
      prompt: "select_account",
      state,
      redirect_uri: env.GOOGLE_CALLBACK_URL,
    });
    res.redirect(302, url);
  } catch (e) {
    next(e);
  }
});

/** Google redirects here with ?code=&state= */
router.get("/google/callback", async (req, res, next) => {
  try {
    const front = env.FRONTEND_URL.replace(/\/$/, "");
    if (!isGoogleOAuthConfigured()) {
      return res.redirect(302, `${front}/signin?error=oauth_not_configured`);
    }
    const oauth2Client = getOAuth2Client();
    const q = req.query;
    if (q.error) {
      const errCode = String(q.error);
      const desc = typeof q.error_description === "string" ? q.error_description : "";
      if (errCode === "invalid_client" || /invalid_client/i.test(desc)) {
        return res.redirect(302, `${front}/signin?error=invalid_client`);
      }
      if (errCode === "redirect_uri_mismatch" || /redirect_uri_mismatch/i.test(desc)) {
        return res.redirect(302, `${front}/signin?error=redirect_uri_mismatch`);
      }
      return res.redirect(302, `${front}/signin?error=${encodeURIComponent(errCode)}`);
    }
    const code = typeof q.code === "string" ? q.code : "";
    if (!code) {
      return res.redirect(302, `${front}/signin?error=missing_code`);
    }
    if (!verifyOAuthState(q.state)) {
      return res.redirect(302, `${front}/signin?error=invalid_state`);
    }

    const { tokens } = await oauth2Client.getToken({
      code,
      redirect_uri: env.GOOGLE_CALLBACK_URL,
    });
    oauth2Client.setCredentials(tokens);
    if (!tokens.id_token) {
      return res.redirect(302, `${front}/signin?error=no_id_token`);
    }

    const ticket = await oauth2Client.verifyIdToken({
      idToken: tokens.id_token,
      audience: env.GOOGLE_CLIENT_ID,
    });
    const payload = ticket.getPayload();
    if (!payload?.email) {
      return res.redirect(302, `${front}/signin?error=no_email`);
    }

    const email = payload.email.toLowerCase();
    const googleId = payload.sub;
    const name = (payload.name || payload.email.split("@")[0]).trim();

    let user = await User.findOne({ $or: [{ googleId }, { email }] });
    if (!user) {
      user = await User.create({
        googleId,
        email,
        name,
        timerVolume: 0.45,
        smartTimerRingtone: "soft_chime",
      });
    } else {
      const updates = {};
      if (!user.googleId) updates.googleId = googleId;
      if (name && user.name !== name) updates.name = name;
      if (Object.keys(updates).length > 0) {
        await User.updateOne({ _id: user._id }, { $set: updates });
        user = await User.findById(user._id);
      }
    }
    if (!user) throw new Error("User missing after OAuth");

    // const token = issueToken(String(user._id));
    const newDeviceName = parseDeviceName(req.headers["user-agent"]);
    // if uesr alredy has an active session on another device, intitaite takeover flow
    if(user.activeSession?.sessionId){
      const pendingSessionId = issueTokenTaken(
        String(user._id),
        pendingSessionId,
        newDeviceName
      );
      const existingDevice = user.activeSession.deviceName || "Another Device";
      return res.redirect(
        302,
        `${frontend}/auth/callback#takeover_taken=${encodeURIComponent(
          takenoverToken
        )}&existing_device=${encodeURIComponent(
          existingDevice
        )}&new_device=${encodeURIComponent(newDeviceName)}`
      );
    }
    console.log('1');
    // no active session
    const sessionId = crypto.randomUUID();
    user.activeSession = {
      sessionId,
      deviceName: newDeviceName,
      lastActiveAt: new Date(),
    };
    await user.save();

    const token = issueToken(String(user._id), sessionId);

    // const userPayload = JSON.stringify({
    //   id: String(user._id),
    //   name: user.name,
    //   email: user.email,
    // });

    // user json data extract
    console.log('2');
    const userJson = encodeURIComponent(
      JSON.stringify({
        id: String(user._id),
        name: user.name,
        email: user.email,
        timerVolume: user.timerVolume ?? 0.45,
        smartTimerRingtone: user.smartTimerRingtone ?? "soft_chime",
      })
    );

    // `${frontend}/auth/callback#token=${encodeURIComponent(token)}&user=${userJson}`
    // `${frontend}/auth/callback#token=${encodeURIComponent(token)}&user=${encodeURIComponent(userPayload)}`
    console.log()
    res.redirect(
      302,
      `${frontend}/auth/callback#token=${encodeURIComponent(token)}&user=${userJson}`
    );
  } catch (e) {
    console.error("Google OAuth callback error", e);
    const front = env.FRONTEND_URL.replace(/\/$/, "");
    // Extract a readable error blob for pattern matching
    let blob;
    try {
      if (e && typeof e === "object" && "response" in e) {
        blob = JSON.stringify(e.response?.data ?? e);
      } else {
        blob = e instanceof Error ? e.message : String(e);
      }
    } catch {
      blob = String(e);
    }
    if (/redirect_uri_mismatch/i.test(blob)) {
      return res.redirect(302, `${front}/signin?error=redirect_uri_mismatch`);
    }
    if (/invalid_client|unauthorized_client|Invalid client|Client secret/i.test(blob)) {
      return res.redirect(302, `${front}/signin?error=invalid_client`);
    }
    res.redirect(302, `${front}/signin?error=oauth_failed`);
  }
});

router.post("/takeover", async(req, res) => {
  try{
    const {takenoverToken} = req.body || {};
    if(!takenoverToken || typeof takenoverToken !== "string") {
      return res.status(400).json({error:"missinag takeoverToken"});
    }

    let payload;
    try{
      payload = jwt.verify(takenoverToken, env.JWT_SECRET);
    } catch{
      return res.status(400).json({error: "invalid or expired takeover token"});
    }

    if(payload.typ !== "takeover" || !payload.sub || payload.sid){
      return res.status(400).json({error: "invalid takeover token"});
    }

    const user = await User.findById(payload.sub);
    if(!user){
      return res.status(404).json({error: "user not found"});
    }

    // automatically invalid previos and active new session
    user.activeSession = {
      sessionId: payload.sid,
      deviceName: payload.dev | "Device",
      lastActiveAt: new Date(),
    };

    await user.save();

    // token issue karna h 
    const token = issueToken(String(user._id), payload.sid);
    res.json({token, user: {id: user._id, name: user.name, email: user.email}});
  }
  catch(e){
    console.error("Takeover error", e);
    res.status(500).json({error: "failed to take over session"});
  }
});

export default router;
