// context/PaymentContext.js - CLEANED VERSION
import React, { createContext, useContext, useState, useEffect } from 'react';
import { useAuth } from './AuthContext';
import { firebaseService } from '../services/firebaseService';
import { collection, query, where, getDocs, orderBy } from 'firebase/firestore';
import { db } from '../utils/firebase';

const PaymentContext = createContext();

export const usePayment = () => {
  const context = useContext(PaymentContext);
  if (!context) {
    throw new Error('usePayment must be used within a PaymentProvider');
  }
  return context;
};

export const PaymentProvider = ({ children }) => {
  const { user } = useAuth();
  const [paymentStatus, setPaymentStatus] = useState({
    isPaid: false,
    paidAt: null,
    amount: 0,
    collectionAccess: [],
    accessType: 'none'
  });
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [selectedCollection, setSelectedCollection] = useState(null);
  const [loading, setLoading] = useState(false);
  const [payments, setPayments] = useState([]);
  const [collections, setCollections] = useState([]);

  useEffect(() => {
    if (user) {
      loadPaymentStatus();
      setupPaymentListener();
      loadCollections();
    }
  }, [user]);

  const loadCollections = async () => {
    try {
      const result = await firebaseService.getCollections();
      if (result.success) {
        setCollections(result.collections);
      }
    } catch (error) {
      console.error('Error loading collections:', error);
    }
  };

  const setupPaymentListener = () => {
    if (user?.email) {
      return firebaseService.subscribeToPayments(user.email, (newPayments) => {
        setPayments(newPayments);
        updatePaymentStatusFromPayments(newPayments);
      });
    }
  };

  const updatePaymentStatusFromPayments = (paymentList) => {
    const completedPayments = paymentList.filter(payment => 
      payment.status === 'completed' || payment.status === 'paid'
    );
    
    if (completedPayments.length > 0) {
      const latestPayment = completedPayments[0];
      const collectionAccess = completedPayments.flatMap(p => p.collectionAccess || []);
      
      const newPaymentStatus = {
        isPaid: true,
        paidAt: latestPayment.paidAt,
        amount: latestPayment.amount,
        collectionAccess: [...new Set(collectionAccess)],
        accessType: latestPayment.accessType || 'collection'
      };
      
      setPaymentStatus(newPaymentStatus);
    } else {
      setPaymentStatus({
        isPaid: false,
        paidAt: null,
        amount: 0,
        collectionAccess: [],
        accessType: 'none'
      });
    }
  };

  const loadPaymentStatus = async () => {
    try {
      setLoading(true);
      
      let userPayments = [];
      
      try {
        const q = query(
          collection(db, 'payments'), 
          where('userEmail', '==', user.email),
          orderBy('paidAt', 'desc')
        );
        const querySnapshot = await getDocs(q);
        querySnapshot.forEach((doc) => {
          userPayments.push({ id: doc.id, ...doc.data() });
        });
      } catch (orderError) {
        const simpleQuery = query(
          collection(db, 'payments'), 
          where('userEmail', '==', user.email)
        );
        const simpleSnapshot = await getDocs(simpleQuery);
        simpleSnapshot.forEach((doc) => {
          userPayments.push({ id: doc.id, ...doc.data() });
        });
        
        userPayments.sort((a, b) => new Date(b.paidAt) - new Date(a.paidAt));
      }
      
      setPayments(userPayments);
      updatePaymentStatusFromPayments(userPayments);
      
    } catch (error) {
      console.error('Error loading payment status:', error);
      setPayments([]);
    } finally {
      setLoading(false);
    }
  };

  const checkCollectionAccess = (collectionId) => {
    if (user?.email === 'admin@rpmediaservices.com' || user?.email === 'admin@example.com') {
      return true;
    }
    
    if (collections && collections.length > 0) {
      const collection = collections.find(c => c.id === collectionId);
      if (collection && collection.price === 0) {
        return true;
      }
    }
    
    if (paymentStatus.isPaid) {
      if (paymentStatus.accessType === 'all') {
        return true;
      }
      
      const hasPaidAccess = paymentStatus.collectionAccess?.includes(collectionId);
      if (hasPaidAccess) {
        return true;
      }
    }
    
    const validPayments = payments.filter(p => 
      p.status === 'completed' || p.status === 'paid'
    );
    
    for (let payment of validPayments) {
      const hasAccess = 
        payment.collectionAccess?.includes(collectionId) || 
        payment.collectionId === collectionId;
      
      if (hasAccess) {
        return true;
      }
    }
    
    return false;
  };

  const requestPayment = (collection = null) => {
    if (!collection) {
      console.error('No collection provided for payment');
      return;
    }
    
    if (collection.price === 0) {
      return;
    }
    
    setSelectedCollection(collection);
    setShowPaymentModal(true);
  };

  const processPayPalPayment = async (paymentData) => {
    try {
      setLoading(true);
      
      const paymentResult = await firebaseService.processPayment({
        userEmail: user.email,
        collectionId: paymentData.collectionId,
        amount: paymentData.amount,
        currency: 'PHP',
        method: 'paypal',
        paypalOrderId: paymentData.paypalOrderId,
        transactionId: paymentData.transactionId,
        payerName: paymentData.payerName,
        payerEmail: paymentData.payerEmail,
        status: 'completed',
        paidAt: new Date().toISOString(),
        collectionAccess: paymentData.collectionAccess || [paymentData.collectionId],
        accessType: paymentData.accessType || 'collection'
      });

      if (paymentResult.success) {
        await loadPaymentStatus();
        return { success: true, paymentId: paymentResult.paymentId };
      } else {
        return { success: false, error: paymentResult.error };
      }
    } catch (error) {
      return { success: false, error: error.message };
    } finally {
      setLoading(false);
    }
  };

  const refreshPaymentStatus = async () => {
    await loadPaymentStatus();
  };

  const closePaymentModal = () => {
    setShowPaymentModal(false);
    setSelectedCollection(null);
  };

  const value = {
    paymentStatus,
    payments,
    collections,
    loading,
    showPaymentModal,
    selectedCollection,
    checkCollectionAccess,
    requestPayment,
    processPayment: processPayPalPayment,
    refreshPaymentStatus,
    closePaymentModal
  };

  return (
    <PaymentContext.Provider value={value}>
      {children}
    </PaymentContext.Provider>
  );
};