// src/pages/LoginRegister.js - FIXED REDIRECT ISSUE
import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import '../styles/login.css';

const LoginRegister = () => {
  const [isActive, setIsActive] = useState(false);
  const [showLoginPassword, setShowLoginPassword] = useState(false);
  const [showRegisterPassword, setShowRegisterPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [registerData, setRegisterData] = useState({
    name: '',
    email: '',
    password: '',
    confirmPassword: ''
  });
  const [loginData, setLoginData] = useState({
    email: '',
    password: ''
  });
  const [registerMessage, setRegisterMessage] = useState('');
  const [loginMessage, setLoginMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [passwordError, setPasswordError] = useState('');
  const [emailError, setEmailError] = useState('');
  const [showVerificationModal, setShowVerificationModal] = useState(false);
  const [verificationEmail, setVerificationEmail] = useState('');
  const [showUnverifiedLoginModal, setShowUnverifiedLoginModal] = useState(false);
  const [unverifiedEmail, setUnverifiedEmail] = useState('');

  const navigate = useNavigate();
  const { user, userData, register, login, loading: authLoading, isAdmin } = useAuth();
  const [sidebarVisible, setSidebarVisible] = useState(false);
  
    const showSidebar = () => {
      setSidebarVisible(true);
    };
  
    const hideSidebar = () => {
      setSidebarVisible(false);
    };
  // FIXED: Only redirect when user is VERIFIED
  // FIXED: Redirect admin immediately, regular users only when verified
  // FIXED: Only redirect admin immediately, let regular users stay on login page
  // FIXED: Redirect admin immediately, regular users only when verified
  useEffect(() => {
    if (!authLoading && user) {
      if (isAdmin) {
        // Admin: redirect immediately to adminDashboard
        const timer = setTimeout(() => {
          navigate('/adminDashboard');
        }, 100);
        return () => clearTimeout(timer);
      } else if (user.emailVerified) {
        // Regular user: only redirect when email is verified
        const timer = setTimeout(() => {
          navigate('/userDashboard');
        }, 100);
        return () => clearTimeout(timer);
      }
    }
  }, [user, authLoading, isAdmin, navigate]);

  const showMessage = (message, type, isError = false) => {
    if (type === 'register') {
      setRegisterMessage(message);
      setTimeout(() => setRegisterMessage(''), 5000);
    } else {
      setLoginMessage(message);
      setTimeout(() => setLoginMessage(''), 5000);
    }
  };

  const validateEmail = (email) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (!emailRegex.test(email)) {
      return { valid: false, message: 'Please enter a valid email address (e.g., name@gmail.com)' };
    }

    const domain = email.split('@')[1].toLowerCase();

    const allowedDomains = ['gmail.com'];
    const isAllowedDomain = allowedDomains.some(allowed => domain === allowed);

    // ADMIN EXCEPTION: Only allow admin@rpmediaservices.com as non-Gmail
    const isAdminEmail = email.toLowerCase() === 'admin@rpmediaservices.com';

    if (!isAllowedDomain && !isAdminEmail) {
      return {
        valid: false,
        message: 'Please use Gmail account.'
      };
    }

    return { valid: true, message: '' };
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    setLoading(true);
    setRegisterMessage('');
    setPasswordError('');
    setEmailError('');

    const emailValidation = validateEmail(registerData.email);
    if (!emailValidation.valid) {
      setEmailError(emailValidation.message);
      setLoading(false);
      return;
    }

    if (registerData.password.length < 6) {
      setPasswordError('Password must be at least 6 characters');
      setLoading(false);
      return;
    }

    if (registerData.password.length > 20) {
      setPasswordError('Password cannot exceed 20 characters');
      setLoading(false);
      return;
    }

    if (registerData.password !== registerData.confirmPassword) {
      setPasswordError('Passwords do not match');
      setLoading(false);
      return;
    }

    const hasNumber = /\d/.test(registerData.password);
    const hasLetter = /[a-zA-Z]/.test(registerData.password);
    if (!hasNumber || !hasLetter) {
      setPasswordError('Password must contain at least one letter and one number');
      setLoading(false);
      return;
    }

    const result = await register(registerData.email, registerData.password, {
      name: registerData.name,
      role: 'user',
      email: registerData.email
    });

    if (result.success) {
      // Show verification modal
      setVerificationEmail(registerData.email);
      setShowVerificationModal(true);

      // Reset form
      setRegisterData({
        name: '',
        email: '',
        password: '',
        confirmPassword: ''
      });

      // Switch to login form automatically
      setIsActive(false);

      // Pre-fill login email
      setLoginData({
        email: registerData.email,
        password: ''
      });

      showMessage('Registration successful! Please verify your email to activate your account.', 'register');
    } else {
      if (result.error.includes('email-already-in-use')) {
        showMessage('Email address already registered! Please use a different email or try logging in.', 'register', true);
      } else if (result.error.includes('invalid-email')) {
        showMessage('Invalid email format. Please use a valid email address.', 'register', true);
      } else if (result.error.includes('disposable') || result.error.includes('temporary')) {
        showMessage('Disposable/temporary email addresses are not allowed. Please use a permanent email.', 'register', true);
      } else if (result.error.includes('Please use a Gmail')) {
        showMessage('Please use Gmail, Yahoo, or Outlook email address to register.', 'register', true);
      } else {
        showMessage('Registration failed: ' + result.error, 'register', true);
      }
    }

    setLoading(false);
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setLoginMessage('');
    setEmailError('');

    const emailValidation = validateEmail(loginData.email);
    if (!emailValidation.valid) {
      setEmailError(emailValidation.message);
      setLoading(false);
      return;
    }

    const result = await login(loginData.email, loginData.password);

    if (result.success) {
      showMessage('Login successful!', 'login');
    } else {
      if (result.needsVerification) {
        setUnverifiedEmail(loginData.email);
        setShowUnverifiedLoginModal(true);
        showMessage('Please verify your email address before logging in.', 'login', true);
      } else if (result.error.includes('invalid-credential') || result.error.includes('wrong-password')) {
        showMessage('Incorrect Email or Password', 'login', true);
      } else if (result.error.includes('user-not-found')) {
        showMessage('Account does not exist. Please register first.', 'login', true);
      } else if (result.error.includes('user-disabled')) {
        showMessage('This account has been disabled', 'login', true);
      } else if (result.error.includes('too-many-requests')) {
        showMessage('Too many failed attempts. Please try again later.', 'login', true);
      } else {
        showMessage('Login failed: ' + result.error, 'login', true);
      }
    }

    setLoading(false);
  };

  const handleResendVerification = async () => {
    setLoading(true);
    try {
      showMessage('Please check your email inbox and spam folder. If you still need help, contact support.', 'login');
      setShowUnverifiedLoginModal(false);
    } catch (error) {
      showMessage('Error: ' + error.message, 'login', true);
    } finally {
      setLoading(false);
    }
  };

  const handleRegisterChange = (e) => {
    const { id, value } = e.target;

    if (id === 'password' && value.length > 20) {
      return;
    }

    if (id === 'confirmPassword' && value.length > 20) {
      return;
    }

    setRegisterData({
      ...registerData,
      [id]: value
    });

    if (id === 'password' || id === 'confirmPassword') {
      setPasswordError('');
    }
    if (id === 'email') {
      setEmailError('');
    }
  };

  const handleLoginChange = (e) => {
    setLoginData({
      ...loginData,
      [e.target.id]: e.target.value
    });
    setEmailError('');
  };

  const toggleLoginPasswordVisibility = () => {
    setShowLoginPassword(!showLoginPassword);
  };

  const toggleRegisterPasswordVisibility = () => {
    setShowRegisterPassword(!showRegisterPassword);
  };

  const toggleConfirmPasswordVisibility = () => {
    setShowConfirmPassword(!showConfirmPassword);
  };

  const closeVerificationModal = () => {
    setShowVerificationModal(false);
    setIsActive(false);
    setLoginData({
      email: verificationEmail,
      password: ''
    });
  };

  const closeUnverifiedLoginModal = () => {
    setShowUnverifiedLoginModal(false);
  };

  // Show loading state
  if (authLoading) {
    return (
      <div className="app-loading">
        <div className="loading-spinner">
          <div className="spinner"></div>
          <p>Loading...</p>
        </div>
      </div>
    );
  }

  // FIXED: Show redirect message for admin and verified users
  if (user && (isAdmin || user.emailVerified)) {
    return (
      <div className="app-loading">
        <div className="loading-spinner">
          <div className="spinner"></div>
          <p>You are already logged in. Redirecting...</p>
        </div>
      </div>
    );
  }

  // Main login/register page
  return (
    <div className="login-register-page">
      {/* Navbar and sidebar */}
            <nav>
              <ul className={`sidebar ${sidebarVisible ? 'active' : ''}`}>
                <li onClick={hideSidebar}><a href="#"><svg xmlns="http://www.w3.org/2000/svg" height="24px" viewBox="0 -960 960 960" width="24px" fill="#1f1f1f"><path d="m256-200-56-56 224-224-224-224 56-56 224 224 224-224 56 56-224 224 224 224-56 56-224-224-224 224Z"/></svg></a></li>
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
                          <path d="M480-480q-66 0-113-47t-47-113q0-66 47-113t113-47q66 0 113 47t47 113q0 66-47 113t-113 47ZM160-160v-112q0-34 17.5-62.5T224-378q62-31 126-46.5T480-440q66 0 130 15.5T736-378q29 15 46.5 43.5T800-272v112H160Z"/>
                        </svg>
                      </Link>
                    </li>
                  ) : (
                    <li className="hideOnMobile">
                      <Link to="/UserDashboard" title="User Dashboard">
                        <svg xmlns="http://www.w3.org/2000/svg" height="24px" viewBox="0 -960 960 960" width="24px" fill="#1f1f1f">
                          <path d="M480-480q-66 0-113-47t-47-113q0-66 47-113t113-47q66 0 113 47t47 113q0 66-47 113t-113 47ZM160-160v-112q0-34 17.5-62.5T224-378q62-31 126-46.5T480-440q66 0 130 15.5T736-378q29 15 46.5 43.5T800-272v112H160Z"/>
                        </svg>
                      </Link>
                    </li>
                  )
                ) : (
                  <li className="hideOnMobile">
                    <Link to="/login-register" title="Login / Register">
                      <svg xmlns="http://www.w3.org/2000/svg" height="24px" viewBox="0 -960 960 960" width="24px" fill="#1f1f1f">
                        <path d="M480-480q-66 0-113-47t-47-113q0-66 47-113t113-47q66 0 113 47t47 113q0 66-47 113t-113 47ZM160-160v-112q0-34 17.5-62.5T224-378q62-31 126-46.5T480-440q66 0 130 15.5T736-378q29 15 46.5 43.5T800-272v112H160Z"/>
                      </svg>
                    </Link>
                  </li>
                )}
                
                <li className="menu-button" onClick={showSidebar}>
                  <a href="#">
                    <svg xmlns="http://www.w3.org/2000/svg" height="24px" viewBox="0 -960 960 960" width="24px" fill="#1f1f1f">
                      <path d="M120-240v-80h720v80H120Zm0-200v-80h720v80H120Zm0-200v-80h720v80H120Z"/>
                    </svg>
                  </a>
                </li>
              </ul>
            </nav>

      {/* Verification Required Modal */}
      {showVerificationModal && (
        <div className="verification-modal">
          <div className="verification-modal-content">
            <button className="close-button" onClick={closeVerificationModal}>
              <svg xmlns="http://www.w3.org/2000/svg" height="24px" viewBox="0 -960 960 960" width="24px" fill="#1f1f1f">
                <path d="m256-200-56-56 224-224-224-224 56-56 224 224 224-224 56 56-224 224 224 224-56 56-224-224-224 224Z" />
              </svg>
            </button>
            <h3>Email Verification Required</h3>
            <p className="verification-text">
              We've sent a verification email to <strong>{verificationEmail}</strong>.
            </p>
            <p className="verification-instructions">
              <strong>⚠️ IMPORTANT:</strong> You <strong>cannot login</strong> until you verify your email address.
            </p>
            <div className="verification-steps">
              <h4>Please follow these steps:</h4>
              <ol>
                <li>Check your email inbox for a message from RP Media Services</li>
                <li>Click the verification link in the email</li>
                <li>Return here and login with your credentials</li>
                <li>If you don't see the email, check your spam/junk folder</li>
              </ol>
            </div>
            <button className="verification-ok-button" onClick={closeVerificationModal}>
              Got it, I'll verify my email
            </button>
          </div>
        </div>
      )}

      {/* Unverified Login Attempt Modal */}
      {showUnverifiedLoginModal && (
        <div className="verification-modal">
          <div className="verification-modal-content">
            <button className="close-button" onClick={closeUnverifiedLoginModal}>
              <svg xmlns="http://www.w3.org/2000/svg" height="24px" viewBox="0 -960 960 960" width="24px" fill="#1f1f1f">
                <path d="m256-200-56-56 224-224-224-224 56-56 224 224 224-224 56 56-224 224 224 224-56 56-224-224-224 224Z" />
              </svg>
            </button>
            <div className="verification-icon">🔒</div>
            <h3>Account Not Verified</h3>
            <p className="verification-text">
              The account <strong>{unverifiedEmail}</strong> is not verified.
            </p>
            <p className="verification-instructions">
              <strong>You must verify your email before you can login.</strong>
            </p>
            <div className="verification-steps">
              <h4>To activate your account:</h4>
              <ol>
                <li>Check your email inbox for the verification email</li>
                <li>Click the verification link in that email</li>
                <li>Return here and login again</li>
                <li>Check spam/junk folder if you don't see it</li>
              </ol>
            </div>
            <div className="verification-actions">
              <button
                className="verification-resend-button"
                onClick={handleResendVerification}
                disabled={loading}
              >
                {loading ? 'Processing...' : 'Need help?'}
              </button>
              <button
                className="verification-ok-button"
                onClick={closeUnverifiedLoginModal}
              >
                I'll verify my email
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Login/Register Content */}
      <div className={`login-container ${isActive ? 'active' : ''}`} id="login-container">
        {/* Register Form */}
        <div className="register-form">
          <form onSubmit={handleRegister}>
            <div
              className={`registerMessage ${registerMessage.includes('failed') ? 'error-message' : ''}`}
              style={{
                display: registerMessage ? 'block' : 'none',
                opacity: registerMessage ? 1 : 0
              }}
            >
              {registerMessage}
            </div>
            <h1>CREATE ACCOUNT</h1>
            <span>Register with email</span>
            <input
              type="text"
              id="name"
              placeholder="Username"
              value={registerData.name}
              onChange={handleRegisterChange}
              required
              disabled={loading}
              className="form-input"
            />
            <input
              type="email"
              id="email"
              placeholder="Email (Gmail only)"
              value={registerData.email}
              onChange={handleRegisterChange}
              required
              disabled={loading}
              className="form-input"
            />
            {emailError && (
              <div className="password-error">
                {emailError}
              </div>
            )}
            <div className="password-wrapper">
              <input
                type={showRegisterPassword ? "text" : "password"}
                id="password"
                placeholder="Password (6-20 characters)"
                value={registerData.password}
                onChange={handleRegisterChange}
                required
                minLength="6"
                maxLength="20"
                disabled={loading}
                className="form-input password-input"
              />
              <span
                className="password-toggle"
                onClick={toggleRegisterPasswordVisibility}
                disabled={loading}
              >
                {showRegisterPassword ? (
                  <svg xmlns="http://www.w3.org/2000/svg" height="20px" viewBox="0 -960 960 960" width="20px" fill="#666">
                    <path d="M480-320q75 0 127.5-52.5T660-500q0-75-52.5-127.5T480-680q-75 0-127.5 52.5T300-500q0 75 52.5 127.5T480-320Zm0-72q-45 0-76.5-31.5T372-500q0-45 31.5-76.5T480-608q45 0 76.5 31.5T588-500q0 45-31.5 76.5T480-392Zm0 192q-146 0-266-81.5T40-500q54-137 174-218.5T480-800q146 0 266 81.5T920-500q-54 137-174 218.5T480-200Zm0-300Zm0 220q113 0 207.5-59.5T832-500q-50-101-144.5-160.5T480-720q-113 0-207.5 59.5T128-500q50 101 144.5 160.5T480-280Z" />
                  </svg>
                ) : (
                  <svg xmlns="http://www.w3.org/2000/svg" height="20px" viewBox="0 -960 960 960" width="20px" fill="#666">
                    <path d="M644-428q-18-17-43.5-26.5T550-464q-71 0-120.5 49.5T380-294q0 29 9.5 54.5T416-196L264-84l-42-42 588-588 42 42-174 174q-13-5-26-8.5t-27-6.5l86-86H708v80h80v80h80v80h80v80h-80v80h-80v80h-80v80h-48l-78-78q-36 15-74 22.5T480-120q-146 0-266-81.5T40-500q20-52 55.5-101.5T179-690l-95-94 42-42 598 598-42 42-84-84Zm-74-74-74-74q19-7 38.5-10.5T480-590q71 0 120.5 49.5T650-420q0 21-3.5 40.5T636-341l-66-65ZM480-280q23 0 45.5-4t43.5-12L376-492q-8 20-12 42.5t-4 45.5q0 71 49.5 120.5T480-280ZM224-654q-45 45-78 100t-58 54q26 17 64 61t88 103q-22 24-50 42t-58 30l-44-44q38-17 69.5-39.5T244-404q-54-73-89-136.5T120-500q36-24 74.5-54t78.5-60l-49-49Zm294 74Z" />
                  </svg>
                )}
              </span>
            </div>
            <div className="password-wrapper">
              <input
                type={showConfirmPassword ? "text" : "password"}
                id="confirmPassword"
                placeholder="Confirm Password"
                value={registerData.confirmPassword}
                onChange={handleRegisterChange}
                required
                minLength="6"
                maxLength="20"
                disabled={loading}
                className="form-input password-input"
              />
              <span
                className="password-toggle"
                onClick={toggleConfirmPasswordVisibility}
                disabled={loading}
              >
                {showConfirmPassword ? (
                  <svg xmlns="http://www.w3.org/2000/svg" height="20px" viewBox="0 -960 960 960" width="20px" fill="#666">
                    <path d="M480-320q75 0 127.5-52.5T660-500q0-75-52.5-127.5T480-680q-75 0-127.5 52.5T300-500q0 75 52.5 127.5T480-320Zm0-72q-45 0-76.5-31.5T372-500q0-45 31.5-76.5T480-608q45 0 76.5 31.5T588-500q0 45-31.5 76.5T480-392Zm0 192q-146 0-266-81.5T40-500q54-137 174-218.5T480-800q146 0 266 81.5T920-500q-54 137-174 218.5T480-200Zm0-300Zm0 220q113 0 207.5-59.5T832-500q-50-101-144.5-160.5T480-720q-113 0-207.5 59.5T128-500q50 101 144.5 160.5T480-280Z" />
                  </svg>
                ) : (
                  <svg xmlns="http://www.w3.org/2000/svg" height="20px" viewBox="0 -960 960 960" width="20px" fill="#666">
                    <path d="M644-428q-18-17-43.5-26.5T550-464q-71 0-120.5 49.5T380-294q0 29 9.5 54.5T416-196L264-84l-42-42 588-588 42 42-174 174q-13-5-26-8.5t-27-6.5l86-86H708v80h80v80h80v80h80v80h-80v80h-80v80h-80v80h-48l-78-78q-36 15-74 22.5T480-120q-146 0-266-81.5T40-500q20-52 55.5-101.5T179-690l-95-94 42-42 598 598-42 42-84-84Zm-74-74-74-74q19-7 38.5-10.5T480-590q71 0 120.5 49.5T650-420q0 21-3.5 40.5T636-341l-66-65ZM480-280q23 0 45.5-4t43.5-12L376-492q-8 20-12 42.5t-4 45.5q0 71 49.5 120.5T480-280ZM224-654q-45 45-78 100t-58 54q26 17 64 61t88 103q-22 24-50 42t-58 30l-44-44q38-17 69.5-39.5T244-404q-54-73-89-136.5T120-500q36-24 74.5-54t78.5-60l-49-49Zm294 74Z" />
                  </svg>
                )}
              </span>
            </div>
            {passwordError && (
              <div className="password-error">
                {passwordError}
              </div>
            )}

            <button
              type="submit"
              className="submit-register"
              disabled={loading}
            >
              {loading ? (
                <>
                  <div className="spinner"></div>
                  Creating Account...
                </>
              ) : (
                'Register & Verify Email'
              )}
            </button>
          </form>
        </div>

        {/* Login Form */}
        <div className="login-form">
          <form onSubmit={handleLogin}>
            <div
              className={`loginMessage ${loginMessage.includes('failed') || loginMessage.includes('Incorrect') ? 'error-message' : ''}`}
              style={{
                display: loginMessage ? 'block' : 'none',
                opacity: loginMessage ? 1 : 0
              }}
            >
              {loginMessage}
            </div>
            <h1>LOGIN</h1>
            <span>Login with verified email</span>
            <input
              type="email"
              id="email"
              placeholder="Verified Email"
              value={loginData.email}
              onChange={handleLoginChange}
              required
              disabled={loading}
              className="form-input"
            />
            {emailError && (
              <div className="password-error">
                {emailError}
              </div>
            )}
            <div className="password-wrapper">
              <input
                type={showLoginPassword ? "text" : "password"}
                id="password"
                placeholder="Password"
                value={loginData.password}
                onChange={handleLoginChange}
                required
                disabled={loading}
                className="form-input password-input"
              />
              <span
                className="password-toggle"
                onClick={toggleLoginPasswordVisibility}
                disabled={loading}
              >
                {showLoginPassword ? (
                  <svg xmlns="http://www.w3.org/2000/svg" height="20px" viewBox="0 -960 960 960" width="20px" fill="#666">
                    <path d="M480-320q75 0 127.5-52.5T660-500q0-75-52.5-127.5T480-680q-75 0-127.5 52.5T300-500q0 75 52.5 127.5T480-320Zm0-72q-45 0-76.5-31.5T372-500q0-45 31.5-76.5T480-608q45 0 76.5 31.5T588-500q0 45-31.5 76.5T480-392Zm0 192q-146 0-266-81.5T40-500q54-137 174-218.5T480-800q146 0 266 81.5T920-500q-54 137-174 218.5T480-200Zm0-300Zm0 220q113 0 207.5-59.5T832-500q-50-101-144.5-160.5T480-720q-113 0-207.5 59.5T128-500q50 101 144.5 160.5T480-280Z" />
                  </svg>
                ) : (
                  <svg xmlns="http://www.w3.org/2000/svg" height="20px" viewBox="0 -960 960 960" width="20px" fill="#666">
                    <path d="M644-428q-18-17-43.5-26.5T550-464q-71 0-120.5 49.5T380-294q0 29 9.5 54.5T416-196L264-84l-42-42 588-588 42 42-174 174q-13-5-26-8.5t-27-6.5l86-86H708v80h80v80h80v80h80v80h-80v80h-80v80h-80v80h-48l-78-78q-36 15-74 22.5T480-120q-146 0-266-81.5T40-500q20-52 55.5-101.5T179-690l-95-94 42-42 598 598-42 42-84-84Zm-74-74-74-74q19-7 38.5-10.5T480-590q71 0 120.5 49.5T650-420q0 21-3.5 40.5T636-341l-66-65ZM480-280q23 0 45.5-4t43.5-12L376-492q-8 20-12 42.5t-4 45.5q0 71 49.5 120.5T480-280ZM224-654q-45 45-78 100t-58 54q26 17 64 61t88 103q-22 24-50 42t-58 30l-44-44q38-17 69.5-39.5T244-404q-54-73-89-136.5T120-500q36-24 74.5-54t78.5-60l-49-49Zm294 74Z" />
                  </svg>
                )}
              </span>
            </div>
            <a href="/password-reset" className="forgot-password">
              Forgot Your Password?
            </a>
            <button
              type="submit"
              className="submit-login"
              disabled={loading}
            >
              {loading ? (
                <>
                  <div className="spinner"></div>
                  Logging in...
                </>
              ) : (
                'LOGIN'
              )}
            </button>

          </form>
        </div>

        {/* Toggle Container */}
        <div className="toggle-container">
          <div className="toggle">
            <div className="toggle-left">
              <h1>Welcome to RP Media Services!</h1>
              <p>Already have a verified account?</p>
              <button
                className="hidden"
                onClick={() => setIsActive(false)}
                disabled={loading}
              >
                LOGIN
              </button>
            </div>
            <div className="toggle-panel toggle-right">
              <h1>Welcome to RP Media Services!</h1>
              <p>No account yet? Register and verify email</p>
              <button
                className="hidden"
                onClick={() => setIsActive(true)}
                disabled={loading}
              >
                REGISTER
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* CSS for verification modal */}

    </div>
  );
};

export default LoginRegister;