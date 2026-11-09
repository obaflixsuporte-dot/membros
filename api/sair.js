import { send, sessionCookie } from "../lib/auth.js";

export default function handler(req, res) {
  if (req.method !== "POST") return send(res, 405, { error: "método" });
  send(res, 200, { ok: true }, { "Set-Cookie": sessionCookie("", 0) });
}
