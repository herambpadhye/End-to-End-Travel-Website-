const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const userSchema = new Schema({
    email: {
        type: String,
        required: true,
        unique: true,
        lowercase: true,
        trim: true
    },

    password: {
        type: String,
        required: true
    },

    profilePicture: {
        type: String,
        default: ""
    },

    country: {
        type: String,
        default: ""
    },

    city: {
        type: String,
        default: ""
    },

    // ================================
    // Host Information
    // ================================

    isHost: {
        type: Boolean,
        default: false
    },

    hostPhone: {
        type: String,
        default: ""
    },

    hostService: {
        type: String,
        default: ""
    },

    idProof: {
        type: String,
        default: ""
    },

    hostName: {
        type: String,
        default: ""
    },

    hostDescription: {
        type: String,
        default: ""
    },

    hostUpiQrImageUrl: {
        type: String,
        default: ""
    }
});

const User = mongoose.model("User", userSchema);

module.exports = User;