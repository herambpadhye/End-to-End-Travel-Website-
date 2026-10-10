document.addEventListener("DOMContentLoaded", () => {

    // =========================================
    // DOM ELEMENTS
    // =========================================

    const originInput =
        document.getElementById("travel-origin");

    const originDetectButton =
        document.getElementById("travel-origin-detect");

    const destinationInput =
        document.getElementById("travel-destination");

    const searchButton =
        document.getElementById("travel-search-button");

    const dateContainer =
        document.getElementById("travel-date-container");

    const dateInput =
        document.getElementById("travel-date");

    const statusBox =
        document.getElementById("travel-status");

    const resultsContainer =
        document.getElementById("travel-results");

    const welcomeBox =
        document.getElementById("travel-welcome");

    const flightList =
        document.getElementById("flight-list");

    const flightMoreButton =
        document.getElementById("flight-more-button");

    let trainList =
        document.getElementById("train-list");

    let trainMoreButton =
        document.getElementById("train-more-button");

    const cruiseList =
        document.getElementById("cruise-list");

    const cruiseMoreButton =
        document.getElementById("cruise-more-button");

    const busList =
        document.getElementById("bus-list");

    const busMoreButton =
        document.getElementById("bus-more-button");

    const flightRouteText = 
        document.getElementById("flight-route-text");

    const mapSection =
        document.getElementById("travel-map-section");

    const mapBox =
        document.getElementById("travel-map");

    const mapText =
        document.getElementById("travel-map-text");

    const requestedDestination =
        new URLSearchParams(window.location.search).get("destination");

    if (
        destinationInput &&
        !destinationInput.value.trim() &&
        requestedDestination
    ) {
        const cleanDestination =
            requestedDestination.trim();

        if (
            cleanDestination.length <= 200 &&
            !/[\u0000-\u001f\u007f]/.test(cleanDestination)
        ) {
            destinationInput.value =
                cleanDestination;
        }
    }


    // =========================================
    // STATE
    // =========================================

    let currentDestination = "";

    let currentOrigin = "";

    let currentOriginCoordinates = null;

    let currentDestinationCoordinates = null;

    /*
     * TRUE:
     * User has manually entered the starting location.
     *
     * FALSE:
     * Browser/current location can be used.
     */
    let originWasManuallyEntered = false;

    let allFlights = [];
    let showingAllFlights = false;

    let allTrains = [];
    let showingAllTrains = false;

    let allBuses = [];
    let showingAllBuses = false;

    let allCruises = [];
    let showingAllCruises = false;

    let map = null;


    function ensureTrainElements() {

        if (
            trainList &&
            trainMoreButton
        ) {
            return;
        }

        const trainSection =
            Array.from(
                document.querySelectorAll(
                    ".travel-section"
                )
            ).find(
                section =>
                    section.querySelector("h2")?.textContent
                        .toLowerCase()
                        .includes("trains")
            );

        const placeholder =
            trainSection?.querySelector(
                ".travel-placeholder-card"
            );

        if (!placeholder) {
            return;
        }

        placeholder.innerHTML = `
            <div
                id="train-list"
                class="flight-list"
            ></div>

            <button
                type="button"
                id="train-more-button"
                class="travel-more-button"
                style="display: none;"
            >
                More
                <i class="fa-solid fa-chevron-down"></i>
            </button>
        `;

        trainList =
            document.getElementById("train-list");

        trainMoreButton =
            document.getElementById("train-more-button");
    }


    ensureTrainElements();


    // =========================================
    // DATE SETUP
    // =========================================

    function getLocalDateString(date = new Date()) {

        return (
            `${date.getFullYear()}-` +
            `${String(date.getMonth() + 1).padStart(2, "0")}-` +
            `${String(date.getDate()).padStart(2, "0")}`
        );
    }


    function setMinimumDate() {

        const todayString =
            getLocalDateString();

        if (!dateInput) {
            return;
        }

        dateInput.min =
            todayString;

        if (!dateInput.value) {

            dateInput.value =
                todayString;
        }
    }


    setMinimumDate();


    // =========================================
    // STATUS
    // =========================================

    function showStatus(
        message,
        type = "loading"
    ) {

        if (!statusBox) {
            return;
        }

        statusBox.style.display =
            "block";

        statusBox.className =
            `travel-status ${type}`;

        statusBox.innerHTML =
            message;
    }


    function hideStatus() {

        if (!statusBox) {
            return;
        }

        statusBox.style.display =
            "none";

        statusBox.innerHTML =
            "";
    }


    // =========================================
    // ORIGIN INPUT
    // =========================================

    if (originInput) {

        /*
         * If user types a starting location,
         * treat it as the new manual origin.
         */
        originInput.addEventListener(
            "input",
            () => {

                const value =
                    originInput.value.trim();

                if (value) {

                    originWasManuallyEntered =
                        true;

                } else {

                    originWasManuallyEntered =
                        false;

                    currentOrigin =
                        "";

                    currentOriginCoordinates =
                        null;
                }
            }
        );


        /*
         * Enter from the From field.
         */
        originInput.addEventListener(
            "keydown",
            (event) => {

                if (event.key === "Enter") {

                    event.preventDefault();

                    searchDestination();
                }
            }
        );
    }


    // =========================================
    // CURRENT LOCATION BUTTON
    // =========================================

    if (originDetectButton) {

        originDetectButton.addEventListener(
            "click",
            async () => {

                await useCurrentLocation();
            }
        );
    }


    async function useCurrentLocation() {

        if (originDetectButton) {

            originDetectButton.disabled =
                true;
        }

        showStatus(
            '<i class="fa-solid fa-spinner fa-spin"></i> Detecting your current location...',
            "loading"
        );

        /*
         * Clear manual-origin mode.
         */
        originWasManuallyEntered =
            false;

        /*
         * Detect location again.
         */
        try {

            await getUserLocation();

            /*
             * If destination already exists,
             * immediately refresh results.
             */
            if (
                currentDestination &&
                dateInput &&
                dateInput.value
            ) {

                await loadTravelResults();

            } else {

                hideStatus();
            }

        } catch (error) {

            console.error(
                "Current location error:",
                error
            );

            showStatus(
                error.message ||
                "Unable to detect your current location.",
                "error"
            );

        } finally {

            if (originDetectButton) {

                originDetectButton.disabled =
                    false;
            }
        }
    }


    // =========================================
    // SEARCH BUTTON
    // =========================================

    if (searchButton) {

        searchButton.addEventListener(
            "click",
            () => {

                searchDestination();
            }
        );
    }


    if (destinationInput) {

        destinationInput.addEventListener(
            "keydown",
            (event) => {

                if (event.key === "Enter") {

                    event.preventDefault();

                    searchDestination();
                }
            }
        );
    }


    // =========================================
    // SEARCH DESTINATION
    // =========================================

    async function searchDestination() {

        if (!destinationInput) {
            return;
        }

        const destination =
            destinationInput.value.trim();

        if (!destination) {

            showStatus(
                "Please enter a destination.",
                "error"
            );

            return;
        }

        currentDestination =
            destination;

        if (welcomeBox) {
            welcomeBox.style.display =
                "none";
        }

        if (resultsContainer) {
            resultsContainer.style.display =
                "none";
        }

        if (dateContainer) {
            dateContainer.style.display =
                "none";
        }

        if (mapSection) {
            mapSection.style.display =
                "none";
        }

        showStatus(
            '<i class="fa-solid fa-spinner fa-spin"></i> Finding your destination...',
            "loading"
        );

        try {

            /*
             * IMPORTANT:
             *
             * If From contains text, use that.
             *
             * If From is empty, detect current
             * browser location.
             */
            const manualOrigin =
                originInput
                    ? originInput.value.trim()
                    : "";

            if (manualOrigin) {

                originWasManuallyEntered =
                    true;

                await setManualOrigin(
                    manualOrigin
                );

            } else {

                originWasManuallyEntered =
                    false;

                await getUserLocation();
            }

            await loadTravelResults();

        } catch (error) {

            console.error(
                "Travel search error:",
                error
            );

            showStatus(
                error.message ||
                "Unable to find travel information.",
                "error"
            );
        }
    }


    // =========================================
    // GET USER LOCATION
    // =========================================

    function getUserLocation() {

        return new Promise((resolve) => {

            /*
             * Browser geolocation unavailable.
             * Keep Pune fallback.
             */
            if (!navigator.geolocation) {

                currentOrigin =
                    "Pune";

                currentOriginCoordinates = {

                    latitude: 18.5204,

                    longitude: 73.8567
                };

                if (originInput) {

                    originInput.value =
                        currentOrigin;
                }

                resolve();

                return;
            }


            navigator.geolocation.getCurrentPosition(

                async (position) => {

                    currentOriginCoordinates = {

                        latitude:
                            position.coords.latitude,

                        longitude:
                            position.coords.longitude
                    };

                    try {

                        const response =
                            await fetch(
                                `https://nominatim.openstreetmap.org/reverse` +
                                `?format=json` +
                                `&lat=${position.coords.latitude}` +
                                `&lon=${position.coords.longitude}`
                            );

                        if (!response.ok) {

                            throw new Error(
                                "Reverse geocoding failed."
                            );
                        }

                        const data =
                            await response.json();

                        if (!originWasManuallyEntered) {
                            currentOrigin =
                                data.address?.city ||
                                data.address?.town ||
                                data.address?.municipality ||
                                data.address?.state_district ||
                                data.address?.county ||
                                "Pune";
                        }

                    } catch (error) {

                        console.warn(
                            "Reverse geocoding failed:",
                            error
                        );

                        if (!originWasManuallyEntered) {
                            currentOrigin =
                                "Pune";
                        }
                    }

                    if (originInput && !originWasManuallyEntered) {

                        originInput.value =
                            currentOrigin;
                    }

                    resolve();
                },

                () => {

                    /*
                     * Location permission denied /
                     * unavailable -> Pune fallback.
                     */
                    if (originWasManuallyEntered) {
                        resolve();
                        return;
                    }

                    currentOrigin =
                        "Pune";

                    currentOriginCoordinates = {

                        latitude: 18.5204,

                        longitude: 73.8567
                    };

                    if (originInput) {

                        originInput.value =
                            currentOrigin;
                    }

                    resolve();
                },

                {
                    enableHighAccuracy: false,
                    timeout: 8000,
                    maximumAge: 300000
                }
            );
        });
    }

    if (originInput) {
        const savedOrigin =
            originInput.value.trim();

        if (savedOrigin) {
            currentOrigin =
                savedOrigin;
            originWasManuallyEntered =
                true;
        } else {
            getUserLocation().catch((error) => {
                console.error(
                    "Initial location detection error:",
                    error
                );
            });
        }
    }


    // =========================================
    // MANUAL ORIGIN
    // =========================================

    async function setManualOrigin(origin) {

        const cleanOrigin =
            String(origin || "").trim();

        if (!cleanOrigin) {

            throw new Error(
                "Please enter a starting location."
            );
        }

        showStatus(
            '<i class="fa-solid fa-spinner fa-spin"></i> Finding your starting location...',
            "loading"
        );

        /*
         * Geocode manual From location.
         */
        const url =
            `https://nominatim.openstreetmap.org/search` +
            `?format=json` +
            `&limit=1` +
            `&q=${encodeURIComponent(cleanOrigin)}`;

        const response =
            await fetch(url);

        if (!response.ok) {

            throw new Error(
                "Unable to find the starting location."
            );
        }

        const data =
            await response.json();

        /*
         * If Nominatim cannot find it,
         * still allow Flights/Buses to use
         * the typed city name.
         */
        if (
            !Array.isArray(data) ||
            !data.length
        ) {

            currentOrigin =
                cleanOrigin;

            const knownCoordinates =
                getCityCoordinates(
                    cleanOrigin
                );

            currentOriginCoordinates =
                knownCoordinates
                    ? {
                        latitude:
                            knownCoordinates[0],

                        longitude:
                            knownCoordinates[1]
                    }
                    : null;

            if (!currentOriginCoordinates) {

                console.warn(
                    "Could not find coordinates for manual origin:",
                    cleanOrigin
                );
            }

            if (originInput) {

                originInput.value =
                    cleanOrigin;
            }

            return;
        }

        const location =
            data[0];

        const latitude =
            Number(location.lat);

        const longitude =
            Number(location.lon);

        if (
            !Number.isFinite(latitude) ||
            !Number.isFinite(longitude)
        ) {

            throw new Error(
                "Invalid coordinates received for the starting location."
            );
        }

        currentOrigin =
            cleanOrigin;

        currentOriginCoordinates = {

            latitude:
                latitude,

            longitude:
                longitude
        };

        /*
         * Keep exactly what user typed.
         */
        if (originInput) {

            originInput.value =
                cleanOrigin;
        }
    }


    // =========================================
    // LOAD TRAVEL RESULTS
    // =========================================

    async function loadTravelResults() {

        if (!dateInput) {
            throw new Error(
                "Travel date field is missing."
            );
        }

        const selectedDate =
            dateInput.value;

        /*
         * If origin is somehow missing,
         * detect current location.
         */
        if (!currentOrigin) {

            await getUserLocation();
        }

        /*
         * If manual origin was not geocoded,
         * try known city coordinates.
         */
        if (!currentOriginCoordinates) {

            const knownCoordinates =
                getCityCoordinates(
                    currentOrigin
                );

            if (knownCoordinates) {

                currentOriginCoordinates = {

                    latitude:
                        knownCoordinates[0],

                    longitude:
                        knownCoordinates[1]
                };
            }
        }

        showStatus(
            '<i class="fa-solid fa-spinner fa-spin"></i> Finding available flights...',
            "loading"
        );

        const params =
            new URLSearchParams();

        /*
         * FROM
         */
        params.set(
            "origin",
            currentOrigin
        );

        /*
         * TO
         */
        params.set(
            "destination",
            currentDestination
        );

        /*
         * DATE
         */
        params.set(
            "date",
            selectedDate
        );

        /*
         * Send manual/detected coordinates
         * whenever available.
         */
        if (
            currentOriginCoordinates &&
            Number.isFinite(
                Number(
                    currentOriginCoordinates.latitude
                )
            ) &&
            Number.isFinite(
                Number(
                    currentOriginCoordinates.longitude
                )
            )
        ) {

            params.set(
                "originLat",
                currentOriginCoordinates.latitude
            );

            params.set(
                "originLng",
                currentOriginCoordinates.longitude
            );
        }

        const response =
            await fetch(
                `/travel/search?${params.toString()}`
            );

        const data =
            await response.json();

        if (!response.ok) {

            throw new Error(
                data.message ||
                "Unable to search travel options."
            );
        }

        currentDestinationCoordinates =
            data.destinationCoordinates ||
            null;

        /*
         * Backend may normalize the origin.
         */
        if (
            data.origin &&
            !originWasManuallyEntered
        ) {

            currentOrigin =
                data.origin;
        }

        /*
         * Keep the user's visible From value.
         */
        if (
            originInput &&
            currentOrigin
        ) {

            originInput.value =
                currentOrigin;
        }

        if (dateContainer) {

            dateContainer.style.display =
                "flex";
        }

        if (resultsContainer) {

            resultsContainer.style.display =
                "block";
        }

        hideStatus();


        // =====================================
        // FLIGHTS
        // =====================================

        allFlights =
            Array.isArray(data.flights)
                ? data.flights
                : [];

        showingAllFlights =
            false;

        displayFlights();

        if (
            flightRouteText &&
            currentOrigin &&
            currentDestination
        ) {

            flightRouteText.textContent =
                `${currentOrigin} → ${currentDestination}`;
        }


            // =====================================
            // TRAINS
            // =====================================

            loadTrains(
                currentOrigin,
                currentDestination,
                selectedDate
            );


        // =====================================
        // BUSES
        // =====================================

        allBuses =
            generateBuses(
                currentOrigin,
                currentDestination,
                selectedDate
            );

        showingAllBuses =
            false;

        displayBuses();


        // =====================================
        // CRUISES
        // =====================================

        await loadCruises(
            currentDestination,
            selectedDate
        );


        // =====================================
        // MAP
        // =====================================

        if (
            data.route &&
            data.route.coordinates &&
            data.route.coordinates.length &&
            data.originCoordinates &&
            data.destinationCoordinates
        ) {

            if (mapSection) {

                mapSection.style.display =
                    "block";
            }

            if (mapText) {

                mapText.textContent =
                    `${currentOrigin} → ${currentDestination}`;
            }

            displayMap(
                data.route,
                data.originCoordinates,
                data.destinationCoordinates
            );

        } else {

            if (mapSection) {

                mapSection.style.display =
                    "none";
            }

            console.log(
                "Route map unavailable for this search."
            );
        }
    }


    // =========================================
    // FLIGHT BOOK NOW
    // =========================================

    if (flightList) {

        flightList.addEventListener(
            "click",
            async (event) => {

                const button =
                    event.target.closest(
                        ".flight-book-now"
                    );

                if (!button) {
                    return;
                }

                /*
                 * Cruise and bus buttons are
                 * handled separately.
                 */
                if (
                    button.classList.contains(
                        "cruise-book-now"
                    ) ||
                    button.classList.contains(
                        "bus-book-now"
                    )
                ) {

                    return;
                }

                const ignavId =
                    button.dataset.ignavId;

                if (!ignavId) {

                    showStatus(
                        "Booking information is not available for this flight.",
                        "error"
                    );

                    return;
                }

                const originalText =
                    button.innerHTML;

                button.disabled =
                    true;

                button.innerHTML =
                    '<i class="fa-solid fa-spinner fa-spin"></i> Opening...';

                try {

                    const response =
                        await fetch(
                            `/travel/booking-link/${encodeURIComponent(
                                ignavId
                            )}`
                        );

                    const data =
                        await response.json();

                    if (!response.ok) {

                        throw new Error(
                            data.message ||
                            "Unable to get booking link."
                        );
                    }

                    if (!data.url) {

                        throw new Error(
                            "No booking link is available for this flight."
                        );
                    }

                    window.location.href =
                        data.url;

                } catch (error) {

                    console.error(
                        "Booking error:",
                        error
                    );

                    showStatus(
                        error.message ||
                        "Unable to open booking page.",
                        "error"
                    );

                    button.disabled =
                        false;

                    button.innerHTML =
                        originalText;
                }
            }
        );
    }


    // =========================================
    // DISPLAY FLIGHTS
    // =========================================

    function displayFlights() {

        if (!flightList) {
            return;
        }

        flightList.innerHTML =
            "";

        if (!allFlights.length) {

            flightList.innerHTML = `
                <div class="travel-empty-card">

                    <i class="fa-solid fa-plane-slash"></i>

                    <h3>
                        No flights found
                    </h3>

                    <p>
                        No available flights were found
                        for this date.
                    </p>

                </div>
            `;

            if (flightMoreButton) {

                flightMoreButton.style.display =
                    "none";
            }

            return;
        }

        const flightsToShow =
            showingAllFlights
                ? allFlights
                : allFlights.slice(0, 3);

        flightsToShow.forEach(
            (flight) => {

                flightList.appendChild(
                    createFlightCard(flight)
                );
            }
        );

        if (
            flightMoreButton &&
            allFlights.length > 3 &&
            !showingAllFlights
        ) {

            flightMoreButton.style.display =
                "block";

        } else if (flightMoreButton) {

            flightMoreButton.style.display =
                "none";
        }
    }


    // =========================================
    // LOAD TRAINS
    // =========================================

    async function loadTrains(
        origin,
        destination,
        date
    ) {

        if (!trainList) {
            return;
        }

        allTrains = [];
        showingAllTrains = false;

        displayTrainsLoading();

        try {

            const params =
                new URLSearchParams();

            params.set(
                "origin",
                origin
            );

            params.set(
                "destination",
                destination
            );

            params.set(
                "date",
                date
            );

            const response =
                await fetch(
                    `/travel/trains?${params.toString()}`
                );

            const data =
                await response.json();

            if (!response.ok) {

                throw new Error(
                    data.message ||
                    "Unable to fetch train information."
                );
            }

            allTrains =
                Array.isArray(data.trains)
                    ? data.trains
                    : [];

            displayTrains();

        } catch (error) {

            console.error(
                "Train search error:",
                error
            );

            displayTrainsError();
        }
    }


    // =========================================
    // DISPLAY TRAINS
    // =========================================

    function displayTrainsLoading() {

        if (!trainList) {
            return;
        }

        trainList.innerHTML = `
            <div class="travel-empty-card">

                <i class="fa-solid fa-spinner fa-spin"></i>

                <h3>
                    Finding available trains...
                </h3>

            </div>
        `;

        if (trainMoreButton) {

            trainMoreButton.style.display =
                "none";
        }
    }


    function displayTrainsError() {

        if (!trainList) {
            return;
        }

        trainList.innerHTML = `
            <div class="travel-empty-card">

                <i class="fa-solid fa-triangle-exclamation"></i>

                <h3>
                    Trains are unavailable
                </h3>

                <p>
                    Train information is currently unavailable.
                </p>

            </div>
        `;

        if (trainMoreButton) {

            trainMoreButton.style.display =
                "none";
        }
    }


    function displayTrains() {

        if (!trainList) {
            return;
        }

        trainList.innerHTML =
            "";

        if (!allTrains.length) {

            trainList.innerHTML = `
                <div class="travel-empty-card">

                    <i class="fa-solid fa-train-subway"></i>

                    <h3>
                        No trains available
                    </h3>

                    <p>
                        No trains available for this route
                        on the selected date.
                    </p>

                </div>
            `;

            if (trainMoreButton) {

                trainMoreButton.style.display =
                    "none";
            }

            return;
        }

        const trainsToShow =
            showingAllTrains
                ? allTrains
                : allTrains.slice(0, 3);

        trainsToShow.forEach(
            train => {

                trainList.appendChild(
                    createTrainCard(train)
                );
            }
        );

        if (
            trainMoreButton &&
            allTrains.length > 3 &&
            !showingAllTrains
        ) {

            trainMoreButton.style.display =
                "block";

        } else if (trainMoreButton) {

            trainMoreButton.style.display =
                "none";
        }
    }


    function getTrainDuration(train) {

        if (train.duration) {
            return train.duration;
        }

        const departure =
            String(
                train.departureTime ||
                ""
            ).match(
                /^(\d{1,2}):(\d{2})/
            );

        const arrival =
            String(
                train.arrivalTime ||
                ""
            ).match(
                /^(\d{1,2}):(\d{2})/
            );

        if (!departure || !arrival) {
            return "N/A";
        }

        const departureMinutes =
            Number(departure[1]) * 60 +
            Number(departure[2]);

        let arrivalMinutes =
            Number(arrival[1]) * 60 +
            Number(arrival[2]);

        if (
            arrivalMinutes <
            departureMinutes
        ) {
            arrivalMinutes += 24 * 60;
        }

        const totalMinutes =
            arrivalMinutes - departureMinutes;

        const hours =
            Math.floor(
                totalMinutes / 60
            );

        const minutes =
            String(
                totalMinutes % 60
            ).padStart(2, "0");

        return `${hours}h ${minutes}m`;
    }


    function getTrainFareValue(fare) {

        const fareCandidates =
            fare && typeof fare === "object"
                ? [
                    fare.fare,
                    fare.amount,
                    fare.price,
                    fare.totalFare,
                    fare.breakdown?.totalFare
                ]
                : [fare];

        const numericFare =
            fareCandidates.find(
                candidate =>
                    candidate !== null &&
                    candidate !== undefined &&
                    candidate !== "" &&
                    Number.isFinite(Number(candidate))
            );

        return numericFare === undefined
            ? null
            : Number(numericFare);
    }


    function getTrainText(value, fallback) {

        if (
            value === null ||
            value === undefined ||
            value === "" ||
            typeof value === "object"
        ) {
            return fallback;
        }

        return String(value);
    }


    function buildConfirmTktTrainUrl(train) {

        const originCode =
            String(
                train.originStationCode ||
                ""
            ).trim().toUpperCase();

        const destinationCode =
            String(
                train.destinationStationCode ||
                ""
            ).trim().toUpperCase();

        const selectedDate =
            dateInput
                ? dateInput.value
                : "";

        const dateParts =
            selectedDate.match(
                /^(\d{4})-(\d{2})-(\d{2})$/
            );

        if (
            !originCode ||
            !destinationCode ||
            !dateParts
        ) {
            return null;
        }

        const bookingDate =
            `${dateParts[3]}-${dateParts[2]}-${dateParts[1]}`;

        return (
            "https://www.confirmtkt.com/rbooking/trains" +
            `/from/${encodeURIComponent(originCode)}` +
            `/to/${encodeURIComponent(destinationCode)}` +
            `/${bookingDate}`
        );
    }


    function createTrainCard(train) {

        const card =
            document.createElement("div");

        card.className =
            "flight-card";

        const trainType =
            train.trainType ||
            "";

        const duration =
            getTrainDuration(train);

        const distance =
            train.distance ||
            "";

        const fareValue =
            getTrainFareValue(
                train.fare
            );

        const fare =
            fareValue === null
                ? "Currently unavailable"
                : `₹${fareValue.toLocaleString("en-IN")}`;

        const fareClass =
            train.fareClass ||
            "";

        card.innerHTML = `
            <div class="flight-main">

                <div class="flight-time">

                    <strong>
                        ${escapeHTML(
                            train.departureTime ||
                            "N/A"
                        )}
                    </strong>

                    <small>
                        ${escapeHTML(
                            getTrainText(
                                train.originStation,
                                "Origin station"
                            )
                        )}
                    </small>

                </div>

                <div class="flight-duration">

                    <span>
                        ${escapeHTML(
                            duration
                        )}
                    </span>

                    <div class="flight-line">

                        <i class="fa-solid fa-train"></i>

                    </div>

                    <span>
                        ${escapeHTML(
                            getTrainText(
                                trainType,
                                "Train"
                            )
                        )}
                    </span>

                </div>

                <div class="flight-time">

                    <strong>
                        ${escapeHTML(
                            train.arrivalTime ||
                            "N/A"
                        )}
                    </strong>

                    <small>
                        ${escapeHTML(
                            getTrainText(
                                train.destinationStation,
                                "Destination station"
                            )
                        )}
                    </small>

                </div>

            </div>

            <div class="flight-details">

                <div>

                    <span class="flight-label">
                        Train
                    </span>

                    <strong>
                        ${escapeHTML(
                            getTrainText(
                                train.trainName,
                                "Train name unavailable"
                            )
                        )}
                    </strong>

                </div>

                <div>

                    <span class="flight-label">
                        Train No.
                    </span>

                    <strong>
                        ${escapeHTML(
                            getTrainText(
                                train.trainNumber,
                                "Train number unavailable"
                            )
                        )}
                    </strong>

                </div>

                <div>

                    <span class="flight-label">
                        Estimated travel time
                    </span>

                    <strong>
                        ${escapeHTML(
                            duration
                        )}
                    </strong>

                </div>

                <div>

                    <span class="flight-label">
                        Fare
                    </span>

                    <strong>
                        ${fare}
                    </strong>

                    ${
                        fareClass
                            ? `
                                <small>
                                    Class: ${escapeHTML(
                                        getTrainText(
                                            fareClass,
                                            ""
                                        )
                                    )}
                                </small>
                            `
                            : ""
                    }

                </div>

                ${
                    distance
                        ? `
                            <div>

                                <span class="flight-label">
                                    Distance
                                </span>

                                <strong>
                                    ${escapeHTML(distance)}
                                </strong>

                            </div>
                        `
                        : ""
                }

            </div>

            <button
                type="button"
                class="train-book-button travel-more-button"
            >
                Book Now
            </button>
        `;

        return card;
    }


    if (trainList) {

        trainList.addEventListener(
            "click",
            (event) => {

                const button =
                    event.target.closest(
                        ".train-book-button"
                    );

                if (!button) {
                    return;
                }

                const card =
                    button.closest(
                        ".flight-card"
                    );

                const trainIndex =
                    Array.from(
                        trainList.children
                    ).indexOf(card);

                const visibleTrains =
                    showingAllTrains
                        ? allTrains
                        : allTrains.slice(0, 3);

                const train =
                    visibleTrains[trainIndex];

                const bookingUrl =
                    train
                        ? buildConfirmTktTrainUrl(train)
                        : null;

                if (!bookingUrl) {

                    showStatus(
                        "Train booking information is unavailable.",
                        "error"
                    );

                    return;
                }

                window.location.href =
                    bookingUrl;
            }
        );
    }


    // =========================================
    // MORE TRAINS
    // =========================================

    if (trainMoreButton) {

        trainMoreButton.addEventListener(
            "click",
            () => {

                showingAllTrains =
                    true;

                displayTrains();
            }
        );
    }


    // =========================================
    // CREATE FLIGHT CARD
    // =========================================

    function createFlightCard(flight) {

        const card =
            document.createElement("div");

        card.className =
            "flight-card";

        const departureDate =
            new Date(
                flight.departureTime
            );

        const arrivalDate =
            new Date(
                flight.arrivalTime
            );

        const departureTime =
            formatTime(departureDate);

        const arrivalTime =
            formatTime(arrivalDate);

        const departureDateText =
            formatDate(departureDate);

        const arrivalDateText =
            formatDate(arrivalDate);

        card.innerHTML = `
            <div class="flight-main">

                <div class="flight-time">

                    <strong>
                        ${escapeHTML(departureTime)}
                    </strong>

                    <span>
                        ${escapeHTML(departureDateText)}
                    </span>

                    <small>
                        ${escapeHTML(
                            flight.originCode
                        )}
                    </small>

                </div>

                <div class="flight-duration">

                    <span>
                        ${escapeHTML(
                            flight.duration || "N/A"
                        )}
                    </span>

                    <div class="flight-line">

                        <i class="fa-solid fa-plane"></i>

                    </div>

                    <span>
                        Direct
                    </span>

                </div>

                <div class="flight-time">

                    <strong>
                        ${escapeHTML(arrivalTime)}
                    </strong>

                    <span>
                        ${escapeHTML(arrivalDateText)}
                    </span>

                    <small>
                        ${escapeHTML(
                            flight.destinationCode
                        )}
                    </small>

                </div>

            </div>

            <div class="flight-details">

                <div>

                    <span class="flight-label">
                        Airline
                    </span>

                    <strong>
                        ${escapeHTML(
                            flight.airline
                        )}
                    </strong>

                </div>

                <div>

                    <span class="flight-label">
                        Flight
                    </span>

                    <strong>
                        ${escapeHTML(
                            flight.flightNumber
                        )}
                    </strong>

                </div>

                <div>

                    <span class="flight-label">
                        Travel time
                    </span>

                    <strong>
                        ${escapeHTML(
                            flight.duration || "N/A"
                        )}
                    </strong>

                </div>

            </div>

            <button
                type="button"
                class="flight-book-now travel-more-button"
                data-ignav-id="${escapeHTML(
                    flight.ignavId
                )}"
            >
                Book now
            </button>
        `;

        return card;
    }


    // =========================================
    // MORE FLIGHTS
    // =========================================

    if (flightMoreButton) {

        flightMoreButton.addEventListener(
            "click",
            () => {

                showingAllFlights =
                    true;

                displayFlights();
            }
        );
    }


    // =========================================
    // REDBUS CITY DATA
    // =========================================

    const RED_BUS_CITY_DATA = {

        pune: {
            id: 130,
            name: "Pune"
        },

        delhi: {
            id: 733,
            name: "Delhi"
        },

        mumbai: {
            id: 462,
            name: "Mumbai"
        },

        nashik: {
            id: 0,
            name: "Nashik"
        },

        nagpur: {
            id: 0,
            name: "Nagpur"
        },

        kolhapur: {
            id: 0,
            name: "Kolhapur"
        },

        satara: {
            id: 0,
            name: "Satara"
        },

        aurangabad: {
            id: 0,
            name: "Aurangabad"
        },

        chhatrapati_sambhajinagar: {
            id: 0,
            name: "Chhatrapati Sambhajinagar"
        },

        ahmednagar: {
            id: 0,
            name: "Ahmednagar"
        },

        navi_mumbai: {
            id: 0,
            name: "Navi Mumbai"
        },

        thane: {
            id: 0,
            name: "Thane"
        },

        surat: {
            id: 0,
            name: "Surat"
        },

        vadodara: {
            id: 0,
            name: "Vadodara"
        },

        ahmedabad: {
            id: 0,
            name: "Ahmedabad"
        },

        goa: {
            id: 0,
            name: "Goa"
        },

        bengaluru: {
            id: 0,
            name: "Bengaluru"
        },

        bangalore: {
            id: 0,
            name: "Bengaluru"
        },

        hyderabad: {
            id: 0,
            name: "Hyderabad"
        },

        indore: {
            id: 0,
            name: "Indore"
        },

        bhopal: {
            id: 0,
            name: "Bhopal"
        },

        jaipur: {
            id: 0,
            name: "Jaipur"
        },

        lucknow: {
            id: 0,
            name: "Lucknow"
        },

        chandigarh: {
            id: 0,
            name: "Chandigarh"
        },

        chennai: {
            id: 0,
            name: "Chennai"
        },

        kolkata: {
            id: 0,
            name: "Kolkata"
        },

        kochi: {
            id: 0,
            name: "Kochi"
        }
    };


    // =========================================
    // CITY COORDINATES
    // =========================================

    const BUS_CITY_COORDINATES = {

        pune: [18.5204, 73.8567],

        mumbai: [19.0760, 72.8777],

        nashik: [19.9975, 73.7898],

        nagpur: [21.1458, 79.0882],

        kolhapur: [16.7050, 74.2433],

        satara: [17.6805, 74.0183],

        aurangabad: [19.8762, 75.3433],

        chhatrapati_sambhajinagar: [
            19.8762,
            75.3433
        ],

        ahmednagar: [19.0948, 74.7480],

        navi_mumbai: [19.0330, 73.0297],

        thane: [19.2183, 72.9781],

        surat: [21.1702, 72.8311],

        vadodara: [22.3072, 73.1812],

        ahmedabad: [23.0225, 72.5714],

        goa: [15.2993, 74.1240],

        bengaluru: [12.9716, 77.5946],

        bangalore: [12.9716, 77.5946],

        hyderabad: [17.3850, 78.4867],

        indore: [22.7196, 75.8577],

        bhopal: [23.2599, 77.4126],

        jaipur: [26.9124, 75.7873],

        delhi: [28.6139, 77.2090],

        lucknow: [26.8467, 80.9462],

        chandigarh: [30.7333, 76.7794],

        chennai: [13.0827, 80.2707],

        kolkata: [22.5726, 88.3639],

        kochi: [9.9312, 76.2673]
    };


    // =========================================
    // CITY HELPERS
    // =========================================

    function normalizeCityName(value) {

        return String(value || "")
            .trim()
            .toLowerCase()
            .replace(/\s+/g, "_");
    }


    function titleCaseCity(value) {

        return String(value || "")
            .trim()
            .replace(
                /\b\w/g,
                letter => letter.toUpperCase()
            );
    }


    function getCityData(city) {

        const key =
            normalizeCityName(city);

        return (
            RED_BUS_CITY_DATA[key] || {
                id: 0,
                name: titleCaseCity(city)
            }
        );
    }


    function getCityCoordinates(city) {

        const key =
            normalizeCityName(city);

        return (
            BUS_CITY_COORDINATES[key] ||
            null
        );
    }


    // =========================================
    // DISTANCE
    // =========================================

    function calculateDistanceKm(
        pointA,
        pointB
    ) {

        const earthRadiusKm =
            6371;

        const lat1 =
            pointA[0] *
            Math.PI /
            180;

        const lat2 =
            pointB[0] *
            Math.PI /
            180;

        const deltaLat =
            (
                pointB[0] -
                pointA[0]
            ) *
            Math.PI /
            180;

        const deltaLng =
            (
                pointB[1] -
                pointA[1]
            ) *
            Math.PI /
            180;

        const a =
            Math.sin(deltaLat / 2) ** 2 +
            Math.cos(lat1) *
            Math.cos(lat2) *
            Math.sin(deltaLng / 2) ** 2;

        const c =
            2 *
            Math.atan2(
                Math.sqrt(a),
                Math.sqrt(1 - a)
            );

        return earthRadiusKm * c;
    }


    // =========================================
    // BUS DURATION
    // =========================================

    function getLogicalBusDurationMinutes(
        origin,
        destination
    ) {

        /*
         * Prefer exact coordinates of the
         * currently selected From location.
         *
         * This is important for manual From.
         */
        let originCoordinates =
            currentOriginCoordinates
                ? [
                    Number(
                        currentOriginCoordinates.latitude
                    ),
                    Number(
                        currentOriginCoordinates.longitude
                    )
                ]
                : getCityCoordinates(origin);

        const destinationCoordinates =
            getCityCoordinates(destination);

        /*
         * If destination is not in the known
         * city table, use a reasonable fallback.
         */
        if (
            !originCoordinates ||
            !destinationCoordinates ||
            !originCoordinates.every(Number.isFinite)
        ) {

            return 6 * 60;
        }

        const straightLineDistance =
            calculateDistanceKm(
                originCoordinates,
                destinationCoordinates
            );

        const roadDistance =
            straightLineDistance * 1.20;

        let averageSpeed;

        if (roadDistance <= 100) {

            averageSpeed = 42;

        } else if (roadDistance <= 200) {

            averageSpeed = 45;

        } else if (roadDistance <= 400) {

            averageSpeed = 50;

        } else if (roadDistance <= 700) {

            averageSpeed = 55;

        } else if (roadDistance <= 1200) {

            averageSpeed = 58;

        } else {

            averageSpeed = 60;
        }

        let durationMinutes =
            Math.round(
                (
                    roadDistance /
                    averageSpeed
                ) * 60
            );

        if (roadDistance <= 150) {

            durationMinutes += 20;

        } else if (roadDistance <= 350) {

            durationMinutes += 35;

        } else if (roadDistance <= 700) {

            durationMinutes += 50;

        } else {

            durationMinutes += 75;
        }

        return Math.max(
            120,
            Math.min(
                durationMinutes,
                30 * 60
            )
        );
    }


    function formatDuration(totalMinutes) {

        const hours =
            Math.floor(
                totalMinutes / 60
            );

        const minutes =
            totalMinutes % 60;

        if (minutes === 0) {

            return `${hours}h`;
        }

        return (
            `${hours}h ` +
            `${String(minutes).padStart(2, "0")}m`
        );
    }


    // =========================================
    // GENERATE BUSES
    // =========================================

    function generateBuses(
        origin,
        destination,
        selectedDate
    ) {

        const buses = [];

        const busOperators = [

            "CityLink Travels",
            "InterCity Express",
            "National Travels",
            "Roadway Express",
            "Highway Travels",
            "Metro Bus Travels"
        ];

        const busTypes = [

            "AC Sleeper",
            "AC Seater",
            "Volvo AC",
            "AC Sleeper Seater",
            "Luxury AC"
        ];

        const today =
            new Date();

        const todayString =
            getLocalDateString(today);

        const isToday =
            selectedDate === todayString;

        let startTime;

        if (isToday) {

            startTime =
                new Date();

            const currentHour =
                startTime.getHours();

            let nextFourHourBlock =
                Math.ceil(
                    (currentHour + 1) / 4
                ) * 4;

            if (nextFourHourBlock >= 24) {

                startTime.setDate(
                    startTime.getDate() + 1
                );

                nextFourHourBlock =
                    nextFourHourBlock % 24;
            }

            startTime.setHours(
                nextFourHourBlock,
                Math.floor(
                    Math.random() * 30
                ),
                0,
                0
            );

        } else {

            startTime =
                new Date(
                    `${selectedDate}T00:00:00`
                );

            startTime.setHours(
                Math.floor(
                    Math.random() * 2
                ) * 4,
                Math.floor(
                    Math.random() * 30
                ),
                0,
                0
            );
        }

        const baseDurationMinutes =
            getLogicalBusDurationMinutes(
                origin,
                destination
            );

        for (
            let i = 0;
            i < 6;
            i++
        ) {

            const departure =
                new Date(startTime);

            departure.setTime(
                startTime.getTime() +
                i *
                4 *
                60 *
                60 *
                1000
            );

            departure.setMinutes(
                Math.floor(
                    Math.random() * 30
                )
            );

            const variationMinutes =
                Math.floor(
                    Math.random() * 31
                ) - 15;

            const durationMinutes =
                Math.max(
                    120,
                    baseDurationMinutes +
                    variationMinutes
                );

            const arrival =
                new Date(
                    departure.getTime() +
                    durationMinutes *
                    60 *
                    1000
                );

            const fare =
                Math.floor(
                    500 +
                    Math.random() * 1800
                );

            const operator =
                busOperators[
                    Math.floor(
                        Math.random() *
                        busOperators.length
                    )
                ];

            const busType =
                busTypes[
                    Math.floor(
                        Math.random() *
                        busTypes.length
                    )
                ];

            buses.push({

                id:
                    `BUS-${Date.now()}-${i}`,

                origin:
                    origin,

                destination:
                    destination,

                departureTime:
                    departure.toISOString(),

                arrivalTime:
                    arrival.toISOString(),

                duration:
                    formatDuration(
                        durationMinutes
                    ),

                operator:
                    operator,

                busType:
                    busType,

                fare:
                    fare
            });
        }

        return buses;
    }


    // =========================================
    // DISPLAY BUSES
    // =========================================

    function displayBuses() {

        if (!busList) {
            return;
        }

        busList.innerHTML =
            "";

        if (!allBuses.length) {

            busList.innerHTML = `
                <div class="travel-empty-card">

                    <i class="fa-solid fa-bus"></i>

                    <h3>
                        No buses found
                    </h3>

                    <p>
                        No bus options were generated
                        for this date.
                    </p>

                </div>
            `;

            if (busMoreButton) {

                busMoreButton.style.display =
                    "none";
            }

            return;
        }

        const busesToShow =
            showingAllBuses
                ? allBuses
                : allBuses.slice(0, 3);

        busesToShow.forEach(
            bus => {

                busList.appendChild(
                    createBusCard(bus)
                );
            }
        );

        if (
            busMoreButton &&
            allBuses.length > 3 &&
            !showingAllBuses
        ) {

            busMoreButton.style.display =
                "block";

        } else if (busMoreButton) {

            busMoreButton.style.display =
                "none";
        }
    }


    // =========================================
    // CREATE BUS CARD
    // =========================================

    function createBusCard(bus) {

        const card =
            document.createElement("div");

        card.className =
            "flight-card";

        const departureDate =
            new Date(
                bus.departureTime
            );

        const arrivalDate =
            new Date(
                bus.arrivalTime
            );

        card.innerHTML = `
            <div class="flight-main">

                <div class="flight-time">

                    <strong>
                        ${escapeHTML(
                            formatTime(
                                departureDate
                            )
                        )}
                    </strong>

                    <span>
                        ${escapeHTML(
                            formatDate(
                                departureDate
                            )
                        )}
                    </span>

                    <small>
                        ${escapeHTML(
                            bus.origin
                        )}
                    </small>

                </div>

                <div class="flight-duration">

                    <span>
                        ${escapeHTML(
                            bus.duration
                        )}
                    </span>

                    <div class="flight-line">

                        <i class="fa-solid fa-bus"></i>

                    </div>

                    <span>
                        Bus
                    </span>

                </div>

                <div class="flight-time">

                    <strong>
                        ${escapeHTML(
                            formatTime(
                                arrivalDate
                            )
                        )}
                    </strong>

                    <span>
                        ${escapeHTML(
                            formatDate(
                                arrivalDate
                            )
                        )}
                    </span>

                    <small>
                        ${escapeHTML(
                            bus.destination
                        )}
                    </small>

                </div>

            </div>

            <div class="flight-details">

                <div>

                    <span class="flight-label">
                        Operator
                    </span>

                    <strong>
                        ${escapeHTML(
                            bus.operator
                        )}
                    </strong>

                </div>

                <div>

                    <span class="flight-label">
                        Bus Type
                    </span>

                    <strong>
                        ${escapeHTML(
                            bus.busType
                        )}
                    </strong>

                </div>

                <div>

                    <span class="flight-label">
                        Fare
                    </span>

                    <strong>
                        ₹${Number(
                            bus.fare
                        ).toLocaleString("en-IN")}
                    </strong>

                </div>

            </div>

            <button
                type="button"
                class="bus-book-now travel-more-button"
                data-origin="${escapeHTML(
                    bus.origin
                )}"
                data-destination="${escapeHTML(
                    bus.destination
                )}"
                data-date="${escapeHTML(
                    selectedBusDate()
                )}"
            >
                Book now
            </button>
        `;

        return card;
    }


    // =========================================
    // BUS DATE
    // =========================================

    function selectedBusDate() {

        if (
            dateInput &&
            dateInput.value
        ) {

            return dateInput.value;
        }

        return getLocalDateString();
    }


    // =========================================
    // REDBUS URL
    // =========================================

    function createRedBusUrl(
        origin,
        destination,
        date
    ) {

        const originData =
            getCityData(origin);

        const destinationData =
            getCityData(destination);

        const originName =
            originData.name ||
            titleCaseCity(origin);

        const destinationName =
            destinationData.name ||
            titleCaseCity(destination);

        const originSlug =
            originName
                .toLowerCase()
                .trim()
                .replace(
                    /[^a-z0-9]+/g,
                    "-"
                )
                .replace(
                    /^-+|-+$/g,
                    ""
                );

        const destinationSlug =
            destinationName
                .toLowerCase()
                .trim()
                .replace(
                    /[^a-z0-9]+/g,
                    "-"
                )
                .replace(
                    /^-+|-+$/g,
                    ""
                );

        const dateObject =
            new Date(
                `${date}T00:00:00`
            );

        const day =
            String(
                dateObject.getDate()
            ).padStart(2, "0");

        const monthNames = [
            "Jan",
            "Feb",
            "Mar",
            "Apr",
            "May",
            "Jun",
            "Jul",
            "Aug",
            "Sep",
            "Oct",
            "Nov",
            "Dec"
        ];

        const month =
            monthNames[
                dateObject.getMonth()
            ];

        const year =
            dateObject.getFullYear();

        const redBusDate =
            `${day}-${month}-${year}`;

        const params =
            new URLSearchParams();

        if (originData.id) {

            params.set(
                "fromCityId",
                originData.id
            );
        }

        params.set(
            "fromCityName",
            originName
        );

        if (destinationData.id) {

            params.set(
                "toCityId",
                destinationData.id
            );
        }

        params.set(
            "toCityName",
            destinationName
        );

        params.set(
            "onward",
            redBusDate
        );

        params.set(
            "doj",
            redBusDate
        );

        params.set(
            "ref",
            "search"
        );

        return (
            `https://www.redbus.in/bus-tickets/` +
            `${originSlug}-to-${destinationSlug}` +
            `?${params.toString()}`
        );
    }


    // =========================================
    // BUS BOOK NOW
    // =========================================

    if (busList) {

        busList.addEventListener(
            "click",
            event => {

                const button =
                    event.target.closest(
                        ".bus-book-now"
                    );

                if (!button) {
                    return;
                }

                const origin =
                    button.dataset.origin ||
                    currentOrigin;

                const destination =
                    button.dataset.destination ||
                    currentDestination;

                const date =
                    button.dataset.date ||
                    selectedBusDate();

                if (
                    !origin ||
                    !destination ||
                    !date
                ) {

                    showStatus(
                        "Bus booking information is not available.",
                        "error"
                    );

                    return;
                }

                const redBusUrl =
                    createRedBusUrl(
                        origin,
                        destination,
                        date
                    );

                window.open(
                    redBusUrl,
                    "_blank",
                    "noopener,noreferrer"
                );
            }
        );
    }


    // =========================================
    // MORE BUSES
    // =========================================

    if (busMoreButton) {

        busMoreButton.addEventListener(
            "click",
            () => {

                showingAllBuses =
                    true;

                displayBuses();
            }
        );
    }


    // =========================================================
    // CRUISES
    // =========================================================

    async function loadCruises(
        destination,
        date
    ) {

        if (!cruiseList) {

            console.warn(
                "Cruise list element not found."
            );

            return;
        }

        try {

            allCruises =
                [];

            showingAllCruises =
                false;

            cruiseList.innerHTML = `
                <div class="travel-empty-card">

                    <i class="fa-solid fa-spinner fa-spin"></i>

                    <p>
                        Finding available cruises...
                    </p>

                </div>
            `;

            if (cruiseMoreButton) {

                cruiseMoreButton.style.display =
                    "none";
            }

            const params =
                new URLSearchParams();

            params.set(
                "destination",
                destination
            );

            if (date) {

                params.set(
                    "date",
                    date
                );
            }

            const response =
                await fetch(
                    `/travel/cruises?${params.toString()}`
                );

            if (!response.ok) {

                throw new Error(
                    `Cruise request failed: ${response.status}`
                );
            }

            const data =
                await response.json();

            if (!data.success) {

                throw new Error(
                    data.message ||
                    "Unable to load cruises."
                );
            }

            allCruises =
                Array.isArray(
                    data.cruises
                )
                    ? data.cruises
                    : [];

            console.log(
                "[CruiseFeed] Cruises received:",
                allCruises
            );

            displayCruises();

        } catch (error) {

            console.error(
                "[CruiseFeed] Error:",
                error
            );

            allCruises =
                [];

            cruiseList.innerHTML = `
                <div class="travel-empty-card">

                    <i class="fa-solid fa-ship"></i>

                    <p>
                        Cruise information is currently unavailable.
                    </p>

                </div>
            `;

            if (cruiseMoreButton) {

                cruiseMoreButton.style.display =
                    "none";
            }
        }
    }


    // =========================================
    // DISPLAY CRUISES
    // =========================================

    function displayCruises() {

        if (!cruiseList) {
            return;
        }

        cruiseList.innerHTML =
            "";

        if (!allCruises.length) {

            cruiseList.innerHTML = `
                <div class="travel-empty-card">

                    <i class="fa-solid fa-ship"></i>

                    <p>
                        No cruises found for this destination
                        on the selected date.
                    </p>

                </div>
            `;

            if (cruiseMoreButton) {

                cruiseMoreButton.style.display =
                    "none";
            }

            return;
        }

        const cruisesToShow =
            showingAllCruises
                ? allCruises
                : allCruises.slice(0, 3);

        cruisesToShow.forEach(
            cruise => {

                cruiseList.appendChild(
                    createCruiseCard(cruise)
                );
            }
        );

        if (
            cruiseMoreButton &&
            allCruises.length > 3
        ) {

            cruiseMoreButton.style.display =
                "inline-flex";

            cruiseMoreButton.innerHTML =
                showingAllCruises
                    ? `Less <i class="fa-solid fa-chevron-up"></i>`
                    : `More <i class="fa-solid fa-chevron-down"></i>`;

        } else if (cruiseMoreButton) {

            cruiseMoreButton.style.display =
                "none";
        }
    }


    // =========================================
    // CREATE CRUISE CARD
    // =========================================

    function createCruiseCard(cruise) {

        const card =
            document.createElement("div");

        card.className =
            "flight-card cruise-card";

        const cruiseLine =
            cruise.cruiseLine ||
            "Cruise operator";

        const shipName =
            cruise.shipName ||
            "Cruise ship";

        const title =
            cruise.title ||
            "Cruise sailing";

        const departurePort =
            cruise.departurePort ||
            "Departure port";

        const arrivalPort =
            cruise.arrivalPort ||
            "Cruise itinerary";

        const duration =
            cruise.duration ||
            "Cruise itinerary";

        const departureDate =
            formatCruiseDate(
                cruise.departureDate
            );

        const returnDate =
            formatCruiseDate(
                cruise.returnDate
            );


        // =====================================
        // PRICE
        // =====================================

        let priceHTML =
            "";

        if (
            cruise.price &&
            cruise.price.amount !== undefined &&
            cruise.price.amount !== null
        ) {

            const currency =
                cruise.price.currency ||
                "USD";

            const amount =
                Number(
                    cruise.price.amount
                );

            priceHTML = `
                <div class="flight-price">

                    <span class="flight-label">
                        Starting from
                    </span>

                    <strong>
                        ${escapeHTML(currency)}
                        ${
                            Number.isFinite(amount)
                                ? amount.toLocaleString()
                                : escapeHTML(
                                    String(
                                        cruise.price.amount
                                    )
                                )
                        }
                    </strong>

                </div>
            `;
        }


        // =====================================
        // PRICE PER NIGHT
        // =====================================

        let pricePerNightHTML =
            "";

        if (
            cruise.pricePerNight !== undefined &&
            cruise.pricePerNight !== null
        ) {

            const currency =
                cruise.price?.currency ||
                "USD";

            const perNight =
                Number(
                    cruise.pricePerNight
                );

            if (
                Number.isFinite(perNight)
            ) {

                pricePerNightHTML = `
                    <span>
                        ${escapeHTML(currency)}
                        ${perNight.toLocaleString()}
                        / night
                    </span>
                `;
            }
        }


        // =====================================
        // BOOKING BUTTON
        // =====================================

        const hasBookingUrl =
            cruise.bookingUrl &&
            isSafeCruiseUrl(
                cruise.bookingUrl
            );

        const bookingButtonHTML =
            hasBookingUrl
                ? `
                    <button
                        type="button"
                        class="flight-book-now cruise-book-now"
                        data-cruise-url="${escapeHTML(
                            cruise.bookingUrl
                        )}"
                    >
                        Book Now

                        <i class="fa-solid fa-arrow-up-right-from-square"></i>
                    </button>
                `
                : `
                    <button
                        type="button"
                        class="flight-book-now cruise-book-now"
                        disabled
                        title="Booking link is not available"
                    >
                        Booking unavailable
                    </button>
                `;


        card.innerHTML = `

            <div class="flight-main">

                <div class="flight-time">

                    <strong>
                        ${escapeHTML(
                            departureDate ||
                            "Departure"
                        )}
                    </strong>

                    <span>
                        ${escapeHTML(
                            departurePort
                        )}
                    </span>

                </div>


                <div class="flight-duration">

                    <span>
                        ${escapeHTML(
                            duration
                        )}
                    </span>

                    <div class="flight-line">

                        <i class="fa-solid fa-ship"></i>

                    </div>

                    <span>
                        ${
                            returnDate
                                ? `Return ${escapeHTML(
                                    returnDate
                                )}`
                                : "Cruise itinerary"
                        }
                    </span>

                </div>


                <div class="flight-time">

                    <strong>
                        ${escapeHTML(
                            arrivalPort
                        )}
                    </strong>

                    <span>
                        Final port
                    </span>

                </div>

            </div>


            <div class="flight-details">

                <div>

                    <span class="flight-label">
                        Cruise line
                    </span>

                    <strong>
                        ${escapeHTML(
                            cruiseLine
                        )}
                    </strong>

                </div>


                <div>

                    <span class="flight-label">
                        Ship
                    </span>

                    <strong>
                        ${escapeHTML(
                            shipName
                        )}
                    </strong>

                </div>


                <div>

                    <span class="flight-label">
                        Cruise
                    </span>

                    <strong>
                        ${escapeHTML(
                            title
                        )}
                    </strong>

                </div>


                ${
                    cruise.region
                        ? `
                            <div>

                                <span class="flight-label">
                                    Region
                                </span>

                                <strong>
                                    ${escapeHTML(
                                        cruise.region
                                    )}
                                </strong>

                            </div>
                        `
                        : ""
                }


                ${
                    cruise.nights
                        ? `
                            <div>

                                <span class="flight-label">
                                    Duration
                                </span>

                                <strong>

                                    ${escapeHTML(
                                        String(
                                            cruise.nights
                                        )
                                    )}

                                    night${
                                        Number(
                                            cruise.nights
                                        ) === 1
                                            ? ""
                                            : "s"
                                    }

                                </strong>

                            </div>
                        `
                        : ""
                }


                ${
                    pricePerNightHTML
                        ? `
                            <div>

                                <span class="flight-label">
                                    Price / night
                                </span>

                                <strong>
                                    ${pricePerNightHTML}
                                </strong>

                            </div>
                        `
                        : ""
                }


                ${priceHTML}


                <div class="cruise-booking-area">

                    ${bookingButtonHTML}

                </div>

            </div>
        `;


        // =====================================
        // CRUISE BOOKING
        // =====================================

        const bookButton =
            card.querySelector(
                ".cruise-book-now"
            );

        if (
            bookButton &&
            hasBookingUrl
        ) {

            bookButton.addEventListener(
                "click",
                () => {

                    const url =
                        bookButton.dataset.cruiseUrl;

                    if (
                        url &&
                        isSafeCruiseUrl(url)
                    ) {

                        window.open(
                            url,
                            "_blank",
                            "noopener,noreferrer"
                        );
                    }
                }
            );
        }

        return card;
    }


    // =========================================
    // CRUISE DATE
    // =========================================

    function formatCruiseDate(dateString) {

        if (!dateString) {
            return "";
        }

        const date =
            new Date(
                `${dateString}T00:00:00`
            );

        if (
            Number.isNaN(
                date.getTime()
            )
        ) {

            return String(
                dateString
            );
        }

        return date.toLocaleDateString(
            "en-IN",
            {
                day: "2-digit",
                month: "short",
                year: "numeric"
            }
        );
    }


    // =========================================
    // SAFE CRUISE URL
    // =========================================

    function isSafeCruiseUrl(url) {

        try {

            const parsed =
                new URL(
                    url,
                    window.location.origin
                );

            return (
                parsed.protocol === "http:" ||
                parsed.protocol === "https:"
            );

        } catch (error) {

            return false;
        }
    }


    // =========================================
    // MORE CRUISES
    // =========================================

    if (cruiseMoreButton) {

        cruiseMoreButton.addEventListener(
            "click",
            () => {

                showingAllCruises =
                    !showingAllCruises;

                displayCruises();
            }
        );
    }


    // =========================================
    // DATE CHANGE
    // =========================================

    if (dateInput) {

        dateInput.addEventListener(
            "change",
            async () => {

                if (!currentDestination) {
                    return;
                }

                try {

                    /*
                     * DO NOT call getUserLocation().
                     *
                     * This is important because if the
                     * user manually entered From, it must
                     * remain unchanged.
                     */
                    await loadTravelResults();

                } catch (error) {

                    console.error(
                        "Date change error:",
                        error
                    );

                    showStatus(
                        error.message ||
                        "Unable to update travel options.",
                        "error"
                    );
                }
            }
        );
    }


    // =========================================
    // FORMAT TIME
    // =========================================

    function formatTime(date) {

        if (
            !(date instanceof Date) ||
            Number.isNaN(date.getTime())
        ) {

            return "N/A";
        }

        return date.toLocaleTimeString(
            "en-IN",
            {
                hour: "numeric",
                minute: "2-digit",
                hour12: true
            }
        );
    }


    // =========================================
    // FORMAT DATE
    // =========================================

    function formatDate(date) {

        if (
            !(date instanceof Date) ||
            Number.isNaN(date.getTime())
        ) {

            return "N/A";
        }

        return date.toLocaleDateString(
            "en-IN",
            {
                day: "numeric",
                month: "short",
                year: "numeric"
            }
        );
    }


    // =========================================
    // DISPLAY MAP
    // =========================================

    function displayMap(
        route,
        originCoordinates,
        destinationCoordinates
    ) {

        if (!mapBox) {
            return;
        }

        // =====================================
        // LEAFLET CHECK
        // =====================================

        if (!window.L) {

            mapBox.innerHTML = `
                <div style="
                    padding:30px;
                    text-align:center;
                ">

                    <i class="fa-solid fa-map-location-dot"></i>

                    <p>
                        Map could not be loaded.
                    </p>

                </div>
            `;

            console.error(
                "Leaflet is not loaded."
            );

            return;
        }


        // =====================================
        // ROUTE CHECK
        // =====================================

        if (
            !route ||
            !route.coordinates ||
            !route.coordinates.length
        ) {

            mapBox.innerHTML = `
                <div style="
                    padding:30px;
                    text-align:center;
                ">

                    <p>
                        Route could not be found.
                    </p>

                </div>
            `;

            return;
        }


        // =====================================
        // COORDINATE CHECK
        // =====================================

        if (
            !originCoordinates ||
            !destinationCoordinates
        ) {

            mapBox.innerHTML = `
                <div style="
                    padding:30px;
                    text-align:center;
                ">

                    <p>
                        Location coordinates are unavailable.
                    </p>

                </div>
            `;

            return;
        }


        // =====================================
        // REMOVE OLD MAP
        // =====================================

        if (map) {

            map.remove();

            map = null;
        }


        // =====================================
        // CREATE MAP
        // =====================================

        map =
            L.map(
                "travel-map"
            );


        L.tileLayer(
            "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
            {
                attribution:
                    "&copy; OpenStreetMap contributors"
            }
        ).addTo(map);


        // =====================================
        // ROUTE COORDINATES
        // =====================================

        const routeCoordinates =
            route.coordinates.map(
                coordinate => [
                    coordinate[1],
                    coordinate[0]
                ]
            );


        // =====================================
        // DRAW ROUTE
        // =====================================

        const routeLine =
            L.polyline(
                routeCoordinates,
                {
                    weight: 6
                }
            ).addTo(map);


        // =====================================
        // ORIGIN MARKER
        // =====================================

        const originMarker =
            L.marker([
                originCoordinates.latitude,
                originCoordinates.longitude
            ]).addTo(map);

        originMarker.bindPopup(`
            <strong>
                Starting Location
            </strong>

            <br>

            ${escapeHTML(
                currentOrigin
            )}
        `);


        // =====================================
        // DESTINATION MARKER
        // =====================================

        const destinationMarker =
            L.marker([
                destinationCoordinates.latitude,
                destinationCoordinates.longitude
            ]).addTo(map);

        destinationMarker.bindPopup(`
            <strong>
                Destination
            </strong>

            <br>

            ${escapeHTML(
                currentDestination
            )}
        `);


        // =====================================
        // FIT ROUTE
        // =====================================

        map.fitBounds(
            routeLine.getBounds(),
            {
                padding: [
                    30,
                    30
                ]
            }
        );


        // =====================================
        // GOOGLE MAPS URL
        // =====================================

        const googleMapsUrl =
            `https://www.google.com/maps/dir/?api=1` +
            `&origin=${encodeURIComponent(
                `${originCoordinates.latitude},${originCoordinates.longitude}`
            )}` +
            `&destination=${encodeURIComponent(
                `${destinationCoordinates.latitude},${destinationCoordinates.longitude}`
            )}` +
            `&travelmode=driving`;


        // =====================================
        // CLICK MAP → GOOGLE MAPS
        // =====================================

        mapBox.style.cursor =
            "pointer";

        mapBox.title =
            "Click to open driving directions in Google Maps";

        mapBox.onclick =
            function (event) {

                if (
                    event.target.closest(
                        ".leaflet-control"
                    )
                ) {

                    return;
                }

                window.open(
                    googleMapsUrl,
                    "_blank"
                );
            };


        // =====================================
        // GOOGLE MAPS BUTTON
        // =====================================

        let directionsButton =
            document.getElementById(
                "google-maps-directions-button"
            );

        if (!directionsButton) {

            directionsButton =
                document.createElement(
                    "button"
                );

            directionsButton.type =
                "button";

            directionsButton.id =
                "google-maps-directions-button";

            directionsButton.className =
                "google-maps-directions-button";

            directionsButton.innerHTML = `
                <i class="fa-solid fa-diamond-turn-right"></i>

                Open Directions in Google Maps
            `;

            if (mapSection) {

                mapSection.appendChild(
                    directionsButton
                );
            }
        }

        directionsButton.onclick =
            function (event) {

                event.stopPropagation();

                window.open(
                    googleMapsUrl,
                    "_blank"
                );
            };
    }


    // =========================================
    // ESCAPE HTML
    // =========================================

    function escapeHTML(value) {

        if (
            value === null ||
            value === undefined
        ) {

            return "";
        }

        return String(value)

            .replace(
                /&/g,
                "&amp;"
            )

            .replace(
                /</g,
                "&lt;"
            )

            .replace(
                />/g,
                "&gt;"
            )

            .replace(
                /"/g,
                "&quot;"
            )

            .replace(
                /'/g,
                "&#039;"
            );
    }

});