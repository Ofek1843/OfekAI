function isFirebaseAuthHelperPath(requestPath, authProxyPath = "/__/auth") {
  const normalizedPath = String(requestPath || "");
  return normalizedPath === authProxyPath
    || normalizedPath.startsWith(`${authProxyPath}/`);
}

function getFrameAncestorsDirective(requestPath, authProxyPath = "/__/auth") {
  return isFirebaseAuthHelperPath(requestPath, authProxyPath)
    ? "frame-ancestors 'self'"
    : "frame-ancestors 'none'";
}

module.exports = {
  getFrameAncestorsDirective,
  isFirebaseAuthHelperPath
};
