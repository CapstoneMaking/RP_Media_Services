import React, { createContext, useContext, useState, useEffect } from 'react';
import { useAuth } from './AuthContext';
import { firebaseService } from '../services/firebaseService';
import { cloudinaryService } from '../services/cloudinaryService';

const IDVerificationContext = createContext();

export const useIDVerification = () => {
  const context = useContext(IDVerificationContext);
  if (!context) {
    throw new Error('useIDVerification must be used within an IDVerificationProvider');
  }
  return context;
};

export const IDVerificationProvider = ({ children }) => {
  const { user, userData } = useAuth();
  const [verifications, setVerifications] = useState([]);
  const [userVerification, setUserVerification] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (user) {
      loadUserVerification();
      if (isAdmin()) {
        loadAllVerifications();
      }
    }
  }, [user]);

  const isAdmin = () => {
    return userData?.role === 'admin' || user?.email === 'admin@rpmediaservices.com';
  };

  const loadUserVerification = async () => {
    if (!user?.email) return;
    
    try {
      setLoading(true);
      const result = await firebaseService.getUserVerification(user.email);
      if (result.success) {
        setUserVerification(result.verification);
      }
    } catch (error) {
      console.error('Error loading user verification:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadAllVerifications = async () => {
    try {
      setLoading(true);
      const result = await firebaseService.getAllVerifications();
      if (result.success) {
        setVerifications(result.verifications);
      }
    } catch (error) {
      console.error('Error loading verifications:', error);
    } finally {
      setLoading(false);
    }
  };

  const submitVerification = async (verificationData) => {
    try {
      setLoading(true);
      
      let idFrontData = verificationData.idFront;
      let idBackData = verificationData.idBack;
      let selfieData = verificationData.selfie;

      if (verificationData.idFront && !verificationData.idFront.secure_url) {
        console.log('Uploading new ID front image...');
        idFrontData = await cloudinaryService.uploadImage(verificationData.idFront);
      }

      if (verificationData.idBack && !verificationData.idBack.secure_url) {
        console.log('Uploading new ID back image...');
        idBackData = await cloudinaryService.uploadImage(verificationData.idBack);
      }

      if (verificationData.selfie && !verificationData.selfie.secure_url) {
        console.log('Uploading new selfie image...');
        selfieData = await cloudinaryService.uploadImage(verificationData.selfie);
      }

      const verificationDoc = {
        userEmail: user.email,
        userName: user.displayName || user.email,
        firstName: verificationData.firstName,
        middleName: verificationData.middleName,
        lastName: verificationData.lastName,
        suffix: verificationData.suffix,
        idType: verificationData.idType,
        idNumber: verificationData.idNumber,
        dateOfBirth: verificationData.dateOfBirth,
        address: verificationData.address,
        phoneNumber: verificationData.phoneNumber,
        idFront: idFrontData,
        idBack: idBackData,
        selfie: selfieData,
        status: 'pending',
        submittedAt: new Date().toISOString(),
        verifiedAt: null,
        adminNotes: '',
        resubmissionCount: userVerification ? (userVerification.resubmissionCount || 0) + 1 : 0,
        previousStatus: userVerification ? userVerification.status : null
      };

      let result;
      
      if (userVerification && userVerification.id) {
        result = await firebaseService.updateVerification(userVerification.id, verificationDoc);
      } else {
        result = await firebaseService.saveVerification(verificationDoc);
      }
      
      if (result.success) {
        await loadUserVerification();
        await loadAllVerifications();
        return { success: true };
      } else {
        return { success: false, error: result.error };
      }
    } catch (error) {
      console.error('Error submitting verification:', error);
      return { success: false, error: error.message };
    } finally {
      setLoading(false);
    }
  };

  const updateVerificationStatus = async (verificationId, status, adminNotes = '') => {
    try {
      setLoading(true);
      const result = await firebaseService.updateVerificationStatus(
        verificationId, 
        status, 
        adminNotes
      );
      
      if (result.success) {
        await loadAllVerifications();
        if (userVerification && userVerification.id === verificationId) {
          await loadUserVerification();
        }
        return { success: true };
      } else {
        return { success: false, error: result.error };
      }
    } catch (error) {
      console.error('Error updating verification:', error);
      return { success: false, error: error.message };
    } finally {
      setLoading(false);
    }
  };

  const value = {
    verifications,
    userVerification,
    loading,
    submitVerification,
    updateVerificationStatus,
    loadAllVerifications,
    loadUserVerification,
    isAdmin: isAdmin()
  };

  return (
    <IDVerificationContext.Provider value={value}>
      {children}
    </IDVerificationContext.Provider>
  );
};