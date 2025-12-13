// src/context/AuthContext.js
import React, { createContext, useContext, useState, useEffect } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { auth, db } from '../utils/firebase';
import { firebaseService } from '../services/firebaseService';

const AuthContext = createContext();

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [userData, setUserData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isVerified, setIsVerified] = useState(false);

  // Function to check verification status
  const checkVerificationStatus = async (userEmail) => {
    if (!userEmail) {
      setIsVerified(false);
      return false;
    }

    try {
      console.log('Checking verification status for:', userEmail);
      
      // Query the idVerifications collection for this user
      const q = query(
        collection(db, 'idVerifications'),
        where('userEmail', '==', userEmail),
        where('status', '==', 'verified')
      );
      
      const querySnapshot = await getDocs(q);
      const isUserVerified = !querySnapshot.empty;
      
      console.log('Verification status result:', isUserVerified);
      setIsVerified(isUserVerified);
      return isUserVerified;
      
    } catch (error) {
      console.error('Error checking verification status:', error);
      setIsVerified(false);
      return false;
    }
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        setUser(user);
        try {
          const userData = await firebaseService.getUserByEmail(user.email);
          if (userData) {
            setUserData(userData);
            
            // Check verification status
            await checkVerificationStatus(user.email);
          } else {
            console.log('No user data found in Firestore for:', user.email);
            setUserData({
              email: user.email,
              name: user.displayName || user.email,
              role: 'user'
            });
            setIsVerified(false);
          }
        } catch (error) {
          console.error('Error fetching user data:', error);
          setUserData({
            email: user.email,
            name: user.displayName || user.email,
            role: 'user'
          });
          setIsVerified(false);
        }
      } else {
        setUser(null);
        setUserData(null);
        setIsVerified(false);
      }
      setLoading(false);
    });

    return unsubscribe;
  }, []);

  // Add this function to manually refresh verification status
  const refreshVerificationStatus = async () => {
    if (user?.email) {
      return await checkVerificationStatus(user.email);
    }
    return false;
  };

  const register = async (email, password, userData) => {
    const result = await firebaseService.registerUser(email, password, userData);
    return result;
  };

  const login = async (email, password) => {
    const result = await firebaseService.loginUser(email, password);
    if (result.success && result.user) {
      // User is logged in, context will update automatically via onAuthStateChanged
      return result;
    }
    return result;
  };

  const logout = async () => {
    const result = await firebaseService.logoutUser();
    if (result.success) {
      setUser(null);
      setUserData(null);
      setIsVerified(false);
    }
    return result;
  };

  const value = {
    user,
    userData,
    isVerified,
    register,
    login,
    logout,
    loading,
    isAdmin: userData?.role === 'admin',
    refreshVerificationStatus
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};