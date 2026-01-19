import React, { useState, useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { collection, addDoc } from 'firebase/firestore';
import { onAuthStateChanged } from 'firebase/auth';
import { auth, db } from '../utils/firebase';
import { useAuth } from '../context/AuthContext';
import { firebaseService } from '../services/firebaseService';
import emailjs from '@emailjs/browser';

// ====================================================
// EMAILJS CONFIGURATION
// ====================================================
const EMAILJS_PUBLIC_KEY = 'orx7cDFwLKVnAld7s';
const EMAILJS_SERVICE_ID = 'service_ppveqbj';
const PAYMENT_CONFIRMED_TEMPLATE_ID = 'template_a4zldlc';
const ELECTRONIC_RECEIPT_TEMPLATE_ID = 'template_k71h8k9';

// Initialize EmailJS
emailjs.init(EMAILJS_PUBLIC_KEY);
// ====================================================

const ConfirmationPage = () => {
  const [selectedItems, setSelectedItems] = useState([]);
  const [selectedPackage, setSelectedPackage] = useState(null);
  const [bookingData, setBookingData] = useState({});
  const [showPolicyModal, setShowPolicyModal] = useState(false);
  const [showVerificationModal, setShowVerificationModal] = useState(false);
  const [policyContent, setPolicyContent] = useState('');
  const [message, setMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [currentUser, setCurrentUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [hasValidBooking, setHasValidBooking] = useState(false);
  const [userInfo, setUserInfo] = useState({
    name: '',
    email: '',
    contact: ''
  });
  const [formData, setFormData] = useState({
    region: '',
    province: '',
    city: '',
    specificAddress: ''
  });
  const [isUserVerified, setIsUserVerified] = useState(false);
  const [verificationData, setVerificationData] = useState(null);
  const [isProcessingPayment, setIsProcessingPayment] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [paymentSuccessful, setPaymentSuccessful] = useState(false);
  const [isPayPalSdkLoaded, setIsPayPalSdkLoaded] = useState(false);

  const { isVerified, refreshVerificationStatus } = useAuth();
  const navigate = useNavigate();

  // Use ref to track PayPal script
  const paypalScriptRef = useRef(null);
  const paypalButtonsRef = useRef(null);

  // Philippine Locations Data
  const philippineLocations = {
    "National Capital Region (NCR)": {
      "Metro Manila": [
        "Caloocan", "Las Piñas", "Makati", "Malabon", "Mandaluyong",
        "Manila", "Marikina", "Muntinlupa", "Navotas", "Parañaque",
        "Pasay", "Pasig", "Pateros", "Quezon City", "San Juan",
        "Taguig", "Valenzuela"
      ]
    },
    "Region IV-A (CALABARZON)": {
      "Batangas": [
        "Agoncillo", "Alitagtag", "Balayan", "Balete", "Batangas City",
        "Bauan", "Calaca", "Calatagan", "Cuenca", "Ibaan", "Laurel",
        "Lemery", "Lian", "Lipa City", "Lobo", "Mabini", "Malvar",
        "Mataasnakahoy", "Nasugbu", "Padre Garcia", "Rosario", "San Jose",
        "San Juan", "San Luis", "San Nicolas", "San Pascual", "Santa Teresita",
        "Santo Tomas", "Taal", "Talisay", "Tanauan City", "Taysan", "Tingloy",
        "Tuy"
      ],
      "Cavite": [
        "Alfonso", "Amadeo", "Bacoor City", "Carmona", "Cavite City",
        "Dasmariñas City", "General Emilio Aguinaldo", "General Trias City",
        "Imus City", "Indang", "Kawit", "Magallanes", "Maragondon", "Mendez",
        "Naic", "Noveleta", "Rosario", "Silang", "Tagaytay City", "Tanza",
        "Ternate", "Trece Martires City"
      ],
      "Laguna": [
        "Alaminos", "Bay", "Biñan City", "Cabuyao City", "Calamba City",
        "Calauan", "Cavinti", "Famy", "Kalayaan", "Liliw", "Los Baños",
        "Luisiana", "Lumban", "Mabitac", "Magdalena", "Majayjay", "Nagcarlan",
        "Paete", "Pagsanjan", "Pakil", "Pangil", "Pila", "Rizal", "San Pablo City",
        "San Pedro City", "Santa Cruz", "Santa Maria", "Santa Rosa City", "Siniloan",
        "Victoria"
      ],
      "Quezon": [
        "Agdangan", "Alabat", "Atimonan", "Buenavista", "Burdeos", "Calauag",
        "Candelaria", "Catanauan", "Dolores", "General Luna", "General Nakar",
        "Guinayangan", "Gumaca", "Infanta", "Jomalig", "Lopez", "Lucban",
        "Lucena City", "Macalelon", "Mauban", "Mulanay", "Padre Burgos",
        "Pagbilao", "Panukulan", "Patnanungan", "Perez", "Pitogo", "Plaridel",
        "Polillo", "Quezon", "Real", "Sampaloc", "San Andres", "San Antonio",
        "San Francisco", "San Narciso", "Sariaya", "Tagkawayan", "Tayabas City",
        "Tiaong", "Unisan"
      ],
      "Rizal": [
        "Angono", "Antipolo City", "Baras", "Binangonana", "Cainta", "Cardona",
        "Jalajala", "Morong", "Pililla", "Rodriguez", "San Mateo", "Tanay",
        "Taytay", "Teresa"
      ]
    },
    "Region III (Central Luzon)": {
      "Bulacan": [
        "Angat", "Balagtas", "Baliuag", "Bocaue", "Bulacan", "Bustos",
        "Calumpit", "Doña Remedios Trinidad", "Guiguinto", "Hagonoy",
        "Malolos City", "Marilao", "Meycauyan City", "Norzagaray",
        "Obando", "Pandi", "Paombong", "Plaridel", "Pulilan", "San Ildefonso",
        "San Jose del Monte City", "San Miguel", "San Rafael", "Santa Maria"
      ],
      "Pampanga": [
        "Angeles City", "Apalit", "Arayat", "Bacolor", "Candaba",
        "Floridablanca", "Guagua", "Lubao", "Mabalacat City", "Macabebe",
        "Magalang", "Masantol", "Mexico", "Minalin", "Porac", "San Fernando City",
        "San Luis", "San Simon", "Santa Ana", "Santa Rita", "Santo Tomas",
        "Sasmuan"
      ]
    }
  };
  const [sidebarVisible, setSidebarVisible] = useState(false);
  const { user, isAdmin } = useAuth();

  const showSidebar = () => {
    setSidebarVisible(true);
  };

  const hideSidebar = () => {
    setSidebarVisible(false);
  };

  // ====================================================
  // MAIN EMAIL SENDING FUNCTION - FIXED VERSION
  // ====================================================
  const sendConfirmationEmails = async (paymentDetails) => {
  try {
    // Get recipient email
    const recipientEmail = userInfo?.email || currentUser?.email;

    if (!recipientEmail) {
      return {
        success: false,
        error: 'No email address found for user',
        message: 'Please ensure your profile has a valid email address.'
      };
    }
    

    // Generate IDs
    const bookingId = `RP${Date.now().toString().slice(-8)}`;
    const receiptNo = `RCPT${Date.now().toString().slice(-10)}`;

    // Calculate rental days
    const rentalDays = bookingData.startDate && bookingData.endDate
      ? Math.ceil((new Date(bookingData.endDate) - new Date(bookingData.startDate)) / (1000 * 60 * 60 * 24)) + 1
      : 0;

    // Calculate financials
    const dailyRate = selectedItems.reduce((sum, item) => sum + (item.subtotal || 0), 0) ||
      (selectedPackage ? selectedPackage.price : 0);

    const additionalFee = 1000;
    const total = (dailyRate * rentalDays) + additionalFee;
    const remainingBalance = total;

    // Create full address
    const fullAddress = formData.specificAddress && formData.city && formData.province && formData.region
      ? `${formData.specificAddress}, ${formData.city}, ${formData.province}, ${formData.region}`
      : 'Address not specified';

    // Create items text
    const itemsText = selectedItems.length > 0 
      ? selectedItems.map(item => 
          `${item.name} x${item.quantity} - ₱${item.subtotal?.toFixed(2)}`
        ).join(' | ')
      : (selectedPackage ? `${selectedPackage.name} Package` : 'No items');

    // Base template parameters
    const baseParams = {
      // EmailJS required fields
      to_email: recipientEmail,
      to_name: userInfo.name || 'Customer',
      from_name: 'RP Media Services',
      reply_to: 'info@rpmediaservices.com',

      // Customer information
      email: recipientEmail,
      customer_name: userInfo.name || 'Customer',
      customer_email: recipientEmail,
      contact_number: userInfo.contact || 'Not provided',

      // Address information
      region: formData.region || 'Not specified',
      province: formData.province || 'Not specified',
      city: formData.city || 'Not specified',
      specific_address: formData.specificAddress || 'Not specified',
      full_address: fullAddress,
      venue: fullAddress,

      // Booking details
      booking_id: bookingId,
      receipt_number: receiptNo,
      start_date: bookingData.startDate || 'Not specified',
      end_date: bookingData.endDate || 'Not specified',
      rental_days: rentalDays.toString(),
      booking_type: selectedPackage ? 'Package' : 'Individual Items',

      // Payment details
      transaction_id: paymentDetails.orderID || paymentDetails.paymentID || 'N/A',
      booking_date: new Date().toLocaleString('en-PH'),
      receipt_date: new Date().toLocaleDateString('en-PH'),
      receipt_time: new Date().toLocaleTimeString('en-PH', {
        hour: '2-digit',
        minute: '2-digit'
      }),

      // Financial details
      daily_rate: dailyRate.toFixed(2),
      rental_subtotal: (dailyRate * rentalDays).toFixed(2),
      additional_fee: additionalFee.toFixed(2),
      total_amount: total.toFixed(2),
      reservation_fee: '1000.00',
      remaining_balance: remainingBalance.toFixed(2),

      // ✅✅✅ CRITICAL FIX: ACTUAL BOOLEANS for Handlebars {{#if}}
      multiple_days: rentalDays > 1, // ACTUAL boolean (true/false)

      // Package/Items information
      is_package: !!selectedPackage, // ✅ ACTUAL boolean (true/false)
      package_name: selectedPackage?.name || '',
      package_description: selectedPackage?.description || '',
      package_subtotal: (dailyRate * rentalDays).toFixed(2),
      items_text: itemsText,
      items_count: selectedItems.length.toString(),

      // Links
      dashboard_link: `${window.location.origin}/userDashboard`,
      receipt_link: `${window.location.origin}/receipt/${receiptNo}`,
    };

    // Add debugging log
    console.log('📧 DEBUG: Email parameters being sent:', {
      to_email: baseParams.to_email,
      is_package: baseParams.is_package,
      is_package_type: typeof baseParams.is_package,
      multiple_days: baseParams.multiple_days,
      multiple_days_type: typeof baseParams.multiple_days,
      has_selectedPackage: !!selectedPackage,
      rental_days: rentalDays
    });

    // 1. Send Payment Confirmation Email
    console.log('📤 Sending payment confirmation email...');
    await emailjs.send(
      EMAILJS_SERVICE_ID,
      PAYMENT_CONFIRMED_TEMPLATE_ID,
      baseParams
    );

    // Wait between emails
    await new Promise(resolve => setTimeout(resolve, 1000));

    // 2. Send Electronic Receipt Email
    // Add receipt-specific parameters
    const receiptParams = {
      ...baseParams,
      receipt_type: 'Electronic Receipt',
      payment_method: 'PayPal',
      payment_status: 'Reservation Fee Paid'
    };

    console.log('📤 Sending electronic receipt email...');
    console.log('📊 Receipt params:', {
      is_package: receiptParams.is_package,
      multiple_days: receiptParams.multiple_days,
      template_id: ELECTRONIC_RECEIPT_TEMPLATE_ID
    });

    await emailjs.send(
      EMAILJS_SERVICE_ID,
      ELECTRONIC_RECEIPT_TEMPLATE_ID,
      receiptParams
    );

    return {
      success: true,
      bookingId,
      receiptNo,
      message: `Confirmation emails sent to ${recipientEmail}`
    };

  } catch (error) {
    console.error('❌ Email sending error:', error);
    console.error('Error details:', error.text || error.message);
    
    // Check if it's the electronic receipt that failed
    if (error.text && error.text.includes('recipients address')) {
      console.error('💥 EmailJS error: Recipient address issue');
      console.error('Current recipient:', userInfo?.email || currentUser?.email);
    }
    
    // Try to send at least one email if both fail
    try {
      const recipientEmail = userInfo?.email || currentUser?.email;
      if (recipientEmail) {
        await emailjs.send(
          EMAILJS_SERVICE_ID,
          PAYMENT_CONFIRMED_TEMPLATE_ID,
          {
            to_email: recipientEmail,
            to_name: userInfo.name || 'Customer',
            from_name: 'RP Media Services',
            reply_to: 'info@rpmediaservices.com',
            message: 'Your booking has been confirmed. Please check your dashboard for details.'
          }
        );
        console.log('📧 Fallback confirmation email sent');
      }
    } catch (fallbackError) {
      console.error('Fallback email also failed:', fallbackError);
    }

    return {
      success: false,
      error: error.text || error.message || 'Failed to send emails',
      message: 'Booking confirmed but email failed to send. Please check your dashboard.'
    };
  }
};


  // ====================================================
  // PAYPAL AND BOOKING FUNCTIONS
  // ====================================================

  // Load PayPal SDK
  useEffect(() => {
    if (showPaymentModal && !isPayPalSdkLoaded && !window.paypal) {
      const script = document.createElement('script');
      script.src = `https://www.paypal.com/sdk/js?client-id=${process.env.REACT_APP_PAYPAL_CLIENT_ID || 'test'}&currency=PHP`;
      script.async = true;
      script.id = 'paypal-sdk-script';

      script.onload = () => {
        setIsPayPalSdkLoaded(true);
        paypalScriptRef.current = script;
        setTimeout(initializePayPalButtons, 100);
      };

      script.onerror = (error) => {
        setErrorMessage('Failed to load payment system. Please refresh the page or try again later.');
        setIsPayPalSdkLoaded(false);
      };

      document.head.appendChild(script);

      return () => {
        if (paypalButtonsRef.current) {
          try {
            paypalButtonsRef.current.close();
          } catch (error) {
            // Silent fail
          }
          paypalButtonsRef.current = null;
        }

        if (!paymentSuccessful && !isProcessingPayment && paypalScriptRef.current) {
          try {
            if (paypalScriptRef.current.parentNode) {
              paypalScriptRef.current.parentNode.removeChild(paypalScriptRef.current);
            }
          } catch (error) {
            // Silent fail
          }
          paypalScriptRef.current = null;
          setIsPayPalSdkLoaded(false);
        }
      };
    }
  }, [showPaymentModal, isPayPalSdkLoaded, paymentSuccessful, isProcessingPayment]);

  // Initialize PayPal buttons
  const initializePayPalButtons = () => {
    if (!window.paypal || !showPaymentModal) {
      return;
    }

    const container = document.getElementById('paypal-button-container');
    if (!container) {
      return;
    }

    // Clear container first
    container.innerHTML = '';

    try {
      const buttons = window.paypal.Buttons({
        style: {
          layout: 'vertical',
          color: 'blue',
          shape: 'rect',
          label: 'paypal',
          height: 55,
        },
        createOrder: function (data, actions) {
          return actions.order.create({
            purchase_units: [{
              amount: {
                value: '1.00',
                currency_code: 'PHP'
              },
              description: 'Reservation Fee for Equipment Rental'
            }]
          });
        },
        onApprove: async function (data, actions) {
          setIsProcessingPayment(true);

          try {
            const details = await actions.order.capture();
            const paymentDetails = {
              orderID: data.orderID,
              paymentID: details.id,
              payerID: data.payerID,
              status: details.status,
              create_time: details.create_time,
              update_time: details.update_time,
              email: details.payer.email_address,
              name: `${details.payer.name.given_name} ${details.payer.name.surname}`,
              payer: details.payer
            };

            // Save booking with payment details
            await saveBooking(paymentDetails);

            // Send confirmation emails
            const emailResult = await sendConfirmationEmails(paymentDetails);
            
            if (emailResult.success) {
              setPaymentSuccessful(true);
              setMessage(`Booking reserved successfully! ₱1,000 reservation fee paid. Confirmation emails sent to ${userInfo.email}. Redirecting...`);
            } else {
              setPaymentSuccessful(true);
              setMessage(`Booking reserved successfully! ₱1,000 reservation fee paid. Please check your dashboard for details.`);
            }

          } catch (error) {
            setErrorMessage('Payment successful but booking save failed. Please contact support.');
            setIsProcessingPayment(false);
          }
        },
        onError: function (err) {
          setErrorMessage('Payment failed. Please try again.');
          setIsProcessingPayment(false);
        },
        onCancel: function (data) {
          setErrorMessage('Payment was cancelled. Please complete payment to confirm your booking.');
        }
      });

      if (buttons.isEligible()) {
        buttons.render('#paypal-button-container').then((instance) => {
          paypalButtonsRef.current = instance;
        }).catch((error) => {
          setErrorMessage('Failed to load payment buttons. Please refresh the page.');
        });
      } else {
        setErrorMessage('PayPal payment is not available. Please try another payment method.');
      }

    } catch (error) {
      setErrorMessage('Failed to initialize payment system. Please try again.');
    }
  };

  // Re-initialize PayPal buttons when SDK loads
  useEffect(() => {
    if (isPayPalSdkLoaded && showPaymentModal) {
      initializePayPalButtons();
    }
  }, [isPayPalSdkLoaded, showPaymentModal]);

  // Function to format full name from verification data
  const formatFullName = (verification) => {
    if (!verification) return '';

    let fullName = verification.firstName || '';

    if (verification.middleName) {
      fullName += ` ${verification.middleName}`;
    }

    if (verification.lastName) {
      fullName += ` ${verification.lastName}`;
    }

    if (verification.suffix) {
      fullName += ` ${verification.suffix}`;
    }

    return fullName.trim();
  };

  // Function to fetch user verification data
  const fetchUserVerificationData = async (userEmail) => {
    try {
      const result = await firebaseService.getUserVerification(userEmail);

      if (result.success && result.verification) {
        const verification = result.verification;
        setVerificationData(verification);

        const fullName = formatFullName(verification);

        const contact = verification.contactNumber ||
          verification.mobileNumber ||
          verification.phoneNumber ||
          verification.contact ||
          verification.phoneNumber ||
          '';

        return { name: fullName, contact };
      } else {
        return { name: '', contact: '' };
      }

    } catch (error) {
      return { name: '', contact: '' };
    }
  };

  // Function to fetch user data from Firestore users collection
  const fetchUserData = async (userEmail) => {
    try {
      const userDoc = await firebaseService.getUserByEmail(userEmail);

      if (userDoc) {
        const name = userDoc.name || userDoc.fullName || userDoc.displayName || '';

        const contact = userDoc.contactNumber ||
          userDoc.mobileNumber ||
          userDoc.phoneNumber ||
          userDoc.phone ||
          userDoc.contact ||
          '';

        return { name, contact };
      }

      return { name: '', contact: '' };

    } catch (error) {
      return { name: '', contact: '' };
    }
  };

  // Function to check verification status
  const checkVerificationStatus = async (userEmail) => {
    if (!userEmail) {
      setIsUserVerified(false);
      return false;
    }

    try {
      if (isVerified) {
        setIsUserVerified(true);
        return true;
      }

      const isVerifiedManually = await refreshVerificationStatus();
      setIsUserVerified(isVerifiedManually);
      return isVerifiedManually;

    } catch (error) {
      setIsUserVerified(false);
      return false;
    }
  };

  useEffect(() => {
    const loadBookingData = () => {
      try {
        const items = JSON.parse(localStorage.getItem("selectedItems")) || [];
        const pkg = JSON.parse(localStorage.getItem("selectedPackage"));
        const booking = JSON.parse(localStorage.getItem("bookingFormData")) || {};

        if (items.length === 0 && !pkg) {
          setHasValidBooking(false);
          return;
        }

        setSelectedItems(items);
        setSelectedPackage(pkg);
        setBookingData(booking);

      } catch (error) {
        setSelectedItems([]);
        setSelectedPackage(null);
        setBookingData({});
        setHasValidBooking(false);
      }
    };

    loadBookingData();

    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setCurrentUser(user);

      if (user) {
        const authName = user.displayName || '';
        const authEmail = user.email || '';

        await checkVerificationStatus(user.email);

        const verificationDataResult = await fetchUserVerificationData(user.email);

        if ((!verificationDataResult.name && !verificationDataResult.contact) ||
          (verificationDataResult.name === '' && verificationDataResult.contact === '')) {
          const userData = await fetchUserData(user.email);
          verificationDataResult.name = verificationDataResult.name || userData.name || '';
          verificationDataResult.contact = verificationDataResult.contact || userData.contact || '';
        }

        const updatedUserInfo = {
          name: verificationDataResult.name || authName,
          email: authEmail,
          contact: verificationDataResult.contact
        };

        setUserInfo(updatedUserInfo);
      } else {
        setIsUserVerified(false);
      }

      setIsLoading(false);
    });

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    const isValid = (selectedItems.length > 0 || selectedPackage) &&
      bookingData.startDate &&
      bookingData.endDate;
    setHasValidBooking(isValid);
  }, [selectedItems, selectedPackage, bookingData]);

  const policyTexts = {
    userAgreement: `
      <h1>USER AGREEMENT</h1>
      <p>This User Agreement ("Agreement") constitutes a legally binding contract between you ("User" or "Renter") and RP MEDIA SERVICES ("Company," "we," "us," or "our"). By accessing or utilizing our rental services, you expressly agree to be bound by the terms and conditions set forth herein.</p>
      
      <h2>1.1. ELIGIBILITY AND IDENTIFICATION REQUIREMENTS</h2>
      <p>Users must be at least eighteen (18) years of age and possess full legal capacity. Registration requires presentation of one of the following valid Philippine government-issued identification cards:</p>
      <ul>
        <li>Philippine National ID (PhilSys ID)</li>
        <li>ePhilID (Philippine Identification System)</li>
      </ul>
      <p>No other forms of identification (including but not limited to driver's licenses, passports, or other government documents) will be accepted for registration purposes. The Company reserves the right to verify the presented identification and reject any application at its sole discretion.</p>
      
      <h2>1.2. ACCOUNT SECURITY AND RESPONSIBILITY</h2>
      <p>The User assumes full responsibility for maintaining the confidentiality of account credentials and for all activities conducted under said account. Any unauthorized access must be reported to the Company immediately.</p>
      
      <h2>1.3. AUTHORIZED USAGE</h2>
      <p>All rented equipment shall be utilized exclusively for lawful purposes. Any use in violation of applicable laws is strictly prohibited.</p>
      
      <h2>1.4. COMPANY-ASSIGNED EQUIPMENT CARETAKER</h2>
      <p>All equipment rentals include a trained Company staff member ("Equipment Caretaker") who shall remain with the equipment throughout the rental period. The Caretaker's primary responsibilities include equipment operation oversight, preventive maintenance, troubleshooting, and ensuring proper handling according to manufacturer specifications.</p>
    `,
    
    privacyPolicy: `
      <h1>PRIVACY POLICY</h1>
      <p>RP MEDIA SERVICES is committed to protecting the privacy and security of your personal information. This Privacy Policy outlines our practices regarding the collection, use, and disclosure of your data.</p>
      
      <h2>2.1. INFORMATION COLLECTION</h2>
      <p>We collect the following categories of personal information:</p>
      <ul>
        <li>Full Legal Name</li>
        <li>Contact Information (address, telephone number, email)</li>
        <li>Philippine National ID or ePhilID Number (for verification only)</li>
        <li>Payment Information and Transaction History</li>
        <li>Event Location and Schedule Details</li>
      </ul>
      <p><strong>Important:</strong> We accept only Philippine National ID (PhilSys ID) or ePhilID for identification purposes. We do not retain copies of physical identification cards. We only verify their validity during the registration process and record the identification number for reference and verification purposes in accordance with Philippine law.</p>
      
      <h2>2.2. PURPOSE OF PROCESSING</h2>
      <p>Your information is processed for the following legitimate business purposes:</p>
      <ul>
        <li>Identity verification using Philippine National ID/ePhilID</li>
        <li>Rental transaction processing</li>
        <li>Equipment tracking and accountability</li>
        <li>Caretaker assignment and scheduling</li>
        <li>Compliance with Republic Act No. 10173 (Data Privacy Act of 2012)</li>
        <li>Fraud prevention and security measures</li>
      </ul>
      
      <h2>2.3. DATA RETENTION AND SECURITY</h2>
      <p>Personal data shall be retained only for as long as necessary to fulfill the purposes outlined herein or as required by Philippine law. We implement appropriate technical and organizational measures to protect against unauthorized access, alteration, or destruction of your personal information, in compliance with the Data Privacy Act of 2012.</p>
    `,
    
    paymentPolicy: `
      <h1>PAYMENT AND FEES POLICY</h1>
      
      <h2>3.1. ACCEPTED PAYMENT METHODS</h2>
      <p>RP MEDIA SERVICES accepts payments via Bank Transfer and PayPal. All transactions must be settled in Philippine Pesos (₱) unless otherwise agreed in writing.</p>
      
      <h2>3.2. PAYMENT TERMS AND SCHEDULE</h2>
      <ul>
        <li>A non-refundable reservation fee of ₱1,000 is required to secure any booking, which will be applied toward the total rental cost.</li>
        <li>Full payment of the remaining balance must be received and cleared at least forty-eight (48) hours prior to equipment release.</li>
        <li>The rental fee includes the Equipment Caretaker's professional services during standard operating hours (8:00 AM to 6:00 PM).</li>
      </ul>
    `,
    
    rentalPolicy: `
      <h1>EQUIPMENT AND RENTAL POLICY</h1>
      
      <h2>4.1. EQUIPMENT SPECIFICATIONS AND INSPECTION</h2>
      <p>All rental equipment is provided with standard accessories as specified in the rental agreement. A comprehensive inspection report documenting the equipment's condition shall be completed jointly by the User and the assigned Equipment Caretaker prior to release.</p>
      
      <h2>4.2. IDENTIFICATION VERIFICATION AT PICKUP</h2>
      <p>At the time of equipment pickup, the User must present the same valid Philippine National ID or ePhilID used during registration. The assigned Equipment Caretaker will verify this identification before releasing any equipment. No equipment will be released without proper ID verification.</p>
      
      <h2>4.3. EQUIPMENT CARETAKER PROVISIONS</h2>
      <ul>
        <li>The Company shall assign a qualified Equipment Caretaker for the duration of the rental period.</li>
        <li>The Caretaker possesses operational expertise and shall provide basic operational guidance upon request.</li>
        <li>The User is responsible for providing the Caretaker with adequate meal provisions (or the applicable meal allowance) and reasonable breaks during the rental period.</li>
        <li>The Caretaker must have access to safe working conditions, including protection from hazardous environments or extreme weather conditions.</li>
        <li>The User shall ensure the Caretaker's personal safety and provide reasonable accommodations as needed.</li>
        <li>The Caretaker retains the right to suspend equipment operation if unsafe conditions or improper usage is observed.</li>
      </ul>
      
      <h2>4.4. USER RESPONSIBILITIES AND LIMITATIONS</h2>
      <ul>
        <li>The User must follow the Caretaker's instructions regarding proper equipment handling and operation.</li>
        <li>Only the assigned Caretaker or User (under Caretaker supervision) may operate the equipment.</li>
        <li>Any malfunction or damage must be reported immediately to the Caretaker.</li>
        <li>The User shall not interfere with the Caretaker's professional duties or disregard safety recommendations.</li>
      </ul>
      
      <h2>4.5. RETURN AND INSPECTION PROCEDURE</h2>
      <p>Equipment must be returned at the agreed date, time, and location under the supervision of the assigned Caretaker. A post-rental inspection will be conducted with the User present. Discrepancies between pre- and post-rental condition reports may result in additional charges.</p>
      
      <h2>4.6. LIABILITY AND INSURANCE</h2>
      <p>The Company maintains comprehensive insurance covering equipment damage, third-party liability, and Caretaker occupational safety. However, the User remains liable for damages resulting from negligence, misuse contrary to Caretaker instructions, or failure to provide safe working conditions. The Company's insurance does not cover User's production losses or consequential damages.</p>
      
      <h2>4.7. CARE OF COMPANY PERSONNEL</h2>
      <p>The User agrees to provide the assigned Equipment Caretaker with reasonable sustenance (meals and beverages) during the rental period, or alternatively, remit the standard meal allowance as specified in Section 3.3. The User shall ensure the Caretaker has access to basic facilities including restroom breaks, seating during appropriate intervals, and protection from extreme environmental conditions. Failure to provide reasonable care for Company personnel may result in early termination of the rental agreement without refund.</p>
    `
  };

  const showPolicy = (policyKey) => {
    setPolicyContent(policyTexts[policyKey]);
    setShowPolicyModal(true);
  };

  const closePolicyModal = () => setShowPolicyModal(false);

  const handleInputChange = (e) => {
    const { name, value } = e.target;

    if (name === 'region') {
      setFormData({
        ...formData,
        region: value,
        province: '',
        city: ''
      });
    } else if (name === 'province') {
      setFormData({
        ...formData,
        province: value,
        city: ''
      });
    } else {
      setFormData({
        ...formData,
        [name]: value
      });
    }
  };

  // Function to validate form before showing payment
  const validateForm = () => {
    if (!currentUser) {
      setErrorMessage("You must be logged in to make a booking.");
      return false;
    }

    const userIsVerified = isVerified || isUserVerified;

    if (!userIsVerified) {
      setShowVerificationModal(true);
      return false;
    }

    if (!userInfo.name || !userInfo.email || !userInfo.contact ||
      !formData.region || !formData.province || !formData.city || !formData.specificAddress) {
      setErrorMessage("Please fill out all required fields including complete address details.");
      return false;
    }

    const checkboxes = ['agreement1', 'agreement2', 'agreement3'];
    const allChecked = checkboxes.every(id => document.getElementById(id)?.checked);
    if (!allChecked) {
      setErrorMessage("Please agree to all required policies before booking.");
      return false;
    }

    return true;
  };

  // Function to show payment modal
  const handleProceedToPayment = (e) => {
    e.preventDefault();

    if (validateForm()) {
      setShowPaymentModal(true);
      setErrorMessage("");
    }
  };

  // Function to save booking after successful payment
  const saveBooking = async (paymentDetails = null) => {
    try {
      // Create combined address string
      const fullAddress = `${formData.specificAddress}, ${formData.city}, ${formData.province}, ${formData.region}`;

      // Calculate balances
      const reservationFeePaid = 1000;
      const remainingBalance = total;

      // Create booking object
      const booking = {
        // User Information
        ...userInfo,
        ...formData,
        venue: fullAddress,

        // Booking Details
        startDate: bookingData.startDate,
        endDate: bookingData.endDate,
        items: selectedItems.length ? selectedItems : null,
        package: selectedPackage ? selectedPackage : null,

        // Financial Information
        totalRentalAmount: total,
        reservationFee: reservationFeePaid,
        reservationFeePaid: reservationFeePaid,
        remainingBalance: remainingBalance,
        paymentStatus: 'reservation_paid',
        fullPaymentStatus: 'pending',

        // Payment Details
        paymentDetails: paymentDetails ? {
          paymentId: paymentDetails.paymentID || paymentDetails.orderID,
          paypalOrderId: paymentDetails.orderID,
          paypalPayerId: paymentDetails.payerID,
          payerEmail: paymentDetails.email,
          payerName: paymentDetails.name,
          paymentMethod: 'paypal',
          amount: reservationFeePaid,
          currency: 'PHP',
          status: 'completed',
          paymentType: 'reservation_fee',
          paidAt: paymentDetails.create_time || new Date().toISOString()
        } : null,

        // System Fields
        timestamp: new Date().toISOString(),
        userId: currentUser.uid,
        bookingStatus: 'reserved',

        // Verification Details
        verificationDetails: verificationData ? {
          firstName: verificationData.firstName,
          middleName: verificationData.middleName,
          lastName: verificationData.lastName,
          suffix: verificationData.suffix,
          idType: verificationData.idType,
          idNumber: verificationData.idNumber
        } : null
      };

      // Save to Firestore bookings collection
      await addDoc(collection(db, "bookings"), booking);

      setErrorMessage("");

      // Clear ALL rental data
      localStorage.removeItem("bookingFormData");
      localStorage.removeItem("selectedItems");
      localStorage.removeItem("selectedPackage");

      // Show success and redirect
      setTimeout(() => navigate("/userDashboard"), 3000);

    } catch (error) {
      setErrorMessage("Error saving booking. Please contact support.");
    }
  };

  const handleStartVerification = () => {
    setShowVerificationModal(false);
    navigate('/userDashboard');
  };

  const handleCloseVerificationModal = () => setShowVerificationModal(false);

  // Calculate rental days
  const rentalDays = bookingData.startDate && bookingData.endDate
    ? Math.ceil((new Date(bookingData.endDate) - new Date(bookingData.startDate)) / (1000 * 60 * 60 * 24)) + 1
    : 0;

  // Calculate daily rate and total
  const dailyRate = selectedItems.reduce((sum, item) => sum + (item.subtotal || 0), 0) ||
    (selectedPackage ? selectedPackage.price : 0);

  // Add additional fee of ₱1,000
  const additionalFee = 1000;
  const total = (dailyRate * rentalDays) + additionalFee;

  // Reservation fee
  const reservationFee = 1000;
  const remainingBalance = total;

  // Get available provinces based on selected region
  const availableProvinces = formData.region ? Object.keys(philippineLocations[formData.region] || {}) : [];

  // Get available cities based on selected province
  const availableCities = formData.region && formData.province ? philippineLocations[formData.region][formData.province] || [] : [];

  if (isLoading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', flexDirection: 'column' }}>
        <div className="spinner"></div>
        <p>Loading your booking details...</p>
      </div>
    );
  }

  const userIsVerified = isVerified || isUserVerified;

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

      {/* Confirmation Content */}
      <h1 className="confirmation-header">Confirm Your Booking</h1>

      <section className="confirmation-container">
        <section className="confirmation-wrapper">
          <h2>Booking Summary</h2>

          <div className="summary" id="bookingSummary">
            {!hasValidBooking ? (
              <div className="empty-state">
                <div className="empty-icon">📋</div>
                <h3>Incomplete Booking</h3>
                <p>Please select items/package and schedule dates first.</p>
                <div style={{ display: 'flex', gap: '10px', marginTop: '20px' }}>
                  <button
                    onClick={() => navigate('/rent-items')}
                    className="btn btn-primary"
                  >
                    Select Items
                  </button>
                  <button
                    onClick={() => navigate('/packages')}
                    className="btn btn-secondary"
                  >
                    View Packages
                  </button>
                </div>
              </div>
            ) : (
              <div className="summary-cards">
                {/* Schedule Card */}
                <div className="summary-card">
                  <div className="card-header">
                    <h3>Rental Schedule</h3>
                  </div>
                  <div className="card-body">
                    <div className="schedule-info">
                      <div className="info-row">
                        <span className="info-label">Start Date:</span>
                        <span className="info-value">{bookingData.startDate}</span>
                      </div>
                      <div className="info-row">
                        <span className="info-label">End Date:</span>
                        <span className="info-value">{bookingData.endDate}</span>
                      </div>
                      <div className="info-row">
                        <span className="info-label">Duration:</span>
                        <span className="info-value">{rentalDays} day{rentalDays !== 1 ? 's' : ''}</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Items/Package Card */}
                <div className="summary-card">
                  <div className="card-header">
                    <h3>{selectedPackage ? 'Selected Package' : 'Rental Items'}</h3>
                  </div>
                  <div className="card-body">
                    {selectedPackage ? (
                      <div className="package-details">
                        <h4>{selectedPackage.name}</h4>
                        <p className="package-description">{selectedPackage.description}</p>
                      </div>
                    ) : (
                      <div className="items-details">
                        <table className="items-table">
                          <thead>
                            <tr>
                              <th>Item</th>
                              <th>Qty</th>
                              <th>Price</th>
                              <th>Subtotal</th>
                            </tr>
                          </thead>
                          <tbody>
                            {selectedItems.map((item, index) => (
                              <tr key={index}>
                                <td>{item.name}</td>
                                <td>{item.quantity}</td>
                                <td>₱{item.price?.toFixed(2)}</td>
                                <td>₱{item.subtotal?.toFixed(2)}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                        <div className="items-count">
                          Rental duration: {rentalDays} day{rentalDays !== 1 ? 's' : ''}<br></br>
                          Total Price: {(dailyRate * rentalDays).toLocaleString()}<br></br>
                          Total Items: {selectedItems.length}
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Total Card */}
                <div className="summary-card total-card">
                  <div className="card-header">
                    <h3>Payment Summary</h3>
                  </div>
                  <div className="card-body">
                    <div className="cost-breakdown">
                      {selectedPackage ? (
                        <>
                          <div className="cost-line">
                            <span>Package Daily Rate:</span>
                            <span>₱{dailyRate.toLocaleString()}</span>
                          </div>
                          <div className="cost-line">
                            <span>Rental Duration:</span>
                            <span>{rentalDays} day{rentalDays !== 1 ? 's' : ''}</span>
                          </div>
                          <div className="cost-line">
                            <span>Total Rental Amount:</span>
                            <span>₱{(dailyRate * rentalDays).toLocaleString()}</span>
                          </div>
                        </>
                      ) : (
                        <>
                          <div className="cost-line">
                            <span>Items Daily Rate: </span>
                            <span>₱{dailyRate.toLocaleString()}</span>
                          </div>
                          <div className="cost-line">
                            <span>Rental Duration: </span>
                            <span>{rentalDays} day{rentalDays !== 1 ? 's' : ''}</span>
                          </div>
                          <div className="cost-line">
                            <span>Total Rental Amount: </span>
                            <span>₱{(dailyRate * rentalDays).toLocaleString()}</span>
                          </div>
                        </>
                      )}

                      {/* Additional Fee */}
                      <div className="cost-line additional-fee">
                        <span>Additional Fee (Caretaker) : </span>
                        <span>₱{additionalFee.toLocaleString()}</span>
                      </div>

                      {/* Reservation Fee */}
                      <div className="cost-line reservation-fee">
                        <span>Reservation Fee: </span>
                        <span>₱{reservationFee.toLocaleString()}</span>
                      </div>

                      {/* Remaining Balance */}
                      <div className="cost-line remaining-balance">
                        <span>Remaining Balance: </span>
                        <span>₱{remainingBalance.toLocaleString()}</span>
                      </div>

                      <div className="cost-line total">
                        <span>Amount to Pay Now: </span>
                        <span className="highlight-amount">₱{reservationFee.toLocaleString()}</span>
                      </div>

                      <div className="payment-note">
                        <small>
                          <strong>Note:</strong> ₱1,000 reservation fee is required to secure your booking.
                          The remaining balance of ₱{remainingBalance.toLocaleString()} will be handled according to the agreement between the client and the equipment owner.
                        </small>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {hasValidBooking && (
            <form className="confirmForm" id="confirmForm" onSubmit={handleProceedToPayment}>
              <h3>Contact Information</h3>

              {/* User Information Display - Single Line */}
              <div className="user-info-display-section">
                <div className="user-info-line">
                  <div className="user-info-label">Full Name:</div>
                  <div className="user-info-value-display">
                    {userInfo.name || "Not available"}
                  </div>
                </div>

                <div className="user-info-line">
                  <div className="user-info-label">Email Address:</div>
                  <div className="user-info-value-display">
                    {userInfo.email || "Not available"}
                  </div>
                </div>

                <div className="user-info-line">
                  <div className="user-info-label">Contact Number:</div>
                  <div className="user-info-value-display">
                    {userInfo.contact || "Not available"}
                    {!userInfo.contact && (
                      <small className="missing-note">
                        (Please add contact in verification)
                      </small>
                    )}
                  </div>
                </div>

              </div>

              <div className="form-grid">
                {/* Multi-level Location Selector */}
                <div className="form-group">
                  <label htmlFor="region">Region *</label>
                  <select
                    id="region"
                    name="region"
                    value={formData.region}
                    onChange={handleInputChange}
                    required
                    className="form-input"
                  >
                    <option value="">Select Region</option>
                    {Object.keys(philippineLocations).map(region => (
                      <option key={region} value={region}>{region}</option>
                    ))}
                  </select>
                </div>

                <div className="form-group">
                  <label htmlFor="province">Province *</label>
                  <select
                    id="province"
                    name="province"
                    value={formData.province}
                    onChange={handleInputChange}
                    required
                    disabled={!formData.region}
                    className="form-input"
                  >
                    <option value="">Select Province</option>
                    {availableProvinces.map(province => (
                      <option key={province} value={province}>{province}</option>
                    ))}
                  </select>
                </div>

                <div className="form-group">
                  <label htmlFor="city">City/Municipality *</label>
                  <select
                    id="city"
                    name="city"
                    value={formData.city}
                    onChange={handleInputChange}
                    required
                    disabled={!formData.province}
                    className="form-input"
                  >
                    <option value="">Select City/Municipality</option>
                    {availableCities.map(city => (
                      <option key={city} value={city}>{city}</option>
                    ))}
                  </select>
                </div>

                <div className="form-group full-width">
                  <label htmlFor="specificAddress">Specific Address *</label>
                  <input
                    type="text"
                    id="specificAddress"
                    name="specificAddress"
                    value={formData.specificAddress}
                    onChange={handleInputChange}
                    required
                    className="form-input"
                    placeholder="Street, Barangay, Building, House No., etc."
                  />
                  <small style={{ color: '#666', fontSize: '0.8rem', marginTop: '0.25rem' }}>
                    Please provide complete address details for delivery
                  </small>
                </div>
              </div>

              <div className="agreement-section">
                <h3>Please agree to the following:</h3>

                <label className="checkbox-label">
                  <input type="checkbox" id="agreement1" required />
                  I've read and agree to the{' '}
                  <button type="button" onClick={() => showPolicy('userAgreement')} className="policy-link">
                    User Agreement
                  </button>{' '}
                  and{' '}
                  <button type="button" onClick={() => showPolicy('privacyPolicy')} className="policy-link">
                    Privacy Policy
                  </button>
                </label>

                <label className="checkbox-label">
                  <input type="checkbox" id="agreement2" required />
                  I've read and agreed to the{' '}
                  <button type="button" onClick={() => showPolicy('paymentPolicy')} className="policy-link">
                    Payments and Fees Policy
                  </button>
                </label>

                <label className="checkbox-label">
                  <input type="checkbox" id="agreement3" required />
                  I've read and agreed to the{' '}
                  <button type="button" onClick={() => showPolicy('rentalPolicy')} className="policy-link">
                    Equipment Rental Policy
                  </button>
                </label>
              </div>

              <button
                className="confirmbtn"
                type="submit"
                disabled={isProcessingPayment}
              >
                {isProcessingPayment ? 'Processing...' : 'Pay Reservation Fee (₱1,000)'}
              </button>

              {errorMessage && (
                <div className="error-message">
                  {errorMessage}
                </div>
              )}
              {message && (
                <div className="success-message">
                  {message}
                </div>
              )}
            </form>
          )}
          
          {/* Policy Modal */}
          <div
            className="policy-modal"
            id="policyModal"
            style={{ display: showPolicyModal ? 'flex' : 'none' }}
          >
            <div className="policy-modal-content">
              <span className="close-modal" onClick={closePolicyModal}>&times;</span>
              <div id="policyContent" dangerouslySetInnerHTML={{ __html: policyContent }}></div>
            </div>
          </div>

          {/* Verification Required Modal */}
          <div
            className="policy-modal"
            style={{ display: showVerificationModal ? 'flex' : 'none' }}
          >
            <div className="policy-modal-content">
              <span className="close-modal" onClick={handleCloseVerificationModal}>&times;</span>
              <div className="verification-content">
                <h2>Identity Verification Required</h2>
                <p>
                  You need to verify your identity before you can confirm bookings.
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

          {/* Payment Modal */}
          <div
            className="policy-modal"
            style={{ display: showPaymentModal ? 'flex' : 'none' }}
          >
            <div className="policy-modal-content payment-modal-content">
              <span className="close-modal" onClick={() => {
                if (!isProcessingPayment && !paymentSuccessful) {
                  setShowPaymentModal(false);
                }
              }}>&times;</span>

              {paymentSuccessful ? (
                <div className="payment-success">
                  <div className="success-icon">✓</div>
                  <h2>Reservation Fee Paid!</h2>
                  <p>Your booking has been reserved with ₱1,000 reservation fee.
                    The remaining balance of ₱{remainingBalance.toLocaleString()} will be paid upon equipment pickup.</p>
                  <p style={{ marginTop: '10px', fontWeight: 'bold', color: '#28a745' }}>
                    Confirmation emails have been sent to {userInfo.email}
                  </p>
                </div>
              ) : (
                <div className="payment-content">
                  <h2>Pay Reservation Fee</h2>
                  <p>Please pay ₱1,000 reservation fee to secure your booking.</p>

                  <div className="payment-summary">
                    <div className="payment-line">
                      <span>Reservation Fee:</span>
                      <span className="payment-amount">₱1,000.00</span>
                    </div>
                    <div className="payment-line">
                      <span>Remaining Balance:</span>
                      <span className="payment-amount">₱{remainingBalance.toLocaleString()}</span>
                    </div>
                    <div className="payment-total">
                      <span>To Pay Now:</span>
                      <span className="payment-total-amount">₱1,000.00</span>
                    </div>
                  </div>

                  <div className="paypal-container">
                    <div id="paypal-button-container">
                      {!isPayPalSdkLoaded && (
                        <div className="loading-payment">
                          <p>Loading payment system...</p>
                          <div className="spinner-small"></div>
                        </div>
                      )}
                    </div>
                  </div>

                  <p className="payment-note">
                    <strong>Note:</strong> This is only a reservation fee.
                    Full payment of ₱{remainingBalance.toLocaleString()} will be required upon equipment pickup.
                  </p>
                </div>
              )}
            </div>
          </div>
        </section>
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

export default ConfirmationPage;