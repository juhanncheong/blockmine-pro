// middleware/auth.js
// Minimal admin guard: requires a Bearer token, but doesn't verify JWT.
// You can harden this later to check a JWT or API key.

function verifyAdminToken(req, res, next) {
  const auth = req.headers.authorization || "";
  if (!auth.startsWith("Bearer ")) {
    return res.status(401).json({ message: "Missing admin token" });
  }
  const token = auth.slice(7).trim();
  if (!token) {
    return res.status(401).json({ message: "Invalid admin token" });
  }
  // TODO (optional): enforce a specific token or verify a JWT here.
  // Example hardening:
  // if (process.env.ADMIN_API_KEY && token !== process.env.ADMIN_API_KEY) {
  //   return res.status(403).json({ message: "Forbidden" });
  // }
  req.adminToken = token;
  next();
}

module.exports = { verifyAdminToken };
