import { 
  collection, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  doc, 
  getDocs,
  getDoc,
  setDoc,
  query, 
  where, 
  onSnapshot,
  orderBy
} from 'firebase/firestore';
import { 
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  updateProfile,
  sendEmailVerification,
  applyActionCode,
  checkActionCode,
  confirmPasswordReset as firebaseConfirmPasswordReset, // Renamed import
  sendPasswordResetEmail
} from 'firebase/auth';
import { cloudinaryService } from './cloudinaryService';
import { db, auth } from '../utils/firebase';

// ==================== AUTHENTICATION METHODS ====================

async function registerUser(email, password, userData) {
  try {
    // === EMAIL VALIDATION START ===
    console.log('Validating email:', email);
    
    // 1. Basic email format validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return { success: false, error: 'Invalid email format. Please use a valid email address (e.g., name@gmail.com).' };
    }
    
    // 2. Check for disposable/temporary email domains
    const disposableDomains = [
      'tempmail.com', 'temp-mail.org', '10minutemail.com', 'guerrillamail.com',
      'mailinator.com', 'yopmail.com', 'trashmail.com', 'dispostable.com',
      'fakeinbox.com', 'getairmail.com', 'mailnesia.com', 'mytrashmail.com',
      'sharklasers.com', 'spam4.me', 'tempail.com', 'throwawaymail.com'
    ];
    
    const domain = email.split('@')[1].toLowerCase();
    
    // Check if domain is disposable
    for (const disposableDomain of disposableDomains) {
      if (domain.includes(disposableDomain) || domain === disposableDomain) {
        return { success: false, error: 'Disposable/temporary email addresses are not allowed. Please use a permanent email address.' };
      }
    }
    
    // 3. Require Gmail addresses (you can change this to other domains)
    const allowedDomains = ['gmail.com', 'googlemail.com', 'yahoo.com', 'outlook.com', 'hotmail.com'];
    const isAllowedDomain = allowedDomains.some(allowed => domain === allowed);
    
    // ADMIN EXCEPTION: ONLY allow admin@rpmediaservices.com
    const isAdminEmail = email.toLowerCase() === 'admin@rpmediaservices.com';
    
    if (!isAllowedDomain) {
      return { success: false, error: 'Please use a Gmail, Yahoo, or Outlook email address to register.' };
    }
    
    // 4. Check for common fake email patterns
    const fakePatterns = [
      /^test@/i,
      /^admin@/i,
      /^user@/i,
      /^demo@/i,
      /^example@/i,
      /^temp@/i
    ];
    
    for (const pattern of fakePatterns) {
      if (pattern.test(email)) {
        return { success: false, error: 'Please use a real email address.' };
      }
    }
    // === EMAIL VALIDATION END ===

    // Create user in Firebase Authentication
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    const user = userCredential.user;

    // Send email verification - MANDATORY
    try {
      await sendEmailVerification(user);
      console.log('Verification email sent to:', email);
    } catch (verificationError) {
      console.error('Failed to send verification email:', verificationError);
      // If verification email fails, delete the user
      await user.delete();
      return { 
        success: false, 
        error: 'Failed to send verification email. Please try again or use a different email.' 
      };
    }

    // Set user as unverified until email is confirmed
    await updateProfile(user, {
      displayName: userData.name
    });

    // Save user data to Firestore with "pending" status
    await saveUserData(user.uid, {
      ...userData,
      email: user.email,
      emailVerified: false, // Track verification status
      accountStatus: 'pending_verification', // User cannot login until verified
      verificationSentAt: new Date().toISOString(),
      createdAt: new Date().toISOString()
    });

    // IMPORTANT: Sign out the user immediately after registration
    // They cannot login until they verify email
    await signOut(auth);

    return { 
      success: true, 
      user: null, // Return null user since they're logged out
      message: 'Account created! Please check your email and click the verification link to activate your account. You cannot login until you verify your email.',
      requiresVerification: true
    };
  } catch (error) {
    console.error('Registration error:', error);
    let errorMessage = error.message;
    
    // Provide user-friendly error messages
    if (error.code === 'auth/email-already-in-use') {
      errorMessage = 'Email address already registered. Please use a different email or try logging in.';
    } else if (error.code === 'auth/weak-password') {
      errorMessage = 'Password is too weak. Please use at least 6 characters with letters and numbers.';
    } else if (error.code === 'auth/invalid-email') {
      errorMessage = 'Invalid email address format. Please check and try again.';
    } else if (error.code === 'auth/operation-not-allowed') {
      errorMessage = 'Email/password accounts are not enabled. Please contact support.';
    } else if (error.code === 'auth/network-request-failed') {
      errorMessage = 'Network error. Please check your internet connection.';
    }
    
    return { success: false, error: errorMessage };
  }
}

async function loginUser(email, password) {
  try {
    // Basic email format check during login
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return { success: false, error: 'Invalid email format' };
    }
    
    // First try to login
    const userCredential = await signInWithEmailAndPassword(auth, email, password);
    const user = userCredential.user;
    
    // CRITICAL: Check if email is verified
    // ADMIN EXCEPTION: Only one admin account doesn't need verification
    const isAdminEmail = email.toLowerCase() === 'admin@rpmediaservices.com';
    
    // CRITICAL: Check if email is verified (except for the one admin account)
    if (!user.emailVerified && !isAdminEmail) {
      // User is not verified - sign them out and show error
      await signOut(auth);
      
      // Check if verification email was sent recently
      const userDoc = await getUserByEmail(email);
      let errorMessage = 'Please verify your email address before logging in. Check your inbox for the verification email.';
      
      if (userDoc && userDoc.verificationSentAt) {
        const sentTime = new Date(userDoc.verificationSentAt);
        const now = new Date();
        const hoursSinceSent = (now - sentTime) / (1000 * 60 * 60);
        
        if (hoursSinceSent > 24) {
          errorMessage = 'Your verification email has expired. Please request a new verification email.';
        }
      }
      
      return { 
        success: false, 
        error: errorMessage,
        needsVerification: true,
        userEmail: email
      };
    }
    
    // User is verified - update last login
    const userDoc = await getUserByEmail(email);
    if (userDoc) {
      const userRef = doc(db, 'users', userDoc.id);
      await updateDoc(userRef, {
        lastLogin: new Date().toISOString(),
        accountStatus: 'active',
        // Auto-verify the admin account in Firestore
        emailVerified: isAdminEmail ? true : userDoc.emailVerified
      });
    } else if (isAdminEmail) {
      // Create admin user record if it doesn't exist
      await saveUserData(user.uid, {
        name: 'Admin',
        email: user.email,
        role: 'admin',
        emailVerified: true,
        accountStatus: 'active',
        createdAt: new Date().toISOString()
      });
    }
    
    return { success: true, user };
  } catch (error) {
    console.error('Login error:', error);
    let errorMessage = error.message;
    
    if (error.code === 'auth/invalid-credential' || error.code === 'auth/wrong-password') {
      errorMessage = 'Incorrect email or password';
    } else if (error.code === 'auth/user-not-found') {
      errorMessage = 'Account does not exist. Please register first.';
    } else if (error.code === 'auth/user-disabled') {
      errorMessage = 'This account has been disabled';
    } else if (error.code === 'auth/too-many-requests') {
      errorMessage = 'Too many failed attempts. Please try again later.';
    } else if (error.code === 'auth/network-request-failed') {
      errorMessage = 'Network error. Please check your internet connection.';
    }
    
    return { success: false, error: errorMessage };
  }
}

async function logoutUser() {
  try {
    await signOut(auth);
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

// PASSWORD RESET FUNCTIONS
async function sendPasswordReset(email) {
  try {
    // Basic email format validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return { success: false, error: 'Invalid email format' };
    }

    // Send password reset email
    await sendPasswordResetEmail(auth, email);
    
    console.log('Password reset email sent to:', email);
    return { 
      success: true, 
    };
  } catch (error) {
    console.error('Password reset error:', error);
    let errorMessage = error.message;
    
    if (error.code === 'auth/user-not-found') {
      errorMessage = 'No account found with this email address.';
    } else if (error.code === 'auth/invalid-email') {
      errorMessage = 'Invalid email address.';
    } else if (error.code === 'auth/too-many-requests') {
      errorMessage = 'Too many requests. Please try again later.';
    } else if (error.code === 'auth/network-request-failed') {
      errorMessage = 'Network error. Please check your internet connection.';
    }
    
    return { success: false, error: errorMessage };
  }
}

// Changed name to confirmPasswordResetCode to avoid conflict
async function confirmPasswordResetCode(oobCode, newPassword) {
  try {
    await firebaseConfirmPasswordReset(auth, oobCode, newPassword);
    return { success: true, message: 'Password has been reset successfully!' };
  } catch (error) {
    console.error('Password reset confirmation error:', error);
    let errorMessage = error.message;
    
    if (error.code === 'auth/weak-password') {
      errorMessage = 'Password is too weak. Use at least 6 characters with letters and numbers.';
    } else if (error.code === 'auth/invalid-action-code') {
      errorMessage = 'Invalid or expired reset link. Please request a new password reset.';
    } else if (error.code === 'auth/expired-action-code') {
      errorMessage = 'Reset link has expired. Please request a new password reset.';
    }
    
    return { success: false, error: errorMessage };
  }
}

async function checkPasswordResetCode(oobCode) {
  try {
    const info = await checkActionCode(auth, oobCode);
    return { 
      success: true, 
      email: info.data.email,
      operation: info.operation 
    };
  } catch (error) {
    console.error('Check password reset code error:', error);
    return { success: false, error: error.message };
  }
}

// NEW: Send verification email to unverified user
async function sendVerificationEmail(email) {
  try {
    // This requires the user to be logged in, so we need a different approach
    // We'll handle this in the LoginRegister component by showing instructions
    return { 
      success: false, 
      error: 'Please use the "Resend Verification" option on the login page.' 
    };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

// NEW: Resend verification email for pending accounts
async function resendVerificationEmail(email) {
  try {
    // Get user from auth (they might not be logged in)
    // We'll use a different approach - show instructions
    return { 
      success: true, 
      message: 'Please check your email inbox and spam folder. If you still need help, contact support.' 
    };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

// NEW: Check if user exists but is unverified
async function checkUserVerificationStatus(email) {
  try {
    const userDoc = await getUserByEmail(email);
    if (userDoc) {
      return { 
        success: true, 
        exists: true,
        emailVerified: userDoc.emailVerified || false,
        accountStatus: userDoc.accountStatus || 'pending',
        verificationSentAt: userDoc.verificationSentAt
      };
    }
    return { success: true, exists: false };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

// ==================== USER MANAGEMENT ====================

async function saveUserData(uid, userData) {
  try {
    await addDoc(collection(db, 'users'), {
      uid,
      ...userData,
      createdAt: new Date().toISOString()
    });
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

async function getUsers() {
  try {
    const querySnapshot = await getDocs(collection(db, 'users'));
    const users = [];
    querySnapshot.forEach((doc) => {
      users.push({ id: doc.id, ...doc.data() });
    });
    return { success: true, users };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

async function getUserByEmail(email) {
  try {
    const q = query(collection(db, 'users'), where('email', '==', email));
    const querySnapshot = await getDocs(q);
    const users = [];
    querySnapshot.forEach((doc) => {
      users.push({ id: doc.id, ...doc.data() });
    });
    return users.length > 0 ? users[0] : null;
  } catch (error) {
    console.error('Error getting user:', error);
    return null;
  }
}

// ==================== PAYMENT METHODS ====================

async function getUserPaymentStatus(userEmail) {
  try {
    const q = query(
      collection(db, 'payments'), 
      where('userEmail', '==', userEmail),
      orderBy('paidAt', 'desc')
    );
    const querySnapshot = await getDocs(q);
    const payments = [];
    querySnapshot.forEach((doc) => {
      payments.push({ id: doc.id, ...doc.data() });
    });
    
    const latestPayment = payments[0];
    
    if (latestPayment) {
      return { 
        success: true, 
        paymentStatus: {
          isPaid: true,
          paidAt: latestPayment.paidAt,
          amount: latestPayment.amount,
          collectionAccess: latestPayment.collectionAccess || [],
          accessType: latestPayment.accessType || 'collection'
        }
      };
    } else {
      return { 
        success: true, 
        paymentStatus: {
          isPaid: false,
          paidAt: null,
          amount: 0,
          collectionAccess: [],
          accessType: 'none'
        }
      };
    }
  } catch (error) {
    console.error('Error getting payment status:', error);
    return { success: false, error: error.message };
  }
}

async function processPayment(paymentData) {
  try {
    console.log('Starting payment processing...');
    console.log('Payment data received:', paymentData);
    
    // Validate required fields
    if (!paymentData.userEmail) {
      throw new Error('User email is required');
    }
    if (!paymentData.collectionId) {
      throw new Error('Collection ID is required');
    }

    const paymentDoc = {
      userEmail: paymentData.userEmail,
      collectionId: paymentData.collectionId,
      amount: paymentData.amount,
      currency: paymentData.currency || 'PHP',
      method: paymentData.method,
      status: 'completed',
      paidAt: new Date().toISOString(),
      accessType: 'collection',
      collectionAccess: [paymentData.collectionId],
      transactionId: paymentData.paypalOrderId || paymentData.transactionId || 'txn_' + Math.random().toString(36).substr(2, 9),
      paypalOrderId: paymentData.paypalOrderId,
      paypalPayerId: paymentData.payerEmail,
      payerEmail: paymentData.payerEmail,
      payerName: paymentData.payerName,
      paymentDetails: paymentData.paymentDetails || {},
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    console.log('Payment document to save:', paymentDoc);

    const docRef = await addDoc(collection(db, 'payments'), paymentDoc);
    console.log('Payment saved to Firebase with ID:', docRef.id);
    
    // Verify the payment was saved
    const savedDoc = await getDoc(docRef);
    if (savedDoc.exists()) {
      console.log('Payment verification - saved data:', savedDoc.data());
    }
    
    return { success: true, paymentId: docRef.id };
  } catch (error) {
    console.error('Error processing payment:', error);
    return { success: false, error: error.message };
  }
}

async function getUserPayments(userEmail) {
  try {
    console.log('Getting user payments for:', userEmail);
    const q = query(
      collection(db, 'payments'), 
      where('userEmail', '==', userEmail),
      orderBy('paidAt', 'desc')
    );
    const querySnapshot = await getDocs(q);
    const payments = [];
    querySnapshot.forEach((doc) => {
      payments.push({ id: doc.id, ...doc.data() });
    });
    console.log('User payments retrieved:', payments.length);
    return { success: true, payments };
  } catch (error) {
    console.error('Error getting user payments:', error);
    return { success: false, error: error.message };
  }
}

// ==================== COLLECTION MANAGEMENT ====================

async function createCollection(collectionData) {
  try {
    console.log('Creating collection in Firebase:', collectionData.name);
    const docRef = await addDoc(collection(db, 'collections'), {
      ...collectionData,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });
    console.log('Collection created with ID:', docRef.id);
    return { success: true, id: docRef.id };
  } catch (error) {
    console.error('Error creating collection:', error);
    return { success: false, error: error.message };
  }
}

async function getCollections() {
  try {
    const q = query(collection(db, 'collections'), orderBy('createdAt', 'desc'));
    const querySnapshot = await getDocs(q);
    const collections = [];
    querySnapshot.forEach((doc) => {
      collections.push({ id: doc.id, ...doc.data() });
    });
    return { success: true, collections };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

async function getCollectionById(collectionId) {
  try {
    const docRef = doc(db, 'collections', collectionId);
    const docSnap = await getDoc(docRef);
    
    if (docSnap.exists()) {
      return { success: true, collection: { id: docSnap.id, ...docSnap.data() } };
    } else {
      return { success: false, error: 'Collection not found' };
    }
  } catch (error) {
    return { success: false, error: error.message };
  }
}

async function updateCollection(collectionId, updateData) {
  try {
    const docRef = doc(db, 'collections', collectionId);
    await updateDoc(docRef, {
      ...updateData,
      updatedAt: new Date().toISOString()
    });
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

async function updateCollectionImageCount(collectionId, newCount) {
  try {
    const docRef = doc(db, 'collections', collectionId);
    await updateDoc(docRef, {
      imageCount: newCount,
      updatedAt: new Date().toISOString()
    });
    return { success: true };
  } catch (error) {
    console.error('Error updating collection count:', error);
    return { success: false, error: error.message };
  }
}

async function deleteCollection(collectionId) {
  try {
    // First, delete all files in this collection
    const filesResult = await getFilesByCollection(collectionId);
    if (filesResult.success) {
      for (const file of filesResult.files) {
        await deleteFile(file.id);
      }
    }

    // Then delete the collection
    await deleteDoc(doc(db, 'collections', collectionId));
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

// ==================== FILE MANAGEMENT ====================

async function saveFileData(fileData) {
  try {
    console.log('Saving file data to Firebase with Cloudinary ID...');
    
    if (!fileData.cloudinaryData || !fileData.cloudinaryData.public_id) {
      console.error('No Cloudinary data or public_id!');
      return { success: false, error: 'No Cloudinary data' };
    }

    console.log('Cloudinary public_id to save:', fileData.cloudinaryData.public_id);

    const fileDoc = {
      title: fileData.title,
      description: fileData.description || '',
      collectionId: fileData.collectionId,
      
      // Save Cloudinary generated ID and data
      cloudinaryData: {
        public_id: fileData.cloudinaryData.public_id,
        secure_url: fileData.cloudinaryData.secure_url,
        format: fileData.cloudinaryData.format,
        bytes: fileData.cloudinaryData.bytes,
        created_at: fileData.cloudinaryData.created_at,
        width: fileData.cloudinaryData.width,
        height: fileData.cloudinaryData.height
      },
      
      fileName: fileData.fileName,
      fileSize: fileData.fileSize,
      fileType: fileData.fileType,
      uploader: fileData.uploader || 'admin',
      originalFileName: fileData.originalFileName,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    console.log('Complete file document:', fileDoc);

    const docRef = await addDoc(collection(db, 'files'), fileDoc);
    
    const savedFile = { 
      id: docRef.id, 
      ...fileDoc 
    };
    
    console.log('File saved successfully! Firebase ID:', docRef.id);
    console.log('Cloudinary public_id saved:', savedFile.cloudinaryData.public_id);
    
    return { 
      success: true, 
      id: docRef.id, 
      file: savedFile 
    };
  } catch (error) {
    console.error('Error saving file data to Firebase:', error);
    return { success: false, error: error.message };
  }
}

async function getFiles() {
  try {
    const q = query(collection(db, 'files'), orderBy('createdAt', 'desc'));
    const querySnapshot = await getDocs(q);
    const files = [];
    querySnapshot.forEach((doc) => {
      files.push({ id: doc.id, ...doc.data() });
    });
    return { success: true, files };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

async function getFilesByCollection(collectionId) {
  try {
    console.log('Querying files for collection:', collectionId);
    
    const q = query(
      collection(db, 'files'), 
      where('collectionId', '==', collectionId),
      orderBy('createdAt', 'asc')
    );
    
    const querySnapshot = await getDocs(q);
    const files = [];
    
    console.log('Found documents:', querySnapshot.size);
    
    querySnapshot.forEach((doc) => {
      const fileData = { id: doc.id, ...doc.data() };
      console.log('File found:', {
        id: fileData.id,
        title: fileData.title,
        public_id: fileData.cloudinaryData?.public_id,
        secure_url: fileData.cloudinaryData?.secure_url ? 'Available' : 'Missing'
      });
      files.push(fileData);
    });
    
    return { success: true, files };
  } catch (error) {
    console.error('Error in getFilesByCollection:', error);
    return { success: false, error: error.message, files: [] };
  }
}

async function getFilesByCloudinaryId(cloudinaryId) {
  try {
    const q = query(
      collection(db, 'files'), 
      where('cloudinaryData.public_id', '==', cloudinaryId)
    );
    const querySnapshot = await getDocs(q);
    const files = [];
    querySnapshot.forEach((doc) => {
      files.push({ id: doc.id, ...doc.data() });
    });
    return { success: true, files };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

async function deleteFile(fileId) {
  try {
    await deleteDoc(doc(db, 'files', fileId));
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

// ==================== ID VERIFICATION METHODS ====================

async function saveVerification(verificationData) {
  try {
    console.log('Saving ID verification data...');
    const docRef = await addDoc(collection(db, 'idVerifications'), verificationData);
    console.log('Verification saved with ID:', docRef.id);
    return { success: true, id: docRef.id };
  } catch (error) {
    console.error('Error saving verification:', error);
    return { success: false, error: error.message };
  }
}

async function getUserVerification(userEmail) {
  try {
    const q = query(
      collection(db, 'idVerifications'), 
      where('userEmail', '==', userEmail)
    );
    const querySnapshot = await getDocs(q);
    const verifications = [];
    querySnapshot.forEach((doc) => {
      verifications.push({ id: doc.id, ...doc.data() });
    });
    
    return { 
      success: true, 
      verification: verifications.length > 0 ? verifications[0] : null 
    };
  } catch (error) {
    console.error('Error getting user verification:', error);
    return { success: false, error: error.message };
  }
}

async function getAllVerifications() {
  try {
    const q = query(collection(db, 'idVerifications'), orderBy('submittedAt', 'desc'));
    const querySnapshot = await getDocs(q);
    const verifications = [];
    querySnapshot.forEach((doc) => {
      verifications.push({ id: doc.id, ...doc.data() });
    });
    return { success: true, verifications };
  } catch (error) {
    console.error('Error getting all verifications:', error);
    return { success: false, error: error.message };
  }
}

async function updateVerificationStatus(verificationId, status, adminNotes = '') {
  try {
    const docRef = doc(db, 'idVerifications', verificationId);
    await updateDoc(docRef, {
      status: status,
      verifiedAt: new Date().toISOString(),
      adminNotes: adminNotes
    });
    console.log('Verification status updated:', verificationId, status);
    return { success: true };
  } catch (error) {
    console.error('Error updating verification status:', error);
    return { success: false, error: error.message };
  }
}

async function updateVerification(verificationId, verificationData) {
  try {
    console.log('Updating existing verification:', verificationId);
    const docRef = doc(db, 'idVerifications', verificationId);
    await updateDoc(docRef, {
      ...verificationData,
      updatedAt: new Date().toISOString()
    });
    console.log('Verification updated:', verificationId);
    return { success: true, id: verificationId };
  } catch (error) {
    console.error('Error updating verification:', error);
    return { success: false, error: error.message };
  }
}

// ==================== DAMAGED ITEMS MANAGEMENT ====================

async function saveRentalItems(rentalItems) {
  try {
    // Since rental items are global, we'll store them in a single document
    const docRef = doc(db, 'system', 'rentalInventory');
    await setDoc(docRef, {
      rentalItems,
      updatedAt: new Date().toISOString()
    });
    return { success: true };
  } catch (error) {
    console.error('Error saving rental items:', error);
    return { success: false, error: error.message };
  }
}

async function getRentalItems() {
  try {
    const docRef = doc(db, 'system', 'rentalInventory');
    const docSnap = await getDoc(docRef);
    
    if (docSnap.exists()) {
      return { success: true, rentalItems: docSnap.data().rentalItems || [] };
    } else {
      return { success: true, rentalItems: [] };
    }
  } catch (error) {
    console.error('Error getting rental items:', error);
    return { success: false, error: error.message };
  }
}

async function saveDamageReport(damageReport) {
  try {
    const docRef = await addDoc(collection(db, 'damageReports'), {
      ...damageReport,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });
    return { success: true, id: docRef.id };
  } catch (error) {
    console.error('Error saving damage report:', error);
    return { success: false, error: error.message };
  }
}

async function getDamageReports() {
  try {
    const q = query(collection(db, 'damageReports'), orderBy('createdAt', 'desc'));
    const querySnapshot = await getDocs(q);
    const reports = [];
    querySnapshot.forEach((doc) => {
      reports.push({ id: doc.id, ...doc.data() });
    });
    return { success: true, reports };
  } catch (error) {
    console.error('Error getting damage reports:', error);
    return { success: false, error: error.message };
  }
}

async function updateDamageReport(reportId, updateData) {
  try {
    const docRef = doc(db, 'damageReports', reportId);
    await updateDoc(docRef, {
      ...updateData,
      updatedAt: new Date().toISOString()
    });
    return { success: true };
  } catch (error) {
    console.error('Error updating damage report:', error);
    return { success: false, error: error.message };
  }
}

async function deleteDamageReport(reportId) {
  try {
    await deleteDoc(doc(db, 'damageReports', reportId));
    return { success: true };
  } catch (error) {
    console.error('Error deleting damage report:', error);
    return { success: false, error: error.message };
  }
}

// ==================== INVENTORY MANAGEMENT ====================

async function saveInventoryItems(inventoryItems) {
  try {
    console.log('Saving inventory items to Firebase:', inventoryItems.length, 'items');
    
    // Clean up items - remove any File objects and keep only image URLs
    const cleanItems = inventoryItems.map(item => {
      const { imageFile, ...cleanItem } = item;
      
      // If we have imageFile and image is a data URL, we need to upload it first
      // But for now, just remove the File object
      if (cleanItem.image && cleanItem.image.startsWith('data:image')) {
        // This is a base64 image that hasn't been uploaded yet
        // We'll handle this in the InventoryPanel.js
        console.warn('Item has base64 image that needs upload:', item.id);
      }
      
      return cleanItem;
    });
    
    // Save to 'inventory/currentInventory' document
    const docRef = doc(db, 'inventory', 'currentInventory');
    await setDoc(docRef, {
      items: cleanItems,
      updatedAt: new Date().toISOString(),
      totalItems: cleanItems.length
    }, { merge: true });
    
    console.log('Inventory items saved to Firebase successfully');
    return { success: true };
  } catch (error) {
    console.error('Error saving inventory items:', error);
    return { success: false, error: error.message };
  }
}

async function getInventoryItems() {
  try {
    const docRef = doc(db, 'inventory', 'currentInventory');
    const docSnap = await getDoc(docRef);
    
    if (docSnap.exists()) {
      const data = docSnap.data();
      console.log('Inventory items loaded from Firebase:', data.items?.length || 0);
      return { success: true, inventoryItems: data.items || [] };
    } else {
      console.log('No inventory items found in Firebase');
      return { success: true, inventoryItems: [] };
    }
  } catch (error) {
    console.error('Error getting inventory items:', error);
    return { success: false, error: error.message };
  }
}

async function saveInventoryItem(itemData) {
  try {
    console.log('Saving individual inventory item:', itemData.name);
    
    // Prepare item data for Firebase (remove File objects)
    const itemForFirebase = { ...itemData };
    
    // If there's a File object (imageFile), upload it to Cloudinary first
    if (itemData.imageFile) {
      try {
        console.log('Uploading image to Cloudinary for item:', itemData.name);
        const cloudinaryResult = await cloudinaryService.uploadImage(itemData.imageFile);
        
        // Update the item with Cloudinary URL
        itemForFirebase.image = cloudinaryResult.secure_url;
        itemForFirebase.cloudinaryPublicId = cloudinaryResult.public_id;
        
        console.log('Image uploaded to Cloudinary:', cloudinaryResult.public_id);
      } catch (uploadError) {
        console.error('Failed to upload image to Cloudinary:', uploadError);
        // Continue without image
        itemForFirebase.image = null;
      }
    }
    
    // Remove File objects from the data before saving to Firebase
    delete itemForFirebase.imageFile;
    
    const docRef = await addDoc(collection(db, 'inventoryItems'), {
      ...itemForFirebase,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      type: 'inventory'
    });
    
    console.log('Individual inventory item saved with ID:', docRef.id);
    return { 
      success: true, 
      id: docRef.id, 
      item: { id: docRef.id, ...itemForFirebase } 
    };
  } catch (error) {
    console.error('Error saving individual inventory item:', error);
    return { success: false, error: error.message };
  }
}

async function updateInventoryItemQuantity(itemId, newQuantity) {
  try {
    console.log('Updating inventory item quantity:', itemId, newQuantity);
    
    // Try to update in the main inventory document first
    const docRef = doc(db, 'inventory', 'currentInventory');
    const docSnap = await getDoc(docRef);
    
    if (docSnap.exists()) {
      const data = docSnap.data();
      const items = data.items || [];
      const updatedItems = items.map(item => {
        if (item.id === itemId) {
          return { ...item, availableQuantity: newQuantity };
        }
        return item;
      });
      
      await setDoc(docRef, {
        items: updatedItems,
        updatedAt: new Date().toISOString(),
        totalItems: updatedItems.length
      }, { merge: true });
      
      console.log('✅ Updated quantity in main inventory');
    }
    
    // Also update in the inventoryItems collection if it exists
    try {
      const itemsResult = await getInventoryItemsByCustomId(itemId);
      if (itemsResult.success && itemsResult.items.length > 0) {
        const firebaseId = itemsResult.items[0].firebaseId;
        await updateDoc(doc(db, 'inventoryItems', firebaseId), {
          availableQuantity: newQuantity,
          updatedAt: new Date().toISOString()
        });
        console.log('✅ Updated quantity in inventoryItems collection');
      }
    } catch (collectionError) {
      console.log('ℹ️ Item not found in collection, continuing...');
    }
    
    // Update localStorage for fallback
    const savedInventoryItems = localStorage.getItem('rentalItems');
    if (savedInventoryItems) {
      const inventoryItems = JSON.parse(savedInventoryItems);
      const updatedInventoryItems = inventoryItems.map(item => {
        if (item.id === itemId) {
          return { ...item, availableQuantity: newQuantity };
        }
        return item;
      });
      localStorage.setItem('rentalItems', JSON.stringify(updatedInventoryItems));
      console.log('✅ Updated quantity in localStorage');
    }
    
    return { success: true };
  } catch (error) {
    console.error('Error updating inventory item quantity:', error);
    return { success: false, error: error.message };
  }
}

async function updateInventoryItem(itemId, updateData) {
  try {
    console.log('Updating inventory item:', itemId);
    
    // Prepare update data for Firebase
    const updateDataForFirebase = { ...updateData };
    
    // If there's a new image file, upload it to Cloudinary
    if (updateData.imageFile) {
      try {
        console.log('Uploading new image to Cloudinary for update');
        const cloudinaryResult = await cloudinaryService.uploadImage(updateData.imageFile);
        
        // Update with Cloudinary URL
        updateDataForFirebase.image = cloudinaryResult.secure_url;
        updateDataForFirebase.cloudinaryPublicId = cloudinaryResult.public_id;
        
        console.log('New image uploaded to Cloudinary:', cloudinaryResult.public_id);
      } catch (uploadError) {
        console.error('Failed to upload new image to Cloudinary:', uploadError);
        // Keep existing image
        delete updateDataForFirebase.image;
      }
    }
    
    // Remove File objects
    delete updateDataForFirebase.imageFile;
    
    const docRef = doc(db, 'inventoryItems', itemId);
    await updateDoc(docRef, {
      ...updateDataForFirebase,
      updatedAt: new Date().toISOString()
    });
    
    console.log('Inventory item updated:', itemId);
    return { success: true };
  } catch (error) {
    console.error('Error updating inventory item:', error);
    return { success: false, error: error.message };
  }
}

async function deleteInventoryItem(itemId) {
  try {
    await deleteDoc(doc(db, 'inventoryItems', itemId));
    console.log('Inventory item deleted:', itemId);
    return { success: true };
  } catch (error) {
    console.error('Error deleting inventory item:', error);
    return { success: false, error: error.message };
  }
}

async function getAllInventoryItems() {
  try {
    const q = query(collection(db, 'inventoryItems'), orderBy('createdAt', 'desc'));
    const querySnapshot = await getDocs(q);
    const items = [];
    querySnapshot.forEach((doc) => {
      items.push({ id: doc.id, ...doc.data() });
    });
    
    console.log('All inventory items loaded:', items.length);
    return { success: true, items };
  } catch (error) {
    console.error('Error getting all inventory items:', error);
    return { success: false, error: error.message };
  }
}

async function saveInventoryToFirebase(inventoryItems) {
  try {
    console.log('Starting Firebase inventory save for', inventoryItems.length, 'items');
    
    // First, process all items to upload images if needed
    const processedItems = [];
    
    for (const item of inventoryItems) {
      try {
        const itemCopy = { ...item };
        
        // If item has an image that's a base64 string (from form), upload to Cloudinary
        if (item.image && item.image.startsWith('data:image')) {
          try {
            console.log(`Uploading base64 image for item: ${item.name}`);
            
            // Convert base64 to blob
            const response = await fetch(item.image);
            const blob = await response.blob();
            
            // Upload to Cloudinary
            const cloudinaryResult = await cloudinaryService.uploadImage(blob);
            
            // Update item with Cloudinary URL
            itemCopy.image = cloudinaryResult.secure_url;
            itemCopy.cloudinaryPublicId = cloudinaryResult.public_id;
            
            console.log(`Image uploaded to Cloudinary: ${cloudinaryResult.public_id}`);
          } catch (uploadError) {
            console.error(`Failed to upload image for ${item.name}:`, uploadError);
            // Use default image if upload fails
            itemCopy.image = '/assets/items/default.png';
          }
        }
        
        // Remove any File objects
        delete itemCopy.imageFile;
        
        processedItems.push(itemCopy);
      } catch (error) {
        console.error(`Error processing item ${item.id}:`, error);
        processedItems.push(item);
      }
    }
    
    // Method 1: Save all items as a batch in a single document
    const result = await saveInventoryItems(processedItems);
    
    if (result.success) {
      console.log('✅ Inventory saved successfully to Firebase');
      return { success: true };
    } else {
      console.error('❌ Failed to save inventory batch:', result.error);
      
      // Method 2: Try saving individually
      console.log('Trying individual saves as fallback...');
      const individualResults = [];
      
      for (const item of processedItems) {
        try {
          // First check if item already exists by custom ID
          const existingResult = await getInventoryItemsByCustomId(item.id);
          
          if (existingResult.success && existingResult.items.length > 0) {
            // Update existing
            const firebaseId = existingResult.items[0].firebaseId;
            const updateResult = await updateInventoryItem(firebaseId, item);
            individualResults.push(updateResult);
          } else {
            // Create new
            const saveResult = await saveInventoryItem(item);
            individualResults.push(saveResult);
          }
        } catch (error) {
          console.error(`Failed to save item ${item.id}:`, error);
          individualResults.push({ success: false, error: error.message });
        }
      }
      
      const allSuccessful = individualResults.every(r => r.success);
      if (allSuccessful) {
        console.log('✅ All items saved individually');
        return { success: true };
      } else {
        console.error('❌ Some items failed to save');
        return { 
          success: false, 
          error: 'Some items failed to save',
          details: individualResults.filter(r => !r.success)
        };
      }
    }
  } catch (error) {
    console.error('❌ Error in saveInventoryToFirebase:', error);
    return { success: false, error: error.message };
  }
}

async function getInventoryItemsByCustomId(customId) {
  try {
    const q = query(collection(db, 'inventoryItems'), where('id', '==', customId));
    const querySnapshot = await getDocs(q);
    const items = [];
    querySnapshot.forEach((doc) => {
      items.push({ firebaseId: doc.id, ...doc.data() });
    });
    return { success: true, items };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

async function updateInventoryItemByCustomId(customId, updateData) {
  try {
    const itemsResult = await getInventoryItemsByCustomId(customId);
    if (itemsResult.success && itemsResult.items.length > 0) {
      const firebaseId = itemsResult.items[0].firebaseId;
      return await updateInventoryItem(firebaseId, updateData);
    }
    return { success: false, error: 'Item not found' };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

async function deleteInventoryItemByCustomId(customId) {
  try {
    const itemsResult = await getInventoryItemsByCustomId(customId);
    if (itemsResult.success && itemsResult.items.length > 0) {
      const firebaseId = itemsResult.items[0].firebaseId;
      return await deleteInventoryItem(firebaseId);
    }
    return { success: false, error: 'Item not found' };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

// ==================== ADMIN PAYMENT MANAGEMENT ====================

async function getAllPayments() {
  try {
    const q = query(collection(db, 'payments'), orderBy('paidAt', 'desc'));
    const querySnapshot = await getDocs(q);
    const payments = [];
    querySnapshot.forEach((doc) => {
      payments.push({ id: doc.id, ...doc.data() });
    });
    return { success: true, payments };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

async function getPaymentsByCollection(collectionId) {
  try {
    const q = query(
      collection(db, 'payments'), 
      where('collectionId', '==', collectionId),
      orderBy('paidAt', 'desc')
    );
    const querySnapshot = await getDocs(q);
    const payments = [];
    querySnapshot.forEach((doc) => {
      payments.push({ id: doc.id, ...doc.data() });
    });
    return { success: true, payments };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

// ==================== UTILITY METHODS ====================

async function getUserAccessibleCollections(userEmail) {
  try {
    // Get user's payment status
    const paymentStatus = await getUserPaymentStatus(userEmail);
    
    // Get all collections
    const collectionsResult = await getCollections();
    
    if (!collectionsResult.success) {
      return { success: false, error: collectionsResult.error };
    }

    let accessibleCollections = [];

    if (paymentStatus.success && paymentStatus.paymentStatus.isPaid) {
      if (paymentStatus.paymentStatus.accessType === 'all') {
        // User has access to all collections
        accessibleCollections = collectionsResult.collections;
      } else {
        // User has access to specific collections
        accessibleCollections = collectionsResult.collections.filter(collection => 
          paymentStatus.paymentStatus.collectionAccess.includes(collection.id) || 
          collection.price === 0 // Always include free collections
        );
      }
    } else {
      // User only has access to free collections
      accessibleCollections = collectionsResult.collections.filter(collection => 
        collection.price === 0
      );
    }

    return { success: true, collections: accessibleCollections };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

async function updateCollectionPrice(collectionId, newPrice) {
  try {
    const docRef = doc(db, 'collections', collectionId);
    await updateDoc(docRef, {
      price: parseFloat(newPrice),
      isPremium: parseFloat(newPrice) > 0,
      updatedAt: new Date().toISOString()
    });
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

async function processRefund(paymentId, reason) {
  try {
    const paymentRef = doc(db, 'payments', paymentId);
    await updateDoc(paymentRef, {
      status: 'refunded',
      refundedAt: new Date().toISOString(),
      refundReason: reason
    });
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

// ==================== MESSAGE SYSTEM ====================

async function sendMessage(messageData) {
  try {
    console.log('Sending message to Firebase...');
    console.log('Message data:', {
      email: messageData.email,
      fullName: messageData.fullName,
      description: messageData.description
    });
    
    const docRef = await addDoc(collection(db, 'sendMessage'), {
      email: messageData.email,
      fullName: messageData.fullName,
      description: messageData.description,
      timestamp: new Date().toISOString(),
      page: messageData.page || 'about',
      status: 'new'
    });
    
    console.log('Message sent with ID:', docRef.id);
    return { success: true, id: docRef.id };
  } catch (error) {
    console.error('Error sending message:', error);
    return { success: false, error: error.message };
  }
}

async function getMessages() {
  try {
    const q = query(collection(db, 'sendMessage'), orderBy('timestamp', 'desc'));
    const querySnapshot = await getDocs(q);
    const messages = [];
    querySnapshot.forEach((doc) => {
      messages.push({ id: doc.id, ...doc.data() });
    });
    return { success: true, messages };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

async function getMessagesByEmail(email) {
  try {
    const q = query(
      collection(db, 'sendMessage'), 
      where('email', '==', email),
      orderBy('timestamp', 'desc')
    );
    const querySnapshot = await getDocs(q);
    const messages = [];
    querySnapshot.forEach((doc) => {
      messages.push({ id: doc.id, ...doc.data() });
    });
    return { success: true, messages };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

async function updateMessageStatus(messageId, status, adminNotes = '') {
  try {
    const docRef = doc(db, 'sendMessage', messageId);
    await updateDoc(docRef, {
      status: status,
      adminNotes: adminNotes,
      updatedAt: new Date().toISOString()
    });
    console.log('Message status updated:', messageId, status);
    return { success: true };
  } catch (error) {
    console.error('Error updating message status:', error);
    return { success: false, error: error.message };
  }
}

async function deleteMessage(messageId) {
  try {
    await deleteDoc(doc(db, 'sendMessage', messageId));
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

// ==================== REAL-TIME LISTENERS ====================

function subscribeToUsers(callback) {
  return onSnapshot(collection(db, 'users'), (snapshot) => {
    const users = [];
    snapshot.forEach((doc) => {
      users.push({ id: doc.id, ...doc.data() });
    });
    callback(users);
  });
}

function subscribeToFiles(callback) {
  return onSnapshot(collection(db, 'files'), (snapshot) => {
    const files = [];
    snapshot.forEach((doc) => {
      files.push({ id: doc.id, ...doc.data() });
    });
    callback(files);
  });
}

function subscribeToCollections(callback) {
  return onSnapshot(collection(db, 'collections'), (snapshot) => {
    const collections = [];
    snapshot.forEach((doc) => {
      collections.push({ id: doc.id, ...doc.data() });
    });
    callback(collections);
  });
}

function subscribeToPayments(userEmail, callback) {
  const q = query(
    collection(db, 'payments'), 
    where('userEmail', '==', userEmail),
    orderBy('paidAt', 'desc')
  );
  
  return onSnapshot(q, (snapshot) => {
    const payments = [];
    snapshot.forEach((doc) => {
      payments.push({ id: doc.id, ...doc.data() });
    });
    callback(payments);
  });
}

function subscribeToVerifications(callback) {
  const q = query(collection(db, 'idVerifications'), orderBy('submittedAt', 'desc'));
  return onSnapshot(q, (snapshot) => {
    const verifications = [];
    snapshot.forEach((doc) => {
      verifications.push({ id: doc.id, ...doc.data() });
    });
    callback(verifications);
  });
}

function subscribeToDamageReports(callback) {
  const q = query(collection(db, 'damageReports'), orderBy('createdAt', 'desc'));
  return onSnapshot(q, (snapshot) => {
    const reports = [];
    snapshot.forEach((doc) => {
      reports.push({ id: doc.id, ...doc.data() });
    });
    callback(reports);
  });
}

function subscribeToRentalItems(callback) {
  const docRef = doc(db, 'system', 'rentalInventory');
  return onSnapshot(docRef, (docSnap) => {
    if (docSnap.exists()) {
      callback(docSnap.data().rentalItems || []);
    } else {
      callback([]);
    }
  });
}

function subscribeToInventory(callback) {
  const docRef = doc(db, 'inventory', 'currentInventory');
  return onSnapshot(docRef, (docSnap) => {
    if (docSnap.exists()) {
      const data = docSnap.data();
      callback(data.items || []);
    } else {
      callback([]);
    }
  });
}

function subscribeToInventoryItems(callback) {
  const q = query(collection(db, 'inventoryItems'), orderBy('createdAt', 'desc'));
  return onSnapshot(q, (snapshot) => {
    const items = [];
    snapshot.forEach((doc) => {
      items.push({ id: doc.id, ...doc.data() });
    });
    callback(items);
  });
}

function subscribeToMessages(callback) {
  const q = query(collection(db, 'sendMessage'), orderBy('timestamp', 'desc'));
  return onSnapshot(q, (snapshot) => {
    const messages = [];
    snapshot.forEach((doc) => {
      messages.push({ id: doc.id, ...doc.data() });
    });
    callback(messages);
  });
}

function subscribeToUserMessages(email, callback) {
  const q = query(
    collection(db, 'sendMessage'), 
    where('email', '==', email),
    orderBy('timestamp', 'desc')
  );
  
  return onSnapshot(q, (snapshot) => {
    const messages = [];
    snapshot.forEach((doc) => {
      messages.push({ id: doc.id, ...doc.data() });
    });
    callback(messages);
  });
}

// ==================== EXPORT ALL FUNCTIONS ====================

export const firebaseService = {
  // Authentication
  registerUser,
  loginUser,
  logoutUser,
  sendVerificationEmail,
  resendVerificationEmail,
  checkUserVerificationStatus,
  
  // Password Reset
  sendPasswordReset,
  confirmPasswordResetCode, // Updated name
  checkPasswordResetCode,
  
  // User Management
  saveUserData,
  getUsers,
  getUserByEmail,
  
  // Payment Management
  getUserPaymentStatus,
  processPayment,
  getUserPayments,
  getAllPayments,
  getPaymentsByCollection,
  processRefund,
  
  // Collection Management
  createCollection,
  getCollections,
  getCollectionById,
  updateCollection,
  updateCollectionImageCount,
  deleteCollection,
  updateCollectionPrice,
  
  // File Management
  saveFileData,
  getFiles,
  getFilesByCollection,
  getFilesByCloudinaryId,
  deleteFile,
  
  // ID Verification
  saveVerification,
  getUserVerification,
  getAllVerifications,
  updateVerificationStatus,
  updateVerification,
  
  // Damaged Items Management
  saveRentalItems,
  getRentalItems,
  saveDamageReport,
  getDamageReports,
  updateDamageReport,
  deleteDamageReport,
  
  // Inventory Management
  saveInventoryItems,
  getInventoryItems,
  saveInventoryItem,
  updateInventoryItem,
  deleteInventoryItem,
  getAllInventoryItems,
  saveInventoryToFirebase,
  getInventoryItemsByCustomId,
  updateInventoryItemByCustomId,
  deleteInventoryItemByCustomId,
  updateInventoryItemQuantity,
  
  // Message System
  sendMessage,
  getMessages,
  getMessagesByEmail,
  updateMessageStatus,
  deleteMessage,
  
  // Utility Functions
  getUserAccessibleCollections,
  
  // Real-time Listeners
  subscribeToUsers,
  subscribeToFiles,
  subscribeToCollections,
  subscribeToPayments,
  subscribeToVerifications,
  subscribeToDamageReports,
  subscribeToRentalItems,
  subscribeToInventory,
  subscribeToInventoryItems,
  subscribeToMessages,
  subscribeToUserMessages
};