import mongoose from "mongoose";

const dbConnect = async()=>{
    try {
        await mongoose.connect(process.env.MONGODB_CONNECT); 
        console.log("DB Connected Successfully");
    } catch (error) {
        console.error("DB connection error:", error.message);
        throw error;
    }
}

export default dbConnect;