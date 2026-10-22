import mongoose from "mongoose";
import Conversation from "../Models/conversationModel.js";
import Message from "../Models/messageModel.js";
import User from "../Models/userModels.js";

export const createConversation = async (req, res) => {
  const participantId = req.body?.participantId;
  if (!mongoose.isValidObjectId(participantId)) {
    return res.status(400).json({ success: false, message: "A valid participantId is required" });
  }

  if (String(req.user._id) === String(participantId)) {
    return res.status(400).json({ success: false, message: "You cannot start a conversation with yourself" });
  }

  let directKey;
  try {
    const participant = await User.findById(participantId).select("_id");
    if (!participant) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    const participantIds = [String(req.user._id), String(participant._id)].sort();
    directKey = participantIds.join(":");

    const existingConversation = await Conversation.findOne({ directKey });
    if (existingConversation) {
      return res.status(200).json(existingConversation);
    }

    const conversation = await Conversation.create({
      participants: participantIds,
      directKey,
    });
    return res.status(201).json(conversation);
  } catch (error) {
    if (error?.code === 11000 && directKey) {
      try {
        const existingConversation = await Conversation.findOne({ directKey });
        if (existingConversation) {
          return res.status(200).json(existingConversation);
        }
      } catch (lookupError) {
        console.error(lookupError);
      }
    }

    console.error(error);
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
};

export const getConversations = async (req, res) => {
  try {
    const conversations = await Conversation.find({ participants: req.user._id })
      .populate("participants", "fullname username profilepicture")
      .populate("lastMessage")
      .sort({ updatedAt: -1 });

    return res.status(200).json(conversations);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
};

export const getMessages = async (req, res) => {
  const { conversationId } = req.params;
  if (!mongoose.isValidObjectId(conversationId)) {
    return res.status(400).json({ success: false, message: "Invalid conversation id" });
  }

  try {
    const conversation = await Conversation.findOne({
      _id: conversationId,
      participants: req.user._id,
    }).select("_id");

    if (!conversation) {
      return res.status(404).json({ success: false, message: "Conversation not found" });
    }

    const parsedLimit = Number.parseInt(req.query.limit, 10);
    const limit = Number.isNaN(parsedLimit) ? 50 : Math.min(Math.max(parsedLimit, 1), 100);
    const filter = { conversation: conversation._id };

    if (req.query.before) {
      if (!mongoose.isValidObjectId(req.query.before)) {
        return res.status(400).json({ success: false, message: "Invalid message cursor" });
      }

      const cursorMessage = await Message.findOne({
        _id: req.query.before,
        conversation: conversation._id,
      }).select("_id createdAt");

      if (!cursorMessage) {
        return res.status(400).json({ success: false, message: "Message cursor not found" });
      }

      filter.$or = [
        { createdAt: { $lt: cursorMessage.createdAt } },
        { createdAt: cursorMessage.createdAt, _id: { $lt: cursorMessage._id } },
      ];
    }

    const messages = await Message.find(filter)
      .populate("sender", "fullname username profilepicture")
      .sort({ createdAt: -1, _id: -1 })
      .limit(limit);

    const nextCursor = messages.length === limit ? messages[messages.length - 1]._id : null;
    return res.status(200).json({ messages: messages.reverse(), nextCursor });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
};

export const sendMessage = async (req, res) => {
  const { conversationId } = req.params;
  const text = typeof req.body?.text === "string" ? req.body.text.trim() : "";

  if (!mongoose.isValidObjectId(conversationId)) {
    return res.status(400).json({ success: false, message: "Invalid conversation id" });
  }
  if (!text || text.length > 5000) {
    return res.status(400).json({ success: false, message: "Message must be between 1 and 5000 characters" });
  }

  try {
    const conversation = await Conversation.findOne({
      _id: conversationId,
      participants: req.user._id,
    });

    if (!conversation) {
      return res.status(404).json({ success: false, message: "Conversation not found" });
    }

    const message = await Message.create({
      conversation: conversation._id,
      sender: req.user._id,
      text,
    });

    conversation.lastMessage = message._id;
    await conversation.save();

    const populatedMessage = await Message.findById(message._id)
      .populate("sender", "fullname username profilepicture");
    req.app.get("io").to(`conversation:${conversation._id}`).emit("conversation:message", populatedMessage);

    return res.status(201).json(populatedMessage);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
};