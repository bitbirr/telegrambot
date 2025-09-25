/**
 * Calendar utilities for Telegram bot date selection
 * Provides calendar picker functionality using inline keyboards
 */

/**
 * Generate a calendar keyboard for a specific month and year
 * @param {number} year - The year to display
 * @param {number} month - The month to display (0-11)
 * @param {string} type - 'checkin' or 'checkout'
 * @param {Date|null} selectedCheckIn - Selected check-in date (for checkout validation)
 * @param {string} language - User's language preference
 * @returns {Object} Inline keyboard markup
 */
function generateCalendarKeyboard(year, month, type = 'checkin', selectedCheckIn = null, language = 'en') {
  const date = new Date(year, month, 1);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  // Month names in different languages
  const monthNames = {
    en: ['January', 'February', 'March', 'April', 'May', 'June',
         'July', 'August', 'September', 'October', 'November', 'December'],
    am: ['ጃንዩወሪ', 'ፌብሩወሪ', 'ማርች', 'ኤፕሪል', 'ሜይ', 'ጁን',
         'ጁላይ', 'ኦገስት', 'ሴፕቴምበር', 'ኦክቶበር', 'ኖቬምበር', 'ዲሴምበር'],
    so: ['Jannaayo', 'Febraayo', 'Maarso', 'Abriil', 'Maajo', 'Juun',
         'Luuliyo', 'Ogosto', 'Sebtembar', 'Oktoobar', 'Nofembar', 'Desembar'],
    or: ['Amajjii', 'Guraandhala', 'Bitooteessa', 'Elba', 'Caamsa', 'Waxabajjii',
         'Adooleessa', 'Hagayya', 'Fulbaana', 'Onkololeessa', 'Sadaasa', 'Muddee']
  };

  // Day abbreviations
  const dayAbbr = {
    en: ['S', 'M', 'T', 'W', 'T', 'F', 'S'],
    am: ['እ', 'ሰ', 'ማ', 'ረ', 'ሐ', 'ዓ', 'ቅ'],
    so: ['A', 'I', 'T', 'A', 'K', 'J', 'S'],
    or: ['D', 'W', 'K', 'R', 'H', 'A', 'S']
  };

  const currentLang = language in monthNames ? language : 'en';
  const monthName = monthNames[currentLang][month];
  const days = dayAbbr[currentLang];

  // Get first day of month and number of days
  const firstDay = date.getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  
  const keyboard = [];
  
  // Header with month/year and navigation
  keyboard.push([
    { text: '◀️', callback_data: `cal_prev_${type}_${year}_${month}` },
    { text: `${monthName} ${year}`, callback_data: 'cal_ignore' },
    { text: '▶️', callback_data: `cal_next_${type}_${year}_${month}` }
  ]);
  
  // Day headers
  keyboard.push(days.map(day => ({ text: day, callback_data: 'cal_ignore' })));
  
  // Calendar days
  let week = [];
  
  // Empty cells for days before month starts
  for (let i = 0; i < firstDay; i++) {
    week.push({ text: ' ', callback_data: 'cal_ignore' });
  }
  
  // Days of the month
  for (let day = 1; day <= daysInMonth; day++) {
    const currentDate = new Date(year, month, day);
    currentDate.setHours(0, 0, 0, 0);
    
    let isDisabled = false;
    let displayText = day.toString();
    
    // Disable past dates
    if (currentDate < today) {
      isDisabled = true;
      displayText = `${day}`;
    }
    
    // For checkout, disable dates before or equal to check-in
    if (type === 'checkout' && selectedCheckIn) {
      const checkInDate = new Date(selectedCheckIn);
      checkInDate.setHours(0, 0, 0, 0);
      if (currentDate <= checkInDate) {
        isDisabled = true;
      }
    }
    
    const callbackData = isDisabled ? 'cal_ignore' : `cal_select_${type}_${year}_${month}_${day}`;
    
    week.push({
      text: isDisabled ? `⚫${day}` : displayText,
      callback_data: callbackData
    });
    
    // Start new week on Sunday
    if (week.length === 7) {
      keyboard.push(week);
      week = [];
    }
  }
  
  // Fill remaining cells in last week
  while (week.length < 7 && week.length > 0) {
    week.push({ text: ' ', callback_data: 'cal_ignore' });
  }
  if (week.length > 0) {
    keyboard.push(week);
  }
  
  // Back button
  const backText = {
    en: '🔙 Back',
    am: '🔙 ተመለስ',
    so: '🔙 Dib u noqo',
    or: '🔙 Deebiʼi'
  };
  
  keyboard.push([
    { text: backText[currentLang] || backText.en, callback_data: 'back_to_menu' }
  ]);
  
  return { inline_keyboard: keyboard };
}

/**
 * Parse calendar callback data
 * @param {string} callbackData - The callback data from button press
 * @returns {Object|null} Parsed data or null if invalid
 */
function parseCalendarCallback(callbackData) {
  // Format: cal_action_type_year_month_day (day optional)
  const parts = callbackData.split('_');
  
  if (parts.length < 4 || parts[0] !== 'cal') {
    return null;
  }
  
  const action = parts[1]; // prev, next, select, ignore
  const type = parts[2];   // checkin, checkout
  const year = parseInt(parts[3]);
  const month = parseInt(parts[4]);
  const day = parts[5] ? parseInt(parts[5]) : null;
  
  return { action, type, year, month, day };
}

/**
 * Format date for display
 * @param {Date} date - Date to format
 * @param {string} language - Language for formatting
 * @returns {string} Formatted date string
 */
function formatDateForDisplay(date, language = 'en') {
  const day = date.getDate().toString().padStart(2, '0');
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  const year = date.getFullYear();
  
  // Different date formats for different languages
  const formats = {
    en: `${day}/${month}/${year}`,
    am: `${day}/${month}/${year}`,
    so: `${day}/${month}/${year}`,
    or: `${day}/${month}/${year}`
  };
  
  return formats[language] || formats.en;
}

/**
 * Get next month/year
 * @param {number} year - Current year
 * @param {number} month - Current month (0-11)
 * @returns {Object} Next month and year
 */
function getNextMonth(year, month) {
  if (month === 11) {
    return { year: year + 1, month: 0 };
  }
  return { year, month: month + 1 };
}

/**
 * Get previous month/year
 * @param {number} year - Current year
 * @param {number} month - Current month (0-11)
 * @returns {Object} Previous month and year
 */
function getPreviousMonth(year, month) {
  if (month === 0) {
    return { year: year - 1, month: 11 };
  }
  return { year, month: month - 1 };
}

/**
 * Validate if a date string is in the future
 * @param {string} dateString - Date string in DD/MM/YYYY format
 * @returns {boolean} True if date is valid and in future
 */
function isValidFutureDate(dateString) {
  const parts = dateString.split('/');
  if (parts.length !== 3) return false;
  
  const day = parseInt(parts[0]);
  const month = parseInt(parts[1]) - 1; // Month is 0-indexed
  const year = parseInt(parts[2]);
  
  const date = new Date(year, month, day);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  return date >= today && 
         date.getDate() === day && 
         date.getMonth() === month && 
         date.getFullYear() === year;
}

export {
  generateCalendarKeyboard,
  parseCalendarCallback,
  formatDateForDisplay,
  getNextMonth,
  getPreviousMonth,
  isValidFutureDate
};