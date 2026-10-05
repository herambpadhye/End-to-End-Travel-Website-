require("dotenv").config();

const express = require("express");
const app = express();
const mongoose = require("mongoose");
const path = require("path");
const methodOverride = require("method-override");
const ejsmate = require("ejs-mate");
const cookieParser = require("cookie-parser");
const session = require("express-session");

const User = require("./models/user.js");

const usersRouter = require("./classroom/routes/user.js");
const travelRouter = require("./classroom/routes/travel.js");
const listingsRouter = require("./classroom/routes/posts.js");
//const atlasConnection = require("./config/atlas.js");
// =============================
// Custom Error Class
// =============================

class ExpressError extends Error {
  constructor(statusCode, message) {
    super();
    this.statusCode = statusCode;
    this.message = message;
  }
}

// =============================
// Async Wrapper
// =============================

const wrapAsync = (fn) => {
  return function (req, res, next) {
    fn(req, res, next).catch(next);
  };
};

// =============================
// MongoDB Connection
// =============================


const MONGO_URL = process.env.MONGODB_ATLAS_URI;

async function main() {
  if (!MONGO_URL) {
    throw new Error("MONGODB_ATLAS_URI is not defined");
  }

  await mongoose.connect(MONGO_URL);
}

main()
  .then(() => console.log("connected to DB"))
  .catch((err) => console.log("DB Connection Error:", err));

// =============================
// Express Configuration
// =============================

app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));

// =============================
// Middleware
// =============================

app.use(express.urlencoded({ extended: true }));

app.use(methodOverride("_method"));

app.engine("ejs", ejsmate);

app.use(express.static(path.join(__dirname, "public")));

app.use(cookieParser(process.env.COOKIE_SECRET));

// =============================
// User Session
// =============================

app.use(
  session({
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: {
      maxAge: 1000 * 60 * 60 * 24 * 7
    }
  })
);

// =============================
// Make Logged-in User
// Available to All EJS Pages
// =============================

app.use(async (req, res, next) => {
  try {
    res.locals.currentUser = null;

    if (req.session.userId) {
      const user = await User.findById(req.session.userId);
      res.locals.currentUser = user;
    }

    next();
  } catch (error) {
    next(error);
  }
});

// =============================
// Home Route
// =============================

app.get("/", (req, res) => {
  res.redirect("/listings");
});
// =============================
// Cookie Test Routes
// =============================

// Set Signed Cookie
app.get("/setcookie", (req, res) => {
  res.cookie("user", "heramb", {
    signed: true
  });

  res.send("Signed Cookie Set!");
});

// Read Cookies
app.get("/getcookie", (req, res) => {
  console.log("Normal Cookies:", req.cookies);
  console.log("Signed Cookies:", req.signedCookies);

  res.send(req.signedCookies);
});

// =============================
// Application Routes
// =============================

// Listings
app.use("/listings", listingsRouter);

// Users
app.use("/users", usersRouter);

// Travel
app.use("/travel", travelRouter);

// =============================
// 404 Handler
// =============================

app.all("*", (req, res, next) => {
  next(new ExpressError(404, "Page Not Found"));
});

// =============================
// Error Middleware
// =============================

app.use((err, req, res, next) => {
  const {
    statusCode = 500,
    message = "Something went wrong"
  } = err;

  res.status(statusCode).send(message);
});

// =============================
// Local Development Server
// =============================

if (require.main === module) {
  const PORT = process.env.PORT || 8080;

  app.listen(PORT, () => {
    console.log(`server is listening to port ${PORT}`);
  });
}

// =============================
// Export Express App
// Required for Vercel
// =============================

module.exports = app;