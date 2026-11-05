"use strict";
function isVerifiedAdmin(user, emails) {
  const allowed = String(emails || "").split(",").map(value => value.trim().toLowerCase()).filter(Boolean);
  return user?.emailVerified === true && allowed.includes(String(user.email || "").toLowerCase());
}
module.exports = { isVerifiedAdmin };
