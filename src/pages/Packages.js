// Packages.js - WITH SIMPLIFIED DISPLAY
import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import { useAuth } from '../context/AuthContext';

const Packages = () => {
  const [selectedPackage, setSelectedPackage] = useState(null);
  const [message, setMessage] = useState('');
  const navigate = useNavigate();

  // Get rental items from context to check availability
  const { rentalItems, isItemAvailable } = useApp();
  const [sidebarVisible, setSidebarVisible] = useState(false);
  const { user, isAdmin } = useAuth();

  const showSidebar = () => {
    setSidebarVisible(true);
  };

  const hideSidebar = () => {
    setSidebarVisible(false);
  };
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

    navigate("/rent-schedule");
  };

  return (
    <>
      {/* Navbar and sidebar */}
      <nav>
        <ul className={`sidebar ${sidebarVisible ? 'active' : ''}`}>
          <li onClick={hideSidebar}><a href="#"><svg xmlns="http://www.w3.org/2000/svg" height="24px" viewBox="0 -960 960 960" width="24px" fill="#1f1f1f"><path d="m256-200-56-56 224-224-224-224 56-56 224 224 224-224 56 56-224 224 224 224-56 56-224-224-224 224Z" /></svg></a></li>
          <li><Link to="/home" onClick={hideSidebar}>Home</Link></li>
          <li><Link to="/rent-items" onClick={hideSidebar}>Rent</Link></li>
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
          <li className="hideOnMobile"><Link to="/rent-items">Rent</Link></li>
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

      {/* Packages Content */}
      <section className="package">
        <section className="packages-header">
          <h1 className='packages-title'>Rental Packages</h1>
          <p>Complete solutions for your production needs</p>
        </section>
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