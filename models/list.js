const mongoose = require("mongoose");
const Schema = mongoose.Schema;

function isValidDateOnly(value) {
    if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
        return false;
    }

    const timestamp = Date.parse(`${value}T00:00:00.000Z`);
    return (
        Number.isFinite(timestamp) &&
        new Date(timestamp).toISOString().slice(0, 10) === value
    );
}

const unavailableDateRangeSchema = new Schema(
    {
        from: {
            type: String,
            required: true,
            validate: {
                validator: isValidDateOnly,
                message: "Unavailable start date must be a valid YYYY-MM-DD date."
            }
        },
        to: {
            type: String,
            required: true,
            validate: {
                validator: isValidDateOnly,
                message: "Unavailable end date must be a valid YYYY-MM-DD date."
            }
        }
    },
    { _id: false }
);

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

    unavailableDateRanges: {
        type: [unavailableDateRangeSchema],
        default: undefined
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