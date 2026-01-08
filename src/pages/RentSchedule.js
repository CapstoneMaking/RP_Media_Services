import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { collection, getDocs } from 'firebase/firestore';
import { onAuthStateChanged } from 'firebase/auth';
import { auth, db } from '../utils/firebase';
import { useAuth } from '../context/AuthContext';
const showMessage = (message, type = 'info') => {
  // Create a simple div for the message
  const messageDiv = document.createElement('div');
  messageDiv.style.cssText = `
    position: fixed;
    top: 20px;
    right: 20px;
    background: ${type === 'error' ? '#dc3545' : type === 'success' ? '#28a745' : '#007bff'};
    color: white;
    padding: 12px 20px;
    border-radius: 6px;
    box-shadow: 0 4px 12px rgba(0,0,0,0.15);
    z-index: 9999;
    max-width: 400px;
    animation: slideIn 0.3s ease, fadeOut 0.3s ease 4.7s;
  `;
  
  // Add animation styles
  const style = document.createElement('style');
  style.textContent = `
    @keyframes slideIn {
      from { transform: translateX(100%); opacity: 0; }
      to { transform: translateX(0); opacity: 1; }
    }
    @keyframes fadeOut {
      from { opacity: 1; }
      to { opacity: 0; }
    }
  `;
  document.head.appendChild(style);
  
  messageDiv.textContent = message;
  document.body.appendChild(messageDiv);
  
  // Auto-remove after 5 seconds
  setTimeout(() => {
    if (messageDiv.parentNode) {
      messageDiv.parentNode.removeChild(messageDiv);
    }
  }, 5000);
  
  // Also allow click to dismiss
  messageDiv.onclick = () => {
    if (messageDiv.parentNode) {
      messageDiv.parentNode.removeChild(messageDiv);
    }
  };
};
const RentSchedule = () => {
  const [selectedDate, setSelectedDate] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [message, setMessage] = useState('');
  const [checkResult, setCheckResult] = useState('');
  const [currentUser, setCurrentUser] = useState(null);
  const [bookedDates, setBookedDates] = useState({});
  const [calendarYear, setCalendarYear] = useState(new Date().getFullYear());
  const [calendarMonth, setCalendarMonth] = useState(new Date().getMonth());
  const [selectionMode, setSelectionMode] = useState('start'); // 'start' or 'end'
  const [hoverDate, setHoverDate] = useState('');

  const navigate = useNavigate();
  const { user: authUser, isadmin } = useAuth();
  const [sidebarVisible, setSidebarVisible] = useState(false);
  const { user, isAdmin } = useAuth();

  const showSidebar = () => {
    setSidebarVisible(true);
  };

  const hideSidebar = () => {
    setSidebarVisible(false);
  };

  // Pad numbers to 2 digits
  const pad = (n) => {
    return n.toString().padStart(2, "0");
  };

  // Get days in month
  const getDaysInMonth = (year, month) => {
    return new Date(year, month + 1, 0).getDate();
  };

  // Check if date is in range
  const isDateInRange = (dateStr) => {
    if (!startDate || !endDate) return false;

    const date = new Date(dateStr);
    const start = new Date(startDate);
    const end = new Date(endDate);

    return date >= start && date <= end;
  };

  // Check if date is selection boundary
  const isSelectionBoundary = (dateStr) => {
    return dateStr === startDate || dateStr === endDate;
  };

  // Load saved schedule for current user
  useEffect(() => {
    if (authUser) {
      const userScheduleKey = `rentalSchedule_${authUser.uid}`;
      const savedSchedule = localStorage.getItem(userScheduleKey);
      if (savedSchedule) {
        try {
          const parsedSchedule = JSON.parse(savedSchedule);
          setStartDate(parsedSchedule.startDate || '');
          setEndDate(parsedSchedule.endDate || '');
          if (parsedSchedule.startDate && parsedSchedule.endDate) {
            setSelectionMode('start');
          }
          console.log('Loaded schedule for user:', authUser.uid, parsedSchedule);
        } catch (error) {
          console.error('Error loading schedule from localStorage:', error);
          localStorage.removeItem(userScheduleKey);
        }
      }
    }
  }, [authUser]);

  // Save schedule to localStorage for current user
  useEffect(() => {
    if (authUser && (startDate || endDate)) {
      const userScheduleKey = `rentalSchedule_${authUser.uid}`;
      const scheduleData = {
        startDate,
        endDate,
        lastUpdated: new Date().toISOString()
      };
      localStorage.setItem(userScheduleKey, JSON.stringify(scheduleData));
      console.log('Saved schedule for user:', authUser.uid, scheduleData);
    }
  }, [startDate, endDate, authUser]);

  // Handle date click
  const handleDateClick = (dateStr) => {
    if (!authUser) {
      showMessage("Please log in to select rental dates.");
      navigate('/login-register');
      return;
    }

    const dateObj = new Date(dateStr);
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    if (dateObj < today) return;
    if (bookedDates[dateStr]) return;

    if (selectionMode === 'start') {
      setStartDate(dateStr);
      setEndDate(''); // Reset end date when selecting new start
      setSelectionMode('end');
    } else {
      // If end date is before start date, swap them
      const endDateObj = new Date(dateStr);
      const startDateObj = new Date(startDate);

      if (endDateObj < startDateObj) {
        setStartDate(dateStr);
        setEndDate(startDate);
      } else {
        setEndDate(dateStr);
      }
      setSelectionMode('start');
    }

    setSelectedDate(dateStr);
    setCheckResult(`${dateStr} is available.`);
  };

  // Render calendar
  const renderCalendar = () => {
    const daysInMonth = getDaysInMonth(calendarYear, calendarMonth);
    const firstDayOfWeek = new Date(calendarYear, calendarMonth, 1).getDay();

    const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const calendarDays = [];

    // Add day names
    dayNames.forEach(day => {
      calendarDays.push(
        <div key={`day-${day}`} className="schedule-day-name">{day}</div>
      );
    });

    // Add empty cells for days before the first day of the month
    for (let i = 0; i < firstDayOfWeek; i++) {
      calendarDays.push(<div key={`empty-${i}`} className="schedule-empty-day"></div>);
    }

    // Add days of the month
    for (let i = 1; i <= daysInMonth; i++) {
      const dateStr = `${calendarYear}-${pad(calendarMonth + 1)}-${pad(i)}`;
      const dateObj = new Date(dateStr);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const isPast = dateObj < today;
      const isBooked = bookedDates[dateStr];
      const inRange = isDateInRange(dateStr);
      const isBoundary = isSelectionBoundary(dateStr);
      const isToday = dateObj.getTime() === today.getTime();

      let className = "schedule-day";
      if (isPast) className += " schedule-past-date";
      if (isBooked) className += " schedule-booked";
      if (inRange) className += " schedule-in-range";
      if (isBoundary) className += " schedule-boundary-date";
      if (isToday) className += " schedule-today";

      calendarDays.push(
        <div
          key={dateStr}
          className={className}
          onClick={() => handleDateClick(dateStr)}
          onMouseEnter={() => !isPast && !isBooked && setHoverDate(dateStr)}
          onMouseLeave={() => setHoverDate('')}
          title={isBooked ? 'Booked' : isPast ? 'Past date' : `Select ${selectionMode} date`}
        >
          <span className="schedule-date-number">{i}</span>
          {isToday && <div className="schedule-today-indicator"></div>}
          {isBooked && <div className="schedule-booked-indicator"></div>}
          {isBoundary && <div className="schedule-boundary-indicator"></div>}
        </div>
      );
    }

    return calendarDays;
  };

  // Load bookings from Firestore
  const loadBookings = async () => {
    try {
      const bookingsRef = collection(db, "bookings");
      const snapshot = await getDocs(bookingsRef);
      const newBookedDates = {};

      snapshot.forEach((doc) => {
        const data = doc.data();
        const startDate = data.startDate;
        const endDate = data.endDate;

        if (startDate && endDate) {
          const start = new Date(startDate);
          const end = new Date(endDate);

          for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
            const key = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
            newBookedDates[key] = true;
          }
        }
      });

      setBookedDates(newBookedDates);
    } catch (error) {
      console.error("Error loading bookings:", error);
    }
  };

  // Check if we have valid booking data (either items or package)
  useEffect(() => {
    const items = JSON.parse(localStorage.getItem("selectedItems")) || [];
    const pkg = JSON.parse(localStorage.getItem("selectedPackage"));

    console.log('RentSchedule - Current selection:', {
      items: items.length,
      package: pkg ? pkg.name : 'none'
    });

    if (items.length === 0 && !pkg) {
      setMessage("No items or package selected. Please go back and make a selection.");
    }
  }, []);

  // Handle next button click
  const handleNext = async () => {
    if (!authUser) {
      setMessage("You must log in before making a booking.");
      return;
    }

    // Validate we have either items or package
    const items = JSON.parse(localStorage.getItem("selectedItems")) || [];
    const pkg = JSON.parse(localStorage.getItem("selectedPackage"));

    if (items.length === 0 && !pkg) {
      setMessage("Please select items or a package before scheduling.");
      return;
    }

    if (!startDate || !endDate) {
      setMessage("Please select both start and end dates.");
      return;
    }

    const start = new Date(startDate);
    const end = new Date(endDate);
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    if (start < today) {
      setMessage("Start date cannot be in the past.");
      return;
    }

    if (start > end) {
      setMessage("Start date must be before end date.");
      return;
    }

    // Check if any date in the range is booked
    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      const key = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
      if (bookedDates[key]) {
        setMessage(`${key} is already booked.`);
        return;
      }
    }

    // Save to localStorage and proceed
    localStorage.setItem("bookingFormData", JSON.stringify({ startDate, endDate }));

    // Log what we're saving
    console.log('Saving booking data:', { startDate, endDate });
    console.log('Current items:', items.length);
    console.log('Current package:', pkg);

    navigate("/rent-items");
  };

  // Navigation functions for calendar
  const goToPreviousMonth = () => {
    if (calendarMonth === 0) {
      setCalendarYear(calendarYear - 1);
      setCalendarMonth(11);
    } else {
      setCalendarMonth(calendarMonth - 1);
    }
  };

  const goToNextMonth = () => {
    if (calendarMonth === 11) {
      setCalendarYear(calendarYear + 1);
      setCalendarMonth(0);
    } else {
      setCalendarMonth(calendarMonth + 1);
    }
  };

  // Reset selection
  const resetSelection = () => {
    setStartDate('');
    setEndDate('');
    setSelectionMode('start');
    setMessage('Selection cleared. Click on calendar to select dates.');

    // Also clear from localStorage
    if (authUser) {
      const userScheduleKey = `rentalSchedule_${authUser.uid}`;
      localStorage.removeItem(userScheduleKey);
    }
  };

  // Clear saved schedule for user
  const clearSavedSchedule = () => {
    if (authUser) {
      const userScheduleKey = `rentalSchedule_${authUser.uid}`;
      localStorage.removeItem(userScheduleKey);
      setMessage('Your saved schedule has been cleared.');
    }
    resetSelection();
  };

  // Go back to items/packages selection
  const goBackToSelection = () => {
    const items = JSON.parse(localStorage.getItem("selectedItems")) || [];
    const pkg = JSON.parse(localStorage.getItem("selectedPackage"));

    if (pkg) {
      navigate('/packages');
    } else {
      navigate('/rent-items');
    }
  };

  useEffect(() => {
    // Set initial calendar values
    const todayDate = new Date();
    setCalendarYear(todayDate.getFullYear());
    setCalendarMonth(todayDate.getMonth());

    // Load bookings
    loadBookings();

    // Set up auth state listener
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setCurrentUser(user);
    });

    return () => unsubscribe();
  }, []);

  const monthNames = ["January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"
  ];

  // Calculate rental period info
  const rentalDays = startDate && endDate
    ? Math.ceil((new Date(endDate) - new Date(startDate)) / (1000 * 60 * 60 * 24)) + 1
    : 0;

  const items = JSON.parse(localStorage.getItem("selectedItems")) || [];
  const pkg = JSON.parse(localStorage.getItem("selectedPackage"));
  const hasSelection = items.length > 0 || pkg;

  return (
    <>
      {/* Navbar and sidebar */}
      <nav>
        <ul className={`sidebar ${sidebarVisible ? 'active' : ''}`}>
          <li onClick={hideSidebar}><a href="#"><svg xmlns="http://www.w3.org/2000/svg" height="24px" viewBox="0 -960 960 960" width="24px" fill="#1f1f1f"><path d="m256-200-56-56 224-224-224-224 56-56 224 224 224-224 56 56-224 224 224 224-56 56-224-224-224 224Z" /></svg></a></li>
          <li><Link to="/home" onClick={hideSidebar}>Home</Link></li>
          <li><Link to="/rent-schedule" onClick={hideSidebar}>Schedule</Link></li>
          <li><Link to="/packages" onClick={hideSidebar}>Packages</Link></li>
          <li><Link to="/services" onClick={hideSidebar}>Services</Link></li>
          <li><Link to="/photobooth" onClick={hideSidebar}>Photobooth</Link></li>
          <li><Link to="/about" onClick={hideSidebar}>About us</Link></li>

          {/* Conditional Dashboard Links */}
          {user ? (
            isAdmin ? (
              <li><Link to="/AdminDashboard" onClick={hideSidebar}>Admin Dashboard</Link></li>
            ) : (
              <li><Link to="/UserDashboard" onClick={hideSidebar}>My Dashboard</Link></li>
            )
          ) : (
            <li><Link to="/login-register" onClick={hideSidebar}>Login</Link></li>
          )}
        </ul>
        <ul>
          <li className="hideOnMobile"><Link to="/home"><img src="/assets/logoNew - Copy.png" width="200px" height="150px" alt="Logo" /></Link></li>
          <li className="hideOnMobile"><Link to="/home">Home</Link></li>
          <li className="hideOnMobile"><Link to="/rent-schedule">Schedule</Link></li>
          <li className="hideOnMobile"><Link to="/packages">Packages</Link></li>
          <li className="hideOnMobile"><Link to="/services">Services</Link></li>
          <li className="hideOnMobile"><Link to="/photobooth">Photobooth</Link></li>
          <li className="hideOnMobile"><Link to="/about">About Us</Link></li>

          {/* Conditional Main Nav Icons */}
          {user ? (
            isAdmin ? (
              <li className="hideOnMobile">
                <Link to="/AdminDashboard" title="Admin Dashboard">
                  <svg xmlns="http://www.w3.org/2000/svg" height="24px" viewBox="0 -960 960 960" width="24px" fill="#1f1f1f">
                    <path d="M480-480q-66 0-113-47t-47-113q0-66 47-113t113-47q66 0 113 47t47 113q0 66-47 113t-113 47ZM160-160v-112q0-34 17.5-62.5T224-378q62-31 126-46.5T480-440q66 0 130 15.5T736-378q29 15 46.5 43.5T800-272v112H160Z" />
                  </svg>
                </Link>
              </li>
            ) : (
              <li className="hideOnMobile">
                <Link to="/UserDashboard" title="User Dashboard">
                  <svg xmlns="http://www.w3.org/2000/svg" height="24px" viewBox="0 -960 960 960" width="24px" fill="#1f1f1f">
                    <path d="M480-480q-66 0-113-47t-47-113q0-66 47-113t113-47q66 0 113 47t47 113q0 66-47 113t-113 47ZM160-160v-112q0-34 17.5-62.5T224-378q62-31 126-46.5T480-440q66 0 130 15.5T736-378q29 15 46.5 43.5T800-272v112H160Z" />
                  </svg>
                </Link>
              </li>
            )
          ) : (
            <li className="hideOnMobile">
              <Link to="/login-register" title="Login / Register">
                <svg xmlns="http://www.w3.org/2000/svg" height="24px" viewBox="0 -960 960 960" width="24px" fill="#1f1f1f">
                  <path d="M480-480q-66 0-113-47t-47-113q0-66 47-113t113-47q66 0 113 47t47 113q0 66-47 113t-113 47ZM160-160v-112q0-34 17.5-62.5T224-378q62-31 126-46.5T480-440q66 0 130 15.5T736-378q29 15 46.5 43.5T800-272v112H160Z" />
                </svg>
              </Link>
            </li>
          )}

          <li className="menu-button" onClick={showSidebar}>
            <a href="#">
              <svg xmlns="http://www.w3.org/2000/svg" height="24px" viewBox="0 -960 960 960" width="24px" fill="#1f1f1f">
                <path d="M120-240v-80h720v80H120Zm0-200v-80h720v80H120Zm0-200v-80h720v80H120Z" />
              </svg>
            </a>
          </li>
        </ul>
      </nav>

      {/* Rent Schedule Content */}
      <section className="rent-schedule">
        <h1 className='schedule-title'>Schedule Your Rental</h1>
        {!authUser && (
          <div className="login-reminder">
            <p>Please log in to save your schedule and proceed with booking.</p>
          </div>
        )}
      </section>

      <section className="modern-schedule-container">

        {/* Selection Status */}
        <div className="schedule-selection-status">
          <div className={`schedule-status-indicator ${selectionMode === 'start' ? 'active' : ''}`}>
            <div className="schedule-status-dot"></div>
            <span>1. Select Start Date</span>
          </div>
          <div className={`schedule-status-indicator ${selectionMode === 'end' ? 'active' : ''}`}>
            <div className="schedule-status-dot"></div>
            <span>2. Select End Date</span>
          </div>
        </div>

        {/* Selected Dates Display */}
        <div className="schedule-selected-dates">
          <div className="schedule-date-display">
            <label>Start Date:</label>
            <div className="schedule-date-value">{startDate || 'Not selected'}</div>
          </div>
          <div className="schedule-date-display">
            <label>End Date:</label>
            <div className="schedule-date-value">{endDate || 'Not selected'}</div>
          </div>
          <button className="schedule-reset-btn" onClick={resetSelection}>Reset Selection</button>
        </div>

        {/* Modern Calendar */}
        <div className="schedule-calendar-container">
          <div className="schedule-calendar-header">
            <button className="schedule-nav-btn" onClick={goToPreviousMonth}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                <path d="M15.41 7.41L14 6l-6 6 6 6 1.41-1.41L10.83 12z" />
              </svg>
            </button>
            <h3 className="schedule-calendar-title">{monthNames[calendarMonth]} {calendarYear}</h3>
            <button className="schedule-nav-btn" onClick={goToNextMonth}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                <path d="M10 6L8.59 7.41 13.17 12l-4.58 4.59L10 18l6-6z" />
              </svg>
            </button>
          </div>

          <div className="schedule-calendar">
            {renderCalendar()}
          </div>

          <div className="schedule-calendar-instruction">
            <p>Click dates to select your rental period. {selectionMode === 'start' ? 'Select start date first.' : 'Now select end date.'}</p>
            {!authUser && (
              <p className="login-prompt">Please log in to save your schedule.</p>
            )}
          </div>
        </div>

        {/* Action Section */}
        <div className="schedule-action-section">
          <div className="schedule-action-buttons">
            <button
              className={`schedule-nextbtn ${!startDate || !endDate || !hasSelection ? 'schedule-disabled' : ''}`}
              onClick={handleNext}
              disabled={!startDate || !endDate || !hasSelection}
            >
              Continue to Items
            </button>
          </div>

          {message && (
            <div className={`schedule-message ${message.includes('error') || message.includes('Please select') ? 'error' : 'info'}`}>
              {message}
            </div>
          )}
        </div>
      </section>

      {/* Footer */}
      <footer className="footer">
        <div className="copyright">
          <div className="column ss-copyright">
            <span>&copy; 2025 RP Media Services. All rights reserved</span>
          </div>
        </div>
      </footer>
    </>
  );
};

export default RentSchedule;