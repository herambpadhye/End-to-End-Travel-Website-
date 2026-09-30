const mongoose = require("mongoose");
const initData = require("./data.js");
const Listing = require("../models/list.js");

const MONGO_URL = "mongodb://127.0.0.1:27017/Wanderlust";

// 🔥 DB Connection with error handling
main()
  .then(() => {
    console.log("connected to DB");
    initDB(); // call only after DB connects
  })
  .catch((err) => {
    console.log("DB Connection Error:", err);
  });

async function main() {
  await mongoose.connect(MONGO_URL);
}

// 🔥 Safe DB Initialization
const initDB = async () => {
  try {
    await Listing.deleteMany({});
    await Listing.insertMany(initData.data);
    console.log("data was initialized");
  } catch (err) {
    console.log("Error while initializing DB:", err);
  }
};