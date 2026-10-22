import mongoose from "mongoose";

const userSchema = mongoose.Schema({
    fullname : {
        type: String,
        required : true,
        trim: true,
        maxlength: 80,
    },
    username : {
        type: String,
        required : true,
        unique: true,
        trim: true,
        lowercase: true,
        minlength: 3,
        maxlength: 24,
        match: /^[a-z0-9_.]+$/,
    },

    email : {
        type: String,
        required : true,
        unique: true,
        trim: true,
        lowercase: true,
    },

    password : {
        type: String,
        required : true,
        minlength : 8,
    },
    
    profilepicture : {
        type: String,
        default: "",
    }
}, {timestamps : true});

const User = mongoose.model("User", userSchema);

export default User;