// AdminBookingPanel.js - UPDATED WITH INVENTORY INTEGRATION
import React, { useState, useEffect } from 'react';
import { collection, query, where, getDocs, orderBy, doc, updateDoc, getFirestore, getDoc, setDoc } from 'firebase/firestore';
import { db } from '../../utils/firebase';
import { useAuth } from '../../context/AuthContext';
import { useNavigate } from 'react-router-dom';

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

const AdminBookingPanel = ({ isAdmin = false }) => {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [expandedBookings, setExpandedBookings] = useState({});
  const [statusFilter, setStatusFilter] = useState('all');
  const [paymentStatusFilter, setPaymentStatusFilter] = useState('all');
  const [hasLoaded, setHasLoaded] = useState(false);
  const [adminName, setAdminName] = useState('');
  const [selectedImage, setSelectedImage] = useState(null);
  const [imageModalOpen, setImageModalOpen] = useState(false);
  const [inventoryItems, setInventoryItems] = useState([]);

  useEffect(() => {
    if (!hasLoaded) {
      loadBookings();
      loadInventory();
    }

    // Get admin's display name
    if (isAdmin && user) {
      getAdminDisplayName();
    }
  }, [hasLoaded]);

  // Load inventory items
  const loadInventory = async () => {
    try {
      const inventoryRef = collection(db, "inventory");
      const q = query(inventoryRef);
      const querySnapshot = await getDocs(q);
      
      const items = [];
      querySnapshot.forEach((doc) => {
        const data = doc.data();
        if (data.items && Array.isArray(data.items)) {
          items.push(...data.items);
        }
      });
      
      setInventoryItems(items);
      console.log("Loaded inventory items:", items.length);
    } catch (error) {
      console.error("Error loading inventory:", error);
    }
  };

  // Get admin's display name from Firebase Auth or Firestore
  const getAdminDisplayName = async () => {
    try {
      // First try to get from Firebase Auth user object
      if (user.displayName) {
        setAdminName(user.displayName);
        console.log("Admin name from Auth:", user.displayName);
        return;
      }

      // If not in Auth, check Firestore users collection
      const q = query(
        collection(db, "users"),
        where("email", "==", user.email)
      );
      const querySnapshot = await getDocs(q);

      if (!querySnapshot.empty) {
        const userDoc = querySnapshot.docs[0];
        const userData = userDoc.data();
        const name = userData.name || userData.displayName;

        if (name) {
          setAdminName(name);
          console.log("Admin name from Firestore:", name);
        } else {
          // Fallback to email first part
          const emailName = user.email.split('@')[0];
          setAdminName(emailName.charAt(0).toUpperCase() + emailName.slice(1));
        }
      } else {
        // Fallback to email first part
        const emailName = user.email.split('@')[0];
        setAdminName(emailName.charAt(0).toUpperCase() + emailName.slice(1));
      }
    } catch (error) {
      console.error("Error getting admin name:", error);
      // Fallback to email first part
      const emailName = user.email.split('@')[0];
      setAdminName(emailName.charAt(0).toUpperCase() + emailName.slice(1));
    }
  };

  // Get user's display name (for regular users)
  const getUserDisplayName = async (userEmail) => {
    try {
      const q = query(
        collection(db, "users"),
        where("email", "==", userEmail)
      );
      const querySnapshot = await getDocs(q);

      if (!querySnapshot.empty) {
        const userDoc = querySnapshot.docs[0];
        const userData = userDoc.data();
        return userData.name || userData.displayName || userEmail.split('@')[0];
      }
      return userEmail.split('@')[0]; // Fallback
    } catch (error) {
      console.error("Error getting user name:", error);
      return userEmail.split('@')[0]; // Fallback
    }
  };

  const loadBookings = async () => {
    try {
      setLoading(true);
      setError('');
      let q;

      if (isAdmin) {
        q = query(collection(db, "bookings"), orderBy("timestamp", "desc"));
      } else {
        q = query(
          collection(db, "bookings"),
          where("userId", "==", user?.uid),
          orderBy("timestamp", "desc")
        );
      }

      const querySnapshot = await getDocs(q);
      const bookingsData = [];

      // Process each booking to get user names
      for (const docSnapshot of querySnapshot.docs) {
        const data = docSnapshot.data();

        // Get the user's display name for each booking
        let userName = data.name || data.userName;
        if (!userName && data.email) {
          // Try to get from users collection if not stored in booking
          userName = await getUserDisplayName(data.email || data.userEmail);
        }

        bookingsData.push({
          id: docSnapshot.id,
          ...data,
          // Ensure we have a display name
          name: userName || data.name || data.userName,
          // Ensure paymentStatus has a default value if not set
          paymentStatus: data.paymentStatus || 'no_payment_recorded',
          // Ensure paymentDetails exists
          paymentDetails: data.paymentDetails || { amountPaid: 0 },
          // Ensure uploadedImages exists
          uploadedImages: data.uploadedImages || []
        });
      }

      setBookings(bookingsData);
      setHasLoaded(true);

      console.log("Loaded bookings:", bookingsData.length);
      console.log("Admin name:", adminName);

    } catch (error) {
      setError(`Error loading bookings: ${error.message}`);
      console.error("Error loading bookings:", error);
    } finally {
      setLoading(false);
    }
  };

  // Calculate duration in days
  const calculateDuration = (booking) => {
    const startDate = new Date(booking.startDate);
    const endDate = new Date(booking.endDate);
    return Math.ceil((endDate - startDate) / (1000 * 60 * 60 * 24)) + 1;
  };

  // Calculate total amount including days - FIXED VERSION
  const calculateTotalAmount = (booking) => {
    const duration = calculateDuration(booking);

    // For packages: package price * duration
    if (booking.package && booking.package.price) {
      return booking.package.price * duration;
    }

    // For individual items: (item price * quantity * days)
    if (booking.items && booking.items.length > 0) {
      return booking.items.reduce((total, item) => {
        const unitPrice = item.price || item.unitPrice || (item.subtotal / (item.quantity || 1));
        const quantity = item.quantity || 1;
        return total + (unitPrice * quantity * duration);
      }, 0);
    }

    return 0;
  };

  // Calculate amount paid (if any)
  const calculateAmountPaid = (booking) => {
    if (booking.paymentDetails && booking.paymentDetails.amountPaid) {
      return booking.paymentDetails.amountPaid;
    }
    return 0;
  };

  // Calculate balance
  const calculateBalance = (booking) => {
    const total = calculateTotalAmount(booking);
    const paid = calculateAmountPaid(booking);
    return total - paid;
  };

  // Calculate package total
  const calculatePackageTotal = (packagePrice, duration) => {
    return packagePrice * duration;
  };

  // Calculate item total for display
  const calculateItemTotal = (item, duration) => {
    const unitPrice = item.price || item.unitPrice || (item.subtotal / (item.quantity || 1));
    const quantity = item.quantity || 1;
    return unitPrice * quantity * duration;
  };

  // Get unit price for an item
  const getUnitPrice = (item) => {
    return item.price || item.unitPrice || (item.subtotal / (item.quantity || 1));
  };

  // FIXED: Get status function that handles both stored and calculated status
  const getStatus = (booking) => {
    // If booking has a status field, use it (convert to lowercase)
    if (booking.status && typeof booking.status === 'string') {
      return booking.status.toLowerCase().trim();
    }

    // Otherwise calculate based on dates
    const today = new Date();
    const endDate = new Date(booking.endDate);
    const startDate = new Date(booking.startDate);

    // Reset times to compare dates only
    today.setHours(0, 0, 0, 0);
    startDate.setHours(0, 0, 0, 0);
    endDate.setHours(0, 0, 0, 0);

    if (today < startDate) return 'pending';
    if (today > endDate) return 'completed';
    return 'active';
  };

  // Get payment status with default
  const getPaymentStatus = (booking) => {
    return booking.paymentStatus || 'no_payment_recorded';
  };

  // Check if balance is 0 (fully paid)
  const isFullyPaid = (booking) => {
    const balance = calculateBalance(booking);
    return balance <= 0;
  };

  // Check if partially paid (some payment but not full)
  const isPartiallyPaid = (booking) => {
    const amountPaid = calculateAmountPaid(booking);
    return amountPaid > 0 && !isFullyPaid(booking);
  };

  // Check if no payment recorded
  const isNoPayment = (booking) => {
    const amountPaid = calculateAmountPaid(booking);
    return amountPaid === 0;
  };

  // Check if payment is completed
  const isPaymentCompleted = (booking) => {
    return getPaymentStatus(booking) === 'payment_completed';
  };

  // Check if booking is just a reservation (no payment made)
  const isJustReservation = (booking) => {
    const amountPaid = calculateAmountPaid(booking);
    const totalAmount = calculateTotalAmount(booking);

    // It's just a reservation if no payment has been made
    return amountPaid === 0 && totalAmount > 0;
  };

  // ==============================================
  // INVENTORY INTEGRATION FUNCTIONS
  // ==============================================

  // Get all items from a booking
  const getItemsFromBooking = (booking) => {
    const items = [];
    
    // Get items from package
    if (booking.package && booking.package.items) {
      booking.package.items.forEach(item => {
        items.push({
          id: item.id,
          name: item.name,
          quantity: item.quantity || 1,
          type: 'package'
        });
      });
    }
    
    // Get individual items
    if (booking.items) {
      booking.items.forEach(item => {
        items.push({
          id: item.id,
          name: item.name,
          quantity: item.quantity || 1,
          type: 'individual'
        });
      });
    }
    
    return items;
  };

  // Update inventory when booking status changes
  const updateInventoryForBooking = async (booking, newStatus, oldStatus = null) => {
    try {
      const bookingItems = getItemsFromBooking(booking);
      
      if (bookingItems.length === 0) {
        console.log("No items found in booking, skipping inventory update");
        return;
      }
      
      console.log(`Updating inventory for booking ${booking.id}: ${oldStatus} -> ${newStatus}`);
      
      // Get current inventory
      const inventoryRef = doc(db, "inventory", "currentInventory");
      const inventoryDoc = await getDoc(inventoryRef);
      
      let inventoryData = { items: [] };
      if (inventoryDoc.exists()) {
        inventoryData = inventoryDoc.data();
      }
      
      // Update each item in inventory
      const updatedItems = [...inventoryData.items];
      
      for (const bookingItem of bookingItems) {
        const itemIndex = updatedItems.findIndex(item => item.id === bookingItem.id);
        
        if (itemIndex !== -1) {
          const item = { ...updatedItems[itemIndex] };
          
          // Calculate available quantity
          const totalQuantity = item.totalQuantity || item.quantity || 1;
          const currentAvailable = item.availableQuantity || item.quantity || 1;
          const currentReserved = item.reservedQuantity || 0;
          
          let newAvailable = currentAvailable;
          let newReserved = currentReserved;
          
          // Logic for status changes
          if (oldStatus === 'pending' && newStatus === 'active') {
            // Already reserved, no change needed
          } 
          else if (oldStatus === 'active' && newStatus === 'completed') {
            // Release items back to inventory
            newAvailable = currentAvailable + bookingItem.quantity;
            newReserved = Math.max(0, currentReserved - bookingItem.quantity);
          }
          else if (oldStatus === 'active' && newStatus === 'cancelled') {
            // Release items back to inventory
            newAvailable = currentAvailable + bookingItem.quantity;
            newReserved = Math.max(0, currentReserved - bookingItem.quantity);
          }
          else if ((!oldStatus || oldStatus === 'cancelled' || oldStatus === 'completed') && 
                   (newStatus === 'active' || newStatus === 'pending')) {
            // Reserve items
            newAvailable = Math.max(0, currentAvailable - bookingItem.quantity);
            newReserved = currentReserved + bookingItem.quantity;
          }
          
          // Ensure values don't go negative
          newAvailable = Math.max(0, Math.min(newAvailable, totalQuantity));
          newReserved = Math.max(0, Math.min(newReserved, totalQuantity));
          
          item.availableQuantity = newAvailable;
          item.reservedQuantity = newReserved;
          item.lastUpdated = new Date().toISOString();
          item.updatedBy = adminName || user?.displayName || user?.email || 'admin';
          
          updatedItems[itemIndex] = item;
          
          console.log(`Updated ${bookingItem.name}: Available ${currentAvailable}->${newAvailable}, Reserved ${currentReserved}->${newReserved}`);
        } else {
          console.warn(`Item ${bookingItem.id} not found in inventory`);
        }
      }
      
      // Save updated inventory
      await updateDoc(inventoryRef, { 
        items: updatedItems,
        lastUpdated: new Date().toISOString(),
        updatedBy: adminName || user?.displayName || user?.email || 'admin'
      });
      
      // Update local state
      setInventoryItems(updatedItems);
      
      // Trigger inventory update event
      window.dispatchEvent(new Event('inventoryUpdated'));
      
      console.log(`Inventory updated successfully for booking ${booking.id}`);
      showMessage(`Inventory updated for ${newStatus} booking`);
      
    } catch (error) {
      console.error('Error updating inventory:', error);
      showMessage('Failed to update inventory');
    }
  };

  // Initialize inventory tracking for all bookings
  const initializeInventoryTracking = async () => {
    try {
      console.log('Initializing inventory tracking for all bookings...');
      
      // Get all bookings
      const activeBookings = bookings.filter(booking => 
        ['active', 'pending'].includes(getStatus(booking))
      );
      
      console.log(`Found ${activeBookings.length} active/pending bookings`);
      
      // Update inventory for each booking
      for (const booking of activeBookings) {
        await updateInventoryForBooking(booking, getStatus(booking), null);
      }
      
      showMessage(`Inventory tracking initialized for ${activeBookings.length} bookings`);
      
    } catch (error) {
      console.error('Error initializing inventory tracking:', error);
      showMessage('Error initializing inventory tracking');
    }
  };

  // Filter bookings based on selected status
  const filteredBookings = bookings.filter(booking => {
    const status = getStatus(booking);
    const paymentStatus = getPaymentStatus(booking);

    const statusMatch = statusFilter === 'all' || status === statusFilter.toLowerCase();

    let paymentStatusMatch;

    if (paymentStatusFilter === 'all') {
      paymentStatusMatch = true;
    } else if (paymentStatusFilter === 'no_payment_recorded') {
      // Filter for bookings that are just reservations
      paymentStatusMatch = isJustReservation(booking);
    } else {
      // Filter for specific payment status
      paymentStatusMatch = paymentStatus === paymentStatusFilter;
    }

    return statusMatch && paymentStatusMatch;
  });

  // Sort bookings chronologically by date booked (newest first)
  const getChronologicallySortedBookings = (bookingsArray) => {
    return [...bookingsArray].sort((a, b) => {
      // Sort by timestamp (date booked) - newest first
      return new Date(b.timestamp) - new Date(a.timestamp);
    });
  };

  // Get sorted bookings
  const sortedBookings = getChronologicallySortedBookings(filteredBookings);

  const toggleBookingFolder = (bookingId) => {
    setExpandedBookings(prev => ({
      ...prev,
      [bookingId]: !prev[bookingId]
    }));
  };

  // Open image modal
  const openImageModal = (image, index, totalImages) => {
    setSelectedImage({
      ...image,
      index: index + 1,
      total: totalImages
    });
    setImageModalOpen(true);
  };

  // Close image modal
  const closeImageModal = () => {
    setSelectedImage(null);
    setImageModalOpen(false);
  };

  // Navigate between images
  const navigateImage = (direction, currentIndex, totalImages, bookingId) => {
    const booking = bookings.find(b => b.id === bookingId);
    if (!booking || !booking.uploadedImages) return;

    let newIndex = currentIndex + direction;
    if (newIndex < 0) newIndex = totalImages - 1;
    if (newIndex >= totalImages) newIndex = 0;

    setSelectedImage({
      ...booking.uploadedImages[newIndex],
      index: newIndex + 1,
      total: totalImages
    });
  };

  // Delete an image from booking (admin only)
  const deleteBookingImage = async (bookingId, imageIndex) => {
    if (!window.confirm('Are you sure you want to delete this image? This action cannot be undone.')) {
      return;
    }

    try {
      const booking = bookings.find(b => b.id === bookingId);
      if (!booking) return;

      const updatedImages = [...booking.uploadedImages];
      const deletedImage = updatedImages.splice(imageIndex, 1)[0];

      // Update Firebase
      const bookingRef = doc(db, "bookings", bookingId);
      await updateDoc(bookingRef, {
        uploadedImages: updatedImages,
        updatedAt: new Date().toISOString(),
        updatedBy: adminName || user?.displayName || user?.email || 'admin'
      });

      // Update local state
      setBookings(prev => prev.map(b => {
        if (b.id === bookingId) {
          return {
            ...b,
            uploadedImages: updatedImages,
            updatedAt: new Date().toISOString(),
            updatedBy: adminName || user?.displayName || user?.email || 'admin'
          };
        }
        return b;
      }));

      // Close modal if it's open
      if (selectedImage && selectedImage.public_id === deletedImage.public_id) {
        closeImageModal();
      }

      showMessage('Image deleted successfully');

    } catch (error) {
      console.error('Error deleting image:', error);
      showMessage('Failed to delete image');
    }
  };

  // Update booking status in Firebase with inventory integration
  const updateBookingStatus = async (bookingId, newStatus) => {
    try {
      const bookingRef = doc(db, "bookings", bookingId);
      const booking = bookings.find(b => b.id === bookingId);
      
      if (!booking) {
        showMessage('Booking not found');
        return;
      }

      const oldStatus = getStatus(booking);

      // Update booking status in Firebase
      await updateDoc(bookingRef, {
        status: newStatus,
        updatedAt: new Date().toISOString(),
        updatedBy: adminName || user?.displayName || user?.email || 'admin'
      });

      // Update local state immediately for better UX
      setBookings(prev => prev.map(booking =>
        booking.id === bookingId
          ? {
            ...booking,
            status: newStatus,
            updatedAt: new Date().toISOString(),
            updatedBy: adminName || user?.displayName || user?.email || 'admin'
          }
          : booking
      ));

      // Update inventory based on status change
      await updateInventoryForBooking(booking, newStatus, oldStatus);

      showMessage(`Booking status updated to: ${newStatus}`);
    } catch (error) {
      console.error('Error updating booking status:', error);
      showMessage('Failed to update booking status');
    }
  };

  // Process refund for a booking
  const processRefund = async (booking) => {
    const bookingId = booking.id;
    const amountPaid = calculateAmountPaid(booking);
    const totalAmount = calculateTotalAmount(booking);
    
    if (amountPaid <= 0) {
      showMessage("No payment has been made to refund!");
      return;
    }

    const maxRefundable = amountPaid; // Can't refund more than paid
    const amountInput = window.prompt(
      `Enter refund amount:\n` +
      `Total Amount: ₱${totalAmount.toLocaleString()}\n` +
      `Amount Paid: ₱${amountPaid.toLocaleString()}\n` +
      `Available for refund: ₱${maxRefundable.toLocaleString()}\n\n` +
      `Enter refund amount (max: ₱${maxRefundable.toLocaleString()}):`,
      maxRefundable.toString()
    );

    if (amountInput === null) return; // User cancelled

    const refundAmount = parseFloat(amountInput);

    if (isNaN(refundAmount) || refundAmount <= 0) {
      showMessage("Please enter a valid positive amount.");
      return;
    }

    if (refundAmount > maxRefundable) {
      showMessage(`Refund amount cannot exceed ₱${maxRefundable.toLocaleString()}.`);
      return;
    }

    const reason = window.prompt("Enter reason for refund (optional):", "");

    if (window.confirm(`Are you sure you want to refund ₱${refundAmount.toLocaleString()}?\nReason: ${reason || "No reason provided"}`)) {
      await updateRefundStatus(bookingId, refundAmount, reason);
    }
  };

  // Update refund status in Firebase
  const updateRefundStatus = async (bookingId, refundAmount, reason = "") => {
    try {
      const bookingRef = doc(db, "bookings", bookingId);
      
      // Get current booking
      const currentBooking = bookings.find(b => b.id === bookingId);
      const currentPaymentDetails = currentBooking?.paymentDetails || {};
      const currentAmountPaid = currentPaymentDetails.amountPaid || 0;
      
      // Calculate new amount paid
      const newAmountPaid = Math.max(0, currentAmountPaid - refundAmount);
      
      // Get current admin name
      const currentAdminName = adminName || user?.displayName || user?.email.split('@')[0] || 'admin';
      
      // Determine new payment status
      let newPaymentStatus;
      if (newAmountPaid === 0) {
        newPaymentStatus = 'no_payment_recorded';
      } else {
        const totalAmount = calculateTotalAmount(currentBooking);
        if (newAmountPaid >= totalAmount) {
          newPaymentStatus = 'payment_completed';
        } else {
          newPaymentStatus = 'payment_partially_completed';
        }
      }
      
      // Add to payment history
      const paymentHistory = currentPaymentDetails.paymentHistory || [];
      paymentHistory.push({
        amount: -refundAmount, // Negative amount for refund
        date: new Date().toISOString(),
        status: 'refund_processed',
        recordedBy: currentAdminName,
        type: 'refund',
        reason: reason || "No reason provided"
      });
      
      const updateData = {
        paymentStatus: newPaymentStatus,
        updatedAt: new Date().toISOString(),
        updatedBy: currentAdminName,
        paymentDetails: {
          ...currentPaymentDetails,
          amountPaid: newAmountPaid,
          lastUpdated: new Date().toISOString(),
          updatedBy: currentAdminName,
          paymentHistory: paymentHistory
        }
      };
      
      console.log("Processing refund:", {
        bookingId,
        refundAmount,
        newAmountPaid,
        newPaymentStatus,
        updateData
      });
      
      await updateDoc(bookingRef, updateData);
      
      // Update local state
      setBookings(prev => prev.map(booking => {
        if (booking.id === bookingId) {
          return {
            ...booking,
            paymentStatus: newPaymentStatus,
            updatedAt: new Date().toISOString(),
            updatedBy: currentAdminName,
            paymentDetails: updateData.paymentDetails
          };
        }
        return booking;
      }));
      
      showMessage(`Refund of ₱${refundAmount.toLocaleString()} processed successfully!\nNew amount paid: ₱${newAmountPaid.toLocaleString()}`);
      
    } catch (error) {
      console.error('Error processing refund:', error);
      showMessage('Failed to process refund');
    }
  };

  // Update payment status in Firebase - UPDATED FOR MULTIPLE PARTIAL PAYMENTS
  const updatePaymentStatus = async (bookingId, action, amount = 0) => {
    try {
      const bookingRef = doc(db, "bookings", bookingId);

      // Get current booking to preserve existing payment details
      const currentBooking = bookings.find(b => b.id === bookingId);
      const currentPaymentDetails = currentBooking?.paymentDetails || {};

      // Get current admin name (refresh if needed)
      const currentAdminName = adminName || user?.displayName || user?.email.split('@')[0] || 'admin';

      // Calculate new total amount paid
      const currentAmountPaid = currentPaymentDetails.amountPaid || 0;
      const totalAmount = calculateTotalAmount(currentBooking);
      let newAmountPaid;
      let newPaymentStatus;

      if (action === 'partial_payment') {
        // Add the partial payment to existing amount
        newAmountPaid = currentAmountPaid + amount;

        // If after adding partial payment, balance becomes 0 or less, mark as completed
        const newBalance = totalAmount - newAmountPaid;
        if (newBalance <= 0) {
          newPaymentStatus = 'payment_completed';
          newAmountPaid = totalAmount; // Don't overpay
        } else {
          newPaymentStatus = 'payment_partially_completed';
        }
      } else if (action === 'payment_completed') {
        // Mark payment as fully completed
        newAmountPaid = totalAmount; // Set to full amount
        newPaymentStatus = 'payment_completed';
      }

      const updateData = {
        paymentStatus: newPaymentStatus,
        updatedAt: new Date().toISOString(),
        updatedBy: currentAdminName,
        paymentDetails: {
          ...currentPaymentDetails,
          amountPaid: newAmountPaid,
          lastUpdated: new Date().toISOString(),
          updatedBy: currentAdminName
        }
      };

      // Always add payment history for new payments
      if (action === 'partial_payment' && amount > 0) {
        const paymentHistory = currentPaymentDetails.paymentHistory || [];
        paymentHistory.push({
          amount: amount,
          date: new Date().toISOString(),
          status: newPaymentStatus,
          recordedBy: currentAdminName,
          type: 'payment'
        });

        updateData.paymentDetails.paymentHistory = paymentHistory;
      }

      // Add payment completed history
      if (action === 'payment_completed') {
        const paymentHistory = currentPaymentDetails.paymentHistory || [];
        const paymentAmount = totalAmount - currentAmountPaid;

        if (paymentAmount > 0) {
          paymentHistory.push({
            amount: paymentAmount,
            date: new Date().toISOString(),
            status: 'payment_completed',
            recordedBy: currentAdminName,
            type: 'payment_completed'
          });
        }

        updateData.paymentDetails.paymentHistory = paymentHistory;
      }

      console.log("Updating payment status in Firebase:", {
        bookingId,
        action,
        newPaymentStatus,
        amountPaid: newAmountPaid,
        adminName: currentAdminName,
        updateData
      });

      await updateDoc(bookingRef, updateData);

      // Update local state immediately for better UX
      setBookings(prev => prev.map(booking => {
        if (booking.id === bookingId) {
          const updatedBooking = {
            ...booking,
            paymentStatus: newPaymentStatus,
            updatedAt: new Date().toISOString(),
            updatedBy: currentAdminName,
            paymentDetails: updateData.paymentDetails
          };

          console.log("Updated local booking:", updatedBooking);
          return updatedBooking;
        }
        return booking;
      }));

      if (action === 'partial_payment') {
        const statusMessage = getPaymentStatusText(newPaymentStatus);
        const message = newPaymentStatus === 'payment_completed'
          ? `Payment completed! Total amount of ₱${totalAmount.toLocaleString()} has been paid in full.`
          : `Partial payment of ₱${amount.toLocaleString()} recorded. Total paid: ₱${newAmountPaid.toLocaleString()}, Balance: ₱${(totalAmount - newAmountPaid).toLocaleString()}`;
        showMessage(message);
      } else if (action === 'payment_completed') {
        showMessage(`Payment marked as completed! Total amount of ₱${totalAmount.toLocaleString()} has been recorded as fully paid.`);
      }
    } catch (error) {
      console.error('Error updating payment status:', error);
      showMessage('Failed to update payment status');
    }
  };

  // Process partial payment - NEW FUNCTION FOR BETTER UX
  const processPartialPayment = async (booking) => {
    const bookingId = booking.id;
    const balance = calculateBalance(booking);
    const totalAmount = calculateTotalAmount(booking);

    if (balance <= 0) {
      showMessage("This booking is already fully paid!");
      return;
    }

    const amountInput = window.prompt(
      `Enter partial payment amount:\n` +
      `Total Amount: ₱${totalAmount.toLocaleString()}\n` +
      `Amount Paid: ₱${calculateAmountPaid(booking).toLocaleString()}\n` +
      `Balance: ₱${balance.toLocaleString()}\n\n` +
      `Enter amount (max: ₱${balance.toLocaleString()}):`,
      balance.toString()
    );

    if (amountInput === null) return; // User cancelled

    const amount = parseFloat(amountInput);

    if (isNaN(amount) || amount <= 0) {
      showMessage("Please enter a valid positive amount.");
      return;
    }

    if (amount > balance) {
      showMessage(`Amount cannot exceed the balance of ₱${balance.toLocaleString()}.`);
      return;
    }

    // Update with partial payment
    await updatePaymentStatus(bookingId, 'partial_payment', amount);
  };

  // Process payment completion - NEW FUNCTION
  const processPaymentCompletion = async (booking) => {
    const bookingId = booking.id;
    const totalAmount = calculateTotalAmount(booking);
    const amountPaid = calculateAmountPaid(booking);
    const balance = calculateBalance(booking);

    if (balance <= 0) {
      showMessage("This booking is already fully paid!");
      return;
    }

    const confirmMessage = `Mark payment as completed?\n\n` +
      `Total Amount: ₱${totalAmount.toLocaleString()}\n` +
      `Amount Already Paid: ₱${amountPaid.toLocaleString()}\n` +
      `Remaining Balance: ₱${balance.toLocaleString()}\n\n` +
      `This will record the full payment and set the balance to zero.`;

    if (window.confirm(confirmMessage)) {
      await updatePaymentStatus(bookingId, 'payment_completed');
    }
  };

  const getStatusColor = (status) => {
    const statusLower = status.toLowerCase();
    switch (statusLower) {
      case 'active': return '#28a745';
      case 'completed': return '#6c757d';
      case 'cancelled': return '#dc3545';
      case 'pending': return '#ffc107';
      default: return '#6c757d';
    }
  };

  const getPaymentStatusColor = (status) => {
    switch (status) {
      case 'payment_completed': return '#28a745'; // Green
      case 'payment_partially_completed': return '#ffc107'; // Yellow
      case 'no_payment_recorded': return '##6c757d'; // Red
      case 'payment_refunded': return '#17a2b8'; // Teal
      case 'payment_pending': return '#fd7e14'; // Orange
      default: return '#6c757d'; // Gray
    }
  };

  const getPaymentStatusText = (status) => {
    switch (status) {
      case 'payment_completed': return 'Payment Completed';
      case 'payment_partially_completed': return 'Payment Partially Completed';
      case 'no_payment_recorded': return 'Reservation Paid';
      default: return status ? status.replace(/_/g, ' ').toUpperCase() : 'Payment Status Unknown';
    }
  };

  const BookingStatusBadge = ({ status }) => {
    const statusText = status ? status.toUpperCase() : 'UNKNOWN';
    const statusLower = status ? status.toLowerCase() : '';

    return (
      <span
        className="status-badge"
        style={{
          backgroundColor: getStatusColor(statusLower) + '20',
          color: getStatusColor(statusLower),
          border: `1px solid ${getStatusColor(statusLower)}40`,
          padding: '0.25rem 0.5rem',
          borderRadius: '4px',
          fontSize: '0.75rem',
          fontWeight: '600',
          marginRight: '0.5rem'
        }}
      >
        {statusText}
      </span>
    );
  };

  const PaymentStatusBadge = ({ status }) => {
    const statusText = getPaymentStatusText(status);

    return (
      <span
        className="payment-status-badge"
        style={{
          backgroundColor: getPaymentStatusColor(status) + '20',
          color: getPaymentStatusColor(status),
          border: `1px solid ${getPaymentStatusColor(status)}40`,
          padding: '0.25rem 0.5rem',
          borderRadius: '4px',
          fontSize: '0.75rem',
          fontWeight: '600'
        }}
      >
        {statusText}
      </span>
    );
  };

  // Check inventory availability for booking items
  const checkBookingInventoryAvailability = (booking) => {
    const bookingItems = getItemsFromBooking(booking);
    const availability = [];
    
    bookingItems.forEach(bookingItem => {
      const inventoryItem = inventoryItems.find(item => item.id === bookingItem.id);
      if (inventoryItem) {
        const available = inventoryItem.availableQuantity || inventoryItem.quantity || 0;
        const reserved = inventoryItem.reservedQuantity || 0;
        const total = inventoryItem.totalQuantity || inventoryItem.quantity || 1;
        
        availability.push({
          name: bookingItem.name,
          required: bookingItem.quantity,
          available: available,
          reserved: reserved,
          total: total,
          hasEnough: available >= bookingItem.quantity
        });
      }
    });
    
    return availability;
  };

  // Image Modal Component
  const ImageModal = () => {
    if (!selectedImage || !imageModalOpen) return null;

    return (
      <div style={{
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        backgroundColor: 'rgba(0, 0, 0, 0.9)',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: 1000,
        padding: '1rem'
      }}>
        <div style={{
          position: 'relative',
          maxWidth: '90vw',
          maxHeight: '90vh'
        }}>
          {/* Close button */}
          <button
            onClick={closeImageModal}
            style={{
              position: 'absolute',
              top: '-70px',
              right: '-50px',
              backgroundColor: 'transparent',
              border: 'none',
              color: 'white',
              fontSize: '2rem',
              cursor: 'pointer',
              zIndex: 1005
            }}
          >
            ✕
          </button>

          {/* Navigation buttons */}
          <button
            onClick={() => navigateImage(-1, selectedImage.index - 1, selectedImage.total, selectedImage.bookingId)}
            style={{
              position: 'absolute',
              left: '20px',
              top: '50%',
              transform: 'translateY(-50%)',
              backgroundColor: 'rgba(255, 255, 255, 0.2)',
              border: 'none',
              color: 'white',
              fontSize: '2rem',
              padding: '10px 15px',
              borderRadius: '50%',
              cursor: 'pointer',
              zIndex: 1001
            }}
          >
            ‹
          </button>

          <button
            onClick={() => navigateImage(1, selectedImage.index - 1, selectedImage.total, selectedImage.bookingId)}
            style={{
              position: 'absolute',
              right: '20px',
              top: '50%',
              transform: 'translateY(-50%)',
              backgroundColor: 'rgba(255, 255, 255, 0.2)',
              border: 'none',
              color: 'white',
              fontSize: '2rem',
              padding: '10px 15px',
              borderRadius: '50%',
              cursor: 'pointer',
              zIndex: 1001
            }}
          >
            ›
          </button>

          {/* Image info */}
          <div style={{
            position: 'absolute',
            bottom: '-40px',
            left: 0,
            right: 0,
            color: 'white',
            textAlign: 'center',
            fontSize: '0.875rem'
          }}>
            Image {selectedImage.index} of {selectedImage.total} | {selectedImage.fileName}
          </div>

          {/* Main image */}
          <img
            src={selectedImage.secure_url}
            alt={`Booking image ${selectedImage.index}`}
            style={{
              maxWidth: '100%',
              maxHeight: '80vh',
              objectFit: 'contain',
              borderRadius: '4px'
            }}
          />

          {/* Action buttons */}
          <div style={{
            position: 'absolute',
            bottom: '-80px',
            left: 0,
            right: 0,
            display: 'flex',
            justifyContent: 'center',
            gap: '1rem',
            marginTop: '1rem'
          }}>
            <button
              onClick={() => {
                try {
                  // Create a safe filename
                  const safeFileName = selectedImage.fileName.replace(/[^a-z0-9.]/gi, '_').toLowerCase();
                  const fileName = `booking_image_${selectedImage.index}_${Date.now()}_${safeFileName}`;

                  const link = document.createElement('a');
                  link.href = selectedImage.secure_url;
                  link.download = fileName;
                  link.target = '_blank'; // Open in new tab as fallback
                  document.body.appendChild(link);
                  link.click();
                  document.body.removeChild(link);
                } catch (error) {
                  console.error('Download failed:', error);
                  // Fallback: Open image in new tab for manual save
                  window.open(selectedImage.secure_url, '_blank');
                  showMessage('Download initiated. If not starting, right-click image and "Save image as..."');
                }
              }}
              className="btn btn-success"
              style={{
                padding: '0.5rem 1rem',
                fontSize: '0.875rem'
              }}
            >
              Download
            </button>
            <button
              onClick={() => deleteBookingImage(selectedImage.bookingId, selectedImage.index - 1)}
              className="btn btn-danger"
              style={{
                padding: '0.5rem 1rem',
                fontSize: '0.875rem'
              }}
            >
              Delete
            </button>
          </div>
        </div>
      </div>
    );
  };

  // Admin View
  if (isAdmin) {
    return (
      <div className="fade-in">
        {/* Image Modal */}
        <ImageModal />

        <div className="card">
          <div className="card-header">
            <h3>All Bookings & Schedule Management</h3>
            <p>View and manage all customer bookings, schedules, and rental items</p>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', marginTop: '1rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <label style={{ margin: 0, whiteSpace: 'nowrap' }}>Filter by Status:</label>
                  <select
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value)}
                    className="form-select"
                    style={{ width: 'auto' }}
                  >
                    <option value="all">All Statuses</option>
                    <option value="pending">Pending</option>
                    <option value="active">Active</option>
                    <option value="completed">Completed</option>
                    <option value="cancelled">Cancelled</option>
                  </select>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <label style={{ margin: 0, whiteSpace: 'nowrap' }}>Payment Status:</label>
                  <select
                    value={paymentStatusFilter}
                    onChange={(e) => setPaymentStatusFilter(e.target.value)}
                    className="form-select"
                    style={{ width: 'auto' }}
                  >
                    <option value="all">All Payment Statuses</option>
                    <option value="payment_completed">Payment Completed</option>
                    <option value="payment_partially_completed">Payment Partially Completed</option>
                    <option value="no_payment_recorded">Reservation Paid (No Payment)</option>
                  </select>
                </div>
              </div>

              <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                <button onClick={loadBookings} className="btn btn-secondary">
                  Refresh Bookings
                </button>
                <button onClick={initializeInventoryTracking} className="btn btn-info">
                  Sync Inventory
                </button>
              </div>
            </div>
          </div>
          <div className="card-body">
            {loading ? (
              <div className="loading-container">
                <div className="spinner"></div>
                <p>Loading bookings...</p>
              </div>
            ) : error ? (
              <div className="empty-state">
                <h3>Error Loading Bookings</h3>
                <p>{error}</p>
                <button onClick={loadBookings} className="btn btn-primary">
                  Try Again
                </button>
              </div>
            ) : sortedBookings.length === 0 ? (
              <div className="empty-state">
                <h3>No Bookings Found</h3>
                {(statusFilter !== 'all' || paymentStatusFilter !== 'all') && (
                  <button
                    onClick={() => {
                      setStatusFilter('all');
                      setPaymentStatusFilter('all');
                    }}
                    className="btn btn-primary"
                  >
                    Show All Bookings
                  </button>
                )}
              </div>
            ) : (
              <div className="bookings-folder-view">
                {sortedBookings.map((booking) => {
                  const status = getStatus(booking);
                  const paymentStatus = getPaymentStatus(booking);
                  const duration = calculateDuration(booking);
                  const totalAmount = calculateTotalAmount(booking);
                  const amountPaid = calculateAmountPaid(booking);
                  const balance = calculateBalance(booking);
                  const fullyPaid = isFullyPaid(booking);
                  const partiallyPaid = isPartiallyPaid(booking);
                  const noPayment = isNoPayment(booking);
                  const paymentCompleted = isPaymentCompleted(booking);
                  const inventoryAvailability = checkBookingInventoryAvailability(booking);

                  return (
                    <div key={booking.id} className="booking-folder">
                      <div
                        className="booking-folder-header"
                        onClick={() => toggleBookingFolder(booking.id)}
                        style={{ cursor: 'pointer' }}
                      >
                        <div className="folder-info">
                          <div className="folder-details">
                            <h4>{booking.name || booking.userName} - {booking.venue}</h4>
                            <div className="folder-meta">
                              <span>{booking.startDate} to {booking.endDate} ({duration} days)</span>
                              <span>Total: ₱{totalAmount.toLocaleString()}</span>
                              <span>Paid: ₱{amountPaid.toLocaleString()}</span>
                              <span>Balance: ₱{balance.toLocaleString()}</span>
                              {booking.uploadedImages && booking.uploadedImages.length > 0 && (
                                <span style={{ color: '#17a2b8' }}>
                                  📸 {booking.uploadedImages.length} image(s)
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                        <div className="folder-actions">
                          <BookingStatusBadge status={status} />
                          <PaymentStatusBadge status={paymentStatus} />
                          <span className="expand-icon">
                            {expandedBookings[booking.id] ? '▼' : '►'}
                          </span>
                        </div>
                      </div>

                      {expandedBookings[booking.id] && (
                        <div className="booking-folder-content">
                          {/* Inventory Availability Section */}
                          {inventoryAvailability.length > 0 && (
                            <div className="inventory-availability-section" style={{ 
                              marginBottom: '1.5rem', 
                              padding: '1rem', 
                              backgroundColor: '#f8f9fa', 
                              borderRadius: '8px',
                              border: '1px solid #dee2e6'
                            }}>
                              <h5>📦 Inventory Availability</h5>
                              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '1rem', marginTop: '1rem' }}>
                                {inventoryAvailability.map((item, index) => (
                                  <div key={index} style={{
                                    padding: '0.75rem',
                                    backgroundColor: item.hasEnough ? '#d4edda' : '#f8d7da',
                                    border: `1px solid ${item.hasEnough ? '#c3e6cb' : '#f5c6cb'}`,
                                    borderRadius: '4px'
                                  }}>
                                    <div style={{ fontWeight: 'bold', marginBottom: '0.25rem' }}>{item.name}</div>
                                    <div style={{ fontSize: '0.875rem' }}>
                                      <div>Required: {item.required}</div>
                                      <div>Available: {item.available}</div>
                                      <div>Reserved: {item.reserved}</div>
                                      <div>Total: {item.total}</div>
                                    </div>
                                    <div style={{ 
                                      marginTop: '0.5rem', 
                                      fontSize: '0.75rem', 
                                      fontWeight: 'bold',
                                      color: item.hasEnough ? '#155724' : '#721c24'
                                    }}>
                                      {item.hasEnough ? '✅ Sufficient Inventory' : '❌ Insufficient Inventory'}
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}

                          <div className="grid grid-cols-2" style={{ gap: '2rem', marginBottom: '1.5rem' }}>
                            <div>
                              <h5>Customer Information</h5>
                              <div className="info-grid">
                                <div className="info-item">
                                  <strong>Name:</strong> {booking.name || booking.userName}
                                </div>
                                <div className="info-item">
                                  <strong>Email:</strong> {booking.email || booking.userEmail}
                                </div>
                                <div className="info-item">
                                  <strong>Contact:</strong> {booking.contact}
                                </div>
                                <div className="info-item">
                                  <strong>Venue:</strong> {booking.venue}
                                </div>
                                {booking.userId && (
                                  <div className="info-item">
                                    <strong>User ID:</strong> {booking.userId}
                                  </div>
                                )}
                              </div>
                            </div>

                            <div>
                              <h5>Booking Details</h5>
                              <div className="info-grid">
                                <div className="info-item">
                                  <strong>Start Date:</strong> {booking.startDate}
                                </div>
                                <div className="info-item">
                                  <strong>End Date:</strong> {booking.endDate}
                                </div>
                                <div className="info-item">
                                  <strong>Duration:</strong> {duration} days
                                </div>
                                <div className="info-item">
                                  <strong>Booked On:</strong> {new Date(booking.timestamp).toLocaleDateString()}
                                </div>
                                {booking.updatedAt && (
                                  <div className="info-item">
                                    <strong>Last Updated:</strong> {new Date(booking.updatedAt).toLocaleDateString()}
                                  </div>
                                )}
                                <div className="info-item">
                                  <strong>Status:</strong> <BookingStatusBadge status={status} />
                                </div>
                                <div className="info-item">
                                  <strong>Payment Status:</strong> <PaymentStatusBadge status={paymentStatus} />
                                </div>
                              </div>
                            </div>
                          </div>

                          <div className="payment-summary-section" style={{ marginBottom: '1.5rem', padding: '1rem', backgroundColor: '#f8f9fa', borderRadius: '8px' }}>
                            <h5>Payment Summary</h5>
                            <div className="grid grid-cols-3" style={{ gap: '1rem' }}>
                              <div className="payment-item" style={{ textAlign: 'center' }}>
                                <div style={{ fontSize: '0.875rem', color: '#6c757d' }}>Total Amount</div>
                                <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#343a40' }}>
                                  ₱{totalAmount.toLocaleString()}
                                </div>
                              </div>
                              <div className="payment-item" style={{ textAlign: 'center' }}>
                                <div style={{ fontSize: '0.875rem', color: '#6c757d' }}>Amount Paid</div>
                                <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: amountPaid > 0 ? '#28a745' : '#dc3545' }}>
                                  ₱{amountPaid.toLocaleString()}
                                </div>
                              </div>
                              <div className="payment-item" style={{ textAlign: 'center' }}>
                                <div style={{ fontSize: '0.875rem', color: '#6c757d' }}>Balance</div>
                                <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: balance === 0 ? '#28a745' : balance > 0 ? '#ffc107' : '#dc3545' }}>
                                  ₱{balance.toLocaleString()}
                                </div>
                              </div>
                              {booking.paymentDetails.paymentHistory && booking.paymentDetails.paymentHistory.length > 0 && (
                                <div style={{ marginTop: '0.5rem' }}>
                                  <strong>Payment History:</strong>
                                  {booking.paymentDetails.paymentHistory.map((payment, index) => (
                                    <div key={index} style={{
                                      fontSize: '0.75rem',
                                      padding: '0.25rem',
                                      borderBottom: '1px solid #dee2e6',
                                      color: payment.type === 'refund' ? '#dc3545' : '#28a745'
                                    }}>
                                      {payment.type === 'refund' ? 'Refund: -₱' : 'Payment: ₱'}{Math.abs(payment.amount).toLocaleString()} - {new Date(payment.date).toLocaleDateString()} - {getPaymentStatusText(payment.status)}
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          </div>

                          {/* Uploaded Images Section */}
                          {booking.uploadedImages && booking.uploadedImages.length > 0 && (
                            <div className="uploaded-images-section" style={{ marginBottom: '1.5rem' }}>
                              <h5>Uploaded Images by Customer ({booking.uploadedImages.length})</h5>
                              <p style={{ fontSize: '0.875rem', color: '#6c757d', marginBottom: '1rem' }}>
                                Images uploaded by the customer for this booking
                              </p>
                              <div className="uploaded-images-grid" style={{
                                display: 'grid',
                                gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))',
                                gap: '1rem',
                                marginBottom: '1rem'
                              }}>
                                {booking.uploadedImages.map((image, index) => (
                                  <div key={index} className="uploaded-image-card" style={{
                                    border: '1px solid #dee2e6',
                                    borderRadius: '8px',
                                    padding: '1rem',
                                    backgroundColor: '#f8f9fa',
                                    position: 'relative'
                                  }}>
                                    <div style={{
                                      height: '180px',
                                      overflow: 'hidden',
                                      borderRadius: '4px',
                                      marginBottom: '0.5rem',
                                      position: 'relative'
                                    }}>
                                      <img
                                        src={image.thumbnailUrl || image.secure_url}
                                        alt={`Booking image ${index + 1}`}
                                        style={{
                                          width: '100%',
                                          height: '100%',
                                          objectFit: 'cover',
                                          transition: 'transform 0.3s ease'
                                        }}
                                        onMouseEnter={(e) => e.currentTarget.style.transform = 'scale(1.05)'}
                                        onMouseLeave={(e) => e.currentTarget.style.transform = 'scale(1)'}
                                      />
                                    </div>

                                    <div style={{ fontSize: '0.875rem', marginBottom: '0.25rem' }}>
                                      <strong>File:</strong> {image.fileName}
                                    </div>
                                    <div style={{ fontSize: '0.75rem', color: '#6c757d', marginBottom: '0.25rem' }}>
                                      <strong>Uploaded:</strong> {new Date(image.uploadedAt).toLocaleDateString()} by {image.uploadedBy || 'Customer'}
                                    </div>
                                    <div style={{ fontSize: '0.75rem', color: '#6c757d', marginBottom: '1rem' }}>
                                      <strong>Size:</strong> {(image.fileSize / 1024 / 1024).toFixed(2)} MB
                                    </div>

                                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                                      <button
                                        onClick={() => {
                                          setSelectedImage({
                                            ...image,
                                            index: index + 1,
                                            total: booking.uploadedImages.length,
                                            bookingId: booking.id
                                          });
                                          setImageModalOpen(true);
                                        }}
                                        className="btn btn-primary btn-sm"
                                        style={{
                                          flex: 1,
                                          padding: '0.375rem 0.75rem',
                                          display: 'flex',
                                          justifyContent: 'center',
                                          alignItems: 'center'
                                        }}
                                      >
                                        View Full
                                      </button>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}

                          <div className="booked-items-section">
                            <h5>Booked Items</h5>
                            {booking.package ? (
                              <div className="items-grid">
                                <div className="item-card">
                                  <div className="item-info">
                                    <h6>{booking.package.name}</h6>
                                    <span className="item-category">Package</span>
                                  </div>
                                  <div className="item-details">
                                    <span className="item-price">₱{booking.package.price?.toLocaleString()} per day</span><br></br>
                                    <span className="item-calculation">
                                      {duration} days
                                    </span>
                                  </div>
                                </div>
                                {booking.package.items && booking.package.items.length > 0 && (
                                  <div style={{ marginTop: '1rem', padding: '1rem', backgroundColor: '#f8f9fa', borderRadius: '4px' }}>
                                    <h6 style={{ marginBottom: '0.5rem' }}>Package Includes:</h6>
                                    {booking.package.items.map((item, index) => (
                                      <div key={index} style={{ display: 'flex', justifyContent: 'space-between', padding: '0.25rem 0' }}>
                                        <span>{item.name}</span>
                                        <span>Qty: {item.quantity || 1}</span>
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </div>
                            ) : booking.items && booking.items.length > 0 ? (
                              <div className="items-grid">
                                {booking.items.map((item, index) => {
                                  const unitPrice = getUnitPrice(item);
                                  const quantity = item.quantity || 1;
                                  const itemTotal = calculateItemTotal(item, duration);

                                  return (
                                    <div key={index} className="item-card">
                                      <div className="item-info">
                                        <h6>{item.name}</h6>
                                        <span className="item-category">{item.category || 'Rental Item'}</span>
                                      </div>
                                      <div className="item-details">
                                        <span className="item-quantity">Qty: {quantity}</span><br></br>
                                        <span className="item-price">₱{unitPrice.toLocaleString()} per day</span><br></br>
                                        <span className="item-calculation">
                                          {quantity} × ₱{unitPrice.toLocaleString()} × {duration} days
                                        </span><br></br>
                                        <span className="item-total">
                                          <strong>Item Total: ₱{itemTotal.toLocaleString()}</strong>
                                        </span>
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            ) : (
                              <p>No items found in this booking.</p>
                            )}
                            <div className="booking-total" style={{ marginTop: '1rem', padding: '1rem', backgroundColor: '#e9ecef', borderRadius: '4px' }}>
                              <strong>Total Amount: ₱{totalAmount.toLocaleString()}</strong>
                              <div style={{ fontSize: '0.875rem', color: '#6c757d', marginTop: '0.25rem' }}>
                              </div>
                            </div>
                          </div>

                          {/* Status Change Section */}
                          <div className="status-change-section">
                            <h5>Update Booking Status</h5>
                            <div className="status-buttons" style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '1rem' }}>
                              <button
                                className={`btn ${status === 'pending' ? 'btn-primary' : 'btn-outline'}`}
                                onClick={() => updateBookingStatus(booking.id, 'pending')}
                                disabled={status === 'pending' || status === 'active' || status === 'completed' || status === 'cancelled'}
                                style={{ fontSize: '0.875rem', padding: '0.5rem 1rem' }}
                              >
                                Mark as Pending
                              </button>
                              <button
                                className={`btn ${status === 'active' ? 'btn-success' : 'btn-outline'}`}
                                onClick={() => updateBookingStatus(booking.id, 'active')}
                                disabled={status === 'active' || status === 'completed' || status === 'cancelled'}
                                style={{ fontSize: '0.875rem', padding: '0.5rem 1rem' }}
                              >
                                Mark as Active
                              </button>
                              <button
                                className={`btn ${status === 'completed' ? 'btn-secondary' : 'btn-outline'}`}
                                onClick={() => updateBookingStatus(booking.id, 'completed')}
                                disabled={status === 'completed' || status === 'cancelled'}
                                style={{ fontSize: '0.875rem', padding: '0.5rem 1rem' }}
                              >
                                Mark as Completed
                              </button>
                              <button
                                className={`btn ${status === 'cancelled' ? 'btn-danger' : 'btn-outline'}`}
                                onClick={() => updateBookingStatus(booking.id, 'cancelled')}
                                disabled={status === 'cancelled' || status === 'completed'}
                                style={{ fontSize: '0.875rem', padding: '0.5rem 1rem' }}
                              >
                                Mark as Cancelled
                              </button>
                            </div>

                            <h5>Update Payment Status</h5>
                            <div className="payment-status-buttons" style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
                              <button
                                className={`btn ${balance > 0 && !paymentCompleted ? 'btn-warning' : 'btn-outline-warning'}`}
                                onClick={() => processPartialPayment(booking)}
                                disabled={paymentCompleted || fullyPaid}
                                style={{ fontSize: '0.875rem', padding: '0.5rem 1rem' }}
                                title={paymentCompleted ? "Payment already completed" : fullyPaid ? "Already fully paid" : "Add a partial payment"}
                              >
                                Add Partial Payment
                              </button>
                              <button
                                className={`btn ${balance > 0 && !paymentCompleted ? 'btn-success' : 'btn-outline-success'}`}
                                onClick={() => processPaymentCompletion(booking)}
                                disabled={paymentCompleted || fullyPaid}
                                style={{ fontSize: '0.875rem', padding: '0.5rem 1rem' }}
                                title={paymentCompleted ? "Payment already completed" : fullyPaid ? "Already fully paid" : "Mark payment as fully completed"}
                              >
                                Mark Payment as Completed
                              </button>
                              <button
                                className="btn btn-info"
                                onClick={() => processRefund(booking)}
                                disabled={calculateAmountPaid(booking) <= 0}
                                style={{
                                  fontSize: '0.875rem',
                                  padding: '0.5rem 1rem',
                                  backgroundColor: calculateAmountPaid(booking) <= 0 ? '#6c757d' : '#17a2b8',
                                  borderColor: calculateAmountPaid(booking) <= 0 ? '#6c757d' : '#17a2b8'
                                }}
                                title={calculateAmountPaid(booking) <= 0 ? "No payment to refund" : "Process a refund"}
                              >
                                Process Refund
                              </button>
                            </div>
                          </div>

                          <div className="booking-actions">
                            <button
                              className="btn btn-secondary"
                              onClick={() => toggleBookingFolder(booking.id)}
                            >
                              Close
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  // Regular User View (for non-admin users - not typically used for this component)
  return (
    <div className="fade-in">
      <div className="card">
        <div className="card-header">
          <h3>Admin Access Required</h3>
          <p>You need administrator privileges to access this panel.</p>
          <button
            onClick={() => navigate('/dashboard')}
            className="btn btn-primary"
          >
            Return to Dashboard
          </button>
        </div>
      </div>
    </div>
  );
};

export default AdminBookingPanel;