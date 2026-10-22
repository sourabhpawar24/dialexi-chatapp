import User from "../Models/userModels.js";

export const searchUsers = async (req, res) => {
  const query = typeof req.query.search === "string" ? req.query.search.trim() : "";
  if (query.length < 2) {
    return res.status(200).json([]);
  }
  if (query.length > 60) {
    return res.status(400).json({ success: false, message: "Search must be 60 characters or fewer" });
  }

  const escapedQuery = query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

  try {
    const users = await User.find({
      _id: { $ne: req.user._id },
      $or: [
        { fullname: { $regex: escapedQuery, $options: "i" } },
        { username: { $regex: escapedQuery, $options: "i" } },
      ],
    })
      .select("fullname username profilepicture")
      .sort({ fullname: 1 })
      .limit(20);

    return res.status(200).json(users);
  } catch (error) {
    console.error("User search error:", error);
    return res.status(500).json({ success: false, message: "Unable to search users" });
  }
};
