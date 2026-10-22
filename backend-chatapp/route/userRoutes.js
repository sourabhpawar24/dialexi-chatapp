import express from "express";
import protectRoute from "../middleware/protectRoute.js";
import { searchUsers } from "../routeController/userSearchController.js";

const router = express.Router();

router.get("/", protectRoute, searchUsers);

export default router;
