const express = require("express");
const router = express.Router();
const User = require("../../models/user.js");
const Listing = require("../../models/list.js");
const Review = require("../../models/review.js");
const multer = require("multer");
const bcrypt = require("bcrypt");
const path = require("path");
const fs = require("fs");


// ========================================
// Upload Folder
// ========================================

const uploadPath = path.join(__dirname, "../../public/uploads");

if (!fs.existsSync(uploadPath)) {
    fs.mkdirSync(uploadPath, { recursive: true });
}


// ========================================
// Storage
// ========================================

const storage = multer.diskStorage({

    destination: function (req, file, cb) {
        cb(null, uploadPath);
    },

    filename: function (req, file, cb) {

        const uniqueName =
            Date.now() +
            "-" +
            Math.round(Math.random() * 1E9) +
            path.extname(file.originalname);

        cb(null, uniqueName);
    }
});


// ========================================
// Profile Picture Upload
// ========================================

const upload = multer({
    storage: storage,

    fileFilter: function (req, file, cb) {

        const allowedTypes = /jpeg|jpg|png|gif|webp/;

        const extension = allowedTypes.test(
            path.extname(file.originalname).toLowerCase()
        );

        const mimeType = allowedTypes.test(file.mimetype);

        if (extension && mimeType) {
            cb(null, true);
        } else {
            cb(new Error("Only image files are allowed."));
        }
    }
});


// ========================================
// Host Upload
// Image + PDF ID Proof
// ========================================

const hostUpload = multer({
    storage: storage,

    fileFilter: function (req, file, cb) {

        if (file.fieldname === "profilePicture") {

            const allowedTypes = /jpeg|jpg|png|gif|webp/;

            const extension = allowedTypes.test(
                path.extname(file.originalname).toLowerCase()
            );

            const mimeType = allowedTypes.test(file.mimetype);

            if (extension && mimeType) {
                cb(null, true);
            } else {
                cb(new Error("Profile picture must be an image."));
            }

        } else if (file.fieldname === "idProof") {

            const allowedTypes = /jpeg|jpg|png|gif|webp|pdf/;

            const extension = allowedTypes.test(
                path.extname(file.originalname).toLowerCase()
            );

            const mimeType =
                file.mimetype.startsWith("image/") ||
                file.mimetype === "application/pdf";

            if (extension && mimeType) {
                cb(null, true);
            } else {
                cb(new Error("ID proof must be an image or PDF."));
            }

        } else {

            cb(null, false);

        }
    }
});


// ========================================
// Gmail Validation
// ========================================

function isValidGmail(email) {

    return /^[a-zA-Z0-9._%+-]+@gmail\.com$/i.test(email);

}


function getProfileNameParts(user) {

    const emailName = user.email.split("@")[0];

    const nameParts = emailName
        .replace(/[._-]+/g, " ")
        .split(" ")
        .filter(Boolean);

    let firstName = "";
    let surname = "";

    if (nameParts.length >= 1) {

        firstName =
            nameParts[0].charAt(0).toUpperCase() +
            nameParts[0].slice(1);

    }

    if (nameParts.length >= 2) {

        surname = nameParts
            .slice(1)
            .map(part =>
                part.charAt(0).toUpperCase() +
                part.slice(1)
            )
            .join(" ");

    }

    return { firstName, surname };

}


function renderProfilePage(res, user, extra = {}) {

    const { firstName, surname } = getProfileNameParts(user);

    return res.render("users/profile.ejs", {
        user,
        firstName,
        surname,
        ...extra
    });

}


function deletePublicFile(fileUrl) {

    if (!fileUrl) {
        return;
    }

    const filePath = path.join(
        __dirname,
        "../../public",
        fileUrl
    );

    if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
    }

}


// ========================================
// SIGN UP PAGE
// ========================================

router.get("/signup", (req, res) => {

    if (req.session.userId) {
        return res.redirect("/listings");
    }

    res.render("users/signup.ejs");

});


// ========================================
// SIGN UP
// ========================================

router.post("/signup", async (req, res) => {

    try {

        let email = req.body.email;
        let password = req.body.password;

        if (!email) {

            return res.render("users/signup.ejs", {
                error: "Please enter your Gmail ID."
            });

        }

        if (!password) {

            return res.render("users/signup.ejs", {
                error: "Please enter a password."
            });

        }

        email = email.trim().toLowerCase();

        if (!isValidGmail(email)) {

            return res.render("users/signup.ejs", {
                error: "Please enter a valid Gmail ID ending with @gmail.com."
            });

        }

        const existingUser = await User.findOne({
            email: email
        });

        if (existingUser) {

            return res.render("users/signup.ejs", {
                error: "This Gmail ID is already registered. Please log in."
            });

        }

        const hashedPassword = await bcrypt.hash(password, 10);

        const newUser = new User({
            email: email,
            password: hashedPassword
        });

        await newUser.save();

        req.session.userId = newUser._id;

        res.redirect("/listings");

    } catch (error) {

        console.log(error);

        res.render("users/signup.ejs", {
            error: "Unable to create account. Please try again."
        });

    }

});


// ========================================
// LOGIN PAGE
// ========================================

router.get("/login", (req, res) => {

    if (req.session.userId) {
        return res.redirect("/listings");
    }

    res.render("users/login.ejs");

});


// ========================================
// LOGIN
// ========================================

router.post("/login", async (req, res) => {

    try {

        let email = req.body.email;
        let password = req.body.password;
        const hostLogin = req.body.isHost === "on";

        if (!email) {

            return res.render("users/login.ejs", {
                error: "Please enter your Gmail ID."
            });

        }

        if (!password) {

            return res.render("users/login.ejs", {
                error: "Please enter your password."
            });

        }

        email = email.trim().toLowerCase();

        if (!isValidGmail(email)) {

            return res.render("users/login.ejs", {
                error: "Please enter a valid Gmail ID ending with @gmail.com."
            });

        }

        const user = await User.findOne({
            email: email
        });

        if (!user) {

            return res.render("users/login.ejs", {
                error: "No account found with this Gmail ID. Please sign up first."
            });

        }

        const passwordMatch = await bcrypt.compare(
            password,
            user.password
        );

        if (!passwordMatch) {

            return res.render("users/login.ejs", {
                error: "Incorrect password. Please try again."
            });

        }

        // Host login checkbox
        if (hostLogin && !user.isHost) {

            return res.render("users/login.ejs", {
                error: "You are not registered as a host. Please click 'Become a Host' first."
            });

        }

        req.session.userId = user._id;

        res.redirect("/listings");

    } catch (error) {

        console.log(error);

        res.render("users/login.ejs", {
            error: "Unable to log in. Please try again."
        });

    }

});


// ========================================
// BECOME A HOST PAGE
// ========================================

router.get("/host", (req, res) => {

    if (!req.session.userId) {
        return res.redirect("/users/login");
    }

    res.render("users/host.ejs");

});


// ========================================
// HOST DASHBOARD
// ========================================

const EXTRA_CARE_GROUPS = [
    {
        name: "DESERT & ARID REGION",
        locationKeywords: [
            "desert",
            "arid",
            "thar",
            "rajasthan",
            "jaisalmer",
            "bikaner"
        ],
        services: [
            "Tent & Canvas Cleaning",
            "AC Repair & Filter Cleaning",
            "Water Tanker Delivery",
            "Pest & Reptile Control"
        ]
    },
    {
        name: "HILLY & MOUNTAINOUS REGION",
        locationKeywords: [
            "hill",
            "mountain",
            "himalaya",
            "himachal",
            "uttarakhand",
            "sikkim",
            "kashmir",
            "ladakh",
            "manali"
        ],
        services: [
            "Chimney & Fireplace Service",
            "Roof & Gutter Repair",
            "Slope & Soil Stabilization",
            "Geyser & Boiler Repair"
        ]
    },
    {
        name: "RAINY, JUNGLE & FOREST REGION",
        locationKeywords: [
            "rainy",
            "jungle",
            "forest",
            "rainforest",
            "monsoon",
            "kerala",
            "assam",
            "meghalaya"
        ],
        services: [
            "Tree Care & Timber Treatment",
            "Mold & Damp Treatment",
            "Pest Control & Fogging",
            "Roof Waterproofing & Drainage"
        ]
    },
    {
        name: "BEACHFRONT & COASTAL REGION",
        locationKeywords: [
            "beach",
            "coast",
            "coastal",
            "seaside",
            "shoreline",
            "goa",
            "pondicherry",
            "puducherry",
            "andaman"
        ],
        services: [
            "Anti-Rust & Coating Treatment",
            "Sand & Deck Cleaning",
            "Storm Shutter Repair",
            "Anti-Mold Paint Service"
        ]
    },
    {
        name: "VILLA & RESORT AMENITIES",
        propertyKeywords: [
            "villa",
            "resort",
            "pool",
            "spa",
            "amenity",
            "amenities"
        ],
        services: [
            "Pool & Spa Maintenance",
            "Lawn Care & Landscaping",
            "CCTV & Security Repair"
        ]
    }
];


function determineExtraCare(listing) {

    const locationText =
        String(
            listing.location ||
            ""
        ).trim().toLowerCase();

    const propertyText = [
        listing.category,
        listing.propertyType,
        listing.propertyCategory,
        listing.type,
        listing.amenities
    ]
        .flatMap(value =>
            Array.isArray(value)
                ? value
                : [value]
        )
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

    const matchedGroups =
        EXTRA_CARE_GROUPS.filter(group =>
            (
                group.locationKeywords ||
                []
            ).some(keyword =>
                locationText.includes(keyword)
            ) ||
            (
                group.propertyKeywords ||
                []
            ).some(keyword =>
                propertyText.includes(keyword)
            )
        );

    const categoryNames =
        matchedGroups.map(group => group.name);

    const services = [
        ...new Set(
            matchedGroups.flatMap(
                group => group.services
            )
        )
    ];

    return {
        extraCareCategory:
            categoryNames.length
                ? categoryNames.join(", ")
                : null,

        extraCareServices:
            services
    };
}

router.get("/dashboard", async (req, res) => {

    try {

        if (!req.session.userId) {
            return res.redirect("/users/login");
        }

        const user = await User.findById(req.session.userId);

        if (!user) {

            req.session.destroy();

            return res.redirect("/users/login");

        }

        const selectedListingId =
            req.query.listingId ||
            req.query.listing;

        if (selectedListingId) {

            let listing;

            try {

                listing =
                    await Listing.findOne({
                        _id: selectedListingId,
                        host: user._id
                    });

            } catch (error) {

                return res.status(400).json({
                    success: false,
                    message: "A valid listing is required."
                });
            }

            if (!listing) {

                return res.status(404).json({
                    success: false,
                    message: "Listing not found for this host."
                });
            }

            const images =
                Array.isArray(listing.images)
                    ? [...listing.images]
                    : [];

            const defaultListingImage =
                "https://images.unsplash.com/photo-1552733407-5d5c46c3bb3b?auto=format&fit=crop&w=800&q=60";

            if (
                !images.length &&
                listing.image?.url
            ) {
                images.push(listing.image.url);
            } else if (
                listing.image?.url &&
                listing.image.url !== defaultListingImage &&
                !images.includes(listing.image.url)
            ) {
                images.unshift(listing.image.url);
            }

            const extraCare =
                determineExtraCare(listing);

            return res.json({
                success: true,
                listingId: listing._id,
                title: listing.title,
                location: listing.location,
                images,
                extraCareCategory:
                    extraCare.extraCareCategory,
                extraCareServices:
                    extraCare.extraCareServices
            });
        }

        const listings = await Listing.find({
            host: user._id
        });

        return res.render("users/dashboard.ejs", {
            user,
            listings
        });

    } catch (error) {

        console.log(error);

        return res.redirect("/listings");

    }

});


// ========================================
// CREATE HOST PROFILE
// ========================================

router.post(
    "/host",
    hostUpload.fields([
        {
            name: "profilePicture",
            maxCount: 1
        },
        {
            name: "idProof",
            maxCount: 1
        }
    ]),
    async (req, res) => {

        try {

            if (!req.session.userId) {
                return res.redirect("/users/login");
            }

            let email = req.body.email;
            let password = req.body.password;

            if (!email || !isValidGmail(email)) {

                return res.render("users/host.ejs", {
                    error: "Please enter a valid Gmail ID ending with @gmail.com."
                });

            }

            email = email.trim().toLowerCase();

            const user = await User.findById(req.session.userId);

            if (!user) {
                return res.redirect("/users/login");
            }

            // Verify host profile password
            const passwordMatch = await bcrypt.compare(
                password,
                user.password
            );

            if (!passwordMatch) {

                return res.render("users/host.ejs", {
                    error: "Incorrect password."
                });

            }

            if (user.email !== email) {

                return res.render("users/host.ejs", {
                    error: "The Gmail ID does not match your account."
                });

            }

            user.isHost = true;

            user.country = req.body.country || "";
            user.city = req.body.city || "";
            user.hostPhone = req.body.phone || "";
            user.hostService = req.body.service || "";

            if (
                req.files &&
                req.files.profilePicture &&
                req.files.profilePicture[0]
            ) {

                user.profilePicture =
                    "/uploads/" +
                    req.files.profilePicture[0].filename;

            }

            if (
                req.files &&
                req.files.idProof &&
                req.files.idProof[0]
            ) {

                user.idProof =
                    "/uploads/" +
                    req.files.idProof[0].filename;

            }

            await user.save();

            req.session.userId = user._id;

            res.redirect("/listings");

        } catch (error) {

            console.log(error);

            res.render("users/host.ejs", {
                error: "Unable to create host profile. Please try again."
            });

        }

    }
);


// ========================================
// PROFILE PAGE
// ========================================

router.get("/profile", async (req, res) => {

    try {

        if (!req.session.userId) {
            return res.redirect("/users/login");
        }

        const user = await User.findById(req.session.userId);

        if (!user) {

            req.session.destroy();

            return res.redirect("/users/login");

        }

        return renderProfilePage(res, user);

    } catch (error) {

        console.log(error);

        res.redirect("/listings");

    }

});


// ========================================
// UPDATE PROFILE
// ========================================

router.post(
    "/profile",
    hostUpload.fields([
        {
            name: "profilePicture",
            maxCount: 1
        },
        {
            name: "idProof",
            maxCount: 1
        }
    ]),
    async (req, res) => {

        try {

            if (!req.session.userId) {
                return res.redirect("/users/login");
            }

            const user = await User.findById(req.session.userId);

            if (!user) {

                req.session.destroy();

                return res.redirect("/users/login");

            }

            let email = req.body.email;

            if (!email || !isValidGmail(email)) {

                return renderProfilePage(res, user, {
                    error: "Please enter a valid Gmail ID ending with @gmail.com."
                });

            }

            email = email.trim().toLowerCase();

            if (email !== user.email) {

                const existingUser = await User.findOne({
                    email: email
                });

                if (existingUser) {

                    return renderProfilePage(res, user, {
                        error: "This Gmail ID is already registered."
                    });

                }

                user.email = email;

            }

            if (req.body.password && req.body.password.trim()) {

                user.password = await bcrypt.hash(
                    req.body.password.trim(),
                    10
                );

            }

            user.country = req.body.country || "";
            user.city = req.body.city || "";

            if (req.body.hostName !== undefined) {
                user.hostName = req.body.hostName.trim();
            }

            if (req.body.hostDescription !== undefined) {
                user.hostDescription = req.body.hostDescription.trim();
            }

            if (user.isHost) {

                user.hostPhone = req.body.phone || "";
                user.hostService = req.body.service || "";

            }

            if (
                req.files &&
                req.files.profilePicture &&
                req.files.profilePicture[0]
            ) {

                deletePublicFile(user.profilePicture);

                user.profilePicture =
                    "/uploads/" +
                    req.files.profilePicture[0].filename;

            }

            if (
                user.isHost &&
                req.files &&
                req.files.idProof &&
                req.files.idProof[0]
            ) {

                deletePublicFile(user.idProof);

                user.idProof =
                    "/uploads/" +
                    req.files.idProof[0].filename;

            }

            await user.save();

            res.redirect("/users/profile");

        } catch (error) {

            console.log(error);

            res.redirect("/users/profile");

        }

    }
);


// ========================================
// DELETE PROFILE
// ========================================

router.post("/delete", async (req, res) => {

    try {

        if (!req.session.userId) {
            return res.redirect("/users/login");
        }

        const user = await User.findById(req.session.userId);

        if (user) {

            if (user.profilePicture) {

                const picturePath = path.join(
                    __dirname,
                    "../../public",
                    user.profilePicture
                );

                if (fs.existsSync(picturePath)) {
                    fs.unlinkSync(picturePath);
                }

            }

            if (user.idProof) {

                const idProofPath = path.join(
                    __dirname,
                    "../../public",
                    user.idProof
                );

                if (fs.existsSync(idProofPath)) {
                    fs.unlinkSync(idProofPath);
                }

            }

            const hostListings = await Listing.find({
                host: user._id
            });

            const listingIds = hostListings.map(
                listing => listing._id
            );
            // Delete all reviews written by this user
            await Review.deleteMany({
            user: user._id
            });

            if (listingIds.length > 0) {

                await Review.deleteMany({
                    listing: {
                        $in: listingIds
                    }
                });

                await Listing.deleteMany({
                    host: user._id
                });

            }

            await User.findByIdAndDelete(user._id);

        }

        req.session.destroy(() => {

            res.redirect("/listings");

        });

    } catch (error) {

        console.log(error);

        res.redirect("/users/profile");

    }

});


// ========================================
// LOGOUT
// ========================================

router.get("/logout", (req, res) => {

    req.session.destroy((error) => {

        if (error) {
            console.log(error);
        }

        res.redirect("/listings");

    });

});


module.exports = router;