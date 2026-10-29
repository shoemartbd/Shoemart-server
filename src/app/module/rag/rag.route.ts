import { Router } from "express";
import { RagController } from "./rag.controller";
import { checkAuth } from "../../middleware/checkAuth";
import { Role } from "../../../generated/prisma/enums";

const router = Router();

router.get("/stats", RagController.getStats);

// Rebuild the chatbot's knowledge (calls the paid embedding API)
router.post(
  "/ingest",
  checkAuth(Role.ADMIN, Role.SUPER_ADMIN),
  RagController.ingestData,
);

// Query RAG (Public or User)
router.post("/query", RagController.queryRag);

export const RagRoutes = router;
