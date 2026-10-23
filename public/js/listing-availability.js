(() => {
    function initializeListingAvailability() {
        const form = document.getElementById("listing-booking-form");
        const bookingCard = document.querySelector(".listing-booking-card");
        const checkInInput = document.getElementById("booking-check-in");
        const checkOutInput = document.getElementById("booking-check-out");
        const message = document.getElementById("booking-availability-message");

        if (
            !form ||
            !bookingCard ||
            !checkInInput ||
            !checkOutInput ||
            form.dataset.availabilityInitialized === "true"
        ) {
            return;
        }

        const bookingUrl = new URL(form.action, window.location.href);
        const listingMatch =
            bookingUrl.pathname.match(/^\/listings\/([a-f\d]{24})\/booking$/i);
        const listingId = listingMatch && listingMatch[1];
        const calendars = Array.from(
            bookingCard.querySelectorAll("[data-calendar-for]")
        );
        const stickyButton =
            document.getElementById("listing-sticky-book-now");

        if (!listingId || calendars.length !== 2 || !message) {
            return;
        }

        function isValidDate(value) {
            if (!/^\d{4}-\d{2}-\d{2}$/.test(value || "")) {
                return false;
            }

            const [year, month, day] = value.split("-").map(Number);
            const timestamp = Date.UTC(year, month - 1, day);
            return (
                new Date(timestamp).toISOString().slice(0, 10) === value
            );
        }

        function formatDate(year, month, day) {
            return `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
        }

        function todayDate() {
            const today = new Date();
            return formatDate(
                today.getFullYear(),
                today.getMonth() + 1,
                today.getDate()
            );
        }

        let unavailableRanges;
        try {
            unavailableRanges = JSON.parse(
                form.dataset.unavailableDateRanges || "[]"
            );
            if (
                !Array.isArray(unavailableRanges) ||
                unavailableRanges.some((range) =>
                    !range ||
                    !isValidDate(range.from) ||
                    !isValidDate(range.to) ||
                    range.from > range.to
                )
            ) {
                throw new Error("Unavailable date ranges are invalid.");
            }
        } catch (error) {
            console.error("Could not read listing availability dates.", error);
            checkInInput.disabled = true;
            checkOutInput.disabled = true;
            message.hidden = false;
            message.textContent =
                "Unavailable dates could not be loaded. Please refresh and try again.";
            return;
        }

        form.dataset.availabilityInitialized = "true";
        const unavailableMessage =
            "Oops! This property is not available for those days. Can you choose different dates?";
        const unavailableDate = (value) =>
            unavailableRanges.some(
                (range) => value >= range.from && value <= range.to
            );
        const hasUnavailableOverlap = (checkIn, checkOut) =>
            unavailableRanges.some(
                (range) => checkIn <= range.to && checkOut > range.from
            );

        function setMessage(text, visible = true) {
            message.textContent = text;
            message.hidden = !visible;
        }

        function isValidStay(checkIn, checkOut) {
            return (
                isValidDate(checkIn) &&
                isValidDate(checkOut) &&
                checkIn >= todayDate() &&
                checkOut > checkIn &&
                !unavailableDate(checkIn) &&
                !unavailableDate(checkOut) &&
                !hasUnavailableOverlap(checkIn, checkOut)
            );
        }

        if (!isValidDate(checkInInput.value) ||
            checkInInput.value < todayDate() ||
            unavailableDate(checkInInput.value)) {
            checkInInput.value = "";
        }

        if (!isValidStay(checkInInput.value, checkOutInput.value)) {
            checkOutInput.value = "";
        }
        checkOutInput.disabled = !checkInInput.value;

        let activeCalendar = null;

        function minimumDate(field) {
            if (field === "checkIn") {
                return todayDate();
            }
            if (!isValidDate(checkInInput.value)) {
                return "";
            }

            const [year, month, day] = checkInInput.value.split("-").map(Number);
            return new Date(Date.UTC(year, month - 1, day + 1))
                .toISOString()
                .slice(0, 10);
        }

        function renderCalendar(calendar) {
            const field = calendar.dataset.calendarFor;
            const input = field === "checkIn" ? checkInInput : checkOutInput;
            const [year, month] = calendar.dataset.month.split("-").map(Number);
            const firstWeekday =
                new Date(Date.UTC(year, month - 1, 1)).getUTCDay();
            const daysInMonth =
                new Date(Date.UTC(year, month, 0)).getUTCDate();
            const days = calendar.querySelector("[data-calendar-days]");
            const monthLabel =
                calendar.querySelector("[data-calendar-month-label]");
            const minimum = minimumDate(field);

            monthLabel.textContent = new Intl.DateTimeFormat("en", {
                month: "long",
                year: "numeric",
                timeZone: "UTC"
            }).format(new Date(Date.UTC(year, month - 1, 1)));
            days.replaceChildren();

            for (let index = 0; index < firstWeekday; index += 1) {
                const spacer = document.createElement("span");
                spacer.className =
                    "booking-calendar-day is-outside-month";
                spacer.setAttribute("aria-hidden", "true");
                days.append(spacer);
            }

            for (let day = 1; day <= daysInMonth; day += 1) {
                const value = formatDate(year, month, day);
                const blocked = unavailableDate(value);
                const button = document.createElement("button");
                button.type = "button";
                button.className = "booking-calendar-day";
                button.dataset.date = value;
                button.textContent = String(day);
                button.disabled =
                    blocked ||
                    !minimum ||
                    value < minimum ||
                    (field === "checkOut" &&
                        (value <= checkInInput.value ||
                            hasUnavailableOverlap(checkInInput.value, value)));
                button.setAttribute(
                    "aria-label",
                    `${new Intl.DateTimeFormat("en", {
                        dateStyle: "full",
                        timeZone: "UTC"
                    }).format(new Date(Date.UTC(year, month - 1, day)))}${blocked ? ", unavailable" : ""}`
                );
                button.setAttribute(
                    "aria-pressed",
                    String(input.value === value)
                );
                if (blocked) {
                    button.classList.add("is-unavailable");
                }
                if (input.value === value) {
                    button.classList.add("is-selected");
                    button.tabIndex = 0;
                } else {
                    button.tabIndex = -1;
                }
                days.append(button);
            }

            while (days.children.length < 42) {
                const spacer = document.createElement("span");
                spacer.className =
                    "booking-calendar-day is-outside-month";
                spacer.setAttribute("aria-hidden", "true");
                days.append(spacer);
            }

            const previousButton =
                calendar.querySelector('[data-calendar-month-change="-1"]');
            const [minimumYear, minimumMonth] =
                minimum.slice(0, 7).split("-").map(Number);
            previousButton.disabled =
                year < minimumYear ||
                (year === minimumYear && month <= minimumMonth);
        }

        function openCalendar(field) {
            if (field === "checkOut" && !checkInInput.value) {
                setMessage("Choose a check-in date before selecting checkout.");
                checkInInput.focus();
                return;
            }

            calendars.forEach((calendar) => {
                const selected = calendar.dataset.calendarFor === field;
                calendar.hidden = !selected;
                const input =
                    field === "checkIn" ? checkInInput : checkOutInput;
                input.setAttribute("aria-expanded", String(selected));
                if (selected) {
                    const initialDate =
                        input.value || minimumDate(field) || todayDate();
                    calendar.dataset.month = initialDate.slice(0, 7);
                    renderCalendar(calendar);
                    activeCalendar = calendar;
                    const firstAvailable = calendar.querySelector(
                        "[data-date]:not(:disabled)"
                    );
                    if (firstAvailable) {
                        firstAvailable.tabIndex = 0;
                    }
                }
            });
        }

        function closeCalendar(restoreFocus) {
            if (!activeCalendar) {
                return;
            }

            const field = activeCalendar.dataset.calendarFor;
            activeCalendar.hidden = true;
            activeCalendar = null;
            const input =
                field === "checkIn" ? checkInInput : checkOutInput;
            input.setAttribute("aria-expanded", "false");
            if (restoreFocus && document.activeElement !== input) {
                input.focus();
            }
        }

        function selectDate(calendar, button) {
            const field = calendar.dataset.calendarFor;
            const input = field === "checkIn" ? checkInInput : checkOutInput;
            input.value = button.dataset.date;
            input.dispatchEvent(new Event("change", { bubbles: true }));

            if (field === "checkIn") {
                checkOutInput.value = "";
                checkOutInput.disabled = false;
                checkOutInput.dispatchEvent(
                    new Event("change", { bubbles: true })
                );
                closeCalendar(false);
                setMessage("", false);
                openCalendar("checkOut");
                checkOutInput.focus();
                return;
            }

            closeCalendar(true);
            setMessage("", false);
        }

        function moveFocus(calendar, currentButton, offset) {
            const buttons = Array.from(
                calendar.querySelectorAll("[data-date]:not(:disabled)")
            );
            const currentIndex = buttons.indexOf(currentButton);
            const nextButton = buttons[currentIndex + offset];
            if (currentIndex >= 0 && nextButton) {
                currentButton.tabIndex = -1;
                nextButton.tabIndex = 0;
                nextButton.focus();
            }
        }

        calendars.forEach((calendar) => {
            calendar.querySelectorAll("[data-calendar-month-change]").forEach(
                (button) => {
                    button.addEventListener("click", (event) => {
                        event.stopImmediatePropagation();
                        const [year, month] =
                            calendar.dataset.month.split("-").map(Number);
                        const nextMonth = new Date(
                            Date.UTC(
                                year,
                                month - 1 +
                                    Number(button.dataset.calendarMonthChange),
                                1
                            )
                        );
                        calendar.dataset.month =
                            `${nextMonth.getUTCFullYear()}-${String(
                                nextMonth.getUTCMonth() + 1
                            ).padStart(2, "0")}`;
                        renderCalendar(calendar);
                        const firstAvailable = calendar.querySelector(
                            "[data-date]:not(:disabled)"
                        );
                        if (firstAvailable) {
                            firstAvailable.tabIndex = 0;
                            firstAvailable.focus();
                        }
                    }, { capture: true });
                }
            );

            const days = calendar.querySelector("[data-calendar-days]");
            days.addEventListener("click", (event) => {
                event.stopImmediatePropagation();
                const button = event.target.closest("[data-date]");
                if (button && !button.disabled) {
                    selectDate(calendar, button);
                }
            }, { capture: true });
            days.addEventListener("keydown", (event) => {
                const button = event.target.closest("[data-date]");
                const offsets = {
                    ArrowLeft: -1,
                    ArrowRight: 1,
                    ArrowUp: -7,
                    ArrowDown: 7
                };
                if (button && offsets[event.key]) {
                    event.preventDefault();
                    moveFocus(calendar, button, offsets[event.key]);
                }
            }, { capture: true });
        });

        [checkInInput, checkOutInput].forEach((input) => {
            const field = input === checkInInput ? "checkIn" : "checkOut";
            input.addEventListener("focus", (event) => {
                event.stopImmediatePropagation();
                openCalendar(field);
            }, { capture: true });
            input.addEventListener("click", (event) => {
                event.stopImmediatePropagation();
                openCalendar(field);
            }, { capture: true });
            input.addEventListener("keydown", (event) => {
                if (
                    event.key === "Enter" ||
                    event.key === " " ||
                    event.key === "ArrowDown"
                ) {
                    event.preventDefault();
                    event.stopImmediatePropagation();
                    openCalendar(field);
                }
            }, { capture: true });
            input.addEventListener("change", () => {
                if (input === checkInInput) {
                    if (!isValidDate(input.value) ||
                        unavailableDate(input.value)) {
                        input.value = "";
                        checkOutInput.value = "";
                        checkOutInput.disabled = true;
                    } else if (
                        checkOutInput.value &&
                        !isValidStay(input.value, checkOutInput.value)
                    ) {
                        checkOutInput.value = "";
                    }
                } else if (
                    input.value &&
                    !isValidStay(checkInInput.value, input.value)
                ) {
                    input.value = "";
                }

                if (activeCalendar) {
                    renderCalendar(activeCalendar);
                }
            });
        });

        document.addEventListener("click", (event) => {
            if (
                activeCalendar &&
                !activeCalendar.contains(event.target) &&
                event.target !== checkInInput &&
                event.target !== checkOutInput
            ) {
                closeCalendar(false);
            }
        });
        document.addEventListener("keydown", (event) => {
            if (event.key === "Escape" && activeCalendar) {
                event.preventDefault();
                closeCalendar(true);
            }
        });

        let requestInProgress = false;
        form.addEventListener("submit", async (event) => {
            event.preventDefault();
            event.stopImmediatePropagation();

            if (requestInProgress) {
                return;
            }
            if (!checkInInput.value) {
                setMessage("Choose a check-in date first.");
                checkInInput.focus();
                return;
            }
            if (!isValidStay(checkInInput.value, checkOutInput.value)) {
                setMessage("Choose a valid checkout date later than check-in.");
                checkOutInput.focus();
                return;
            }

            requestInProgress = true;
            const submitButton =
                event.submitter ||
                form.querySelector('button[type="submit"]');
            const buttons = [submitButton, stickyButton].filter(Boolean);
            const originalLabels = new Map();
            buttons.forEach((button) => {
                originalLabels.set(button, button.textContent);
                button.disabled = true;
                button.setAttribute("aria-busy", "true");
                button.textContent = "Checking availability…";
            });
            setMessage("Checking availability…");

            try {
                const availabilityUrl = new URL(
                    `/listings/${encodeURIComponent(listingId)}/availability`,
                    window.location.origin
                );
                availabilityUrl.searchParams.set(
                    "checkIn",
                    checkInInput.value
                );
                availabilityUrl.searchParams.set(
                    "checkOut",
                    checkOutInput.value
                );

                const response = await fetch(availabilityUrl, {
                    headers: { Accept: "application/json" },
                    credentials: "same-origin"
                });
                const result = await response.json();

                if (!response.ok || !result.available) {
                    setMessage(
                        response.ok && result.available === false
                            ? unavailableMessage
                            : result.message ||
                                "We couldn't check availability right now. Please try again."
                    );
                    return;
                }

                const destination = new URL(form.action, window.location.href);
                destination.search =
                    new URLSearchParams(new FormData(form)).toString();
                window.location.assign(destination.toString());
            } catch (error) {
                console.error("Could not check listing availability.", error);
                setMessage(
                    "We couldn't check availability right now. Please try again."
                );
            } finally {
                requestInProgress = false;
                buttons.forEach((button) => {
                    button.disabled = false;
                    button.removeAttribute("aria-busy");
                    button.textContent = originalLabels.get(button);
                });
            }
        }, { capture: true });

        if (stickyButton) {
            stickyButton.addEventListener("click", (event) => {
                event.stopImmediatePropagation();
                form.requestSubmit();
            }, { capture: true });
        }
    }

    if (document.readyState === "loading") {
        document.addEventListener(
            "DOMContentLoaded",
            initializeListingAvailability,
            { once: true }
        );
    } else {
        initializeListingAvailability();
    }
})();