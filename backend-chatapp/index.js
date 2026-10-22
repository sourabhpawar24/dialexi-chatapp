import express from "express";
import dotenv from 'dotenv';
import cookieParser from "cookie-parser";
import cors from "cors";
import http from "node:http";
import jwt from "jsonwebtoken";
import { Server } from "socket.io";
import dbConnect from "./DB/dbConnect.js";
import authRouter from './route/authUser.js'
import conversationRouter from "./route/conversationRoutes.js";
import userRouter from "./route/userRoutes.js";
import Conversation from "./Models/conversationModel.js";
import User from "./Models/userModels.js";

const app = express();

dotenv.config();

const server = http.createServer(app);
const isProduction = process.env.NODE_ENV === "production";
const configuredFrontendUrl = process.env.FRONTEND_URL || (isProduction ? "" : "http://localhost:5173");
let frontendUrl;
try {
    frontendUrl = new URL(configuredFrontendUrl).origin;
} catch {
    throw new Error("FRONTEND_URL must be set to the frontend origin");
}
if (isProduction && (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32)) {
    throw new Error("In production, JWT_SECRET must contain at least 32 characters");
}
const cookieSameSite = (process.env.COOKIE_SAME_SITE || "strict").toLowerCase();
if (!["strict", "lax", "none"].includes(cookieSameSite)) {
    throw new Error("COOKIE_SAME_SITE must be strict, lax, or none");
}
if (isProduction && new URL(frontendUrl).protocol !== "https:") {
    throw new Error("FRONTEND_URL must use HTTPS in production");
}
const io = new Server(server, {
    cors: {
        origin: frontendUrl,
        credentials: true,
    },
});

app.set("io", io);
app.use(cors({
    origin: frontendUrl,
    credentials: true,
}));
app.use(express.json());
app.use(cookieParser());

app.use('/api/auth', authRouter);
app.use("/api/conversations", conversationRouter);
app.use("/api/users", userRouter);

app.get("/", (req, res)=>{
    res.json({ success: true, message: "Chat API is running" });
});

const PORT = process.env.PORT || 2405

io.use(async (socket, next) => {
    const requestOrigin = socket.handshake.headers.origin;
    if (requestOrigin && requestOrigin !== frontendUrl) {
        return next(new Error("Origin not allowed"));
    }

    const cookies = socket.handshake.headers.cookie ?? "";
    const jwtCookie = cookies.split(";").map((cookie) => cookie.trim())
        .find((cookie) => cookie.startsWith("jwt="));

    if (!jwtCookie) {
        return next(new Error("Authentication required"));
    }

    let decoded;
    try {
        const token = decodeURIComponent(jwtCookie.slice(4));
        decoded = jwt.verify(token, process.env.JWT_SECRET);
    } catch {
        return next(new Error("Invalid or expired token"));
    }

    if (typeof decoded !== "object" || !decoded || typeof decoded.userId !== "string") {
        return next(new Error("Invalid or expired token"));
    }

    try {
        const user = await User.findById(decoded.userId).select("_id");
        if (!user) {
            return next(new Error("User no longer exists"));
        }
        socket.data.userId = String(user._id);
        return next();
    } catch (error) {
        console.error("Socket authentication error:", error);
        return next(new Error("Unable to authenticate connection"));
    }
});

io.on("connection", (socket) => {
    socket.join(`user:${socket.data.userId}`);
    socket.on("conversation:join", async (conversationId) => {
        if (typeof conversationId !== "string") {
            return;
        }

        try {
            const conversation = await Conversation.findOne({
                _id: conversationId,
                participants: socket.data.userId,
            }).select("_id");

            if (conversation) {
                socket.join(`conversation:${conversation._id}`);
            }
        } catch (error) {
            console.error("Socket conversation join error:", error);
        }
    });

    socket.on("conversation:leave", (conversationId) => {
        if (typeof conversationId === "string") {
            socket.leave(`conversation:${conversationId}`);
        }
    });
});

const startServer = async () => {
    try {
        if (!process.env.MONGODB_CONNECT) {
            throw new Error("MONGODB_CONNECT must be configured");
        }
        if (!process.env.JWT_SECRET) {
            throw new Error("JWT_SECRET must be configured");
        }
        await dbConnect();
        server.listen(PORT, ()=>{
            console.log(`Chat server listening on port ${PORT}`);
        });
    } catch (error) {
        console.error("Server startup error:", error.message);
        process.exitCode = 1;
    }
}

startServer();