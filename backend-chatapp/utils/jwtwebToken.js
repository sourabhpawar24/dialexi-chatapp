import jwt from "jsonwebtoken";

const jwtToken = (userId, res) => {
    const token = jwt.sign({userId}, process.env.JWT_SECRET, {
        expiresIn : "30d"
    })
    res.cookie('jwt', token, {
        maxAge : 30*24*60*60*1000,
        httpOnly : true,
        sameSite : process.env.COOKIE_SAME_SITE?.toLowerCase() || "strict",
        secure : process.env.NODE_ENV === "production" || process.env.COOKIE_SAME_SITE?.toLowerCase() === "none"
    })
}

export default jwtToken;