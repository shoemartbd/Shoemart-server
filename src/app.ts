/* eslint-disable @typescript-eslint/no-explicit-any */
import * as Sentry from "@sentry/node";
import { nodeProfilingIntegration } from "@sentry/profiling-node";
import { toNodeHandler } from "better-auth/node";
import cookieParser from "cookie-parser";
import cors from "cors";
import express, { Application, Request, Response } from "express";
import path from "path";
import qs from "qs";
import { envVars } from "./app/config/env";
import { auth } from "./app/lib/auth";
import { IndexRoutes } from "./app/routes";
import { requestLogger } from "./app/middleware/requestLogger";
import { globalErrorHandler } from "./app/middleware/globalErrorHandler";
import { notFound } from "./app/middleware/notFound";
import { globalRateLimiter } from "./app/middleware/rateLimiter";

const app: Application = express();

// Sentry Initialization
if (envVars.SENTRY_DSN) {
  Sentry.init({
    dsn: envVars.SENTRY_DSN,
    integrations: [nodeProfilingIntegration()],
    // Performance Monitoring
    tracesSampleRate: 1.0, //  Capture 100% of the transactions
    // Set sampling rate for profiling - this is relative to tracesSampleRate
    profilesSampleRate: 1.0,
  });

  // The request handler must be the first middleware on the app
  Sentry.setupExpressErrorHandler(app);
}

// EJS Setup
app.set("view engine", "ejs");
app.set("views", path.join(process.cwd(), "src/app/templates"));

app.set("query parser", (str: string) => qs.parse(str));

app.use(requestLogger);

// Global request logger for debugging
// app.use((req, res, next) => {
//   console.log(`🚀 [${req.method}] ${req.url}`);
//   next();
// });

app.use(
  cors({
    origin: [
      envVars.FRONTEND_URL,
      envVars.BETTER_AUTH_URL,
      // The Google redirect page is served from the backend's own domain and
      // calls /api/auth/sign-in/social from there, so that origin must be allowed.
      ...(process.env.BACKEND_URL ? [process.env.BACKEND_URL] : []),
      "http://localhost:3000",
      "http://localhost:5000",
    ],
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH"],
    allowedHeaders: ["Content-Type", "Authorization"],
  }),
);

app.use("/api/auth", toNodeHandler(auth));

// 3. General Parsers (These must come AFTER the /webhook route)
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(cookieParser());

// Apply global rate limiter
app.use("/api", globalRateLimiter);

// application routes
app.use("/api/v1", IndexRoutes);

app.get("/", (req: Request, res: Response) => {
  res.send("Hello from Shoe Mart Server!");
});

app.use(notFound);
app.use(globalErrorHandler);

export default app;
