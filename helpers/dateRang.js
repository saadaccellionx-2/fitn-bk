function getWeeksInMonth(year, month) {
    const weeks = [];
    const firstDay = new Date(year, month - 1, 1);
    const lastDay = new Date(year, month, 0); // last day of month
  
    let start = new Date(firstDay);
    start.setDate(start.getDate() - start.getDay()); // back to Sunday
  
    while (start <= lastDay) {
      const end = new Date(start);
      end.setDate(end.getDate() + 6);
      weeks.push({
        start: new Date(start),
        end: new Date(end > lastDay ? lastDay : end),
      });
      start.setDate(start.getDate() + 7);
    }
  
    return weeks;
  }
  
  function getWeekDays(selectedDate) {
    const date = new Date(selectedDate);
    const startOfWeek = new Date(date);
    startOfWeek.setDate(date.getDate() - date.getDay()); // Go to Sunday
  
    const days = [];
    for (let i = 0; i < 7; i++) {
      const day = new Date(startOfWeek);
      day.setDate(startOfWeek.getDate() + i);
      days.push({
        name: ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][i],
        start: new Date(day.getFullYear(), day.getMonth(), day.getDate()),
        end: new Date(
          day.getFullYear(),
          day.getMonth(),
          day.getDate(),
          23,
          59,
          59,
          999
        ),
      });
    }
    return days;
  }
  
  function getMonthsInYear(year) {
    const months = [];
    const monthNames = [
      "Jan", "Feb", "Mar", "Apr", "May", "Jun",
      "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"
    ];
  
    for (let i = 0; i < 12; i++) {
      months.push({
        name: monthNames[i],
        start: new Date(year, i, 1),
        end: new Date(year, i + 1, 0, 23, 59, 59, 999),
      });
    }
    return months;
  }
  
  function getYearsRange() {
    const currentYear = new Date().getFullYear();
    const years = [];
  
    for (let year = 2020; year <= currentYear; year++) {
      years.push({
        name: year.toString(),
        start: new Date(year, 0, 1),
        end: new Date(year, 11, 31, 23, 59, 59, 999),
      });
    }
    return years;
  }

  function getDaysInMonth(year, month) {
    const days = [];
    const daysInMonth = new Date(year, month, 0).getDate();
    const monthNames = [
      "Jan", "Feb", "Mar", "Apr", "May", "Jun",
      "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"
    ];

    for (let day = 1; day <= daysInMonth; day++) {
      days.push({
        name: `${monthNames[month - 1]} ${day}`,
        date: `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`,
        start: new Date(year, month - 1, day, 0, 0, 0, 0),
        end: new Date(year, month - 1, day, 23, 59, 59, 999),
      });
    }
    return days;
  }

  function getHoursInDay(selectedDate) {
    const date = new Date(selectedDate);
    const year = date.getFullYear();
    const month = date.getMonth();
    const day = date.getDate();
    
    const hours = [];
    for (let hour = 0; hour < 24; hour++) {
      let hourName;
      if (hour === 0) {
        hourName = "12 AM";
      } else if (hour < 12) {
        hourName = `${hour} AM`;
      } else if (hour === 12) {
        hourName = "12 PM";
      } else {
        hourName = `${hour - 12} PM`;
      }
      
      hours.push({
        name: hourName,
        start: new Date(year, month, day, hour, 0, 0, 0),
        end: new Date(year, month, day, hour, 59, 59, 999),
      });
    }
    return hours;
  }

  function getDaysInRange(startDate, endDate) {
    const start = new Date(startDate);
    const end = new Date(endDate);
    const days = [];
    const monthNames = [
      "Jan", "Feb", "Mar", "Apr", "May", "Jun",
      "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"
    ];

    // Set start to beginning of day
    start.setHours(0, 0, 0, 0);
    end.setHours(23, 59, 59, 999);

    const currentDate = new Date(start);
    let dayIndex = 1;

    while (currentDate <= end) {
      const dayNumber = currentDate.getDate();
      const month = currentDate.getMonth();
      const monthName = monthNames[month];
      
      days.push({
        name: dayNumber.toString(),
        date: `${currentDate.getFullYear()}-${String(month + 1).padStart(2, '0')}-${String(dayNumber).padStart(2, '0')}`,
        start: new Date(currentDate.getFullYear(), month, dayNumber, 0, 0, 0, 0),
        end: new Date(currentDate.getFullYear(), month, dayNumber, 23, 59, 59, 999),
      });

      currentDate.setDate(currentDate.getDate() + 1);
      dayIndex++;
    }

    return days;
  }

  function getWeeksInRange(startDate, endDate) {
    const start = new Date(startDate);
    const end = new Date(endDate);
    const weeks = [];

    // Set start to beginning of day
    start.setHours(0, 0, 0, 0);
    end.setHours(23, 59, 59, 999);

    // Start from the beginning of the week (Sunday) that contains the start date
    const currentWeekStart = new Date(start);
    currentWeekStart.setDate(start.getDate() - start.getDay());

    let weekIndex = 1;

    while (currentWeekStart <= end) {
      const weekEnd = new Date(currentWeekStart);
      weekEnd.setDate(currentWeekStart.getDate() + 6);
      weekEnd.setHours(23, 59, 59, 999);

      // Cap weekEnd to the actual end date
      const effectiveEnd = weekEnd > end ? end : weekEnd;

      // Format week label (e.g., "Week 1", "Week 2", etc.)
      const monthNames = [
        "Jan", "Feb", "Mar", "Apr", "May", "Jun",
        "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"
      ];
      
      const startMonth = monthNames[currentWeekStart.getMonth()];
      const startDay = currentWeekStart.getDate();
      const endMonth = monthNames[effectiveEnd.getMonth()];
      const endDay = effectiveEnd.getDate();

      weeks.push({
        name: `Week ${weekIndex}`,
        start: new Date(currentWeekStart),
        end: new Date(effectiveEnd),
      });

      // Move to next week
      currentWeekStart.setDate(currentWeekStart.getDate() + 7);
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
  