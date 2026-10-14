(() => {
    function isValidDateValue(dateValue) {
        if (!/^\d{4}-\d{2}-\d{2}$/.test(dateValue || "")) {
            return false;
        }

        const [year, month, day] = dateValue.split("-").map(Number);
        const parsedDate = new Date(year, month - 1, day);
        return (
            parsedDate.getFullYear() === year &&
            parsedDate.getMonth() === month - 1 &&
            parsedDate.getDate() === day
        );
    }

    function initializeBookingConfirmation() {
        const confirmationPage =
            document.querySelector(".booking-confirmation-page");

        if (
            !confirmationPage ||
            confirmationPage.dataset.bookingInteractionsInitialized === "true"
        ) {
            return;
        }

        confirmationPage.dataset.bookingInteractionsInitialized = "true";

        const routeMatch =
            window.location.pathname.match(/^\/listings\/([a-f\d]{24})\/booking$/i);
        const listingId =
            confirmationPage.dataset.listingId ||
            (routeMatch ? routeMatch[1] : "");
        const parameters =
            new URLSearchParams(window.location.search);
        const selection = {
            checkIn:
                confirmationPage.dataset.checkIn ||
                parameters.get("checkIn") ||
                "",
            checkOut:
                confirmationPage.dataset.checkOut ||
                parameters.get("checkOut") ||
                "",
            adults:
                confirmationPage.dataset.adults ||
                parameters.get("adults") ||
                "",
            children:
                confirmationPage.dataset.children ||
                parameters.get("children") ||
                "",
            pets:
                confirmationPage.dataset.pets ||
                parameters.get("pets") ||
                ""
        };

        function getValidatedSelection() {
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            const [checkInYear, checkInMonth, checkInDay] =
                selection.checkIn.split("-").map(Number);
            const checkInDate =
                new Date(checkInYear, checkInMonth - 1, checkInDay);
            const guestCounts = {
                adults: Number(selection.adults),
                children: Number(selection.children),
                pets: Number(selection.pets)
            };
            const validDates =
                isValidDateValue(selection.checkIn) &&
                isValidDateValue(selection.checkOut) &&
                checkInDate >= today &&
                selection.checkOut > selection.checkIn;
            const validGuests =
                /^\d+$/.test(selection.adults) &&
                /^\d+$/.test(selection.children) &&
                /^\d+$/.test(selection.pets) &&
                Number.isSafeInteger(guestCounts.adults) &&
                Number.isSafeInteger(guestCounts.children) &&
                Number.isSafeInteger(guestCounts.pets) &&
                guestCounts.adults >= 1 &&
                guestCounts.children >= 0 &&
                guestCounts.pets >= 0 &&
                guestCounts.adults + guestCounts.children <= 16 &&
                guestCounts.pets <= 10;

            return validDates && validGuests ? guestCounts : null;
        }

        function updateConfirmationSubtotal() {
            const nightlyPrice =
                Number(confirmationPage.dataset.nightlyPrice);
            const guestCounts = getValidatedSelection();

            if (
                !guestCounts ||
                !Number.isFinite(nightlyPrice) ||
                nightlyPrice < 0
            ) {
                return;
            }

            const [checkInYear, checkInMonth, checkInDay] =
                selection.checkIn.split("-").map(Number);
            const [checkOutYear, checkOutMonth, checkOutDay] =
                selection.checkOut.split("-").map(Number);
            const nights =
                (
                    Date.UTC(checkOutYear, checkOutMonth - 1, checkOutDay) -
                    Date.UTC(checkInYear, checkInMonth - 1, checkInDay)
                ) / 86400000;

            if (!Number.isInteger(nights) || nights < 1) {
                return;
            }

            const nightsLabel =
                `${nights} ${nights === 1 ? "night" : "nights"}`;
            const subtotal =
                `₹${new Intl.NumberFormat("en-IN", {
                    maximumFractionDigits: 2
                }).format(nightlyPrice * nights)}`;
            const nightsElement =
                confirmationPage.querySelector("[data-booking-nights]");
            const subtotalElement =
                confirmationPage.querySelector("[data-booking-subtotal]");

            if (nightsElement && nightsElement.textContent.trim() !== nightsLabel) {
                nightsElement.textContent = nightsLabel;
            }

            if (
                subtotalElement &&
                subtotalElement.textContent.trim() !== subtotal
            ) {
                subtotalElement.textContent = subtotal;
            }
        }

        confirmationPage.addEventListener("click", function (event) {
            if (!(event.target instanceof Element)) {
                return;
            }

            const changeButton =
                event.target.closest("[data-booking-change]");

            if (!changeButton) {
                return;
            }

            const guestCounts = getValidatedSelection();
            if (
                !/^[a-f\d]{24}$/i.test(listingId) ||
                !guestCounts
            ) {
                event.preventDefault();
                window.alert(
                    "Please return to the listing and choose valid dates and guest counts."
                );
                return;
            }

            const bookingSelectionUrl =
                new URL(`/listings/${listingId}`, window.location.origin);
            bookingSelectionUrl.searchParams.set("checkIn", selection.checkIn);
            bookingSelectionUrl.searchParams.set("checkOut", selection.checkOut);
            bookingSelectionUrl.searchParams.set(
                "adults",
                String(guestCounts.adults)
            );
            bookingSelectionUrl.searchParams.set(
                "children",
                String(guestCounts.children)
            );
            bookingSelectionUrl.searchParams.set(
                "pets",
                String(guestCounts.pets)
            );

            event.preventDefault();
            window.location.assign(bookingSelectionUrl.toString());
        });

        updateConfirmationSubtotal();
    }

    function initializeNearbyListings() {
        const nearbySection =
            document.querySelector(".nearby-listings-section");
        const nearbyTrack =
            nearbySection &&
            nearbySection.querySelector(".nearby-listings-row");

        if (
            !nearbySection ||
            !nearbyTrack ||
            nearbyTrack.dataset.nearbyNavigationInitialized === "true"
        ) {
            return;
        }

        const previousButton =
            nearbySection.querySelector('[data-nearby-direction="-1"]');
        const nextButton =
            nearbySection.querySelector('[data-nearby-direction="1"]');

        if (!previousButton || !nextButton) {
            return;
        }

        nearbyTrack.dataset.nearbyNavigationInitialized = "true";

        function updateArrowStates() {
            const maxScroll =
                nearbyTrack.scrollWidth - nearbyTrack.clientWidth;

            previousButton.disabled =
                nearbyTrack.scrollLeft <= 1;
            nextButton.disabled =
                maxScroll <= 1 ||
                nearbyTrack.scrollLeft >= maxScroll - 1;
        }

        previousButton.addEventListener("click", function () {
            nearbyTrack.scrollBy({
                left: -nearbyTrack.clientWidth * 0.85,
                behavior: "smooth"
            });
        });

        nextButton.addEventListener("click", function () {
            nearbyTrack.scrollBy({
                left: nearbyTrack.clientWidth * 0.85,
                behavior: "smooth"
            });
        });

        nearbyTrack.addEventListener("scroll", updateArrowStates, {
            passive: true
        });
        window.addEventListener("resize", updateArrowStates);
        updateArrowStates();
    }

    function initializeListingBooking() {
        initializeNearbyListings();
        initializeBookingConfirmation();

        const bookingForm = document.getElementById("listing-booking-form");

        if (!bookingForm || bookingForm.dataset.bookingInitialized === "true") {
            return;
        }

        const checkInInput = document.getElementById("booking-check-in");
        const checkOutInput = document.getElementById("booking-check-out");
        const guestsTrigger = document.getElementById("booking-guests-trigger");
        const guestsPopover = document.getElementById("booking-guest-popover");
        const guestsSummary = document.getElementById("booking-guests-summary");
        const bookingCard = document.querySelector(".listing-booking-card");
        const stickyBar = document.getElementById("listing-sticky-bar");
        const bookingPriceSummary =
            document.getElementById("booking-price-summary");
        const stickyPriceSummary =
            document.getElementById("sticky-price-summary");
        const priceSummaries =
            [bookingPriceSummary, stickyPriceSummary].filter(Boolean);

        if (
            !checkInInput ||
            !checkOutInput ||
            !guestsTrigger ||
            !guestsPopover ||
            !guestsSummary
        ) {
            return;
        }

        bookingForm.dataset.bookingInitialized = "true";

        function formatLocalDate(date) {
            const year = date.getFullYear();
            const month = String(date.getMonth() + 1).padStart(2, "0");
            const day = String(date.getDate()).padStart(2, "0");
            return `${year}-${month}-${day}`;
        }

        function getNextLocalDate(dateValue) {
            const [year, month, day] = dateValue.split("-").map(Number);
            return formatLocalDate(new Date(year, month - 1, day + 1));
        }

        function isValidDate(dateValue) {
            if (!/^\d{4}-\d{2}-\d{2}$/.test(dateValue)) {
                return false;
            }

            const [year, month, day] = dateValue.split("-").map(Number);
            const parsedDate = new Date(year, month - 1, day);
            return (
                parsedDate.getFullYear() === year &&
                parsedDate.getMonth() === month - 1 &&
                parsedDate.getDate() === day
            );
        }

        const today = formatLocalDate(new Date());
        const searchParameters =
            new URLSearchParams(window.location.search);
        const requestedCheckIn =
            searchParameters.get("checkIn") || "";
        const requestedCheckOut =
            searchParameters.get("checkOut") || "";
        const requestedCheckInIsValid =
            isValidDate(requestedCheckIn) && requestedCheckIn >= today;
        const initialCheckIn =
            requestedCheckInIsValid ? requestedCheckIn : today;

        checkInInput.min = today;
        checkInInput.value = initialCheckIn;
        checkOutInput.min = getNextLocalDate(initialCheckIn);
        checkOutInput.value =
            isValidDate(requestedCheckOut) &&
                requestedCheckOut > initialCheckIn
                ? requestedCheckOut
                : checkOutInput.min;

        function updatePriceSummary() {
            if (!priceSummaries.length) {
                return;
            }

            const summaryParts = priceSummaries.map((summary) => {
                let total = summary.querySelector(".listing-price-total");
                let nightLabel =
                    summary.querySelector(".listing-price-night-label");

                if (!total || !nightLabel) {
                    summary.textContent = "";
                    total = document.createElement("span");
                    total.className = "listing-price-total";
                    nightLabel = document.createElement("span");
                    nightLabel.className = "listing-price-night-label";
                    summary.append(total, nightLabel);
                }

                return { total, nightLabel };
            });

            const nightlyPrice =
                Number(priceSummaries[0].dataset.nightlyPrice);
            if (!Number.isFinite(nightlyPrice)) {
                console.error("Listing booking price is not a valid number.");
                return;
            }

            if (
                !isValidDate(checkInInput.value) ||
                !isValidDate(checkOutInput.value)
            ) {
                return;
            }

            const [checkInYear, checkInMonth, checkInDay] =
                checkInInput.value.split("-").map(Number);
            const [checkOutYear, checkOutMonth, checkOutDay] =
                checkOutInput.value.split("-").map(Number);
            const checkInTime =
                Date.UTC(checkInYear, checkInMonth - 1, checkInDay);
            const checkOutTime =
                Date.UTC(checkOutYear, checkOutMonth - 1, checkOutDay);
            const nights = (checkOutTime - checkInTime) / 86400000;

            if (!Number.isInteger(nights) || nights < 1) {
                return;
            }

            const formatter = new Intl.NumberFormat("en-IN", {
                maximumFractionDigits: 2
            });
            const total = formatter.format(nightlyPrice * nights);
            const nightLabel =
                `for ${nights} ${nights === 1 ? "night" : "nights"}`;

            summaryParts.forEach((parts) => {
                const formattedTotal = `₹${total}`;
                if (parts.total.textContent.trim() !== formattedTotal) {
                    parts.total.textContent = formattedTotal;
                }
                if (parts.nightLabel.textContent.trim() !== nightLabel) {
                    parts.nightLabel.textContent = nightLabel;
                }
            });
        }

        updatePriceSummary();

        checkInInput.addEventListener("change", function () {
            if (!checkInInput.value || !isValidDate(checkInInput.value)) {
                checkOutInput.setCustomValidity("");
                return;
            }

            checkOutInput.min = getNextLocalDate(checkInInput.value);
            if (!checkOutInput.value || checkOutInput.value <= checkInInput.value) {
                checkOutInput.value = checkOutInput.min;
            }
            checkInInput.setCustomValidity("");
            checkOutInput.setCustomValidity("");
            updatePriceSummary();
        });

        checkOutInput.addEventListener("change", function () {
            checkOutInput.setCustomValidity(
                isValidDate(checkInInput.value) &&
                    isValidDate(checkOutInput.value) &&
                    checkOutInput.value > checkInInput.value
                    ? ""
                    : "Checkout must be after check-in."
            );
            updatePriceSummary();
        });

        function updateGuestSummary() {
            const counts = {};

            guestsPopover.querySelectorAll("[data-guest-type]").forEach((counter) => {
                const type = counter.dataset.guestType;
                const countElement = counter.querySelector("[data-guest-count]");
                const minimum = Number(counter.dataset.minimum);
                const maximum = type === "pets" ? 10 : 16;
                const value = Math.min(
                    maximum,
                    Math.max(minimum, Number(countElement.textContent) || 0)
                );
                const hiddenInput = bookingForm.querySelector(
                    `[data-guest-value="${type}"]`
                );

                countElement.textContent = String(value);
                counts[type] = value;
                if (hiddenInput) {
                    hiddenInput.value = String(value);
                }
            });

            guestsPopover.querySelectorAll("[data-guest-type]").forEach((counter) => {
                const type = counter.dataset.guestType;
                const minimum = Number(counter.dataset.minimum);
                const maximum = type === "pets" ? 10 : 16;
                const value =
                    Number(counter.querySelector("[data-guest-count]").textContent);
                counter.querySelectorAll("[data-guest-change]").forEach((button) => {
                    const change = Number(button.dataset.guestChange);
                    const wouldExceedGuestLimit =
                        change > 0 &&
                        type !== "pets" &&
                        counts.adults + counts.children >= 16;
                    button.disabled =
                        (change < 0 && value <= minimum) ||
                        (change > 0 && value >= maximum) ||
                        wouldExceedGuestLimit;
                });
            });

            const humanGuests = counts.adults + counts.children;
            const guestLabel = humanGuests === 1 ? "guest" : "guests";
            const petLabel = counts.pets === 1 ? "pet" : "pets";
            guestsSummary.textContent =
                `${humanGuests} ${guestLabel} · ${counts.pets} ${petLabel}`;
        }

        guestsPopover.querySelectorAll("[data-guest-type]").forEach((counter) => {
            const type = counter.dataset.guestType;
            const initialCounts = {
                adults: searchParameters.get("adults"),
                children: searchParameters.get("children"),
                pets: searchParameters.get("pets")
            };
            const requestedCount = initialCounts[type];
            const fallbackCounts = { adults: 4, children: 0, pets: 0 };
            const parsedCount =
                /^\d+$/.test(requestedCount || "")
                    ? Number(requestedCount)
                    : fallbackCounts[type];

            counter.querySelector("[data-guest-count]").textContent =
                String(
                    Number.isSafeInteger(parsedCount)
                        ? parsedCount
                        : fallbackCounts[type]
                );
        });

        const requestedAdults =
            Number(searchParameters.get("adults"));
        const requestedChildren =
            Number(searchParameters.get("children"));
        const requestedPets =
            Number(searchParameters.get("pets"));
        const validRequestedGuestCounts =
            Number.isSafeInteger(requestedAdults) &&
            Number.isSafeInteger(requestedChildren) &&
            Number.isSafeInteger(requestedPets) &&
            requestedAdults >= 1 &&
            requestedChildren >= 0 &&
            requestedPets >= 0 &&
            requestedAdults + requestedChildren <= 16 &&
            requestedPets <= 10;

        if (!validRequestedGuestCounts) {
            guestsPopover.querySelectorAll("[data-guest-type]").forEach((counter) => {
                const fallbackCounts = { adults: 4, children: 0, pets: 0 };
                counter.querySelector("[data-guest-count]").textContent =
                    String(fallbackCounts[counter.dataset.guestType]);
            });
        }

        updateGuestSummary();

        guestsTrigger.addEventListener("click", function () {
            const isExpanded = guestsTrigger.getAttribute("aria-expanded") === "true";
            guestsTrigger.setAttribute("aria-expanded", String(!isExpanded));
            guestsPopover.hidden = isExpanded;
        });

        guestsPopover.addEventListener("click", function (event) {
            const button = event.target.closest("[data-guest-change]");
            if (!button || button.disabled) {
                return;
            }

            event.preventDefault();
            const counter = button.closest("[data-guest-type]");
            const countElement = counter.querySelector("[data-guest-count]");
            const minimum = Number(counter.dataset.minimum);
            const change = Number(button.dataset.guestChange);
            countElement.textContent = String(
                Math.max(minimum, Number(countElement.textContent) + change)
            );
            updateGuestSummary();
        });

        document.addEventListener("click", function (event) {
            if (
                !guestsPopover.hidden &&
                !guestsPopover.contains(event.target) &&
                !guestsTrigger.contains(event.target)
            ) {
                guestsPopover.hidden = true;
                guestsTrigger.setAttribute("aria-expanded", "false");
            }
        });

        document.addEventListener("keydown", function (event) {
            if (event.key === "Escape" && !guestsPopover.hidden) {
                guestsPopover.hidden = true;
                guestsTrigger.setAttribute("aria-expanded", "false");
                guestsTrigger.focus();
            }
        });

        if (stickyBar && !stickyBar.dataset.bookingInitialized) {
            stickyBar.dataset.bookingInitialized = "true";
            const navbar = document.querySelector(".navbar");
            const navbarHeight = navbar
                ? navbar.getBoundingClientRect().height
                : 0;

            function setStickyVisibility(visible) {
                if (stickyBar.hidden === !visible) {
                    return;
                }

                stickyBar.hidden = !visible;
                stickyBar.setAttribute("aria-hidden", String(!visible));
            }

            function updateStickyVisibility() {
                if (!bookingCard) {
                    setStickyVisibility(false);
                    return;
                }

                setStickyVisibility(
                    bookingCard.getBoundingClientRect().bottom <= navbarHeight
                );
            }

            if ("IntersectionObserver" in window && bookingCard) {
                const observer = new IntersectionObserver(
                    function (entries) {
                        const entry = entries[0];
                        setStickyVisibility(
                            !entry.isIntersecting &&
                                entry.boundingClientRect.bottom <= navbarHeight
                        );
                    },
                    {
                        rootMargin: `-${navbarHeight}px 0px 0px 0px`,
                        threshold: 0
                    }
                );
                observer.observe(bookingCard);
                window.addEventListener("resize", updateStickyVisibility);
            } else {
                let visibilityUpdateScheduled = false;

                function scheduleStickyVisibilityUpdate() {
                    if (visibilityUpdateScheduled) {
                        return;
                    }

                    visibilityUpdateScheduled = true;
                    window.requestAnimationFrame(function () {
                        visibilityUpdateScheduled = false;
                        updateStickyVisibility();
                    });
                }

                window.addEventListener(
                    "scroll",
                    scheduleStickyVisibilityUpdate,
                    { passive: true }
                );
                window.addEventListener(
                    "resize",
                    scheduleStickyVisibilityUpdate
                );
                updateStickyVisibility();
            }

            stickyBar.addEventListener("click", function (event) {
                const link = event.target.closest('a[href^="#"]');
                if (!link) {
                    return;
                }

                const target = document.getElementById(
                    decodeURIComponent(link.hash.slice(1))
                );
                if (!target) {
                    return;
                }

                event.preventDefault();
                const stickyHeight = stickyBar.hidden
                    ? 0
                    : stickyBar.getBoundingClientRect().height;
                const top =
                    target.getBoundingClientRect().top +
                    window.scrollY -
                    navbarHeight -
                    stickyHeight -
                    12;

                window.scrollTo({
                    top: Math.max(0, top),
                    behavior: "smooth"
                });
            });
        }

        bookingForm.addEventListener("submit", function (event) {
            event.preventDefault();

            updateGuestSummary();

            const validCheckIn =
                isValidDate(checkInInput.value) && checkInInput.value >= today;
            const validCheckOut =
                isValidDate(checkOutInput.value) &&
                isValidDate(checkInInput.value) &&
                checkOutInput.value > checkInInput.value;

            checkInInput.setCustomValidity(
                validCheckIn ? "" : "Choose a valid check-in date that is today or later."
            );
            checkOutInput.setCustomValidity(
                validCheckOut ? "" : "Checkout must be after check-in."
            );

            if (!bookingForm.reportValidity()) {
                return;
            }

            const guestCounts = {};
            let validGuestCounts = true;
            guestsPopover.querySelectorAll("[data-guest-type]").forEach((counter) => {
                const type = counter.dataset.guestType;
                const value = Number(
                    counter.querySelector("[data-guest-count]").textContent
                );
                const minimum = Number(counter.dataset.minimum);
                guestCounts[type] = value;
                validGuestCounts =
                    validGuestCounts &&
                    Number.isInteger(value) &&
                    value >= minimum;
            });

            validGuestCounts =
                validGuestCounts &&
                guestCounts.adults + guestCounts.children <= 16 &&
                guestCounts.pets <= 10;

            if (!validGuestCounts) {
                window.alert("Please choose at least one adult and valid guest counts.");
                guestsTrigger.focus();
                return;
            }

            const bookingUrl = new URL(bookingForm.action, window.location.href);
            bookingUrl.searchParams.set("checkIn", checkInInput.value);
            bookingUrl.searchParams.set("checkOut", checkOutInput.value);
            bookingUrl.searchParams.set("adults", String(guestCounts.adults));
            bookingUrl.searchParams.set("children", String(guestCounts.children));
            bookingUrl.searchParams.set("pets", String(guestCounts.pets));
            window.location.assign(bookingUrl.toString());
        });
    }

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", initializeListingBooking, {
            once: true
        });
    } else {
        initializeListingBooking();
    }
})();
