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
    "/:id/booking",

    wrapAsync(
        async (
            req,
            res
        ) => {

            const { id } =
                req.params;

            if (!/^[a-f\d]{24}$/i.test(id)) {

                throw new ExpressError(
                    404,
                    "Listing Not Found"
                );

            }

            function getQueryValue(name) {
                const value = req.query[name];
                return typeof value === "string" ? value : "";
            }

            function isValidBookingDate(value) {
                if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
                    return false;
                }

                const [year, month, day] =
                    value.split("-").map(Number);
                const date =
                    new Date(Date.UTC(year, month - 1, day));

                return (
                    date.getUTCFullYear() === year &&
                    date.getUTCMonth() === month - 1 &&
                    date.getUTCDate() === day
                );
            }

            function parseGuestCount(name) {
                const value = getQueryValue(name);

                if (!/^\d+$/.test(value)) {
                    throw new ExpressError(
                        400,
                        `Please provide a valid ${name} count.`
                    );
                }

                const count = Number(value);

                if (!Number.isSafeInteger(count)) {
                    throw new ExpressError(
                        400,
                        `Please provide a valid ${name} count.`
                    );
                }

                return count;
            }

            const checkIn =
                getQueryValue("checkIn");
            const checkOut =
                getQueryValue("checkOut");

            if (
                !isValidBookingDate(checkIn) ||
                !isValidBookingDate(checkOut)
            ) {
                throw new ExpressError(
                    400,
                    "Please select valid check-in and checkout dates."
                );
            }

            const [checkInYear, checkInMonth, checkInDay] =
                checkIn.split("-").map(Number);
            const [checkOutYear, checkOutMonth, checkOutDay] =
                checkOut.split("-").map(Number);
            const checkInDate =
                new Date(checkInYear, checkInMonth - 1, checkInDay);
            const today = new Date();
            today.setHours(0, 0, 0, 0);

            if (checkInDate < today) {
                throw new ExpressError(
                    400,
                    "Check-in cannot be in the past."
                );
            }

            const checkInTime =
                Date.UTC(checkInYear, checkInMonth - 1, checkInDay);
            const checkOutTime =
                Date.UTC(checkOutYear, checkOutMonth - 1, checkOutDay);
            const nights =
                (checkOutTime - checkInTime) / 86400000;

            if (!Number.isInteger(nights) || nights < 1) {
                throw new ExpressError(
                    400,
                    "Checkout must be after check-in."
                );
            }

            const adults =
                parseGuestCount("adults");
            const children =
                parseGuestCount("children");
            const pets =
                parseGuestCount("pets");

            if (adults < 1) {
                throw new ExpressError(
                    400,
                    "At least one adult is required."
                );
            }

            if (children < 0 || pets < 0) {
                throw new ExpressError(
                    400,
                    "Children and pets must be non-negative."
                );
            }

            if (adults + children > 16) {
                throw new ExpressError(
                    400,
                    "The total number of adults and children cannot exceed 16."
                );
            }

            if (pets > 10) {
                throw new ExpressError(
                    400,
                    "The number of pets cannot exceed 10."
                );
            }

            const bookingUrl =
                new URL(
                    `/listings/${id}/booking`,
                    "http://localhost"
                );
            bookingUrl.searchParams.set("checkIn", checkIn);
            bookingUrl.searchParams.set("checkOut", checkOut);
            bookingUrl.searchParams.set("adults", String(adults));
            bookingUrl.searchParams.set("children", String(children));
            bookingUrl.searchParams.set("pets", String(pets));

            const listing =
                await Listing.findById(id);

            if (!listing) {
                throw new ExpressError(
                    404,
                    "Listing Not Found"
                );
            }

            const nightlyPrice =
                Number(listing.price);

            if (!Number.isFinite(nightlyPrice) || nightlyPrice < 0) {
                throw new ExpressError(
                    500,
                    "Listing price is unavailable."
                );
            }

            const returnTo =
                bookingUrl.pathname + bookingUrl.search;
            const loginUrl =
                `/users/login?returnTo=${encodeURIComponent(returnTo)}`;
            const signupUrl =
                `/users/signup?returnTo=${encodeURIComponent(returnTo)}`;

            res.render(
                "listings/booking.ejs",
                {
                    listing,
                    checkIn,
                    checkOut,
                    adults,
                    children,
                    pets,
                    nights,
                    subtotal: nightlyPrice * nights,
                    returnTo,
                    loginUrl,
                    signupUrl,
                    isAuthenticated: Boolean(req.session.userId)
                }
            );

        }
    )
);


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

            const nearbyOriginLatitude =
                Number(listing.coordinates && listing.coordinates.lat);
            const nearbyOriginLongitude =
                Number(listing.coordinates && listing.coordinates.lng);
            const hasValidNearbyOrigin =
                listing.coordinates &&
                listing.coordinates.lat !== null &&
                listing.coordinates.lat !== undefined &&
                String(listing.coordinates.lat).trim() !== "" &&
                listing.coordinates.lng !== null &&
                listing.coordinates.lng !== undefined &&
                String(listing.coordinates.lng).trim() !== "" &&
                Number.isFinite(nearbyOriginLatitude) &&
                nearbyOriginLatitude >= -90 &&
                nearbyOriginLatitude <= 90 &&
                Number.isFinite(nearbyOriginLongitude) &&
                nearbyOriginLongitude >= -180 &&
                nearbyOriginLongitude <= 180;


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

            let nearbyListings = [];

            if (hasValidNearbyOrigin) {
                const listingsWithCoordinates =
                    await Listing.find(
                        {
                            _id: { $ne: listing._id }
                        },
                        {
                            title: 1,
                            images: 1,
                            image: 1,
                            price: 1,
                            location: 1,
                            coordinates: 1
                        }
                    ).lean();

                const toRadians =
                    degrees => degrees * Math.PI / 180;
                const earthRadiusKm = 6371.0088;

                nearbyListings =
                    listingsWithCoordinates
                        .map(nearbyListing => {
                            const latitude =
                                Number(
                                    nearbyListing.coordinates &&
                                    nearbyListing.coordinates.lat
                                );
                            const longitude =
                                Number(
                                    nearbyListing.coordinates &&
                                    nearbyListing.coordinates.lng
                                );
                            const hasValidCoordinates =
                                nearbyListing.coordinates &&
                                nearbyListing.coordinates.lat !== null &&
                                nearbyListing.coordinates.lat !== undefined &&
                                String(nearbyListing.coordinates.lat).trim() !== "" &&
                                nearbyListing.coordinates.lng !== null &&
                                nearbyListing.coordinates.lng !== undefined &&
                                String(nearbyListing.coordinates.lng).trim() !== "" &&
                                Number.isFinite(latitude) &&
                                latitude >= -90 &&
                                latitude <= 90 &&
                                Number.isFinite(longitude) &&
                                longitude >= -180 &&
                                longitude <= 180;

                            if (!hasValidCoordinates) {
                                return null;
                            }

                            const latitudeDifference =
                                toRadians(latitude - nearbyOriginLatitude);
                            const longitudeDifference =
                                toRadians(longitude - nearbyOriginLongitude);
                            const haversine =
                                Math.min(
                                    1,
                                    Math.sin(latitudeDifference / 2) ** 2 +
                                    Math.cos(toRadians(nearbyOriginLatitude)) *
                                    Math.cos(toRadians(latitude)) *
                                    Math.sin(longitudeDifference / 2) ** 2
                                );
                            const distanceKm =
                                2 *
                                earthRadiusKm *
                                Math.atan2(
                                    Math.sqrt(haversine),
                                    Math.sqrt(1 - haversine)
                                );

                            if (distanceKm < 5) {
                                return null;
                            }

                            return {
                                ...nearbyListing,
                                distanceKm
                            };
                        })
                        .filter(Boolean)
                        .sort(
                            (first, second) =>
                                first.distanceKm - second.distanceKm
                        )
                        .slice(0, 10);

                if (nearbyListings.length) {
                    const ratingSummaries =
                        await Review.aggregate([
                            {
                                $match: {
                                    listing: {
                                        $in: nearbyListings.map(item => item._id)
                                    }
                                }
                            },
                            {
                                $group: {
                                    _id: "$listing",
                                    rating: { $avg: "$rating" },
                                    reviewCount: { $sum: 1 }
                                }
                            }
                        ]);
                    const ratingsByListingId =
                        new Map(
                            ratingSummaries.map(summary => [
                                String(summary._id),
                                {
                                    rating: summary.rating,
                                    reviewCount: summary.reviewCount
                                }
                            ])
                        );

                    nearbyListings =
                        nearbyListings.map(item => ({
                            ...item,
                            ...(ratingsByListingId.get(String(item._id)) || {
                                rating: null,
                                reviewCount: 0
                            })
                        }));
                }
            }


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

                    nearbyListings,

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

            function getLocationText(field, label, maxLength) {
                const value = listingData[field];

                if (
                    typeof value !== "string" ||
                    !value.trim() ||
                    value.length > maxLength ||
                    /[\u0000-\u001f\u007f]/.test(value)
                ) {
                    throw new ExpressError(
                        400,
                        `Please provide a valid ${label}.`
                    );
                }

                return value.trim();
            }

            const propertyName =
                getLocationText("propertyName", "property name", 200);
            const landmark =
                getLocationText("landmark", "nearby landmark", 200);
            const locality =
                getLocationText("locality", "locality", 200);
            const city =
                getLocationText("city", "city", 100);
            const state =
                getLocationText("state", "state", 100);
            const pincode =
                getLocationText("pinCode", "PIN code", 12);
            const location =
                getLocationText("location", "location", 200);
            const country =
                getLocationText("country", "country", 100);

            if (
                pincode.length < 3 ||
                !/^[a-z\d][a-z\d -]*[a-z\d]$/i.test(pincode) ||
                !/\d/.test(pincode)
            ) {
                throw new ExpressError(
                    400,
                    "Please provide a valid PIN code."
                );
            }

            const submittedCoordinates =
                listingData.coordinates;
            const latitudeValue =
                submittedCoordinates &&
                typeof submittedCoordinates.lat === "string"
                    ? submittedCoordinates.lat.trim()
                    : "";
            const longitudeValue =
                submittedCoordinates &&
                typeof submittedCoordinates.lng === "string"
                    ? submittedCoordinates.lng.trim()
                    : "";
            const latitude =
                Number(latitudeValue);
            const longitude =
                Number(longitudeValue);

            if (
                !latitudeValue ||
                !longitudeValue ||
                !Number.isFinite(latitude) ||
                !Number.isFinite(longitude) ||
                latitude < -90 ||
                latitude > 90 ||
                longitude < -180 ||
                longitude > 180
            ) {
                throw new ExpressError(
                    400,
                    "Please select a valid property location on the map."
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

                propertyName,
                landmark,
                locality,
                city,
                state,
                pincode,
                location,
                country,
                coordinates: {
                    lat: latitude,
                    lng: longitude
                },

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

            if (
                existingListing &&
                existingListing.host &&
                existingListing.host.toString() !==
                    String(res.locals.currentUser._id)
            ) {
                return res.redirect(
                    `/listings/${id}`
                );
            }

            if (!existingListing) {

                throw new ExpressError(
                    404,
                    "Listing Not Found"
                );

            }

            if (
                !listingData ||
                typeof listingData !== "object" ||
                Array.isArray(listingData)
            ) {
                throw new ExpressError(
                    400,
                    "Listing details are required."
                );
            }

            function sanitizeLocationText(field, label, maxLength) {
                if (!Object.prototype.hasOwnProperty.call(listingData, field)) {
                    return undefined;
                }

                const value = listingData[field];

                if (
                    typeof value !== "string" ||
                    value.length > maxLength ||
                    /[\u0000-\u001f\u007f]/.test(value)
                ) {
                    throw new ExpressError(
                        400,
                        `Please provide a valid ${label}.`
                    );
                }

                return value.trim();
            }

            const locationFields = {
                propertyName:
                    sanitizeLocationText("propertyName", "property name", 200),
                landmark:
                    sanitizeLocationText("landmark", "landmark", 200),
                locality:
                    sanitizeLocationText("locality", "locality", 200),
                city:
                    sanitizeLocationText("city", "city", 100),
                state:
                    sanitizeLocationText("state", "state", 100)
            };
            const submittedPincode =
                Object.prototype.hasOwnProperty.call(listingData, "pincode")
                    ? sanitizeLocationText("pincode", "PIN code", 12)
                    : sanitizeLocationText("pinCode", "PIN code", 12);

            if (
                submittedPincode &&
                (
                    submittedPincode.length < 3 ||
                    !/^[a-z\d][a-z\d -]*[a-z\d]$/i.test(submittedPincode) ||
                    !/\d/.test(submittedPincode)
                )
            ) {
                throw new ExpressError(
                    400,
                    "Please provide a valid PIN code."
                );
            }

            const coordinateFields =
                listingData.coordinates;
            let coordinates =
                existingListing.coordinates;

            if (
                coordinateFields !== undefined &&
                (
                    !coordinateFields ||
                    typeof coordinateFields !== "object" ||
                    Array.isArray(coordinateFields)
                )
            ) {
                throw new ExpressError(
                    400,
                    "Please provide valid property coordinates."
                );
            }

            if (coordinateFields) {
                const latitudeValue =
                    typeof coordinateFields.lat === "string"
                        ? coordinateFields.lat.trim()
                        : "";
                const longitudeValue =
                    typeof coordinateFields.lng === "string"
                        ? coordinateFields.lng.trim()
                        : "";
                const hasLatitude =
                    latitudeValue !== "";
                const hasLongitude =
                    longitudeValue !== "";

                if (hasLatitude || hasLongitude) {
                    const latitude = Number(latitudeValue);
                    const longitude = Number(longitudeValue);

                    if (
                        !hasLatitude ||
                        !hasLongitude ||
                        !Number.isFinite(latitude) ||
                        !Number.isFinite(longitude) ||
                        latitude < -90 ||
                        latitude > 90 ||
                        longitude < -180 ||
                        longitude > 180
                    ) {
                        throw new ExpressError(
                            400,
                            "Please provide valid property coordinates."
                        );
                    }

                    coordinates = {
                        lat: latitude,
                        lng: longitude
                    };
                }
            }


            // ========================================
            // BASIC LISTING UPDATE
            // ========================================

            const updateData = {

                ...listingData,

                ...Object.fromEntries(
                    Object.entries(locationFields).filter(
                        ([, value]) => value !== undefined
                    )
                ),

                ...(submittedPincode !== undefined
                    ? { pincode: submittedPincode }
                    : {}),

                coordinates,
                host: existingListing.host

            };

            delete updateData.pinCode;


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