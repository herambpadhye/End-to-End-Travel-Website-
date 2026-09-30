const express = require("express");
const router = express.Router();

const Listing = require("../../models/list.js");
const Review = require("../../models/review.js");

// ========================================
// MULTER IMAGE UPLOAD
// ========================================

const multer = require("multer");
const path = require("path");
const fs = require("fs");

const uploadPath = path.join(__dirname, "../../public/uploads");

if (!fs.existsSync(uploadPath)) {
    fs.mkdirSync(uploadPath, { recursive: true });
}

const storage = multer.diskStorage({

    destination: function (req, file, cb) {

        cb(
            null,
            uploadPath
        );

    },

    filename: function (req, file, cb) {

        const uniqueName =
            Date.now() +
            "-" +
            Math.round(Math.random() * 1e9) +
            path.extname(file.originalname);

        cb(null, uniqueName);

    }

});


const upload = multer({

    storage: storage,

    fileFilter: function (req, file, cb) {

        const allowedTypes = [
            "image/jpeg",
            "image/png",
            "image/webp",
            "image/gif",
            "image/avif"
        ];

        if (allowedTypes.includes(file.mimetype)) {

            cb(null, true);

        } else {

            cb(
                new Error(
                    "Only JPG, JPEG, PNG, WEBP, GIF or AVIF images are allowed."
                )
            );

        }

    },

    limits: {
        files: 16
    }

});


// 🔥 Async Wrapper

const wrapAsync = (fn) => {

    return function (req, res, next) {

        fn(req, res, next).catch(next);

    };

};


// 🔥 Custom Error

class ExpressError extends Error {

    constructor(statusCode, message) {

        super();

        this.statusCode = statusCode;
        this.message = message;

    }

}


// 🌍 Convert location into latitude and longitude

async function getCoordinates(location, country) {

    if (!location) return null;

    const searchQuery = country
        ? `${location}, ${country}`
        : location;

    const url =
        `https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(searchQuery)}`;

    const response = await fetch(url, {

        headers: {
            "User-Agent": "Wanderlust-Major-Project/1.0"
        }

    });

    if (!response.ok) {

        throw new Error(
            "Unable to find location on map"
        );

    }

    const data = await response.json();

    if (!data || data.length === 0) {

        return null;

    }

    return {

        lat: Number(data[0].lat),

        lng: Number(data[0].lon)

    };

}


// ========================================
// INDEX
// ========================================

router.get(
    "/",
    wrapAsync(async (req, res) => {

        const allListings =
            await Listing.find({});

        res.render(
            "listings/index.ejs",
            { allListings }
        );

    })
);


// ========================================
// NEW
// ========================================

router.get(
    "/new",
    (req, res) => {

        // Only logged-in users can access Add New Listing

        if (!req.session.userId) {

            return res.redirect(
                "/users/login"
            );

        }

        res.render(
            "listings/new.ejs"
        );

    }
);


// ========================================
// ADD REVIEW
// ========================================

router.post(
    "/:id/reviews",
    wrapAsync(async (req, res) => {

        // User must be logged in

        if (!req.session.userId) {

            return res.redirect(
                "/users/login"
            );

        }

        const { id } = req.params;

        const comment =
            req.body.comment;

        const rating =
            Number(req.body.rating);

        const listing =
            await Listing.findById(id);

        if (!listing) {

            throw new ExpressError(
                404,
                "Listing Not Found"
            );

        }


        // Validate comment

        if (!comment || !comment.trim()) {

            return res.redirect(
                `/listings/${id}`
            );

        }


        // Validate rating

        if (
            !rating ||
            rating < 0.5 ||
            rating > 5 ||
            rating % 0.5 !== 0
        ) {

            return res.redirect(
                `/listings/${id}`
            );

        }


        const newReview =
            new Review({

                comment:
                    comment.trim(),

                rating:
                    rating,

                listing:
                    listing._id,

                user:
                    req.session.userId

            });


        await newReview.save();


        // After submitting review
        // redirect to All Listings

        res.redirect("/listings");

    })
);


// ========================================
// DELETE REVIEW
// ========================================

router.delete(
    "/:listingId/reviews/:reviewId",
    wrapAsync(async (req, res) => {

        // User must be logged in

        if (!req.session.userId) {

            return res.redirect(
                "/users/login"
            );

        }

        const {
            listingId,
            reviewId
        } = req.params;


        const review =
            await Review.findById(
                reviewId
            );


        if (!review) {

            return res.redirect(
                `/listings/${listingId}`
            );

        }


        // Only the user who created
        // the review can delete it

        if (
            review.user.toString() !==
            req.session.userId.toString()
        ) {

            return res.redirect(
                `/listings/${listingId}`
            );

        }


        await Review.findByIdAndDelete(
            reviewId
        );


        res.redirect(
            `/listings/${listingId}`
        );

    })
);


// ========================================
// SHOW
// ========================================

router.get(
    "/:id",
    wrapAsync(async (req, res) => {

        const { id } = req.params;

        const listing =
            await Listing.findById(id)
                .populate("host");


        if (!listing) {

            throw new ExpressError(
                404,
                "Listing Not Found"
            );

        }


        // If an old listing doesn't have
        // coordinates, find them once

        if (
            listing.location &&
            (
                !listing.coordinates ||
                listing.coordinates.lat === undefined ||
                listing.coordinates.lng === undefined
            )
        ) {

            try {

                const coordinates =
                    await getCoordinates(
                        listing.location,
                        listing.country
                    );


                if (coordinates) {

                    listing.coordinates =
                        coordinates;

                    await listing.save();

                }

            } catch (error) {

                console.log(
                    "Map location error:",
                    error.message
                );

            }

        }


        // ========================================
        // GET REVIEWS
        // ========================================

        const reviews =
            await Review.find({

                listing:
                    listing._id

            })
            .populate("user")
            .sort({
                createdAt: -1
            });


        let listingPostedDate = "";
        let hostWhatsAppLink = "";
        let hostDisplayName = "Host";

        const postedDateValue =
            listing.postedAt ||
            listing._id.getTimestamp();

        listingPostedDate =
            new Date(postedDateValue)
                .toLocaleDateString(
                    "en-IN",
                    {
                        day: "numeric",
                        month: "long",
                        year: "numeric"
                    }
                );

        if (listing.host) {

            const savedHostName =
                (listing.host.hostName || "").trim();

            if (savedHostName) {
                hostDisplayName = savedHostName;
            }

        }

        if (
            listing.host &&
            listing.host.hostPhone
        ) {

            let whatsappNumber =
                listing.host.hostPhone
                    .replace(/\D/g, "");

            if (
                whatsappNumber.length === 10
            ) {

                whatsappNumber =
                    "91" + whatsappNumber;

            }

            if (whatsappNumber) {

                hostWhatsAppLink =
                    "https://wa.me/" +
                    whatsappNumber;

            }

        }


        res.render(
            "listings/show.ejs",
            {
                listing,
                reviews,
                listingPostedDate,
                hostWhatsAppLink,
                hostDisplayName
            }
        );

    })
);


// ========================================
// CREATE
// ========================================

router.post(
    "/",
    upload.array("listingImages", 16),

    wrapAsync(async (req, res) => {

        // Only logged-in users can create listing

        if (!req.session.userId) {

            return res.redirect(
                "/users/login"
            );

        }

        const listingData =
            req.body.listing;


        if (!listingData) {

            return res.redirect(
                "/listings/new"
            );

        }


        // Get coordinates from entered location

        let coordinates = null;

        try {

            coordinates =
                await getCoordinates(
                    listingData.location,
                    listingData.country
                );

        } catch (error) {

            console.log(
                "Map location error:",
                error.message
            );

        }


        const newListingData = {

            ...listingData,

            host:
                req.session.userId,

            coordinates:
                coordinates ||
                undefined

        };


        if (
            req.files &&
            req.files.length > 0
        ) {

            const imagePaths =
                req.files.map(
                    file =>
                        "/uploads/" +
                        file.filename
                );

            newListingData.images =
                imagePaths;

            newListingData.image = {

                url:
                    imagePaths[0],

                filename:
                    req.files[0].filename

            };

        } else if (listingData.image) {

            newListingData.image = {

                url:
                    listingData.image,

                filename:
                    "custom"

            };

        }


        const newListing =
            new Listing(
                newListingData
            );


        await newListing.save();


        res.redirect(
            "/listings"
        );

    })
);


// ========================================
// EDIT
// ========================================

router.get(
    "/:id/edit",
    wrapAsync(async (req, res) => {

        if (!req.session.userId) {

            return res.redirect(
                "/users/login"
            );

        }

        if (
            !res.locals.currentUser ||
            !res.locals.currentUser.isHost
        ) {

            return res.redirect(
                `/listings/${req.params.id}`
            );

        }

        const { id } =
            req.params;


        const listing =
            await Listing.findById(id);


        if (!listing) {

            throw new ExpressError(
                404,
                "Listing Not Found"
            );

        }


        res.render(
            "listings/edit.ejs",
            {
                listing
            }
        );

    })
);


// ========================================
// UPDATE
// ========================================

router.put(
    "/:id",
    upload.array("listingImages", 16),

    wrapAsync(async (req, res) => {

        if (!req.session.userId) {

            return res.redirect(
                "/users/login"
            );

        }

        if (
            !res.locals.currentUser ||
            !res.locals.currentUser.isHost
        ) {

            return res.redirect(
                `/listings/${req.params.id}`
            );

        }

        const { id } =
            req.params;


        const listingData =
            req.body.listing;


        const existingListing =
            await Listing.findById(id);


        if (!existingListing) {

            throw new ExpressError(
                404,
                "Listing Not Found"
            );

        }


        // ========================================
        // UPDATE COORDINATES
        // ========================================

        let coordinates = null;

        try {

            coordinates =
                await getCoordinates(
                    listingData.location,
                    listingData.country
                );

        } catch (error) {

            console.log(
                "Map location error:",
                error.message
            );

        }


        // ========================================
        // BASIC LISTING UPDATE
        // ========================================

        const updateData = {

            ...listingData,

            coordinates:
                coordinates ||
                existingListing.coordinates ||
                undefined

        };


        // ========================================
        // NEW IMAGE UPLOAD
        // ========================================

        /*
         * If new images are selected,
         * replace the existing images.
         */

        if (
            req.files &&
            req.files.length > 0
        ) {

            const imagePaths =
                req.files.map(
                    file =>
                        "/uploads/" +
                        file.filename
                );


            updateData.images =
                imagePaths;


            // Keep old single image field
            // for backward compatibility

            updateData.image = {

                url:
                    imagePaths[0],

                filename:
                    req.files[0].filename

            };

        }


        /*
         * If no new images are selected,
         * existing images remain unchanged.
         */


        await Listing.findByIdAndUpdate(
            id,
            updateData,
            {
                runValidators: true
            }
        );


        res.redirect(
            `/listings/${id}`
        );

    })
);


// ========================================
// DELETE
// ========================================

router.delete(
    "/:id",
    wrapAsync(async (req, res) => {

        if (!req.session.userId) {

            return res.redirect(
                "/users/login"
            );

        }

        if (
            !res.locals.currentUser ||
            !res.locals.currentUser.isHost
        ) {

            return res.redirect(
                `/listings/${req.params.id}`
            );

        }

        const { id } =
            req.params;


        const deletedListing =
            await Listing.findByIdAndDelete(
                id
            );


        if (!deletedListing) {

            throw new ExpressError(
                404,
                "Listing Not Found"
            );

        }


        // Delete reviews belonging
        // to deleted listing

        await Review.deleteMany({

            listing: id

        });


        res.redirect(
            "/listings"
        );

    })
);


module.exports = router;
