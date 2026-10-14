const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const listingschema = new Schema({

    title: {
        type: String,
        required: [true, "Title is required"]
    },

    description: {
        type: String,
        default: ""
    },

    image: {
        filename: {
            type: String,
            default: "listingimage"
        },

        url: {
            type: String,
            default:
                "https://images.unsplash.com/photo-1552733407-5d5c46c3bb3b?auto=format&fit=crop&w=800&q=60"
        }
    },

    // Multiple images for host listings
    images: {
        type: [String],
        default: []
    },

    price: {
        type: Number,
        min: [0, "Price cannot be negative"]
    },

    location: {
        type: String,
        default: ""
    },

    country: {
        type: String,
        default: ""
    },

    propertyName: {
        type: String,
        trim: true,
        maxlength: 200
    },

    landmark: {
        type: String,
        trim: true,
        maxlength: 200
    },

    locality: {
        type: String,
        trim: true,
        maxlength: 200
    },

    city: {
        type: String,
        trim: true,
        maxlength: 100
    },

    state: {
        type: String,
        trim: true,
        maxlength: 100
    },

    pincode: {
        type: String,
        trim: true,
        maxlength: 12
    },

    amenities: {
        type: [String],
        default: []
    },

    // Map coordinates for this particular listing
    coordinates: {

        lat: {
            type: Number,
            min: -90,
            max: 90
        },

        lng: {
            type: Number,
            min: -180,
            max: 180
        }

    },

    // Host who created the listing
    host: {
        type: Schema.Types.ObjectId,
        ref: "User",
        default: null
    },

    postedAt: {
        type: Date,
        default: Date.now
    }

});

const Listing =
    mongoose.model(
        "Listing",
        listingschema
    );

module.exports = Listing;