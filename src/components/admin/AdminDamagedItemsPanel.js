// DamagedItemsPanel.js - UPDATED VERSION WITH BOOKING-SPECIFIC ITEMS AND INVENTORY
import React, { useState, useEffect } from 'react';
import { useApp } from '../../context/AppContext';
import { collection, query, where, getDocs, orderBy, getFirestore, updateDoc, doc } from 'firebase/firestore';
import { db } from '../../utils/firebase';
import emailjs from '@emailjs/browser';
import { firebaseService } from '../../services/firebaseService';

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

const AdminDamagedItemsPanel = () => {
  const {
    rentalItems,
    damageReports,
    reportDamage,
    updateDamageStatus,
    deleteDamageReport,
    loadingDamagedItems
  } = useApp();

  const [selectedCategory, setSelectedCategory] = useState('all');
  const [bookings, setBookings] = useState([]);
  const [selectedBooking, setSelectedBooking] = useState(null);
  const [newDamageReport, setNewDamageReport] = useState({
    itemId: '',
    itemName: '',
    description: '',
    severity: 'low',
    estimatedRepairCost: 0,
    estimatedRepairTime: '',
    reportedBy: 'admin',
    reportedAt: new Date().toISOString().split('T')[0],
    customerEmail: '',
    customerName: '',
    rentalId: '',
    penaltyFee: 0
  });
  const [showWriteOffModal, setShowWriteOffModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [selectedReport, setSelectedReport] = useState(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [loadingBookings, setLoadingBookings] = useState(false);
  const [emailConfig, setEmailConfig] = useState({
    enabled: true,
    sendToCustomer: true
  });
  const [allInventoryItems, setAllInventoryItems] = useState([]);
  const [loadingInventory, setLoadingInventory] = useState(false);
  // NEW STATE: Items from the selected booking
  const [bookingItems, setBookingItems] = useState([]);
  // NEW STATE: For refreshing damage reports
  const [refreshingReports, setRefreshingReports] = useState(false);

  const EMAILJS_PUBLIC_KEY = 'VZ3ZR1YRXGqSKbkSi';
  const EMAILJS_SERVICE_ID = 'service_gxti7fo';
  const EMAILJS_TEMPLATE_ID = 'template_bgxwbl3';

  const getItemType = (itemName) => {
    if (!itemName) return 'Rental Equipment';

    const lowerName = itemName.toLowerCase();
    if (lowerName.includes('camera')) return 'Camera';
    if (lowerName.includes('tripod')) return 'Tripod';
    if (lowerName.includes('lens')) return 'Lens';
    if (lowerName.includes('microphone') || lowerName.includes('comset')) return 'Audio Equipment';
    if (lowerName.includes('light')) return 'Lighting Equipment';
    if (lowerName.includes('monitor')) return 'Monitor';
    if (lowerName.includes('switcher')) return 'Video Switcher';
    if (lowerName.includes('dolly')) return 'Camera Dolly';

    return 'Rental Equipment';
  };

  useEffect(() => {
    emailjs.init(EMAILJS_PUBLIC_KEY);
    loadActiveBookings();
    loadAllInventoryItems();
  }, []);

  // Load all inventory items (predefined + user-added)
  const loadAllInventoryItems = async () => {
    try {
      setLoadingInventory(true);

      // Combine predefined rental items with user-added inventory items
      let combinedItems = [...rentalItems];

      // Load user-added inventory items from Firebase
      try {
        // Method 1: Load from main inventory document
        const inventoryResult = await firebaseService.getInventoryItems();
        if (inventoryResult.success && inventoryResult.inventoryItems.length > 0) {
          console.log('✅ Loaded', inventoryResult.inventoryItems.length, 'items from main inventory');
          combinedItems = [...combinedItems, ...inventoryResult.inventoryItems];
        } else {
          // Method 2: Load from inventoryItems collection
          const collectionResult = await firebaseService.getAllInventoryItems();
          if (collectionResult.success && collectionResult.items.length > 0) {
            console.log('✅ Loaded', collectionResult.items.length, 'items from collection');
            combinedItems = [...combinedItems, ...collectionResult.items];
          } else {
            // Method 3: Load from localStorage as fallback
            const savedInventoryItems = localStorage.getItem('rentalItems');
            if (savedInventoryItems) {
              const inventoryItems = JSON.parse(savedInventoryItems);
              console.log('✅ Loaded', inventoryItems.length, 'items from localStorage');
              combinedItems = [...combinedItems, ...inventoryItems];
            }
          }
        }
      } catch (firebaseError) {
        console.error('Error loading from Firebase, using localStorage:', firebaseError);
        // Fallback to localStorage
        const savedInventoryItems = localStorage.getItem('rentalItems');
        if (savedInventoryItems) {
          const inventoryItems = JSON.parse(savedInventoryItems);
          combinedItems = [...combinedItems, ...inventoryItems];
        }
      }

      // Remove duplicates based on item id
      const uniqueItems = combinedItems.reduce((acc, current) => {
        const x = acc.find(item => item.id === current.id);
        if (!x) {
          acc.push(current);
        }
        return acc;
      }, []);

      console.log('Total inventory items:', uniqueItems.length);
      setAllInventoryItems(uniqueItems);

    } catch (error) {
      console.error('Error loading inventory items:', error);
      // Fallback to just rentalItems if there's an error
      setAllInventoryItems(rentalItems);
    } finally {
      setLoadingInventory(false);
    }
  };

  const loadActiveBookings = async () => {
    try {
      setLoadingBookings(true);

      let bookingsData = [];

      try {
        const q = query(
          collection(db, "bookings"),
          where("status", "in", ["active", "upcoming", "pending"]),
          orderBy("timestamp", "desc")
        );
        const querySnapshot = await getDocs(q);
        querySnapshot.forEach((doc) => {
          bookingsData.push({
            id: doc.id,
            ...doc.data()
          });
        });
      } catch (queryError) {
        const q = query(collection(db, "bookings"), orderBy("timestamp", "desc"));
        const querySnapshot = await getDocs(q);
        querySnapshot.forEach((doc) => {
          const bookingData = {
            id: doc.id,
            ...doc.data()
          };

          const status = bookingData.status ||
            (new Date(bookingData.startDate) > new Date() ? 'upcoming' :
              new Date(bookingData.endDate) < new Date() ? 'completed' : 'active');

          if (['active', 'upcoming', 'pending'].includes(status)) {
            bookingsData.push(bookingData);
          }
        });
      }

      setBookings(bookingsData);

    } catch (error) {
      showMessage('Error loading bookings data: ' + error.message);
    } finally {
      setLoadingBookings(false);
    }
  };

  // Function to refresh damage reports (refreshes everything)
  const refreshDamageReports = async () => {
    setRefreshingReports(true);
    try {
      // Reload the page to refresh all data
      window.location.reload();
      
      // Show success message (though page will reload)
      showMessage('Refreshing all data...', 'success');
    } catch (error) {
      showMessage('Error refreshing data: ' + error.message, 'error');
      setRefreshingReports(false);
    }
  };

  // NEW FUNCTION: Extract items from selected booking
  const extractBookingItems = (booking) => {
    if (!booking) {
      setBookingItems([]);
      return;
    }

    const items = [];

    // Check for items in bookingDetails array
    if (booking.bookingDetails && Array.isArray(booking.bookingDetails)) {
      booking.bookingDetails.forEach(detail => {
        if (detail.item) {
          items.push({
            id: detail.item.id || detail.item.itemId || `item-${Date.now()}`,
            name: detail.item.name || detail.item.itemName || 'Unknown Item',
            quantity: detail.quantity || 1,
            category: detail.item.category || 'uncategorized',
            // Add any other relevant item properties
          });
        }
      });
    }

    // Also check for items directly in the booking object
    if (booking.items && Array.isArray(booking.items)) {
      booking.items.forEach(item => {
        items.push({
          id: item.id || item.itemId || `item-${Date.now()}`,
          name: item.name || item.itemName || 'Unknown Item',
          quantity: item.quantity || 1,
          category: item.category || 'uncategorized',
        });
      });
    }

    // If no structured items found, check for rentalItems
    if (booking.rentalItems && Array.isArray(booking.rentalItems)) {
      booking.rentalItems.forEach(item => {
        items.push({
          id: item.id || item.itemId || `item-${Date.now()}`,
          name: item.name || item.itemName || 'Unknown Item',
          quantity: item.quantity || 1,
          category: item.category || 'uncategorized',
        });
      });
    }

    // Remove duplicates based on item id
    const uniqueItems = items.reduce((acc, current) => {
      const x = acc.find(item => item.id === current.id);
      if (!x) {
        acc.push(current);
      }
      return acc;
    }, []);

    console.log('Extracted booking items:', uniqueItems);
    setBookingItems(uniqueItems);
  };

  const handleBookingSelect = (bookingId) => {
    const selected = bookings.find(booking => booking.id === bookingId);
    if (selected) {
      setSelectedBooking(selected);
      setNewDamageReport(prev => ({
        ...prev,
        customerName: selected.name || selected.userName,
        customerEmail: selected.email || selected.userEmail,
        rentalId: selected.id
      }));

      // Extract items from the selected booking
      extractBookingItems(selected);
    }
  };

  // Update the handleItemSelect function to better match items
  const handleItemSelect = (itemId) => {
    // Find the item in booking items
    const selectedBookingItem = bookingItems.find(item => item.id === itemId);
    if (selectedBookingItem) {
      // Try to find the matching item in allInventoryItems
      const matchingInventoryItem = allInventoryItems.find(inventoryItem => {
        // Try multiple matching strategies
        return inventoryItem.id === selectedBookingItem.id ||
          inventoryItem.name.toLowerCase() === selectedBookingItem.name.toLowerCase() ||
          inventoryItem.itemId === selectedBookingItem.id;
      });

      if (matchingInventoryItem) {
        setNewDamageReport({
          ...newDamageReport,
          itemId: matchingInventoryItem.id, // Use the inventory item ID
          itemName: selectedBookingItem.name
        });
      } else {
        // If no exact match, use the booking item info
        setNewDamageReport({
          ...newDamageReport,
          itemId: selectedBookingItem.id,
          itemName: selectedBookingItem.name
        });
      }
    }
  };

  const sendDamageEmailNotification = async (reportData) => {
    if (!emailConfig.enabled || !emailConfig.sendToCustomer) {
      return { success: true, skipped: true };
    }

    try {
      const customerEmail = reportData.customerEmail;

      if (!customerEmail) {
        return { success: false, error: 'No customer email available' };
      }

      if (customerEmail === 'capstonemaking@gmail.com') {
        return { success: false, error: 'Customer email cannot be the service email' };
      }

      const dueDate = new Date();
      dueDate.setDate(dueDate.getDate() + 7);

      const templateParams = {
        to_email: customerEmail,
        to_name: reportData.customerName || 'Valued Customer',
        from_name: 'RP Media Services',
        from_email: 'capstonemaking@gmail.com',
        reply_to: 'capstonemaking@gmail.com',

        customer_name: reportData.customerName || 'Valued Customer',
        customer_email: customerEmail,
        rental_id: reportData.rentalId || 'N/A',
        venue: selectedBooking?.venue || 'Not specified',
        rental_date: selectedBooking?.startDate || 'N/A',
        return_date: selectedBooking?.endDate || 'N/A',
        item_name: reportData.itemName,
        item_type: getItemType(reportData.itemName),
        damage_severity: reportData.severity,
        damage_description: reportData.description,
        repair_cost: `₱${parseFloat(reportData.estimatedRepairCost || 0).toLocaleString()}`,
        penalty_fee: `₱${parseFloat(reportData.penaltyFee || 0).toLocaleString()}`,
        total_amount: `₱${parseFloat((reportData.estimatedRepairCost || 0) + (reportData.penaltyFee || 0)).toLocaleString()}`,
        due_date: dueDate.toISOString().split('T')[0],
        payment_instructions: 'Please settle the amount within 7 days via bank transfer or credit card.',
        company_name: 'RP Media Services',
        contact_email: 'capstonemaking@gmail.com',
        contact_phone: '+63-912-345-6789',
        report_date: new Date().toLocaleDateString(),
        notification_date: new Date().toLocaleDateString(),

        subject: `Rental Equipment Damage Report - ${reportData.itemName}`,
        message: `Damage report notification for ${reportData.itemName}`
      };

      const result = await emailjs.send(
        EMAILJS_SERVICE_ID,
        EMAILJS_TEMPLATE_ID,
        templateParams,
        EMAILJS_PUBLIC_KEY
      );

      return {
        success: true,
        message: `Transactional email sent from RP Media Services to customer: ${customerEmail}`,
        status: result.status,
        email: customerEmail
      };

    } catch (error) {
      return {
        success: false,
        error: error.text || error.message,
        status: error.status,
        details: 'Check Mailjet service configuration and sender verification'
      };
    }
  };

  // Update item quantity when marking as damaged
  // In DamagedItemsPanel.js - UPDATED updateItemQuantity function
  const updateItemQuantity = async (itemId, quantityChange) => {
    try {
      console.log(`Updating item ${itemId} quantity by ${quantityChange}`);

      // First, try to find the item by exact ID
      let itemToUpdate = allInventoryItems.find(item => item.id === itemId);

      // If not found by ID, try to find by name
      if (!itemToUpdate) {
        console.log(`Item ${itemId} not found by ID, trying to find by name...`);

        // Get the item name from the newDamageReport
        const itemName = newDamageReport.itemName;
        if (itemName) {
          itemToUpdate = allInventoryItems.find(item =>
            item.name.toLowerCase() === itemName.toLowerCase()
          );
        }
      }

      // If still not found, try to find by alternative ID fields
      if (!itemToUpdate) {
        console.log('Trying to find item by alternative ID fields...');
        itemToUpdate = allInventoryItems.find(item =>
          item.itemId === itemId || item.customId === itemId || item.firebaseId === itemId
        );
      }

      if (!itemToUpdate) {
        console.error(`Item ${itemId} not found in inventory. Available items:`, allInventoryItems.map(item => ({ id: item.id, name: item.name })));
        return false;
      }

      // Parse quantities as numbers to ensure proper arithmetic
      const currentQuantity = parseInt(itemToUpdate.availableQuantity) || 0;
      const newQuantity = Math.max(0, currentQuantity + quantityChange);

      console.log(`Updating ${itemToUpdate.name}: ${currentQuantity} -> ${newQuantity}`);

      // Update local state ONLY ONCE
      setAllInventoryItems(prev =>
        prev.map(item =>
          item.id === itemToUpdate.id
            ? {
              ...item,
              availableQuantity: newQuantity,
              // Ensure reservedQuantity is maintained
              reservedQuantity: item.reservedQuantity || 0
            }
            : item
        )
      );

      // Update in Firebase if it's a user-added item - SIMPLIFIED VERSION
      try {
        // Check if it's a predefined rental item
        const isPredefined = rentalItems.some(item => item.id === itemToUpdate.id);

        if (!isPredefined) {
          // It's a user-added item, update in Firebase inventory
          console.log('Updating user-added item in Firebase inventory:', itemToUpdate.name);

          // Get current inventory from Firebase
          const inventoryResult = await firebaseService.getInventoryItems();
          if (inventoryResult.success) {
            const currentItems = inventoryResult.inventoryItems || [];

            // Find the item to update
            const itemIndex = currentItems.findIndex(item => item.id === itemToUpdate.id);

            if (itemIndex !== -1) {
              // Update the specific item
              const updatedItems = [...currentItems];
              updatedItems[itemIndex] = {
                ...updatedItems[itemIndex],
                availableQuantity: newQuantity,
                updatedAt: new Date().toISOString()
              };

              // Save updated inventory back to Firebase
              await firebaseService.saveInventoryItems(updatedItems);
              console.log('✅ Updated Firebase inventory');
            } else {
              console.log('Item not found in Firebase inventory, trying collection...');

              // Try to update in inventoryItems collection
              const itemsResult = await firebaseService.getInventoryItemsByCustomId(itemToUpdate.id);
              if (itemsResult.success && itemsResult.items.length > 0) {
                const firebaseId = itemsResult.items[0].firebaseId;
                await firebaseService.updateInventoryItem(firebaseId, {
                  ...itemsResult.items[0],
                  availableQuantity: newQuantity,
                  updatedAt: new Date().toISOString()
                });
                console.log('✅ Updated inventoryItems collection');
              }
            }
          }

          // Update localStorage as backup
          const savedItems = localStorage.getItem('rentalItems');
          if (savedItems) {
            const items = JSON.parse(savedItems);
            const updatedItems = items.map(item =>
              item.id === itemToUpdate.id
                ? {
                  ...item,
                  availableQuantity: newQuantity,
                  reservedQuantity: item.reservedQuantity || 0
                }
                : item
            );
            localStorage.setItem('rentalItems', JSON.stringify(updatedItems));
            console.log('✅ Updated localStorage');
          }
        } else {
          // For predefined items, update in the rentalItems system
          console.log('Updating predefined rental item:', itemToUpdate.name);
          // Update Firebase rental items
          const updatedRentalItems = rentalItems.map(item =>
            item.id === itemToUpdate.id
              ? {
                ...item,
                availableQuantity: newQuantity,
                reservedQuantity: item.reservedQuantity || 0
              }
              : item
          );

          await firebaseService.saveRentalItems(updatedRentalItems);
          console.log('✅ Updated Firebase rental items');
        }

        return true;
      } catch (firebaseError) {
        console.error('Error updating in Firebase:', firebaseError);
        // Update localStorage as fallback
        const savedItems = localStorage.getItem('rentalItems');
        if (savedItems) {
          const items = JSON.parse(savedItems);
          const updatedItems = items.map(item =>
            item.id === itemToUpdate.id
              ? {
                ...item,
                availableQuantity: newQuantity,
                reservedQuantity: item.reservedQuantity || 0
              }
              : item
          );
          localStorage.setItem('rentalItems', JSON.stringify(updatedItems));
        }
        return true;
      }
    } catch (error) {
      console.error('Error updating item quantity:', error);
      return false;
    }
  };

  const handleSubmitDamageReport = async (e) => {
    e.preventDefault();
    setActionLoading(true);

    try {
      // First, update the item quantity (reduce by 1) - ONLY ONCE
      const quantityUpdated = await updateItemQuantity(newDamageReport.itemId, -1);

      if (!quantityUpdated) {
        showMessage('Failed to update item quantity. Please try again.');
        setActionLoading(false);
        return;
      }

      // Then, create the damage report - SIMPLIFIED VERSION
      const report = {
        ...newDamageReport,
        status: 'damaged',
        repairCost: 0,
        repairedAt: null,
        createdAt: new Date().toISOString()
      };

      // Save damage report to Firebase - ONLY ONCE
      const result = await firebaseService.saveDamageReport(report);

      if (result.success) {
        let emailSuccess = true;
        let emailMessage = '';

        if (emailConfig.enabled && emailConfig.sendToCustomer && newDamageReport.customerEmail) {
          const emailResult = await sendDamageEmailNotification(newDamageReport);
          if (emailResult.success) {
            emailMessage = `Mailjet email sent to ${newDamageReport.customerEmail}`;
          } else {
            emailSuccess = false;
            emailMessage = `But Mailjet email failed: ${emailResult.error}`;
          }
        }

        // Reset form
        setNewDamageReport({
          itemId: '',
          itemName: '',
          description: '',
          severity: 'low',
          estimatedRepairCost: 0,
          estimatedRepairTime: '',
          reportedBy: 'admin',
          reportedAt: new Date().toISOString().split('T')[0],
          customerEmail: '',
          customerName: '',
          rentalId: '',
          penaltyFee: 0
        });
        setSelectedBooking(null);
        setBookingItems([]);

        // Reload inventory to reflect changes - DO THIS ONLY ONCE
        await loadAllInventoryItems();

        if (emailSuccess && emailConfig.enabled && emailConfig.sendToCustomer) {
          showMessage(`Damage report submitted successfully! Item quantity updated. ${emailMessage}`);
        } else if (!emailSuccess) {
          showMessage(`Damage report submitted successfully! Item quantity updated. ${emailMessage}`);
        } else {
          showMessage('Damage report submitted successfully! Item quantity updated.');
        }
      } else {
        // If damage report failed, restore the item quantity
        await updateItemQuantity(newDamageReport.itemId, 1);
        showMessage(`Error: ${result.error}`);
      }
    } catch (error) {
      console.error('Error submitting damage report:', error);
      showMessage('Error submitting damage report. Please try again.');
    } finally {
      setActionLoading(false);
    }
  };
  
  // In handleRepairComplete, simplify:
  // Replace the entire handleRepairComplete function with:
const handleRepairComplete = async (report) => {
  // Remove the prompt - just use the estimated repair cost that was already entered
  const confirmRepair = window.confirm(`Mark "${report.itemName}" as repaired?`);
  
  if (confirmRepair) {
    setActionLoading(true);
    try {
      // Use the estimated repair cost that was already entered when reporting damage
      const actualCost = report.estimatedRepairCost || 0;
      
      const result = await updateDamageStatus(report.id, 'repaired', parseFloat(actualCost));
      if (!result.success) {
        showMessage(`Error: ${result.error}`, 'error');
      } else {
        // When item is repaired, restore its quantity
        await updateItemQuantity(report.itemId, 1);
        showMessage('Item marked as repaired successfully! Item quantity restored.', 'success');
      }
    } catch (error) {
      showMessage('Error updating repair status. Please try again.', 'error');
    } finally {
      setActionLoading(false);
    }
  }
};

  const handleStatusUpdate = async (reportId, newStatus) => {
    setActionLoading(true);
    try {
      const result = await updateDamageStatus(reportId, newStatus);
      if (!result.success) {
        showMessage(`Error: ${result.error}`);
      } else {
        showMessage(`Status updated to ${newStatus} successfully!`);
        await loadAllInventoryItems(); // Refresh inventory
      }
    } catch (error) {
      showMessage('Error updating status. Please try again.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleWriteOffConfirm = async () => {
    if (selectedReport) {
      setActionLoading(true);
      try {
        const result = await updateDamageStatus(selectedReport.id, 'written-off');
        if (result.success) {
          // When item is Deleted, it's permanently removed, so no quantity restoration
          setShowWriteOffModal(false);
          setSelectedReport(null);
          await loadAllInventoryItems(); // Refresh inventory
          showMessage('Item deleted successfully!');
        } else {
          showMessage(`Error: ${result.error}`);
        }
      } catch (error) {
        showMessage('Error writing off item. Please try again.');
      } finally {
        setActionLoading(false);
      }
    }
  };

  const handleDeleteConfirm = async () => {
    if (selectedReport) {
      setActionLoading(true);
      try {
        // Check if the report is for a damaged item (not deleted)
        const shouldRestoreQuantity = selectedReport.status === 'damaged' || selectedReport.status === 'under-repair';

        if (shouldRestoreQuantity) {
          // Restore the item quantity
          await updateItemQuantity(selectedReport.itemId, 1);
        }

        const result = await deleteDamageReport(selectedReport.id);
        if (result.success) {
          setShowDeleteModal(false);
          setSelectedReport(null);
          await loadAllInventoryItems(); // Refresh inventory
          showMessage('Damage report deleted successfully!' + (shouldRestoreQuantity ? ' Item quantity restored.' : ''));
        } else {
          showMessage(`Error: ${result.error}`);
        }
      } catch (error) {
        showMessage('Error deleting report. Please try again.');
      } finally {
        setActionLoading(false);
      }
    }
  };

  const openWriteOffModal = (report) => {
    setSelectedReport(report);
    setShowWriteOffModal(true);
  };

  const openDeleteModal = (report) => {
    setSelectedReport(report);
    setShowDeleteModal(true);
  };

  const closeModals = () => {
    setShowWriteOffModal(false);
    setShowDeleteModal(false);
    setSelectedReport(null);
  };

  const filteredItems = selectedCategory === 'all'
    ? allInventoryItems
    : allInventoryItems.filter(item => item.category === selectedCategory);

  const damagedItems = damageReports.filter(report => report.status === 'damaged');
  const underRepairItems = damageReports.filter(report => report.status === 'under-repair');
  const repairedItems = damageReports.filter(report => report.status === 'repaired');
  const writtenOffItems = damageReports.filter(report => report.status === 'written-off');

  // Get unique categories from all items
  const allCategories = ['all', ...new Set(allInventoryItems.map(item => item.category).filter(Boolean))];

  if (loadingDamagedItems && loadingInventory && rentalItems.length === 0) {
    return (
      <div className="damaged-items-panel">
        <div className="loading-container">
          <div className="spinner"></div>
          <p>Loading damaged items data...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="damaged-items-panel">
      <div className="panel-content">
        <div className="report-damage-section">
          <h2>Report New Damaged Item</h2>
          <p className="section-description">
            Report one damaged item at a time. The item will be deducted from available stock.
            {emailConfig.enabled && emailConfig.sendToCustomer && ' Customer will receive Mailjet transactional email.'}
          </p>

          <form onSubmit={handleSubmitDamageReport} className="damage-report-form">
            <div className="form-grid">
              <div className="form-group full-width">
                <h4>Select Booking</h4>
                <select
                  value={selectedBooking?.id || ''}
                  onChange={(e) => handleBookingSelect(e.target.value)}
                  required
                  disabled={actionLoading || loadingBookings}
                >
                  <option value="">Choose a booking...</option>
                  {loadingBookings ? (
                    <option value="" disabled>Loading bookings...</option>
                  ) : bookings.length === 0 ? (
                    <option value="" disabled>No active bookings found</option>
                  ) : (
                    bookings.map(booking => (
                      <option key={booking.id} value={booking.id}>
                        {booking.name || booking.userName} - {booking.venue} ({booking.startDate} to {booking.endDate})
                      </option>
                    ))
                  )}
                </select>

                {loadingBookings && (
                  <div style={{ marginTop: '10px', color: '#666', fontSize: '14px' }}>
                    Loading bookings...
                  </div>
                )}

                {!loadingBookings && bookings.length === 0 && (
                  <div style={{ marginTop: '10px', color: '#dc3545', fontSize: '14px' }}>
                    No active bookings found. Please check if there are any active, upcoming, or pending bookings.
                  </div>
                )}
              </div>

              <div className="form-group">
                <label>Select Item *</label>
                <select
                  value={newDamageReport.itemId}
                  onChange={(e) => handleItemSelect(e.target.value)}
                  required
                  disabled={actionLoading || !selectedBooking || loadingInventory}
                >
                  <option value="">Choose an item...</option>
                  {!selectedBooking ? (
                    <option value="" disabled>Please select a booking first</option>
                  ) : bookingItems.length === 0 ? (
                    <option value="" disabled>No items found in this booking</option>
                  ) : (
                    bookingItems.map(item => (
                      <option key={item.id} value={item.id}>
                        {item.name} (Qty: {item.quantity || 1})
                      </option>
                    ))
                  )}
                </select>
                {selectedBooking && bookingItems.length === 0 && (
                  <small style={{ color: '#dc3545', fontSize: '0.8rem' }}>
                    No items found in this booking. Check if the booking has rental items.
                  </small>
                )}
              </div>

              <div className="form-group">
                <label>Damage Severity *</label>
                <select
                  value={newDamageReport.severity}
                  onChange={(e) => setNewDamageReport({
                    ...newDamageReport,
                    severity: e.target.value
                  })}
                  required
                  disabled={actionLoading}
                >
                  <option value="low">Low (Minor cosmetic damage)</option>
                  <option value="medium">Medium (Functional but needs repair)</option>
                  <option value="high">High (Not functional, major repair needed)</option>
                </select>
              </div>

              <div className="form-group">
                <label>Estimated Repair Cost (₱)</label>
                <input
                  type="number"
                  min="0"
                  value={newDamageReport.estimatedRepairCost}
                  onChange={(e) => setNewDamageReport({
                    ...newDamageReport,
                    estimatedRepairCost: parseFloat(e.target.value) || 0
                  })}
                  disabled={actionLoading}
                />
              </div>

              <div className="form-group">
                <label>Penalty Fee (₱)</label>
                <input
                  type="number"
                  min="0"
                  value={newDamageReport.penaltyFee}
                  onChange={(e) => setNewDamageReport({
                    ...newDamageReport,
                    penaltyFee: parseFloat(e.target.value) || 0
                  })}
                  disabled={actionLoading}
                  placeholder="Additional penalty fee"
                />
              </div>

              <div className="form-group">
                <label>Estimated Repair Time (days)</label>
                <input
                  type="number"
                  min="1"
                  value={newDamageReport.estimatedRepairTime}
                  onChange={(e) => setNewDamageReport({
                    ...newDamageReport,
                    estimatedRepairTime: e.target.value
                  })}
                  placeholder="e.g., 7"
                  disabled={actionLoading}
                />
              </div>

              <div className="form-group full-width">
                <label>Damage Description *</label>
                <textarea
                  value={newDamageReport.description}
                  onChange={(e) => setNewDamageReport({
                    ...newDamageReport,
                    description: e.target.value
                  })}
                  placeholder="Describe the damage in detail..."
                  rows="3"
                  required
                  disabled={actionLoading}
                />
              </div>
            </div>

            <div className="form-actions">
              <button
                type="button"
                onClick={refreshDamageReports}
                className="btn btn-secondary"
                disabled={refreshingReports || actionLoading}
                style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
              >
                {refreshingReports ? (
                  <>
                    <span className="spinner-small"></span>
                    Refreshing All Data...
                  </>
                ) : (
                  <>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M23 4v6h-6M1 20v-6h6M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
                    </svg>
                    Refresh All Data
                  </>
                )}
              </button>
              <button
                type="submit"
                className="btn btn-primary"
                disabled={actionLoading || !selectedBooking || !newDamageReport.itemId || loadingInventory || refreshingReports}
              >
                {actionLoading ? 'Submitting...' : 'Mark Item as Damaged'}
                {emailConfig.enabled && ' & Send Email'}
              </button>
            </div>

            <style>
              {`
                .spinner-small {
                  width: 16px;
                  height: 16px;
                  border: 2px solid rgba(255,255,255,0.3);
                  border-radius: 50%;
                  border-top-color: white;
                  animation: spin-small 1s ease-in-out infinite;
                }
                
                @keyframes spin-small {
                  to { transform: rotate(360deg); }
                }
              `}
            </style>
          </form>
        </div>

        {/* INVENTORY SECTION - RESTORED */}
        <div className="inventory-overview">
          <h3>Inventory Status ({allInventoryItems.length} items total)</h3>

          <div className="category-filter">
            <label>Filter by Category:</label>
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
            >
              {allCategories.map(category => (
                <option key={category} value={category}>
                  {category === 'all' ? 'All Categories' : category.charAt(0).toUpperCase() + category.slice(1)}
                </option>
              ))}
            </select>
          </div>

          <div className="inventory-table">
            <table>
              <thead>
                <tr>
                  <th>Item Name</th>
                  <th>Category</th>
                  <th>Max Quantity</th>
                  <th>Available</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {loadingInventory ? (
                  <tr>
                    <td colSpan="5" style={{ textAlign: 'center', padding: '20px' }}>
                      Loading inventory items...
                    </td>
                  </tr>
                ) : filteredItems.length === 0 ? (
                  <tr>
                    <td colSpan="5" style={{ textAlign: 'center', padding: '20px' }}>
                      No items found in this category.
                    </td>
                  </tr>
                ) : (
                  filteredItems.map(item => (
                    <tr key={item.id} className={
                      (item.availableQuantity || 0) === 0 ? 'out-of-stock' :
                        (item.availableQuantity || 0) < (item.maxQuantity || item.totalQuantity || 1) * 0.3 ? 'low-stock' : ''
                    }>
                      <td>{item.name}</td>
                      <td>{item.category || 'Uncategorized'}</td>
                      <td>{item.maxQuantity || item.totalQuantity || 1}</td>
                      <td>{item.availableQuantity || 0}</td>
                      <td>
                        {(item.availableQuantity || 0) === 0 ? (
                          <span className="status-badge out-of-stock">Out of Stock</span>
                        ) : (item.availableQuantity || 0) < (item.maxQuantity || item.totalQuantity || 1) * 0.3 ? (
                          <span className="status-badge low-stock">Low Stock</span>
                        ) : (
                          <span className="status-badge available">Available</span>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* DAMAGE REPORTS SECTION */}
        <div className="damage-reports-section">
          <h3>Damage Reports Management</h3>

          <div className="reports-category">
            <h4>Currently Damaged Items ({damagedItems.length})</h4>
            {damagedItems.length === 0 ? (
              <p>No currently damaged items.</p>
            ) : (
              <div className="reports-grid">
                {damagedItems.map(report => (
                  <div key={report.id} className={`report-card severity-${report.severity}`}>
                    <div className="report-header">
                      <h5>{report.itemName}</h5>
                      <span className={`severity-badge ${report.severity}`}>
                        {report.severity.toUpperCase()}
                      </span>
                    </div>
                    <div className="report-details">
                      <p><strong>Reported:</strong> {new Date(report.reportedAt).toLocaleDateString()}</p>
                      <p><strong>Description:</strong> {report.description}</p>
                      <p><strong>Est. Repair Cost:</strong> ₱{report.estimatedRepairCost.toLocaleString()}</p>
                      {report.estimatedRepairTime && (
                        <p><strong>Est. Repair Time:</strong> {report.estimatedRepairTime} days</p>
                      )}
                    </div>
                    <div className="report-actions">
                      <button
                        onClick={() => handleStatusUpdate(report.id, 'under-repair')}
                        className="btn btn-warning"
                        disabled={actionLoading}
                      >
                        Start Repair
                      </button>
                      <button
                        onClick={() => openWriteOffModal(report)}
                        className="btn btn-danger"
                        disabled={actionLoading}
                      >
                        Delete the Item
                      </button>
                      <button
                        onClick={() => openDeleteModal(report)}
                        className="btn btn-secondary"
                        disabled={actionLoading}
                      >
                        Delete Report
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="reports-category">
            <h4>Items Under Repair ({underRepairItems.length})</h4>
            {underRepairItems.length === 0 ? (
              <p>No items currently under repair.</p>
            ) : (
              <div className="reports-grid">
                {underRepairItems.map(report => (
                  <div key={report.id} className={`report-card severity-${report.severity}`}>
                    <div className="report-header">
                      <h5>{report.itemName}</h5>
                      <span className={`severity-badge ${report.severity}`}>
                        {report.severity.toUpperCase()}
                      </span>
                    </div>
                    <div className="report-details">
                      <p><strong>Reported:</strong> {new Date(report.reportedAt).toLocaleDateString()}</p>
                      <p><strong>Description:</strong> {report.description}</p>
                      <p><strong>Est. Repair Cost:</strong> ₱{report.estimatedRepairCost.toLocaleString()}</p>
                    </div>
                    <div className="report-actions">
                      <button
                        onClick={() => handleRepairComplete(report)}
                        className="btn btn-secondary"
                        disabled={actionLoading}
                      >
                        Mark as Repaired
                      </button>
                      <button
                        onClick={() => handleStatusUpdate(report.id, 'damaged')}
                        className="btn btn-secondary"
                        disabled={actionLoading}
                      >
                        Back to Damaged
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="reports-category">
            <h4>Repair History ({repairedItems.length})</h4>
            {repairedItems.length === 0 ? (
              <p>No repair history.</p>
            ) : (
              <div className="reports-table">
                <table>
                  <thead>
                    <tr>
                      <th>Item Name</th>
                      <th>Repair Cost</th>
                      <th>Reported</th>
                      <th>Repaired</th>
                      <th>Severity</th>
                    </tr>
                  </thead>
                  <tbody>
                    {repairedItems.map(report => (
                      <tr key={report.id}>
                        <td>{report.itemName}</td>
                        <td>₱{report.repairCost.toLocaleString()}</td>
                        <td>{new Date(report.reportedAt).toLocaleDateString()}</td>
                        <td>{report.repairedAt ? new Date(report.repairedAt).toLocaleDateString() : 'N/A'}</td>
                        <td>
                          <span className={`severity-badge ${report.severity}`}>
                            {report.severity.toUpperCase()}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <div className="reports-category">
            <h4>Deleted Items ({writtenOffItems.length})</h4>
            {writtenOffItems.length === 0 ? (
              <p>No deleted items.</p>
            ) : (
              <div className="reports-table">
                <table>
                  <thead>
                    <tr>
                      <th>Item Name</th>
                      <th>Reason</th>
                      <th>Date Deleted</th>
                      <th>Severity</th>
                    </tr>
                  </thead>
                  <tbody>
                    {writtenOffItems.map(report => (
                      <tr key={report.id}>
                        <td>{report.itemName}</td>
                        <td>{report.description}</td>
                        <td>{new Date(report.createdAt).toLocaleDateString()}</td>
                        <td>
                          <span className={`severity-badge ${report.severity}`}>
                            {report.severity.toUpperCase()}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>

      {showWriteOffModal && selectedReport && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header">
              <h3>Confirm delete</h3>
              <button className="modal-close" onClick={closeModals}>×</button>
            </div>
            <div className="modal-body">
              <p>Are you sure you want to delete this item?</p>
              <div className="modal-details">
                <p><strong>Item:</strong> {selectedReport.itemName}</p>
                <p><strong>Description:</strong> {selectedReport.description}</p>
              </div>
              <p className="warning-text">
                This action cannot be undone. The item will be permanently removed from inventory.
              </p>
            </div>
            <div className="modal-actions">
              <button onClick={closeModals} className="btn btn-secondary" disabled={actionLoading}>
                Cancel
              </button>
              <button onClick={handleWriteOffConfirm} className="btn btn-danger" disabled={actionLoading}>
                {actionLoading ? 'Processing...' : 'Confirm delete'}
              </button>
            </div>
          </div>
        </div>
      )}

      {showDeleteModal && selectedReport && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header">
              <h3>Confirm Delete</h3>
              <button className="modal-close" onClick={closeModals}>×</button>
            </div>
            <div className="modal-body">
              <p>Are you sure you want to delete this damage report?</p>
              <div className="modal-details">
                <p><strong>Item:</strong> {selectedReport.itemName}</p>
                <p><strong>Description:</strong> {selectedReport.description}</p>
              </div>
              <p className="warning-text">
                This will restore the item back to available stock.
              </p>
            </div>
            <div className="modal-actions">
              <button onClick={closeModals} className="btn btn-secondary" disabled={actionLoading}>
                Cancel
              </button>
              <button onClick={handleDeleteConfirm} className="btn btn-danger" disabled={actionLoading}>
                {actionLoading ? 'Processing...' : 'Delete Report'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminDamagedItemsPanel;