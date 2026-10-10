    const express = require("express");
    const router = express.Router();


    // ========================================
    // ENVIRONMENT VARIABLES
    // ========================================

    const IGNAV_API_KEY =
        process.env.IGNAV_API_KEY;

    const IGNAV_BASE_URL =
        process.env.IGNAV_BASE_URL ||
        "https://ignav.com/api";


    // ============================================================
    // CRUISEFEED CONFIGURATION
    // ============================================================

    const CRUISEFEED_API_KEY =
        process.env.CRUISEFEED_API_KEY;

    const CRUISEFEED_BASE_URL =
        (
            process.env.CRUISEFEED_BASE_URL ||
            "https://api.cruisefeed.io/v1"
        ).replace(/\/+$/, "");


    // ============================================================
    // RAILRADAR CONFIGURATION
    // ============================================================

    const RAILRADAR_API_KEY =
        process.env.RAILRADAR_API_KEY;

    const RAILRADAR_BASE_URL =
        (
            process.env.RAILRADAR_BASE_URL ||
            "https://api.railradar.in"
        ).replace(/\/+$/, "");


    console.log(
        "[RailRadar] API key loaded:",
        Boolean(
            process.env.RAILRADAR_API_KEY
        )
    );

    console.log(
        "[RailRadar] Base URL:",
        RAILRADAR_BASE_URL
    );


    const NOMINATIM_URL =
        process.env.NOMINATIM_URL ||
        "https://nominatim.openstreetmap.org";

    const OSRM_URL =
        process.env.OSRM_URL ||
        "https://router.project-osrm.org";


    // ========================================
    // IGNAV HEADERS
    // ========================================

    function getIgnavHeaders() {

        if (!IGNAV_API_KEY) {

            throw new Error(
                "Ignav API key is missing in .env"
            );
        }

        return {
            "Content-Type": "application/json",
            "X-Api-Key": IGNAV_API_KEY
        };
    }


    // ========================================
    // GEOCODE LOCATION
    // ========================================

    async function geocodeLocation(location) {

        const url =
            `${NOMINATIM_URL}/search?format=json&limit=1&q=${encodeURIComponent(location)}`;

        const response =
            await fetch(
                url,
                {
                    headers: {
                        "User-Agent":
                            "Wanderlust Travel Application"
                    }
                }
            );

        if (!response.ok) {

            throw new Error(
                "Unable to find destination."
            );
        }

        const data =
            await response.json();

        if (!data.length) {

            throw new Error(
                `Could not find "${location}".`
            );
        }

        return {

            latitude:
                Number(data[0].lat),

            longitude:
                Number(data[0].lon),

            displayName:
                data[0].display_name
        };
    }

    // ========================================
    // GEOCODE MANUAL TRAVEL ORIGIN
    // ========================================

    router.get(
        "/geocode",
        async (req, res) => {

            try {

                const location =
                    String(
                        req.query.location || ""
                    ).trim();

                if (!location) {

                    return res.status(400).json({
                        message:
                            "Location is required."
                    });
                }

                const result =
                    await geocodeLocation(
                        location
                    );

                return res.json({
                    success: true,

                    latitude:
                        result.latitude,

                    longitude:
                        result.longitude,

                    displayName:
                        result.displayName
                });

            } catch (error) {

                console.error(
                    "[Travel Geocode] Error:",
                    error
                );

                return res.status(400).json({
                    success: false,

                    message:
                        error.message ||
                        "Unable to find location."
                });
            }
        }
    );


    // ========================================
    // FIND IGNAV AIRPORT
    // ========================================

    async function findAirport(location) {

        const headers =
            getIgnavHeaders();

        const url =
            `${IGNAV_BASE_URL}/airports?q=${encodeURIComponent(location)}&limit=10`;

        const response =
            await fetch(
                url,
                {
                    headers
                }
            );

        const data =
            await response.json();

        if (!response.ok) {

            console.log(
                "Ignav Airport Error:",
                data
            );

            throw new Error(
                data?.error?.message ||
                "Unable to find airport information."
            );
        }

        if (
            !Array.isArray(data) ||
            !data.length
        ) {

            throw new Error(
                `No airport found for "${location}".`
            );
        }

        return data[0];
    }


    // ========================================
    // GET IATA CODE
    // ========================================

    async function getIataCode(location) {

        const airport =
            await findAirport(location);

        if (!airport.code) {

            throw new Error(
                `No airport code found for ${location}.`
            );
        }

        return airport.code;
    }


    // ========================================
    // FLIGHT SEARCH - IGNAV
    // ========================================

    async function searchFlights(
        origin,
        destination,
        date
    ) {

        const headers =
            getIgnavHeaders();

        const originCode =
            await getIataCode(origin);

        const destinationCode =
            await getIataCode(destination);

        const response =
            await fetch(
                `${IGNAV_BASE_URL}/fares/one-way`,
                {
                    method: "POST",

                    headers,

                    body:
                        JSON.stringify({

                            origin:
                                originCode,

                            destination:
                                destinationCode,

                            departure_date:
                                date,

                            adults:
                                1,

                            cabin_class:
                                "economy",

                            market:
                                "IN"
                        })
                }
            );

        const data =
            await response.json();

        if (!response.ok) {

            console.log(
                "Ignav Flight Search Error:",
                data
            );

            return {

                flights: [],

                originCode,

                destinationCode
            };
        }

        const flights =
            (data.itineraries || [])
                .map(
                    itinerary =>
                        formatFlight(
                            itinerary,
                            originCode,
                            destinationCode
                        )
                )
                .filter(Boolean);

        return {

            flights,

            originCode,

            destinationCode
        };
    }


    // ========================================
    // GET BOOKING LINK - IGNAV
    // ========================================

    router.get(
        "/booking-link/:ignavId",
        async (req, res) => {

            try {

                const {
                    ignavId
                } = req.params;

                if (!ignavId) {

                    return res.status(400).json({
                        message:
                            "Flight booking information is missing."
                    });
                }

                const headers =
                    getIgnavHeaders();

                const response =
                    await fetch(
                        `${IGNAV_BASE_URL}/fares/booking-links`,
                        {
                            method: "POST",

                            headers,

                            body:
                                JSON.stringify({
                                    ignav_id:
                                        ignavId
                                })
                        }
                    );

                const data =
                    await response.json();

                if (!response.ok) {

                    console.log(
                        "Ignav Booking Link Error:",
                        data
                    );

                    return res.status(500).json({
                        message:
                            "Unable to get booking link."
                    });
                }

                const bookingOptions =
                    data.booking_options || [];

                let bookingUrl = null;


                // ========================================
                // PREFER AIRLINE DIRECT BOOKING LINK
                // ========================================

                for (
                    const option of bookingOptions
                ) {

                    const airlineLink =
                        (option.links || [])
                            .find(
                                link =>
                                    link.provider_type ===
                                    "airline" &&
                                    link.url
                            );

                    if (airlineLink) {

                        bookingUrl =
                            airlineLink.url;

                        break;
                    }
                }


                // ========================================
                // FALLBACK TO OTA BOOKING LINK
                // ========================================

                if (!bookingUrl) {

                    for (
                        const option of bookingOptions
                    ) {

                        const otaLink =
                            (option.links || [])
                                .find(
                                    link =>
                                        link.url
                                );

                        if (otaLink) {

                            bookingUrl =
                                otaLink.url;

                            break;
                        }
                    }
                }


                // ========================================
                // NO BOOKING LINK AVAILABLE
                // ========================================

                if (!bookingUrl) {

                    return res.status(404).json({
                        message:
                            "No booking link is available for this flight."
                    });
                }


                // ========================================
                // MAKE SURE URL HAS PROTOCOL
                // ========================================

                if (
                    !bookingUrl.startsWith("http://") &&
                    !bookingUrl.startsWith("https://")
                ) {

                    bookingUrl =
                        `https://${bookingUrl}`;
                }


                res.json({
                    url:
                        bookingUrl
                });

            } catch (error) {

                console.log(
                    "Booking link error:",
                    error
                );

                res.status(500).json({

                    message:
                        "Unable to get the flight booking link."
                });
            }
        }
    );


    // ========================================
    // FORMAT FLIGHT
    // ========================================

    function formatFlight(
        itinerary,
        originCode,
        destinationCode
    ) {

        try {

            const outbound =
                itinerary.outbound;

            if (!outbound) {
                return null;
            }

            const segments =
                outbound.segments || [];

            if (!segments.length) {
                return null;
            }

            const firstSegment =
                segments[0];

            const lastSegment =
                segments[segments.length - 1];

            const departureTime =
                firstSegment.departure_time_local ||
                firstSegment.departure_time_utc;

            const arrivalTime =
                lastSegment.arrival_time_local ||
                lastSegment.arrival_time_utc;

            if (
                !departureTime ||
                !arrivalTime
            ) {

                return null;
            }

            const airlineName =
                outbound.carrier ||
                firstSegment.operating_carrier_name ||
                "Airline";

            const airlineCode =
                firstSegment.marketing_carrier_code ||
                "";

            const flightNumber =
                `${airlineCode} ${firstSegment.flight_number || ""}`
                    .trim();

            const durationMinutes =
                outbound.duration_minutes;

            return {

                airline:
                    airlineName,

                flightNumber,

                departureTime,

                arrivalTime,

                duration:
                    formatDurationMinutes(
                        durationMinutes
                    ),

                originCode,

                destinationCode,

                ignavId:
                    itinerary.ignav_id || null,

                price:
                    itinerary.price || null,

                segments:
                    segments.map(
                        segment => ({

                            airline:
                                segment.operating_carrier_name ||
                                airlineName,

                            flightNumber:
                                `${segment.marketing_carrier_code || ""} ${segment.flight_number || ""}`
                                    .trim(),

                            departureTime:
                                segment.departure_time_local ||
                                segment.departure_time_utc,

                            arrivalTime:
                                segment.arrival_time_local ||
                                segment.arrival_time_utc,

                            departureAirport:
                                segment.departure_airport,

                            arrivalAirport:
                                segment.arrival_airport
                        })
                    )
            };

        } catch (error) {

            console.log(
                "Flight formatting error:",
                error
            );

            return null;
        }
    }


    // ========================================
    // FORMAT DURATION
    // ========================================

    function formatDurationMinutes(minutes) {

        if (
            minutes === null ||
            minutes === undefined
        ) {

            return "N/A";
        }

        const totalMinutes =
            Number(minutes);

        if (Number.isNaN(totalMinutes)) {
            return "N/A";
        }

        const hours =
            Math.floor(
                totalMinutes / 60
            );

        const remainingMinutes =
            totalMinutes % 60;

        if (
            hours &&
            remainingMinutes
        ) {

            return `${hours}h ${remainingMinutes}m`;
        }

        if (hours) {

            return `${hours}h`;
        }

        return `${remainingMinutes}m`;
    }


    // ========================================
    // ROUTE MAP
    // ========================================

    async function getRoute(
        originLat,
        originLng,
        destinationLat,
        destinationLng
    ) {

        const url =
            `${OSRM_URL}/route/v1/driving/${originLng},${originLat};${destinationLng},${destinationLat}?overview=full&geometries=geojson`;

        const response =
            await fetch(url);

        if (!response.ok) {

            throw new Error(
                "Unable to calculate route."
            );
        }

        const data =
            await response.json();

        if (
            !data.routes ||
            !data.routes.length
        ) {

            throw new Error(
                "No route found."
            );
        }

        return {

            distance:
                data.routes[0].distance,

            duration:
                data.routes[0].duration,

            coordinates:
                data.routes[0]
                    .geometry
                    .coordinates
        };
    }


    // ========================================
    // TRAVEL HOME PAGE
    // ========================================

    router.get(
        "/",
        (req, res) => {
            const destination =
                typeof req.query.destination === "string"
                    ? req.query.destination
                    : "";
            const requestedBookingReturnTo =
                req.query.bookingReturnTo;
            const bookingReturnTo =
                typeof requestedBookingReturnTo === "string" &&
                    requestedBookingReturnTo.startsWith("/") &&
                    !requestedBookingReturnTo.startsWith("//") &&
                    !requestedBookingReturnTo.includes("\\") &&
                    !/[\u0000-\u001f\u007f]/.test(requestedBookingReturnTo)
                    ? requestedBookingReturnTo
                    : "";

            res.render(
                "travel/index",
                {
                    destination,
                    bookingReturnTo
                }
            );
        }
    );


    // ========================================
    // TRAVEL SEARCH
    // ========================================

    router.get(
        "/search",
        async (req, res) => {

            try {

                const {
                    destination,
                    origin,
                    date,
                    originLat,
                    originLng
                } = req.query;

                if (!destination) {

                    return res.status(400).json({
                        message:
                            "Please enter a destination."
                    });
                }

                if (!origin) {

                    return res.status(400).json({
                        message:
                            "Your starting location could not be determined."
                    });
                }

                const selectedDate =
                    date ||
                    new Date()
                        .toISOString()
                        .split("T")[0];


                // =================================
                // DESTINATION COORDINATES
                // =================================

                const destinationCoordinates =
                    await geocodeLocation(
                        destination
                    );


                // =================================
                // FLIGHTS
                // =================================

                let flightResult;

                try {

                    flightResult =
                        await searchFlights(
                            origin,
                            destination,
                            selectedDate
                        );

                } catch (flightError) {

                    console.log(
                        "Flight search failed:",
                        flightError.message
                    );

                    flightResult = {

                        flights: [],

                        originCode: "",

                        destinationCode: ""
                    };
                }


                // =================================
                // MAP ROUTE
                // =================================

                let route = null;

                if (
                    originLat &&
                    originLng
                ) {

                    try {

                        route =
                            await getRoute(
                                Number(originLat),
                                Number(originLng),
                                destinationCoordinates.latitude,
                                destinationCoordinates.longitude
                            );

                    } catch (routeError) {

                        console.log(
                            "Route error:",
                            routeError.message
                        );

                        route = null;
                    }
                }


                // =================================
                // RESPONSE
                // =================================

                res.json({

                    origin,

                    destination,

                    date:
                        selectedDate,

                    flights:
                        flightResult.flights,

                    originCode:
                        flightResult.originCode,

                    destinationCode:
                        flightResult.destinationCode,

                    originCoordinates: {

                        latitude:
                            Number(originLat),

                        longitude:
                            Number(originLng)
                    },

                    destinationCoordinates,

                    route
                });

            } catch (error) {

                console.log(
                    "Travel Search Error:",
                    error
                );

                res.status(500).json({

                    message:
                        error.message ||
                        "Unable to search travel options."
                });
            }
        }
    );


    // ============================================================
    // CRUISEFEED FUNCTIONS
    // ============================================================


    /**
     * Search cruises using CruiseFeed API.
     *
     * IMPORTANT:
     * CRUISEFEED_BASE_URL must be:
     *
     * https://api.cruisefeed.io/v1
     *
     * NOT:
     *
     * https://api.cruisefeed.io/v1/cruises
     *
     * because "/cruises" is added below.
     */
    async function searchCruises(
        destination,
        selectedDate
    ) {

        if (!CRUISEFEED_API_KEY) {

            throw new Error(
                "CRUISEFEED_API_KEY is missing in .env"
            );
        }


        // ========================================
        // BUILD API QUERY
        // ========================================

        const params =
            new URLSearchParams();

        params.set(
            "limit",
            "50"
        );


        if (selectedDate) {

            params.set(
                "departure_from",
                selectedDate
            );
        }


        // ========================================
        // BUILD FINAL URL
        // ========================================

        const url =
            `${CRUISEFEED_BASE_URL}/cruises?${params.toString()}`;


        console.log(
            "[CruiseFeed] Request URL:",
            url
        );


        // ========================================
        // API REQUEST
        // ========================================

        const response =
            await fetch(
                url,
                {
                    method: "GET",

                    headers: {

                        "Authorization":
                            `Bearer ${CRUISEFEED_API_KEY}`,

                        "Accept":
                            "application/json"
                    }
                }
            );


        const responseText =
            await response.text();


        // ========================================
        // API ERROR
        // ========================================

        if (!response.ok) {

            if (
                response.status === 429 &&
                /result_allowance_exhausted|free plan result allowance used/i.test(
                    responseText
                )
            ) {

                console.log(
                    "[CruiseFeed] Free result allowance exhausted."
                );

                return [];
            }

            console.log(
                "[CruiseFeed] HTTP Status:",
                response.status
            );

            console.log(
                "[CruiseFeed] Response:",
                responseText
            );

            throw new Error(
                `CruiseFeed API error ${response.status}: ${responseText}`
            );
        }


        // ========================================
        // PARSE JSON
        // ========================================

        let data;

        try {

            data =
                JSON.parse(
                    responseText
                );

        } catch (parseError) {

            throw new Error(
                "CruiseFeed returned invalid JSON."
            );
        }


        // ========================================
        // GET CRUISE ARRAY
        // ========================================

        const cruises =
            Array.isArray(data.items)
                ? data.items
                : Array.isArray(data)
                    ? data
                    : [];


        console.log(
            `[CruiseFeed] API returned ${cruises.length} cruises`
        );


        // ========================================
        // DESTINATION FILTER
        // ========================================

        const destinationText =
            String(destination || "")
                .trim()
                .toLowerCase();


        if (!destinationText) {
            return cruises;
        }


        const filteredCruises =
            cruises.filter(
                cruise => {

                    const embarkPort =
                        String(
                            cruise.embark_port ||
                            ""
                        )
                            .trim()
                            .toLowerCase();


                    const region =
                        String(
                            cruise.region ||
                            ""
                        )
                            .trim()
                            .toLowerCase();


                    const title =
                        String(
                            cruise.title ||
                            ""
                        )
                            .trim()
                            .toLowerCase();


                    const cruiseLine =
                        String(
                            cruise.cruise_line ||
                            ""
                        )
                            .trim()
                            .toLowerCase();


                    const shipName =
                        String(
                            cruise.ship_name ||
                            ""
                        )
                            .trim()
                            .toLowerCase();


                    const itinerary =
                        Array.isArray(
                            cruise.itinerary
                        )
                            ? cruise.itinerary
                            : [];


                    // ========================================
                    // ITINERARY MATCH
                    // ========================================

                    const itineraryMatches =
                        itinerary.some(
                            stop => {

                                const port =
                                    String(
                                        stop?.port ||
                                        ""
                                    )
                                        .trim()
                                        .toLowerCase();


                                const country =
                                    String(
                                        stop?.country ||
                                        ""
                                    )
                                        .trim()
                                        .toLowerCase();


                                if (
                                    port &&
                                    (
                                        port.includes(
                                            destinationText
                                        ) ||
                                        destinationText.includes(
                                            port
                                        )
                                    )
                                ) {

                                    return true;
                                }


                                if (
                                    country &&
                                    (
                                        country.includes(
                                            destinationText
                                        ) ||
                                        destinationText.includes(
                                            country
                                        )
                                    )
                                ) {

                                    return true;
                                }


                                return false;
                            }
                        );


                    // ========================================
                    // FINAL DESTINATION MATCH
                    // ========================================

                    return (

                        (
                            embarkPort &&
                            (
                                embarkPort.includes(
                                    destinationText
                                ) ||
                                destinationText.includes(
                                    embarkPort
                                )
                            )
                        )

                        ||

                        (
                            region &&
                            (
                                region.includes(
                                    destinationText
                                ) ||
                                destinationText.includes(
                                    region
                                )
                            )
                        )

                        ||

                        (
                            title &&
                            (
                                title.includes(
                                    destinationText
                                ) ||
                                destinationText.includes(
                                    title
                                )
                            )
                        )

                        ||

                        (
                            cruiseLine &&
                            cruiseLine.includes(
                                destinationText
                            )
                        )

                        ||

                        (
                            shipName &&
                            shipName.includes(
                                destinationText
                            )
                        )

                        ||

                        itineraryMatches
                    );
                }
            );


        console.log(
            `[CruiseFeed] ${filteredCruises.length} cruises matched "${destination}"`
        );


        return filteredCruises;
    }


    // ============================================================
    // RAILRADAR FUNCTIONS
    // ============================================================

    async function findRailwayStation(location) {

        if (!RAILRADAR_API_KEY) {

            const error =
                new Error(
                    "RAILRADAR_API_KEY is missing in .env"
                );

            error.status = 401;
            throw error;
        }

        const url =
            `${RAILRADAR_BASE_URL}/v1/lookup/search/stations?q=${encodeURIComponent(location)}&limit=10`;

        console.log(
            "[RailRadar] Station lookup query:",
            location
        );

        const response =
            await fetch(
                url,
                {
                    headers: {
                        "Authorization":
                            `Bearer ${process.env.RAILRADAR_API_KEY}`,

                        "Accept":
                            "application/json"
                    }
                }
            );

        const responseText =
            await response.text();

        if (!response.ok) {

            if (response.status === 401) {

                const error =
                    new Error(
                        "RailRadar authentication failed. Check RAILRADAR_API_KEY in .env."
                    );

                error.status = 401;
                throw error;
            }

            const error =
                new Error(
                    `RailRadar station lookup failed with status ${response.status}.`
                );

            error.status = response.status;
            error.responseText = responseText;
            throw error;
        }

        let data;

        try {

            data =
                JSON.parse(
                    responseText
                );

        } catch (parseError) {

            throw new Error(
                "RailRadar returned invalid station data."
            );
        }

        const stations =
            Array.isArray(data?.data)
                ? data.data
                : [];

        const normalizedLocation =
            location
                .trim()
                .toLowerCase();

        const stationCandidates =
            stations.filter(
                station =>
                    station &&
                    station.code
            );

        const station =
            stationCandidates
                .map(
                    candidate => {

                        const name =
                            String(
                                candidate.name ||
                                ""
                            )
                                .trim()
                                .toLowerCase();

                        const city =
                            String(
                                candidate.city ||
                                ""
                            )
                                .trim()
                                .toLowerCase();

                        let score = 0;

                        const stationName =
                            String(
                                candidate.name ||
                                ""
                            );

                        const isOperationalStation =
                            candidate.isActive !== false;

                        const isNonPassengerStation =
                            /siding|military|ordinance|ord[in]ence|depot|goods|yard|cabin|halt|workshop|loco shed/i.test(
                                stationName
                            );

                        if (isOperationalStation) {
                            score += 20;
                        }

                        if (isNonPassengerStation) {
                            score -= 1000;
                        }

                        if (city === normalizedLocation) {
                            score += 100;
                        }

                        if (name === normalizedLocation) {
                            score += 90;
                        }

                        if (
                            name ===
                            `new ${normalizedLocation}`
                        ) {
                            score += 100;
                        }

                        if (
                            city.includes(
                                normalizedLocation
                            )
                        ) {
                            score += 60;
                        }

                        if (
                            name.includes(
                                normalizedLocation
                            )
                        ) {
                            score += 40;
                        }

                        if (
                            /railway|central|junction|main|cantt|terminus/i.test(
                                stationName
                            )
                        ) {
                            score += 80;
                        }

                        return {
                            candidate,
                            score
                        };
                    }
                )
                .sort(
                    (first, second) =>
                        second.score - first.score
                )
                .at(0)
                ?.candidate;

        if (!station) {

            const error =
                new Error(
                    `No railway station found for "${location}".`
                );

            error.status = 404;
            throw error;
        }

        console.log(
            "[RailRadar] Station selected:",
            `${station.name || location} (${station.code})`
        );

        return {
            code:
                station.code,

            name:
                station.name ||
                location
        };
    }


    function formatTrainDuration(duration) {

        if (
            duration === null ||
            duration === undefined ||
            duration === ""
        ) {
            return null;
        }

        if (typeof duration === "number") {

            return formatMinutesDuration(
                duration
            );
        }

        const durationText =
            String(duration).trim();

        const hoursMinutes =
            durationText.match(
                /^(\d+)\s*(?:h|hours?)\s*(?:(\d+)\s*(?:m|min|minutes?))?$/i
            );

        if (hoursMinutes) {

            return `${hoursMinutes[1]}h ${String(
                hoursMinutes[2] || "00"
            ).padStart(2, "0")}m`;
        }

        const numericDuration =
            Number(durationText);

        if (!Number.isNaN(numericDuration)) {

            return formatMinutesDuration(
                numericDuration
            );
        }

        return durationText;
    }


    function formatMinutesDuration(minutes) {

        const totalMinutes =
            Math.max(
                0,
                Math.round(
                    Number(minutes)
                )
            );

        const hours =
            Math.floor(
                totalMinutes / 60
            );

        const remainingMinutes =
            totalMinutes % 60;

        return `${hours}h ${String(
            remainingMinutes
        ).padStart(2, "0")}m`;
    }


    function calculateTrainDuration(
        departureTime,
        arrivalTime,
        departureDay,
        arrivalDay,
        journeyDate
    ) {

        if (
            !departureTime ||
            !arrivalTime
        ) {
            return null;
        }

        const departure =
            String(departureTime).match(
                /^(\d{1,2}):(\d{2})/
            );

        const arrival =
            String(arrivalTime).match(
                /^(\d{1,2}):(\d{2})/
            );

        if (!departure || !arrival) {
            return null;
        }

        const departureMinutes =
            Number(departure[1]) * 60 +
            Number(departure[2]);

        let arrivalMinutes =
            Number(arrival[1]) * 60 +
            Number(arrival[2]);

        const dayDifference =
            Number.isFinite(Number(departureDay)) &&
            Number.isFinite(Number(arrivalDay))
                ? Number(arrivalDay) - Number(departureDay)
                : null;

        if (dayDifference !== null && dayDifference > 0) {
            arrivalMinutes += dayDifference * 24 * 60;
        } else if (arrivalMinutes < departureMinutes) {
            arrivalMinutes += 24 * 60;
        }

        if (journeyDate && departureTime.includes("T") && arrivalTime.includes("T")) {
            const departureDate = new Date(departureTime);
            const arrivalDate = new Date(arrivalTime);

            if (!Number.isNaN(departureDate.getTime()) && !Number.isNaN(arrivalDate.getTime())) {
                return formatMinutesDuration(
                    (arrivalDate.getTime() - departureDate.getTime()) / 60000
                );
            }
        }

        return formatMinutesDuration(
            arrivalMinutes - departureMinutes
        );
    }


    function formatRailRadarTrain(
        train,
        originStationCode,
        destinationStationCode,
        journeyDate
    ) {

        const trainDetails =
            train.train ||
            {};

        const from =
            train.from ||
            {};

        const to =
            train.to ||
            {};

        const departureTime =
            from.departure ||
            from.departureTime ||
            train.departureTime ||
            train.departure_time ||
            null;

        const arrivalTime =
            to.arrival ||
            to.arrivalTime ||
            train.arrivalTime ||
            train.arrival_time ||
            null;

        const duration =
            formatTrainDuration(
                train.duration ||
                train.durationMinutes
            ) ||
            calculateTrainDuration(
                departureTime,
                arrivalTime,
                from.day,
                to.day,
                journeyDate
            );

        const fare =
            train.fare ??
            train.fare_amount ??
            train.fareAmount ??
            null;

        const trainNumber =
            trainDetails.number ??
            trainDetails.trainNumber ??
            train.number ??
            train.trainNumber ??
            train.train_number ??
            train.trainNo ??
            null;

        return {

            trainNumber:
                trainNumber === null
                    ? null
                    : String(trainNumber),

            trainName:
                trainDetails.name ??
                trainDetails.trainName ??
                trainDetails.train_name ??
                train.name ??
                train.trainName ??
                train.train_name ??
                null,

            trainType:
                trainDetails.type ??
                trainDetails.trainType ??
                trainDetails.train_type ??
                train.type ??
                train.trainType ??
                train.train_type ??
                null,

            departureTime,

            arrivalTime,

            duration,

            originStation:
                from.name ||
                from.station ||
                train.originStation ||
                null,

            destinationStation:
                to.name ||
                to.station ||
                train.destinationStation ||
                null,

            originStationCode:
                from.code ||
                originStationCode ||
                null,

            destinationStationCode:
                to.code ||
                destinationStationCode ||
                null,

            distance:
                train.distance ||
                train.distance_km ||
                null,

            totalHalts:
                train.totalHaltsBetween ??
                train.totalHalts ??
                train.total_halts ??
                train.halts ??
                null,

            fare,

            fareClass:
                fare === null
                    ? null
                    : "3A",

            fareOptions:
                fare === null
                    ? []
                    : [{
                        classCode: "3A",
                        fare
                    }]
        };
    }


    async function fetchTrainFare(
        trainNumber,
        source,
        destination,
        journeyDate
    ) {

        if (!trainNumber) {
            return null;
        }

        const params =
            new URLSearchParams({
                source,
                destination,
                journeyDate,
                classCode: "3A",
                quotaCode: "GN"
            });

        const url =
            `${RAILRADAR_BASE_URL}/v1/trains/${encodeURIComponent(trainNumber)}/fare?${params.toString()}`;

        try {

            const response =
                await fetch(
                    url,
                    {
                        headers: {
                            "Authorization":
                                `Bearer ${process.env.RAILRADAR_API_KEY}`,

                            "Accept":
                                "application/json"
                        }
                    }
                );

            if (!response.ok) {

                console.error(
                    `[RailRadar] Fare lookup failed with status ${response.status} for train ${trainNumber}`
                );

                return null;
            }

            const data =
                await response.json();

            const fareData =
                data?.data ||
                data;

            const fare =
                fareData?.breakdown?.totalFare ??
                fareData?.fare ??
                fareData?.amount ??
                fareData?.price ??
                null;

            const fareClass =
                fareData?.fareClass ||
                fareData?.classCode ||
                "3A";

            return {
                fare,

                fareClass:
                    fare === null
                        ? null
                        : fareClass,

                fareOptions:
                    fare === null
                        ? []
                        : [{
                            classCode: fareClass,
                            fare
                        }]
            };

        } catch (error) {

            console.error(
                `[RailRadar] Fare lookup error for train ${trainNumber}:`,
                error.message
            );

            return null;
        }
    }


    // ============================================================
    // GET /travel/trains
    // ============================================================

    router.get(
        "/trains",
        async (req, res) => {

            const origin =
                String(
                    req.query.origin ||
                    ""
                ).trim();

            const destination =
                String(
                    req.query.destination ||
                    ""
                ).trim();

            const date =
                String(
                    req.query.date ||
                    ""
                ).trim();

            if (!origin || !destination || !date) {

                return res.status(400).json({

                    success:
                        false,

                    message:
                        "Origin, destination and date are required.",

                    trains:
                        []
                });
            }

            if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {

                return res.status(400).json({

                    success:
                        false,

                    message:
                        "Date must use YYYY-MM-DD format.",

                    trains:
                        []
                });
            }

            try {

                const originStation =
                    await findRailwayStation(
                        origin
                    );

                const destinationStation =
                    await findRailwayStation(
                        destination
                    );

                console.log(
                    "[RailRadar] Train search:",
                    `${originStation.code} -> ${destinationStation.code}`
                );

                console.log(
                    "[RailRadar] Date:",
                    date
                );

                const url =
                    `${RAILRADAR_BASE_URL}/v1/trains/between/${encodeURIComponent(originStation.code)}/${encodeURIComponent(destinationStation.code)}?date=${encodeURIComponent(date)}&byCity=true`;

                const response =
                    await fetch(
                        url,
                        {
                            headers: {
                                "Authorization":
                                            `Bearer ${process.env.RAILRADAR_API_KEY}`,

                                "Accept":
                                    "application/json"
                            }
                        }
                    );

                const responseText =
                    await response.text();

                if (!response.ok) {

                    if (response.status === 401) {

                        return res.status(401).json({

                            success:
                                false,

                            message:
                                "RailRadar authentication failed. Check RAILRADAR_API_KEY in .env.",

                            trains:
                                []
                        });
                    }

                    if (response.status === 404) {

                        console.error(
                            "[RailRadar] Train route was not found."
                        );

                        return res.json({

                            success:
                                true,

                            origin,

                            destination,

                            date,

                            trains:
                                []
                        });
                    }

                    console.error(
                        `[RailRadar] Train search failed with status ${response.status}`
                    );

                    const statusMessages = {
                        401: "RailRadar API key is invalid or missing.",
                        404: "No railway route was found for these stations.",
                        429: "RailRadar API quota has been exceeded.",
                        500: "RailRadar is currently unavailable.",
                        503: "RailRadar is currently unavailable."
                    };

                    return res.status(
                        response.status === 401 ||
                        response.status === 404 ||
                        response.status === 429
                            ? response.status
                            : 502
                    ).json({

                        success:
                            false,

                        message:
                            statusMessages[response.status] ||
                            "Unable to fetch train information.",

                        trains:
                            []
                    });
                }

                let data;

                try {

                    data =
                        JSON.parse(
                            responseText
                        );

                } catch (parseError) {

                    throw new Error(
                        "RailRadar returned invalid train data."
                    );
                }

                const trains =
                    Array.isArray(data)
                        ? data
                        : Array.isArray(data?.trains)
                            ? data.trains
                            : Array.isArray(data?.data?.trains)
                                ? data.data.trains
                            : Array.isArray(data?.data)
                                ? data.data
                                : [];

                const formattedTrains =
                    trains.map(
                        train =>
                            formatRailRadarTrain(
                                train,
                                originStation.code,
                                destinationStation.code,
                                date
                            )
                    );

                const fareTrains =
                    formattedTrains
                        .filter(
                            (train, index, allFormattedTrains) =>
                                train.trainNumber &&
                                allFormattedTrains.findIndex(
                                    candidate =>
                                        candidate.trainNumber ===
                                        train.trainNumber
                                ) === index
                        )
                        .slice(0, 10);

                const fareResults =
                    await Promise.all(
                        fareTrains.map(
                            train =>
                                fetchTrainFare(
                                    String(train.trainNumber),
                                    originStation.code,
                                    destinationStation.code,
                                    date
                                )
                        )
                    );

                fareResults.forEach(
                    (fareResult, index) => {

                        if (!fareResult) {
                            return;
                        }

                        const train =
                            fareTrains[index];

                        train.fare =
                            fareResult.fare;

                        train.fareClass =
                            fareResult.fareClass;

                        train.fareOptions =
                            fareResult.fareOptions;
                    }
                );

                console.log(
                    "[RailRadar] Trains found:",
                    formattedTrains.length
                );

                return res.json({

                    success:
                        true,

                    origin,

                    destination,

                    date,

                    trains:
                        formattedTrains
                });

            } catch (error) {

                console.error(
                    "[RailRadar] Train search error:",
                    error.message
                );

                const status =
                    error.status === 404
                        ? 404
                        : error.status === 401
                            ? 401
                            : error.status === 429
                                ? 429
                            : 502;

                return res.status(status).json({

                    success:
                        false,

                    message:
                        error.status === 404
                            ? error.message
                            : error.status === 401
                                ? "RailRadar authentication failed. Check RAILRADAR_API_KEY in .env."
                                : error.status === 429
                                    ? "RailRadar API quota has been exceeded."
                                : "Unable to fetch train information.",

                    trains:
                        []
                });
            }
        }
    );


    /**
     * Format CruiseFeed data for frontend.
     */
    function formatCruise(cruise) {

        const itinerary =
            Array.isArray(
                cruise.itinerary
            )
                ? cruise.itinerary
                : [];


        // ========================================
        // FIRST / LAST PORT
        // ========================================

        const firstPort =
            itinerary.length > 0
                ? itinerary[0]
                : null;


        const lastPort =
            itinerary.length > 0
                ? itinerary[
                    itinerary.length - 1
                ]
                : null;


        // ========================================
        // NIGHTS
        // ========================================

        const nights =
            Number(
                cruise.nights || 0
            );


        let durationText;


        if (nights > 0) {

            durationText =
                `${nights} night${nights === 1 ? "" : "s"}`;

        } else {

            durationText =
                "Cruise itinerary";
        }


        // ========================================
        // PRICE
        // ========================================

        let price = null;


        if (
            cruise.price_amount !== undefined &&
            cruise.price_amount !== null
        ) {

            price = {

                amount:
                    cruise.price_amount,

                currency:
                    cruise.price_currency ||
                    "USD"
            };
        }


        // ========================================
        // FARE PRICE FALLBACK
        // ========================================

        let availableFare = null;


        if (
            Array.isArray(
                cruise.fares
            )
        ) {

            availableFare =
                cruise.fares.find(
                    fare =>
                        fare &&
                        fare.available !== false
                );
        }


        if (
            !price &&
            availableFare
        ) {

            price = {

                amount:
                    availableFare.price_amount,

                currency:
                    availableFare.price_currency ||
                    cruise.price_currency ||
                    "USD"
            };
        }


        // ========================================
        // BOOKING / DETAIL URL
        // ========================================

        const bookingUrl =
            cruise.booking_url ||
            cruise.book_url ||
            cruise.detail_url ||
            cruise.url ||
            null;


        // ========================================
        // PORT TIMES
        // ========================================

        const departureTime =
            firstPort?.departure_time ||
            firstPort?.departureTime ||
            firstPort?.depart_time ||
            firstPort?.departure_datetime ||
            firstPort?.departure_datetime_local ||
            null;


        const arrivalTime =
            lastPort?.arrival_time ||
            lastPort?.arrivalTime ||
            lastPort?.arrive_time ||
            lastPort?.arrival_datetime ||
            lastPort?.arrival_datetime_local ||
            null;


        // ========================================
        // RETURN FORMATTED OBJECT
        // ========================================

        return {

            id:
                cruise.id ||
                null,


            cruiseLine:
                cruise.cruise_line ||
                cruise.cruiseLine ||
                "Cruise operator",


            shipName:
                cruise.ship_name ||
                cruise.shipName ||
                "Cruise ship",


            title:
                cruise.title ||
                "Cruise sailing",


            departureDate:
                cruise.departure_date ||
                null,


            returnDate:
                cruise.return_date ||
                null,


            nights,


            duration:
                durationText,


            departurePort:
                cruise.embark_port ||
                (
                    firstPort
                        ? firstPort.port
                        : null
                ) ||
                "Departure port",


            arrivalPort:
                lastPort
                    ? lastPort.port
                    : null,


            departureTime,


            arrivalTime,


            region:
                cruise.region ||
                null,


            itinerary,


            price,


            pricePerNight:
                cruise.price_per_night ||
                null,


            bookingUrl,


            cruiseFeedId:
                cruise.id ||
                null
        };
    }


    // ============================================================
    // GET /travel/cruises
    // ============================================================

    router.get(
        "/cruises",
        async (req, res) => {

            try {

                const destination =
                    String(
                        req.query.destination ||
                        ""
                    ).trim();


                const date =
                    String(
                        req.query.date ||
                        ""
                    ).trim();


                // ========================================
                // VALIDATION
                // ========================================

                if (!destination) {

                    return res.status(400).json({

                        success:
                            false,

                        message:
                            "Destination is required",

                        cruises:
                            []
                    });
                }


                // ========================================
                // SELECTED DATE
                // ========================================

                const selectedDate =
                    date ||
                    new Date()
                        .toISOString()
                        .split("T")[0];


                console.log(
                    `[CruiseFeed] Searching cruises for ${destination} on ${selectedDate}`
                );


                // ========================================
                // SEARCH
                // ========================================

                const cruises =
                    await searchCruises(
                        destination,
                        selectedDate
                    );


                // ========================================
                // FORMAT
                // ========================================

                const formattedCruises =
                    cruises.map(
                        formatCruise
                    );


                // ========================================
                // RESPONSE
                // ========================================

                return res.json({

                    success:
                        true,

                    destination,

                    date:
                        selectedDate,

                    count:
                        formattedCruises.length,

                    cruises:
                        formattedCruises
                });

            } catch (error) {

                console.error(
                    "[CruiseFeed] Search error:",
                    error
                );


                // ========================================
                // IMPORTANT:
                // Return JSON instead of crashing server
                // ========================================

                return res.status(500).json({

                    success:
                        false,

                    message:
                        error.message ||
                        "Unable to fetch cruise information right now.",

                    cruises:
                        []
                });
            }
        }
    );


    // ========================================
    // EXPORT ROUTER
    // ========================================

    module.exports = router;