import { Router } from "express";
import { Role } from "../../../generated/prisma/enums";
import { checkAuth } from "../../middleware/checkAuth";
import { validateRequest } from "../../middleware/validateRequest";
import { SampleWorkController } from "./sampleWork.controller";
import {
  createSampleWorkZodSchema,
  updateSampleWorkZodSchema,
} from "./sampleWork.validation";

const router = Router();
const admin = checkAuth(Role.ADMIN, Role.SUPER_ADMIN);

// Public — homepage section
router.get("/", SampleWorkController.getPublicSampleWorks);

router.get("/admin", admin, SampleWorkController.getAllSampleWorks);
router.get("/:id/file", SampleWorkController.openFile);
router.post("/upload-signature", admin, SampleWorkController.getUploadSignature);
router.post("/", admin, validateRequest(createSampleWorkZodSchema), SampleWorkController.createSampleWork);
router.patch("/:id", admin, validateRequest(updateSampleWorkZodSchema), SampleWorkController.updateSampleWork);
router.delete("/:id", admin, SampleWorkController.deleteSampleWork);

export const SampleWorkRoutes = router;
