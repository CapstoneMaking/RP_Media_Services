// Packages.js - WITH SIMPLIFIED DISPLAY & ID VERIFICATION
import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import { useAuth } from '../context/AuthContext'; // Add this import

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

const Packages = () => {
  const [selectedPackage, setSelectedPackage] = useState(null);
  const [message, setMessage] = useState('');
  const [showVerificationModal, setShowVerificationModal] = useState(false);
  const navigate = useNavigate();
  
  // Get rental items from context to check availability
  const { rentalItems, isItemAvailable } = useApp();
  const { user, isVerified } = useAuth(); // Add this to get user info

  const packages = [
    {
      id: 'basic-video-package',
      name: 'Package 1',
      description: 'Perfect for small events and basic video production',
      price: 15000,
      // Simplified display for users
      displayItems: [
        "1 camera (inclusion: sdi, battery, charger and sd card)",
        "1 tripod", 
        "1 wheel slider",
        "1 cameraman"
      ],
      // Original items for information.js connection and availability checking
      items: [
        { id: 'pmw-200', name: 'PMW-200', quantity: 1 },
        { id: 'sachtler-tripod', name: 'Sachtler Video 20 S1 100mm Ball Head Tripod System', quantity: 1 },
        { id: 'wheels-slider', name: 'Wheels Slider Tripod', quantity: 1 }
      ]
    },
    {
      id: 'professional-video-package',
      name: 'Package 2',
      description: 'Professional multi-camera setup for events',
      price: 45000,
      displayItems: [
        "2 cameras (inclusion: sdi, battery, charger and sd card)",
        "2 tripods",
        "1 wheel slider", 
        "1 switcher",
        "1 monitor",
        "1 communication set",
        "2 cameramen",
        "1 switcher operator"
      ],
      items: [
        { id: 'sony-pmw-350k', name: 'sony pmw-350k', quantity: 1 },
        { id: 'cartoni-tripod', name: 'Cartoni Laser Z100 Fluid Head Tripod Aluminum 2', quantity: 1 },
        { id: 'lumantek-switcher', name: 'Lumantek ez-Pro VS10 3G-SDI/HDMI Video Switcher with 5" LED Touchscreen', quantity: 1 },
        { id: 'saramonic-comset', name: 'Saramonic WiTalk-WT7S 7-Person Full-Duplex Wireless Intercom System with Single-Ear Remote Headsets (1.9 GHz)', quantity: 1 },
        { id: 'accsoon-transmitter', name: 'Accsoon CineView Master 4K', quantity: 1 }
      ]
    },
    {
      id: 'multicam-production-package',
      name: 'Package 3',
      description: 'Premium broadcast package for large productions',
      price: 60000,
      displayItems: [
        "3 cameras (inclusion: sdi, battery, charger and sd card)",
        "3 tripods",
        "1 wheel slider", 
        "1 switcher",
        "1 monitor",
        "1 communication set",
        "3 cameramen",
        "1 switcher operator"
      ],
      items: [
        { id: 'pmw-200', name: 'PMW-200', quantity: 2 },
        { id: 'panasonic-hpx3100', name: 'Panasonic AJ HPX3100', quantity: 1 },
        { id: 'sony-mcx-500', name: 'sony mcx-500', quantity: 1 },
        { id: 'saramonic-comset', name: 'Saramonic WiTalk-WT7S 7-Person Full-Duplex Wireless Intercom System with Single-Ear Remote Headsets (1.9 GHz)', quantity: 1 },
        { id: 'atem-monitor', name: 'monitor ATEM156-CO HDMI 15.6 Video Monitor with Flightcase', quantity: 2 },
        { id: 'hollyland-transmitter', name: 'Hollyland Mars 4K Wireless Video Transmitter', quantity: 1 }
      ]
    }
  ];

  // Check package availability
  const isPackageAvailable = (pkg) => {
    return pkg.items.every(item => 
      isItemAvailable(item.id, item.quantity)
    );
  };

  const getPackageAvailability = (pkg) => {
    const unavailableItems = pkg.items.filter(item => 
      !isItemAvailable(item.id, item.quantity)
    );
    return {
      isAvailable: unavailableItems.length === 0,
      unavailableItems
    };
  };

  const selectPackage = (pkg) => {
    const availability = getPackageAvailability(pkg);
    
    if (!availability.isAvailable) {
      const unavailableNames = availability.unavailableItems.map(item => item.name).join(', ');
      setMessage(`Package unavailable. Following items are out of stock: ${unavailableNames}`);
      return;
    }

    setSelectedPackage(pkg);
    localStorage.setItem("selectedPackage", JSON.stringify(pkg));
    localStorage.removeItem("selectedItems"); // Clear any individual items
    
    setMessage(`Package "${pkg.name}" selected! Proceed to schedule.`);
    
    // Auto-scroll to confirmation
    setTimeout(() => {
      document.getElementById('packageConfirmation')?.scrollIntoView({ behavior: 'smooth' });
    }, 500);
  };

  // UPDATED: Handle verification before proceeding - same as RentItems.js
  const proceedToSchedule = () => {
    if (!selectedPackage) {
      setMessage("Please select a package first.");
      return;
    }

    const availability = getPackageAvailability(selectedPackage);
    if (!availability.isAvailable) {
      setMessage("Selected package is no longer available. Please choose another package.");
      return;
    }

    // Check if user is logged in - same as RentItems.js
    if (!user) {
      showMessage("Please log in to schedule a package.");
      navigate('/login-register');
      return;
    }

    // Check verification status - same as RentItems.js
    if (!isVerified) {
      // Show verification modal
      setShowVerificationModal(true);
      return;
    }

    // If verified, proceed to schedule
    navigate("/rent-schedule");
  };

  // Verification modal handlers - same as RentItems.js
  const handleStartVerification = () => {
    setShowVerificationModal(false);
    navigate("/user-dashboard"); // Changed to match RentItems.js
  };

  const handleCloseVerificationModal = () => {
    setShowVerificationModal(false);
  };

  const showSidebar = () => {
    const sidebar = document.querySelector('.sidebar');
    if (sidebar) sidebar.style.display = 'flex';
  };

  const hideSidebar = () => {
    const sidebar = document.querySelector('.sidebar');
    if (sidebar) sidebar.style.display = 'none';
  };

  return (
    <>
      {/* Navbar with Sidebar */}
      <nav>
        <ul className="sidebar">
          <li onClick={hideSidebar}><a href="#"><svg xmlns="http://www.w3.org/2000/svg" height="24px" viewBox="0 -960 960 960" width="24px" fill="#1f1f1f"><path d="m256-200-56-56 224-224-224-224 56-56 224 224 224-224 56 56-224 224 224 224-56 56-224-224-224 224Z"/></svg></a></li>
          <li><Link to="/home">Home</Link></li>
          <li><Link to="/rent-schedule">Schedule</Link></li>
          <li><Link to="/packages">Packages</Link></li>
          <li><Link to="/services">Services</Link></li>
          <li><Link to="/photobooth">Photobooth</Link></li>
          <li><Link to="/about">About us</Link></li>
          <li><a href="/login-register">Login</a></li>
        </ul>
        <ul>
          <li className="hideOnMobile"><Link to="/home"><img src="/assets/logoNew - Copy.png" width="200px" height="150px" alt="Logo" /></Link></li>
          <li className="hideOnMobile"><Link to="/home">Home</Link></li>
          <li className="hideOnMobile"><Link to="/rent-schedule">Schedule</Link></li>
          <li className="hideOnMobile"><Link to="/packages">Packages</Link></li>
          <li className="hideOnMobile"><Link to="/services">Services</Link></li>
          <li className="hideOnMobile"><Link to="/photobooth">Photobooth</Link></li>
          <li className="hideOnMobile"><Link to="/about">About Us</Link></li>
          <li className="hideOnMobile"><a href="/login-register"><svg xmlns="http://www.w3.org/2000/svg" height="24px" viewBox="0 -960 960 960" width="24px" fill="#1f1f1f"><path d="M480-480q-66 0-113-47t-47-113q0-66 47-113t113-47q66 0 113 47t47 113q0 66-47 113t-113 47ZM160-160v-112q0-34 17.5-62.5T224-378q62-31 126-46.5T480-440q66 0 130 15.5T736-378q29 15 46.5 43.5T800-272v112H160Z"/></svg></a></li>
          <li className="menu-button" onClick={showSidebar}><a href="#"><svg xmlns="http://www.w3.org/2000/svg" height="24px" viewBox="0 -960 960 960" width="24px" fill="#1f1f1f"><path d="M120-240v-80h720v80H120Zm0-200v-80h720v80H120Zm0-200v-80h720v80H120Z"/></svg></a></li>
        </ul>
      </nav>

      {/* Packages Content */}
      <section className="packages-header">
        <h1 className='packages-title'>Rental Packages</h1>
        <p>Complete solutions for your production needs</p>
      </section>
      
      <section className="packages-container">
        <div className="packages-wrapper">
          <div className="packages-grid">
            {packages.map(pkg => {
              const availability = getPackageAvailability(pkg);
              return (
                <div key={pkg.id} className={`package-card ${!availability.isAvailable ? 'unavailable' : ''}`}>
                  <div className="package-header">
                    <h3>{pkg.name}</h3>
                    <div className="package-header-actions">
                      {!availability.isAvailable && (
                        <span className="availability-badge out-of-stocks">Out of Stock</span>
                      )}
                      {availability.isAvailable && (
                        <span className="availability-badge in-stocks">Available</span>
                      )}
                      <Link 
                        to={`/information?package=${pkg.id}`}
                        className="info-button"
                        title={`More about ${pkg.name}`}
                      >
                        ℹ
                      </Link>
                    </div>
                  </div>
                  <div className="package-description">
                    <p>{pkg.description}</p>
                  </div>
                  <div className="package-items">
                    <h4>Includes:</h4>
                    <ul className="simple-items-list">
                      {pkg.displayItems.map((item, index) => (
                        <li key={index}>{item}</li>
                      ))}
                    </ul>
                  </div>
                  <div className="package-price">
                    <h4>₱{pkg.price.toLocaleString()}</h4>
                    <p>per day</p>
                  </div>
                  <div className="package-actions">
                    <button
                      onClick={() => selectPackage(pkg)}
                      disabled={!availability.isAvailable}
                      className={!availability.isAvailable ? 'disabled' : ''}
                    >
                      {!availability.isAvailable ? 'Unavailable' : 'Select Package'}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Selected Package Confirmation */}
          <div id="packageConfirmation" className="package-confirmation">
            {selectedPackage && (
              <div className="selected-package">
                <h3>Selected Package</h3>
                <div className="selected-package-details">
                  <h4>{selectedPackage.name}</h4>
                  <p>{selectedPackage.description}</p>
                  <div className="selected-items">
                    <strong>Includes:</strong>
                    <ul className="simple-items-list">
                      {selectedPackage.displayItems.map((item, index) => (
                        <li key={index}>{item}</li>
                      ))}
                    </ul>
                  </div>
                  <div className="selected-price">
                    <strong>Price: ₱{selectedPackage.price.toLocaleString()} per day</strong>
                  </div>
                </div>
                <button onClick={proceedToSchedule} className="proceed-btn">
                  Proceed to Schedule
                </button>
              </div>
            )}
          </div>

          {message && (
            <div className={`message ${message.includes('unavailable') ? 'error' : 'success'}`}>
              {message}
            </div>
          )}
        </div>
      </section>

      {/* Verification Required Modal - same as RentItems.js */}
      <div 
        className="policy-modal" 
        style={{ display: showVerificationModal ? 'flex' : 'none' }}
      >
        <div className="policy-modal-content">
          <span className="close-modal" onClick={handleCloseVerificationModal}>&times;</span>
          <div className="verification-content">
            <h2>Identity Verification Required</h2>
            <p>
              You need to verify your identity before you can proceed to scheduling. 
              This helps us ensure the security of our equipment and services.
            </p>
            
            <div className="verification-steps">
              <h4>Verification Process:</h4>
              <ul>
                <li>Submit valid government ID (ePhil ID or National ID)</li>
                <li>Take a clear selfie</li>
                <li>Admin approval within a week</li>
              </ul>
            </div>

            <div className="verification-actions">
              <button onClick={handleStartVerification} className="btn btn-primary">
                Start Verification
              </button>
              <button onClick={handleCloseVerificationModal} className="btn btn-secondary">
                Maybe Later
              </button>
            </div>
            
            <p className="verification-note">
              You can complete verification in your User Dashboard anytime.
            </p>
          </div>
        </div>
      </div>

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

export default Packages;