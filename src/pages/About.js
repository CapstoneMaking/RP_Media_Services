import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { firebaseService } from '../services/firebaseService';
import emailjs from '@emailjs/browser';
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

const About = () => {
  const [formData, setFormData] = useState({
    fullName: '',
    email: '',
    description: ''
  });
  const [sending, setSending] = useState(false);
  const [messageStatus, setMessageStatus] = useState('');
  const [sidebarVisible, setSidebarVisible] = useState(false);
  const { user, isAdmin } = useAuth();

  const showSidebar = () => {
    setSidebarVisible(true);
  };

  const hideSidebar = () => {
    setSidebarVisible(false);
  };


  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prevState => ({
      ...prevState,
      [name]: value
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    // Validation
    if (!formData.fullName.trim() || !formData.email.trim() || !formData.description.trim()) {
      setMessageStatus('error');
      showMessage('Please fill in all fields');
      return;
    }

    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(formData.email)) {
      setMessageStatus('error');
      showMessage('Please enter a valid email address');
      return;
    }

    setSending(true);
    setMessageStatus('sending');

    try {
      // 1. Save to Firebase
      const result = await firebaseService.sendMessage({
        email: formData.email.trim(),
        fullName: formData.fullName.trim(),
        description: formData.description.trim(),
        page: 'about'
      });

      if (result.success) {
        // 2. Send email notification using EmailJS
        try {
          const emailResult = await emailjs.send(
            'service_333eela',
            'template_49x9up4',
            {
              full_name: formData.fullName,
              email: formData.email,
              description: formData.description,
              page: 'about',
              time: new Date().toLocaleString()
            },
            'VZ3ZR1YRXGqSKbkSi'
          );

          if (emailResult.status === 200) {
            console.log('Email notification sent successfully!');
          }
        } catch (emailError) {
          console.log('Email notification failed, but message was saved to database');
          // Continue anyway - the message is saved in Firebase
        }

        setMessageStatus('success');
        showMessage('Message sent successfully! We will contact you soon.');

        // Reset form
        setFormData({
          fullName: '',
          email: '',
          description: ''
        });

        // Reset form fields
        e.target.reset();
      } else {
        setMessageStatus('error');
        showMessage('Failed to send message. Please try again.');
        console.error('Send message error:', result.error);
      }
    } catch (error) {
      setMessageStatus('error');
      showMessage('Failed to send message. Please try again.');
      console.error('Send message error:', error);
    } finally {
      setSending(false);
    }
  };

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

      {/* About Content */}
      <section className="about">
        <section className='about-header'>
          <h1 className="heading">About Us</h1>
          <p>Trusted Professionals, Guaranteed Quality</p>
        </section>
      </section>

      <div className="contact">
        <img className="abtUsPic" src="/assets/AboutUsPic.jpg" alt="About Us" />
        <h1>WELCOME TO RP MEDIA SERVICES</h1>
        <p className="welcome-description">
          At Roland Pestillos Media Services, we're your go-to partner for all things media production. From seamless video
          coverage and top-tier equipment rentals to flawless live streaming and expert technical direction, we provide the
          professional services you need to bring your vision to life. Our team is dedicated to capturing every moment with creativity and precision,
          ensuring high-quality results for any event or project. Whether it's a corporate event, concert, or promotional shoot, we tailor our services
          to meet your specific needs. With our reliable equipment, skilled crew, and passion for storytelling, we turn your ideas into engaging visual experiences that stand out.
        </p>
        <h2>Roland Pestillos</h2>
        <p className="owner">Owner</p>
      </div>

      <div className="message">
        <h2>Contact Us</h2>
        <div className="contact-container">
          <div className="contact-info">
            <div className="info-item">
              <div>
                <strong>
                  <svg xmlns="http://www.w3.org/2000/svg" height="18px" viewBox="0 0 24 24" width="18px" fill="#000">
                    <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 
                    0-2.5-1.12-2.5-2.5s1.12-2.5 
                    2.5-2.5 2.5 1.12 2.5 
                    2.5-1.12 2.5-2.5 2.5z" />
                  </svg>{" "}
                  Address:
                </strong>
                <p>Blk 3 lot 15 Kensington 5 Brgy. Navarro General Trias Cavite</p>
              </div>
            </div>

            <div className="info-item">
              <div>
                <strong>
                  <svg xmlns="http://www.w3.org/2000/svg" height="18px" viewBox="0 0 24 24" width="18px" fill="#000">
                    <path d="M6.62 10.79a15.464 15.464 0 006.59 6.59l2.2-2.2c.27-.27.67-.36 
                    1.02-.24 1.12.37 2.33.57 
                    3.57.57.55 0 1 .45 1 
                    1V20c0 .55-.45 1-1 
                    1C10.07 21 3 13.93 3 
                    5c0-.55.45-1 1-1h3.5c.55 
                    0 1 .45 1 1 0 1.24.2 2.45.57 
                    3.57.11.35.03.74-.24 
                    1.02l-2.21 2.2z" />
                  </svg>{" "}
                  Phone:
                </strong>
                <p>09158703107</p>
              </div>
            </div>

            <div className="info-item">
              <div>
                <strong>
                  <svg xmlns="http://www.w3.org/2000/svg" height="18px" viewBox="0 0 24 24" width="18px" fill="#000">
                    <path d="M12 13.5l8-6V6l-8 
                    6-8-6v1.5l8 6zm0 
                    2.5l-8-6v8h16v-8l-8 
                    6z" />
                  </svg>{" "}
                  Email:
                </strong>
                <p>rolandpestillos46@gmail.com</p>
              </div>
            </div>
          </div>

          <form className="contact-form" onSubmit={handleSubmit}>
            <h3>Send Message</h3>

            <input
              type="text"
              name="fullName"
              placeholder="Full Name"
              value={formData.fullName}
              onChange={handleInputChange}
              required
              disabled={sending}
            />

            <input
              type="email"
              name="email"
              placeholder="Email"
              value={formData.email}
              onChange={handleInputChange}
              required
              disabled={sending}
            />

            <textarea
              name="description"
              placeholder="Your Message..."
              rows="5"
              value={formData.description}
              onChange={handleInputChange}
              required
              disabled={sending}
            ></textarea>

            <button
              type="submit"
              disabled={sending}
              style={{
                opacity: sending ? 0.7 : 1,
                cursor: sending ? 'not-allowed' : 'pointer'
              }}
            >
              {sending ? 'Sending...' : 'Send Message'}
            </button>

            {messageStatus === 'sending' && (
              <p style={{ color: '#007AFF', textAlign: 'center' }}>Sending your message...</p>
            )}
            {messageStatus === 'success' && (
              <p style={{ color: 'green', textAlign: 'center' }}>Message sent successfully!</p>
            )}
            {messageStatus === 'error' && (
              <p style={{ color: 'red', textAlign: 'center' }}>Failed to send message. Please try again.</p>
            )}
          </form>
        </div>
      </div>

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

export default About;