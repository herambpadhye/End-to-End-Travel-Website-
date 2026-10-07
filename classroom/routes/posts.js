const express = require("express");
const router = express.Router();

const Listing = require("../../models/list.js");
const Review = require("../../models/review.js");

// ========================================
// MULTER + CLOUDINARY IMAGE UPLOAD
// ========================================

const multer = require("multer");
const cloudinary = require("../../config/cloudinary.js");


// ========================================
// MULTER MEMORY STORAGE
// ========================================

const storage =
    multer.memoryStorage();


// ========================================
// MULTER
// ========================================

const upload =
    multer({

        storage: storage,

        fileFilter: function (req, file, cb) {

            const allowedTypes = [
                "image/jpeg",
                "image/png",
                "image/webp",
                "image/gif",
                "image/avif"
            ];


            if (
                allowedTypes.includes(
                    file.mimetype
                )
            ) {

                cb(
                    null,
                    true
                );

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


// ========================================
// CLOUDINARY UPLOAD HELPER
// ========================================
//
// Uploads image buffer directly to Cloudinary.
// No Base64 conversion is used.
//

function uploadToCloudinary(file) {

    return new Promise(
        (resolve, reject) => {

            if (
                !file ||
                !file.buffer
            ) {

                return reject(
                    new Error(
                        "Image buffer is missing."
                    )
                );

            }


            const uploadStream =
                cloudinary
                    .uploader
                    .upload_stream(

                        {

                            folder:
                                "wanderlust/listings",

                            resource_type:
                                "image",

                            timeout:
                                120000

                        },

                        function (
                            error,
                            result
                        ) {

                            if (error) {

                                return reject(
                                    error
                                );

                            }


                            if (!result) {

                                return reject(
                                    new Error(
                                        "Cloudinary returned no upload result."
                                    )
                                );

                            }


                            resolve(
                                result
                            );

                        }

                    );


            uploadStream.on(
                "error",
                function (error) {

                    reject(
                        error
                    );

                }
            );


            uploadStream.end(
                file.buffer
            );

        }
    );

}


// ========================================
// ASYNC WRAPPER
// ========================================

const wrapAsync =
    (fn) => {

        return function (
            req,
            res,
            next
        ) {

            fn(
                req,
                res,
                next
            ).catch(next);

        };

    };


// ========================================
// CUSTOM ERROR
// ========================================

class ExpressError extends Error {

    constructor(
        statusCode,
        message
    ) {

        super();

        this.statusCode =
            statusCode;

        this.message =
            message;

    }

}


// ========================================
// CONVERT LOCATION TO COORDINATES
// ========================================

async function getCoordinates(
    location,
    country
) {

    if (!location) {

        return null;

    }


    const searchQuery =
        country
            ? `${location}, ${country}`
            : location;


    const url =
        `https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(searchQuery)}`;


    const controller =
        new AbortController();


    const timeout =
        setTimeout(
            () => {

                controller.abort();

            },
            5000
        );


    try {

        const response =
            await fetch(
                url,
                {

                    headers: {

                        "User-Agent":
                            "Wanderlust-Major-Project/1.0"

                    },

                    signal:
                        controller.signal

                }
            );


        if (!response.ok) {

            throw new Error(
                "Unable to find location on map"
            );

        }


        const data =
            await response.json();


        if (
            !data ||
            data.length === 0
        ) {

            return null;

        }


        return {

            lat:
                Number(
                    data[0].lat
                ),

            lng:
                Number(
                    data[0].lon
                )

        };

    } finally {

        clearTimeout(
            timeout
        );

    }

}


// ========================================
// INDEX
// ========================================

router.get(
    "/",

    wrapAsync(
        async (
            req,
            res
        ) => {

            const allListings =
                await Listing.find({});


            res.render(
                "listings/index.ejs",
                {
                    allListings
                }
            );

        }
    )
);


// ========================================
// NEW
// ========================================

router.get(
    "/new",

    (req, res) => {

        // Only logged-in users can access
        // Add New Listing

        if (
            !req.session.userId
        ) {

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

    wrapAsync(
        async (
            req,
            res
        ) => {

            // User must be logged in

            if (
                !req.session.userId
            ) {

                return res.redirect(
                    "/users/login"
                );

            }


            const { id } =
                req.params;


            const comment =
                req.body.comment;


            const rating =
                Number(
                    req.body.rating
                );


            const listing =
                await Listing.findById(
                    id
                );


            if (!listing) {

                throw new ExpressError(
                    404,
                    "Listing Not Found"
                );

            }


            // Validate comment

            if (
                !comment ||
                !comment.trim()
            ) {

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

            res.redirect(
                "/listings"
            );

        }
    )
);


// ========================================
// DELETE REVIEW
// ========================================

router.delete(
    "/:listingId/reviews/:reviewId",

    wrapAsync(
        async (
            req,
            res
        ) => {

            // User must be logged in

            if (
                !req.session.userId
            ) {

                return res.redirect(
                    "/users/login"
                );

            }


            const {
                listingId,
                reviewId
            } =
                req.params;


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

        }
    )
);


// ========================================
// SHOW
// ========================================

router.get(
    "/:id",

    wrapAsync(
        async (
            req,
            res
        ) => {

            const { id } =
                req.params;


            const listing =
                await Listing.findById(
                    id
                )
                .populate("host");


            if (!listing) {

                throw new ExpressError(
                    404,
                    "Listing Not Found"
                );

            }


            // ========================================
            // OLD LISTINGS WITHOUT COORDINATES
            // ========================================

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


            // ========================================
            // LISTING POSTED DATE
            // ========================================

            let listingPostedDate =
                "";

            let hostWhatsAppLink =
                "";

            let hostDisplayName =
                "Host";


            const postedDateValue =
                listing.postedAt ||
                listing._id.getTimestamp();


            listingPostedDate =
                new Date(
                    postedDateValue
                )
                .toLocaleDateString(
                    "en-IN",
                    {

                        day:
                            "numeric",

                        month:
                            "long",

                        year:
                            "numeric"

                    }
                );


            // ========================================
            // HOST NAME
            // ========================================

            if (listing.host) {

                const savedHostName =
                    (
                        listing.host.hostName ||
                        ""
                    ).trim();


                if (savedHostName) {

                    hostDisplayName =
                        savedHostName;

                }

            }


            // ========================================
            // HOST WHATSAPP
            // ========================================

            if (
                listing.host &&
                listing.host.hostPhone
            ) {

                let whatsappNumber =
                    listing.host.hostPhone
                        .replace(
                            /\D/g,
                            ""
                        );


                if (
                    whatsappNumber.length === 10
                ) {

                    whatsappNumber =
                        "91" +
                        whatsappNumber;

                }


                if (whatsappNumber) {

                    hostWhatsAppLink =
                        "https://wa.me/" +
                        whatsappNumber;

                }

            }


            // ========================================
            // RENDER SHOW PAGE
            // ========================================

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

        }
    )
);


// ========================================
// CREATE
// ========================================

router.post(
    "/",

    upload.array(
        "listingImages",
        16
    ),

    wrapAsync(
        async (
            req,
            res
        ) => {

            // ========================================
            // AUTHENTICATION
            // ========================================

            if (
                !req.session.userId
            ) {

                return res.redirect(
                    "/users/login"
                );

            }


            // ========================================
            // FORM DATA
            // ========================================

            const listingData =
                req.body.listing;


            if (!listingData) {

                return res.redirect(
                    "/listings/new"
                );

            }


            // ========================================
            // CLOUDINARY IMAGE UPLOADS
            // ========================================
            //
            // All images upload in parallel.
            //

            let uploadedImages =
                [];


            if (
                req.files &&
                req.files.length > 0
            ) {

                console.log(
                    "Starting parallel Cloudinary uploads..."
                );


                uploadedImages =
                    await Promise.all(

                        req.files.map(
                            file =>
                                uploadToCloudinary(
                                    file
                                )
                        )

                    );


                console.log(
                    "All Cloudinary uploads completed."
                );

            }


            // ========================================
            // CREATE LISTING DATA
            // ========================================

            // FIX:
            // Amenities are submitted using
            // name="listing[amenities]" in new.ejs.
            // Therefore they are available inside
            // req.body.listing.amenities.

            const submittedAmenities =
                listingData.amenities;


            const amenities =
                Array.isArray(submittedAmenities)
                    ? submittedAmenities
                    : typeof submittedAmenities === "string"
                        ? [submittedAmenities]
                        : [];


            const newListingData = {

                ...listingData,

                amenities,

                host:
                    req.session.userId

            };


            // ========================================
            // SAVE CLOUDINARY IMAGE DATA
            // ========================================

            if (
                uploadedImages.length > 0
            ) {

                const imagePaths =
                    uploadedImages.map(
                        image =>
                            image.secure_url
                    );


                newListingData.images =
                    imagePaths;


                newListingData.image = {

                    url:
                        imagePaths[0],

                    filename:
                        uploadedImages[0]
                            .public_id

                };

            }


            // ========================================
            // SAVE LISTING TO MONGODB
            // ========================================

            const newListing =
                new Listing(
                    newListingData
                );


            await newListing.save();


            console.log(
                "Listing saved:",
                newListing._id
            );


            // ========================================
            // REDIRECT USER IMMEDIATELY
            // ========================================

            res.redirect(
                "/listings"
            );


            // ========================================
            // MAP COORDINATES IN BACKGROUND
            // ========================================

            setImmediate(
                () => {

                    getCoordinates(
                        listingData.location,
                        listingData.country
                    )

                    .then(
                        async coordinates => {

                            if (
                                coordinates
                            ) {

                                await Listing.findByIdAndUpdate(

                                    newListing._id,

                                    {
                                        coordinates
                                    },

                                    {
                                        runValidators:
                                            true
                                    }

                                );

                            }

                        }
                    )

                    .catch(
                        error => {

                            console.log(
                                "Map location error:",
                                error.message
                            );

                        }
                    );

                }
            );

        }
    )
);


// ========================================
// EDIT
// ========================================

router.get(
    "/:id/edit",

    wrapAsync(
        async (
            req,
            res
        ) => {

            if (
                !req.session.userId
            ) {

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
                await Listing.findById(
                    id
                );


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

        }
    )
);


// ========================================
// UPDATE
// ========================================

router.put(
    "/:id",

    upload.array(
        "listingImages",
        16
    ),

    wrapAsync(
        async (
            req,
            res
        ) => {

            if (
                !req.session.userId
            ) {

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
                await Listing.findById(
                    id
                );


            if (!existingListing) {

                throw new ExpressError(
                    404,
                    "Listing Not Found"
                );

            }


            // ========================================
            // UPDATE COORDINATES
            // ========================================

            let coordinates =
                null;


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

            if (
                req.files &&
                req.files.length > 0
            ) {

                console.log(
                    "Starting parallel Cloudinary uploads for update..."
                );


                const uploadedImages =
                    await Promise.all(

                        req.files.map(
                            file =>
                                uploadToCloudinary(
                                    file
                                )
                        )

                    );


                console.log(
                    "All update Cloudinary uploads completed."
                );


                const imagePaths =
                    uploadedImages.map(
                        image =>
                            image.secure_url
                    );


                updateData.images =
                    imagePaths;


                // Keep old single image field
                // for backward compatibility

                updateData.image = {

                    url:
                        imagePaths[0],

                    filename:
                        uploadedImages[0]
                            .public_id

                };

            }


            // ========================================
            // SAVE UPDATE
            // ========================================

            await Listing.findByIdAndUpdate(
                id,
                updateData,
                {
                    runValidators:
                        true
                }
            );


            // ========================================
            // REDIRECT
            // ========================================

            res.redirect(
                `/listings/${id}`
            );

        }
    )
);


// ========================================
// DELETE
// ========================================

router.delete(
    "/:id",

    wrapAsync(
        async (
            req,
            res
        ) => {

            if (
                !req.session.userId
            ) {

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

                listing:
                    id

            });


            res.redirect(
                "/listings"
            );

        }
    )
);


// ========================================
// EXPORT ROUTER
// ========================================

module.exports = router;