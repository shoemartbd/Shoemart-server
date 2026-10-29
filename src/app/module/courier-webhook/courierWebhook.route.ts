import { Router } from "express";
import { CourierWebhookController } from "./courierWebhook.controller";

const router = Router();

// Public — called by Steadfast's own servers, authenticated via the
// Bearer token configured in Courier Settings (not our session/JWT auth)
router.post("/steadfast", CourierWebhookController.handleSteadfastWebhook);

// Public — called by RedX; protected by ?token= set in Courier Settings
router.post("/redx", CourierWebhookController.handleRedxWebhook);

export const CourierWebhookRoutes = router;
