const jwt = require("jsonwebtoken");

/**
 * Verifies the JWT sent in the Authorization header (Bearer token) and
 * attaches { id, role } to req.user. Does not check the role — pair with
 * requireRole() for role-specific routes.
 */
function verifyToken(req, res, next) {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;

  if (!token) {
    return res.status(401).json({ message: "No token provided." });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded; // { id, role }
    next();
  } catch (err) {
    return res.status(401).json({ message: "Invalid or expired token." });
  }
}

/**
 * Restricts a route to one or more roles. Use after verifyToken.
 * Example: router.get("/", verifyToken, requireRole("admin"), handler)
 */
function requireRole(...allowedRoles) {
  return (req, res, next) => {
    if (!req.user || !allowedRoles.includes(req.user.role)) {
      return res.status(403).json({ message: "You do not have access to this resource." });
    }
    next();
  };
}

module.exports = { verifyToken, requireRole };
