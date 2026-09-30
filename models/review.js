const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const reviewSchema = new Schema({
    comment: {
        type: String,
        required: [true, "Comment is required"],
        trim: true
    },

    rating: {
        type: Number,
        required: [true, "Rating is required"],
        min: 0.5,
        max: 5
    },

    listing: {
        type: Schema.Types.ObjectId,
        ref: "Listing",
        required: true
    },

    user: {
        type: Schema.Types.ObjectId,
        ref: "User",
        required: true
    }

}, {
    timestamps: true
});

const Review = mongoose.model("Review", reviewSchema);

module.exports = Review;