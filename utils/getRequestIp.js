const PRIVATE_IPV4_REGEX =
  /^(10\.|127\.|169\.254\.|172\.(1[6-9]|2\d|3[0-1])\.|192\.168\.)/;
const PRIVATE_IPV6_REGEX = /^(::1$|fc00:|fd00:|fe80:)/i;

const normalizeIp = (ip) => {
  if (!ip || typeof ip !== "string") return "";
  return ip.trim().replace(/^::ffff:/i, "");
};

const isPublicIp = (ip) => {
  const cleanIp = normalizeIp(ip);
  if (!cleanIp) return false;
  if (PRIVATE_IPV4_REGEX.test(cleanIp)) return false;
  if (PRIVATE_IPV6_REGEX.test(cleanIp)) return false;
  return true;
};

const extractForwardedIps = (value) => {
  if (!value || typeof value !== "string") return [];
  return value
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);
};

const extractForwardHeaderIps = (value) => {
  if (!value || typeof value !== "string") return [];
  const matches = value.match(/for=([^;]+)/gi);
  if (!matches) return [];
  return matches
    .map((match) => match.replace(/^for=/i, "").trim())
    .map((ip) => ip.replace(/^"|"$/g, ""));
};

const getRequestIp = (req) => {
  const candidates = [
    ...extractForwardedIps(req.headers["x-forwarded-for"]),
    req.headers["x-real-ip"],
    req.headers["cf-connecting-ip"],
    req.headers["true-client-ip"],
    ...extractForwardHeaderIps(req.headers["forwarded"]),
    req.socket?.remoteAddress,
  ]
    .map(normalizeIp)
    .filter(Boolean);

  const publicIp = candidates.find((ip) => isPublicIp(ip));
  return publicIp || candidates[0] || null;
};

module.exports = {
  getRequestIp,
  isPublicIp,
};

