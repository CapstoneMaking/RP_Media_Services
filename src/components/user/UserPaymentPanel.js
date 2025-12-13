// components/PaymentModal.js - UPDATED FOR PHP
import React, { useState, useEffect, useRef } from 'react';
import { usePayment } from '../../context/PaymentContext';
import { useAuth } from '../../context/AuthContext';

const UserPaymentPanel = () => {
  const { 
    showPaymentModal, 
    selectedCollection, 
    processPayment, 
    closePaymentModal,
    loading,
    refreshPaymentStatus
  } = usePayment();
  
  const { user } = useAuth();
  const [paymentSuccess, setPaymentSuccess] = useState(false);
  const [error, setError] = useState('');
  const [paypalLoaded, setPaypalLoaded] = useState(false);
  const [loadingPayPal, setLoadingPayPal] = useState(false);
  const paypalButtonsRef = useRef(null);

  const PAYPAL_CLIENT_ID = 'AWCQefq8SIs_Fuayw9IBekdAKsSOkSS0ZTXCBSgZE8s35YI2AlalQZrCn15lzWja2gz6SI4i_xxZOgaH';

  useEffect(() => {
    if (showPaymentModal) {
      setError('');
      setPaymentSuccess(false);
      setPaypalLoaded(false);
      setLoadingPayPal(true);
      loadPayPalSDK();
    }
  }, [showPaymentModal]);

  const loadPayPalSDK = () => {
    const existingScripts = document.querySelectorAll('script[src*="paypal.com/sdk/js"]');
    existingScripts.forEach(script => script.remove());

    const script = document.createElement('script');
    // CHANGED: Updated to PHP currency
    script.src = `https://www.paypal.com/sdk/js?client-id=${PAYPAL_CLIENT_ID}&currency=PHP`;
    script.async = true;
    
    script.onload = () => {
      setPaypalLoaded(true);
      setLoadingPayPal(false);
      renderPayPalButtons();
    };
    
    script.onerror = () => {
      setError('Failed to load payment system. Please check your connection.');
      setLoadingPayPal(false);
    };

    document.head.appendChild(script);
  };

  const renderPayPalButtons = () => {
    if (!paypalButtonsRef.current || !window.paypal) return;

    try {
      paypalButtonsRef.current.innerHTML = '';

      const buttons = window.paypal.Buttons({
        style: {
          layout: 'vertical',
          color: 'blue',
          shape: 'rect',
          label: 'paypal',
          height: 48
        },

        createOrder: function(data, actions) {
          const amount = selectedCollection?.price || 10;
          return actions.order.create({
            purchase_units: [{
              amount: {
                currency_code: "PHP", // CHANGED: PHP currency
                value: amount.toString()
              },
              description: selectedCollection?.name || "Premium Collection"
            }]
          });
        },

        onApprove: async function(data, actions) {
          try {
            setError('');
            const details = await actions.order.capture();
            
            const paymentData = {
              method: 'paypal',
              amount: selectedCollection?.price || 10,
              collectionId: selectedCollection?.id,
              paypalOrderId: data.orderID,
              transactionId: details.id,
              payerEmail: details.payer.email_address,
              payerName: `${details.payer.name.given_name} ${details.payer.name.surname}`,
              status: 'completed',
              collectionAccess: [selectedCollection?.id],
              accessType: 'collection',
              currency: 'PHP' // ADDED: Track currency
            };

            const result = await processPayment(paymentData);

            if (result.success) {
              setPaymentSuccess(true);
              
              await refreshPaymentStatus();
              
              setTimeout(() => {
                closePaymentModal();
                window.location.reload();
              }, 3000);
            } else {
              setError(result.error || 'Payment completed but failed to unlock content.');
            }
          } catch (error) {
            setError('Payment processing error. Please contact support.');
          }
        },

        onCancel: function() {
          // Silent cancel - no error needed
        },

        onError: function(err) {
          if (err && err.message && !err.message.includes('Script error')) {
            setError('Payment error: Please try again.');
          }
        }
      });

      buttons.render(paypalButtonsRef.current).catch((error) => {
        // Handle render error silently
      });

    } catch (error) {
      // Handle button creation error silently
    }
  };

  useEffect(() => {
    if (showPaymentModal && paypalLoaded) {
      renderPayPalButtons();
    }
  }, [showPaymentModal, paypalLoaded]);

  // Global error handler to catch script errors
  useEffect(() => {
    const handleScriptError = (event) => {
      // Ignore script errors from PayPal
      if (event.message && event.message.includes('Script error')) {
        event.preventDefault();
        return false;
      }
    };

    window.addEventListener('error', handleScriptError);
    return () => window.removeEventListener('error', handleScriptError);
  }, []);

  if (!showPaymentModal) return null;

  if (paymentSuccess) {
    return (
      <div className="modal-overlay">
        <div className="modal-content payment-modal">
          <div className="modal-body">
            <div className="payment-success">
              <h3>Payment Successful!</h3>
              <p>You now have access to "{selectedCollection?.name}"</p>
              <p>Page will refresh automatically...</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="modal-overlay">
      <div className="modal-content payment-modal">
        <div className="modal-header">
          <h2>Unlock Premium Collection</h2>
          <button className="close-button" onClick={closePaymentModal}>×</button>
        </div>
        
        <div className="modal-body">
          <div className="payment-summary">
            <h3>{selectedCollection?.name}</h3>
            <p>{selectedCollection?.description}</p>
            <div className="price-display">
              {/* CHANGED: Updated to show PHP symbol */}
              <span className="price">₱{selectedCollection?.price || 10}</span>
              <span className="price-note">One-time payment • Lifetime access</span>
            </div>
          </div>

          {/* Only show meaningful errors, not script errors */}
          {error && !error.includes('Script') && (
            <div className="error-message">
              {error}
            </div>
          )}

          <div className="payment-form">
            {loadingPayPal && (
              <div className="loading-paypal">
                <div className="spinner"></div>
                <p>Loading payment options...</p>
              </div>
            )}

            <div 
              ref={paypalButtonsRef} 
              className="paypal-buttons-container"
              style={{ minHeight: '60px' }}
            />

            <div className="payment-actions">
              <button 
                className="btn btn-secondary"
                onClick={closePaymentModal}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default UserPaymentPanel;