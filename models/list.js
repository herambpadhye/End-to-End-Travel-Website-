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
         default: "https://images.unsplash.com/photo-1552733407-5d5c46c3bb3b?auto=format&fit=crop&w=800&q=60"
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

   // Map coordinates for this particular listing
   coordinates: {
      lat: {
         type: Number
      },
      lng: {
         type: Number
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

const Listing = mongoose.model("Listing", listingschema);

module.exports = Listing;