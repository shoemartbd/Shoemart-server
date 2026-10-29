import { ipKeyGenerator, rateLimit } from "express-rate-limit";

export const globalRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  limit: 10000, // Limit each IP to 100 requests per `window` (here, per 15 minutes)
  standardHeaders: "draft-8", // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
  message: {
    success: false,
    message:
      "Too many requests from this IP, please try again after 15 minutes",
  },
  handler: (req, res, next, options) => {
    res.status(options.statusCode).json(options.message);
  },
});

// Stricter limiter for sensitive routes like auth
export const authRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  limit: 1000, // Limit each IP to 10 requests per 15 minutes for auth
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: {
    success: false,
    message: "Too many login attempts, please try again after 15 minutes",
  },
});

// Guest (unauthenticated) order placement and payment start — abuse/spam guard.
// These requests come through the Next.js server, so every customer shares its
// IP; counting per phone number (orders) or order (payments) keeps one
// spammer from blocking everyone else.
export const guestOrderRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  limit: 20, // 20 guest orders per phone (or payment starts per order) per 15 minutes
  standardHeaders: "draft-8",
  legacyHeaders: false,
  keyGenerator: (req) => {
    const phone = String(req.body?.phone ?? "").replace(/\D/g, "").slice(-10);
    if (phone) return `phone:${phone}`;
    if (req.body?.orderId) return `order:${String(req.body.orderId)}`;
    return ipKeyGenerator(req.ip ?? "");
  },
  message: {
    success: false,
    message: "Too many orders placed from this device, please try again later",
  },
  handler: (req, res, next, options) => {
    res.status(options.statusCode).json(options.message);
  },
});

// Public abandoned-checkout autosave — one browser session sends a handful of
// these while filling the checkout form, guard against scripted spam only
export const abandonedCheckoutTrackRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  limit: 60, // Limit each IP to 60 autosave pings per 15 minutes
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: {
    success: false,
    message: "Too many requests, please try again later",
  },
  handler: (req, res, next, options) => {
    res.status(options.statusCode).json(options.message);
  },
});

// Public order-tracking lookup (orderNumber + phone) — guards against brute-forcing
// the phone number for a known/guessed order number
export const orderTrackRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  limit: 15, // Limit each IP to 15 track attempts per 15 minutes
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: {
    success: false,
    message: "Too many order lookup attempts, please try again later",
  },
  handler: (req, res, next, options) => {
    res.status(options.statusCode).json(options.message);
  },
});

// Public wholesale enquiry form — a buyer sends one, maybe a correction;
// counted per phone like guest orders (all requests share the Next.js IP)
export const wholesaleRequestRateLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  limit: 5, // 5 enquiries per phone per hour
  standardHeaders: "draft-8",
  legacyHeaders: false,
  keyGenerator: (req) => {
    const phone = String(req.body?.phone ?? "").replace(/\D/g, "").slice(-10);
    return phone ? `phone:${phone}` : ipKeyGenerator(req.ip ?? "");
  },
  message: {
    success: false,
    message: "Too many requests from this number, please try again later",
  },
  handler: (req, res, next, options) => {
    res.status(options.statusCode).json(options.message);
  },
});

// Password-reset OTP emails. Counted per email address, so nobody can flood
// one inbox and shoppers behind the same IP don't block each other.
export const passwordResetRateLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  limit: 5, // 5 codes per email per hour
  standardHeaders: "draft-8",
  legacyHeaders: false,
  keyGenerator: (req) => {
    const email = String(req.body?.email ?? "").trim().toLowerCase();
    return email ? `email:${email}` : ipKeyGenerator(req.ip ?? "");
  },
  message: {
    success: false,
    message: "Too many reset codes requested, please try again in an hour",
  },
  handler: (req, res, next, options) => {
    res.status(options.statusCode).json(options.message);
  },
});
