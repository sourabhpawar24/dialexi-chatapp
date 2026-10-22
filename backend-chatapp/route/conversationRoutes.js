import express from "express";
import protectRoute from "../middleware/protectRoute.js";
import {
  createConversation,
  getConversations,
  getMessages,
  sendMessage,
} from "../routeController/conversationController.js";

const router = express.Router();

router.use(protectRoute);
router.get("/", getConversations);
router.post("/", createConversation);
router.get("/:conversationId/messages", getMessages);
router.post("/:conversationId/messages", sendMessage);

export default router;