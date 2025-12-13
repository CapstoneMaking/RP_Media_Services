// src/pages/PasswordReset.js
import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { firebaseService } from '../services/firebaseService';
import '../styles/login.css'; // Reuse your login styles

const PasswordReset = () => {
  const [step, setStep] = useState(1); // 1 = email input, 2 = success message, 3 = reset form
  const [email, setEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [oobCode, setOobCode] = useState('');
  const [emailVerified, setEmailVerified] = useState(false);
  
  const navigate = useNavigate();
  const location = useLocation();

  // Check if there's a password reset code in the URL
  useEffect(() => {
    const queryParams = new URLSearchParams(location.search);
    const code = queryParams.get('oobCode');
    const mode = queryParams.get('mode');
    
    if (mode === 'resetPassword' && code) {
      // User clicked on reset password link
      verifyResetCode(code);
    }
  }, [location]);

  const verifyResetCode = async (code) => {
    try {
      setLoading(true);
      const result = await firebaseService.checkPasswordResetCode(code);
      
      if (result.success && result.operation === 'PASSWORD_RESET') {
        setOobCode(code);
        setEmail(result.email);
        setEmailVerified(true);
        setStep(3); // Go directly to password reset form
      } else {
        setError('Invalid or expired reset link. Please request a new password reset.');
        setStep(1);
      }
    } catch (err) {
      setError('Failed to verify reset link. Please request a new password reset.');
      setStep(1);
    } finally {
      setLoading(false);
    }
  };

  const handleRequestReset = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setMessage('');

    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      setError('Please enter a valid email address');
      setLoading(false);
      return;
    }

    const result = await firebaseService.sendPasswordReset(email);
    
    if (result.success) {
      setMessage(result.message);
      setStep(2); // Show success message
    } else {
      setError(result.error);
    }
    
    setLoading(false);
  };

  const handleResetPassword = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setMessage('');

    if (newPassword.length < 6) {
      setError('Password must be at least 6 characters');
      setLoading(false);
      return;
    }

    if (newPassword !== confirmPassword) {
      setError('Passwords do not match');
      setLoading(false);
      return;
    }

    const hasNumber = /\d/.test(newPassword);
    const hasLetter = /[a-zA-Z]/.test(newPassword);
    if (!hasNumber || !hasLetter) {
      setError('Password must contain at least one letter and one number');
      setLoading(false);
      return;
    }

    const result = await firebaseService.confirmPasswordReset(oobCode, newPassword);
    
    if (result.success) {
      setMessage('✅ Password reset successful! You can now login with your new password.');
      setTimeout(() => {
        navigate('/login-register');
      }, 3000);
    } else {
      setError(result.error || 'Failed to reset password. Please try again.');
    }
    
    setLoading(false);
  };

  const goToLogin = () => {
    navigate('/login-register');
  };

  return (
    <div className="login-register-page">
      {/* Reuse your navbar from LoginRegister.js */}
      <nav>
        <ul className="sidebar">
          {/* ... same sidebar as LoginRegister ... */}
        </ul>
        <ul>
          {/* ... same navbar as LoginRegister ... */}
        </ul>
      </nav>

      <div className="reset-container" style={{ height: 'auto', minHeight: '600px' }}>
        <div className="reset-form" style={{ width: '100%', maxWidth: '500px', margin: 'auto' , alignItems:'center'}}>
          <form onSubmit={step === 1 ? handleRequestReset : handleResetPassword}>
            <h1>Reset Password</h1>
            
            {message && (
              <div className="success-message" style={{ 
                background: '#d4edda', 
                color: '#155724', 
                padding: '15px', 
                borderRadius: '5px',
                marginBottom: '20px',
                textAlign: 'center'
              }}>
                {message}
              </div>
            )}
            
            {error && (
              <div className="error-message" style={{ 
                background: '#f8d7da', 
                color: '#721c24', 
                padding: '15px', 
                borderRadius: '5px',
                marginBottom: '20px',
                textAlign: 'center'
              }}>
                {error}
              </div>
            )}

            {step === 1 && (
              <>
                <p style={{ textAlign: 'center', marginBottom: '30px' }}>
                  Enter your email address and we'll send you a link to reset your password.
                </p>
                <input 
                  type="email" 
                  placeholder="Enter your email address" 
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  disabled={loading}
                  className="form-input"
                  style={{ width: '100%', marginBottom: '20px' }}
                />
                <button 
                  type="submit" 
                  className="submit-login"
                  disabled={loading}
                  style={{ width: '100%' }}
                >
                  {loading ? 'Sending...' : 'Send Reset Link'}
                </button>
              </>
            )}

            {step === 2 && (
              <>
                <div style={{ textAlign: 'center', padding: '20px 0' }}>
                  <div style={{ fontSize: '48px', marginBottom: '20px' }}>📧</div>
                  <h3>Check Your Email</h3>
                  <p>We've sent password reset instructions to:</p>
                  <p style={{ fontWeight: 'bold', margin: '10px 0' }}>{email}</p>
                  <p style={{ fontSize: '14px', color: '#666', marginTop: '20px' }}>
                    If you don't see the email, check your spam or junk folder.
                  </p>
                </div>
                <button 
                  type="button" 
                  className="submit-login"
                  onClick={goToLogin}
                  style={{ width: '100%', marginTop: '20px' }}
                >
                  Return to Login
                </button>
                <button 
                  type="button" 
                  className="submit-register"
                  onClick={() => {
                    setStep(1);
                    setMessage('');
                  }}
                  style={{ 
                    width: '100%', 
                    marginTop: '10px',
                    background: 'transparent',
                    color: '#1f1f1f',
                    border: '2px solid #1f1f1f'
                  }}
                >
                  Try a different email
                </button>
              </>
            )}

            {step === 3 && emailVerified && (
              <>
                <p style={{ textAlign: 'center', marginBottom: '30px' }}>
                  Reset password for: <strong>{email}</strong>
                </p>
                <div className="password-wrapper">
                  <input 
                    type="password"
                    placeholder="New Password (min. 6 characters)" 
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    required
                    minLength="6"
                    disabled={loading}
                    className="form-input password-input"
                    style={{ width: '100%', marginBottom: '15px' }}
                  />
                </div>
                <div className="password-wrapper">
                  <input 
                    type="password"
                    placeholder="Confirm New Password" 
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required
                    minLength="6"
                    disabled={loading}
                    className="form-input password-input"
                    style={{ width: '100%', marginBottom: '15px' }}
                  />
                </div>
                <button 
                  type="submit" 
                  className="submit-login"
                  disabled={loading}
                  style={{ width: '100%' }}
                >
                  {loading ? 'Resetting...' : 'Reset Password'}
                </button>
              </>
            )}

            <div style={{ textAlign: 'center', marginTop: '20px' }}>
              <Link to="/login-register" style={{ color: '#1f1f1f', textDecoration: 'underline' }}>
                ← Back to Login
              </Link>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default PasswordReset;