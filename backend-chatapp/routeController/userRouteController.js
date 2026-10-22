import User from "../Models/userModels.js";
import bcryptjs from "bcryptjs";
import jwtToken from "../utils/jwtwebToken.js";

export const getCurrentUser = (req, res) => {
  const { _id, fullname, username, email, profilepicture } = req.user;
  res.status(200).json({ _id, fullname, username, email, profilepicture });
};

export const userRegister = async (req, res) => {
  try {
    const { fullname, username, email, password, profilepicture } = req.body ?? {};
    const normalizedFullname = typeof fullname === "string" ? fullname.trim() : "";
    const normalizedUsername = typeof username === "string" ? username.trim().toLowerCase() : "";
    const normalizedEmail = typeof email === "string" ? email.trim().toLowerCase() : "";
    const normalizedProfilePicture = typeof profilepicture === "string" ? profilepicture.trim() : "";

    if (!normalizedFullname || normalizedFullname.length > 80
      || !/^[a-z0-9_.]{3,24}$/.test(normalizedUsername)
      || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)
      || typeof password !== "string" || password.length < 8 || password.length > 72
      || (profilepicture !== undefined && typeof profilepicture !== "string")) {
      return res
        .status(400)
        .json({ success: false, message: "Enter a name, valid username, valid email, and a password of at least 8 characters" });
    }

    const user = await User.findOne({ $or: [{ username: normalizedUsername }, { email: normalizedEmail }] });
    if (user) {
      return res.status(409).json({
        success: false,
        message: "Username or Email already exists, please try a different one",
      });
    }

    const hashPassword = await bcryptjs.hash(password, 10);

    const newUser = new User({
      fullname: normalizedFullname,
      username: normalizedUsername,
      email: normalizedEmail,
      password: hashPassword,
      profilepicture: normalizedProfilePicture,
    });

    await newUser.save();
    jwtToken(newUser._id, res);

    res.status(201).json({
      _id: newUser._id,
      fullname: newUser.fullname,
      username: newUser.username,
      email: newUser.email,
      profilepicture: newUser.profilepicture,
    });
  } catch (error) {
    console.error(error);
    if (error?.code === 11000) {
      return res.status(409).json({
        success: false,
        message: "Username or Email already exists, please try a different one",
      });
    }
    res.status(500).json({ success: false, message: "Internal server error" });
  }
};

export const userLogout = (req, res) => {
  req.app.get("io").in(`user:${req.user._id}`).disconnectSockets(true);
  res.clearCookie("jwt", {
    httpOnly: true,
    sameSite: process.env.COOKIE_SAME_SITE?.toLowerCase() || "strict",
    secure: process.env.NODE_ENV === "production" || process.env.COOKIE_SAME_SITE?.toLowerCase() === "none",
  });
  return res.status(200).json({ success: true, message: "Logged out successfully" });
};

export const userLogin = async (req, res) => {
  try {
    const { email, password } = req.body ?? {};
    const normalizedEmail = typeof email === "string" ? email.trim().toLowerCase() : "";

    if (!normalizedEmail || typeof password !== "string" || !password) {
      return res
        .status(400)
        .json({ success: false, message: "Email and password are required" });
    }

    const user = await User.findOne({ email: normalizedEmail });
    if (!user) {
      return res
        .status(401)
        .json({ success: false, message: "Invalid email or password" });
    }

    const comparePass = await bcryptjs.compare(password, user.password);
    if (!comparePass) {
      return res
        .status(401)
        .json({ success: false, message: "Invalid email or password" });
    }

    jwtToken(user._id, res);

    res.status(200).json({
      _id: user._id,
      fullname: user.fullname,
      username: user.username,
      email: user.email,
      profilepicture: user.profilepicture,
      message: "Login Successful",
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
};