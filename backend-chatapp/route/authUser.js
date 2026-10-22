import express from 'express';
import { getCurrentUser, userLogin, userLogout, userRegister } from "../routeController/userRouteController.js";
import protectRoute from "../middleware/protectRoute.js";



const router = express.Router();

router.post('/register', userRegister)

router.post('/login', userLogin)
router.post('/logout', protectRoute, userLogout)

router.get('/me', protectRoute, getCurrentUser)

export default router