const jwt = require("jsonwebtoken");

function generateToken(id, role, rememberDevice) {
  return jwt.sign({ id, role }, process.env.JWT_SECRET, {
    expiresIn: rememberDevice ? "30d" : (process.env.JWT_EXPIRES_IN || "7d"),
  });
}

module.exports = generateToken;
