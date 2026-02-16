const { DateTime } = require("luxon");

/**
 * All functions here accept a 'timezone' string (IANA, e.g., 'Europe/London').
 * They use UTC internally but boundaries are calculated based on the target timezone.
 */

function getWeeksInMonth(year, month, timezone = "UTC") {
    const weeks = [];
    // Start of the month in the target timezone
    const firstDayOfMonth = DateTime.fromObject({ year, month, day: 1 }, { zone: timezone }).startOf("day");
    const lastDayOfMonth = firstDayOfMonth.endOf("month");

    // Start from the Sunday on or before the first day of the month
    let start = firstDayOfMonth.startOf("week").minus({ days: 1 }); // Luxon weeks start on Monday, handle Sunday
    if (firstDayOfMonth.weekday === 7) {
        start = firstDayOfMonth.startOf("day");
    }

    while (start <= lastDayOfMonth) {
        const end = start.plus({ days: 6 }).endOf("day");
        weeks.push({
            start: start.toJSDate(),
            end: (end > lastDayOfMonth ? lastDayOfMonth : end).toJSDate(),
        });
        start = start.plus({ weeks: 1 });
    }

    return weeks;
}

function getWeekDays(selectedDate, timezone = "UTC") {
    const dt = DateTime.fromJSDate(new Date(selectedDate), { zone: timezone }).startOf("day");
    // Go to Sunday (Luxon weekday 7 is Sunday, 1 is Monday)
    let startOfWeek = dt.startOf("week").minus({ days: 1 });
    if (dt.weekday === 7) {
        startOfWeek = dt.startOf("day");
    }

    const days = [];
    const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

    for (let i = 0; i < 7; i++) {
        const day = startOfWeek.plus({ days: i });
        days.push({
            name: dayNames[i],
            start: day.startOf("day").toJSDate(),
            end: day.endOf("day").toJSDate(),
        });
    }
    return days;
}

function getMonthsInYear(year, timezone = "UTC") {
    const months = [];
    const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

    for (let i = 1; i <= 12; i++) {
        const startOfMonth = DateTime.fromObject({ year, month: i, day: 1 }, { zone: timezone }).startOf("day");
        months.push({
            name: monthNames[i - 1],
            start: startOfMonth.toJSDate(),
            end: startOfMonth.endOf("month").toJSDate(),
        });
    }
    return months;
}

function getYearsRange(timezone = "UTC") {
    const currentYear = DateTime.now().setZone(timezone).year;
    const years = [];

    for (let year = 2020; year <= currentYear; year++) {
        const startOfYear = DateTime.fromObject({ year, month: 1, day: 1 }, { zone: timezone }).startOf("day");
        years.push({
            name: year.toString(),
            start: startOfYear.toJSDate(),
            end: startOfYear.endOf("year").toJSDate(),
        });
    }
    return years;
}

function getDaysInMonth(year, month, timezone = "UTC") {
    const days = [];
    const startOfMonth = DateTime.fromObject({ year, month, day: 1 }, { zone: timezone }).startOf("day");
    const daysInMonth = startOfMonth.daysInMonth;
    const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

    for (let day = 1; day <= daysInMonth; day++) {
        const currentDay = startOfMonth.set({ day });
        days.push({
            name: `${monthNames[month - 1]} ${day}`,
            date: currentDay.toISODate(),
            start: currentDay.startOf("day").toJSDate(),
            end: currentDay.endOf("day").toJSDate(),
        });
    }
    return days;
}

function getHoursInDay(selectedDate, timezone = "UTC") {
    const startOfDay = DateTime.fromJSDate(new Date(selectedDate), { zone: timezone }).startOf("day");
    const hours = [];

    for (let hour = 0; hour < 24; hour++) {
        const currentHour = startOfDay.plus({ hours: hour });
        let hourName;
        const h = currentHour.hour;
        if (h === 0) hourName = "12 AM";
        else if (h < 12) hourName = `${h} AM`;
        else if (h === 12) hourName = "12 PM";
        else hourName = `${h - 12} PM`;

        hours.push({
            name: hourName,
            start: currentHour.startOf("hour").toJSDate(),
            end: currentHour.endOf("hour").toJSDate(),
        });
    }
    return hours;
}

function getDaysInRange(startDate, endDate, timezone = "UTC") {
    const start = DateTime.fromJSDate(new Date(startDate), { zone: timezone }).startOf("day");
    const end = DateTime.fromJSDate(new Date(endDate), { zone: timezone }).endOf("day");
    const days = [];

    let currentDate = start;
    while (currentDate <= end) {
        days.push({
            name: currentDate.day.toString(),
            date: currentDate.toISODate(),
            start: currentDate.startOf("day").toJSDate(),
            end: currentDate.endOf("day").toJSDate(),
        });
        currentDate = currentDate.plus({ days: 1 });
    }

    return days;
}

function getWeeksInRange(startDate, endDate, timezone = "UTC") {
    const start = DateTime.fromJSDate(new Date(startDate), { zone: timezone }).startOf("day");
    const end = DateTime.fromJSDate(new Date(endDate), { zone: timezone }).endOf("day");
    const weeks = [];

    // Start from Sunday on or before start
    let currentWeekStart = start.startOf("week").minus({ days: 1 });
    if (start.weekday === 7) {
        currentWeekStart = start.startOf("day");
    }

    let weekIndex = 1;
    while (currentWeekStart <= end) {
        const weekEnd = currentWeekStart.plus({ days: 6 }).endOf("day");
        const effectiveEnd = weekEnd > end ? end : weekEnd;

        weeks.push({
            name: `Week ${weekIndex}`,
            start: currentWeekStart.toJSDate(),
            end: effectiveEnd.toJSDate(),
        });

        currentWeekStart = currentWeekStart.plus({ weeks: 1 });
        weekIndex++;
    }

    return weeks;
}

module.exports = {
    getWeeksInMonth,
    getWeekDays,
    getMonthsInYear,
    getYearsRange,
    getDaysInMonth,
    getHoursInDay,
    getDaysInRange,
    getWeeksInRange,
};