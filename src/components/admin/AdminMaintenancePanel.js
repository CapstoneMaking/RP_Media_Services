// AdminMaintenancePanel.js - SIMPLIFIED RETURN PROCESS VERSION
import React, { useState, useEffect } from 'react';
import { useApp } from '../../context/AppContext';
import { collection, query, where, getDocs, orderBy, getFirestore, updateDoc, doc } from 'firebase/firestore';
import { db } from '../../utils/firebase';
import emailjs from '@emailjs/browser';
import { firebaseService } from '../../services/firebaseService';

const showMessage = (message, type = 'info') => {
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

  setTimeout(() => {
    if (messageDiv.parentNode) {
      messageDiv.parentNode.removeChild(messageDiv);
    }
  }, 5000);

  messageDiv.onclick = () => {
    if (messageDiv.parentNode) {
      messageDiv.parentNode.removeChild(messageDiv);
    }
  };
};

const AdminMaintenancePanel = () => {
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
  const [bookingItems, setBookingItems] = useState([]);
  const [refreshingReports, setRefreshingReports] = useState(false);

  // SIMPLIFIED RETURN STATE - NO MODAL NEEDED
  const [selectedReturnBooking, setSelectedReturnBooking] = useState(null);
  const [returnItems, setReturnItems] = useState([]);
  const [returnNotes, setReturnNotes] = useState('');
  const [availableReturnBookings, setAvailableReturnBookings] = useState([]);
  const [loadingReturnBookings, setLoadingReturnBookings] = useState(false);
  const [processingReturn, setProcessingReturn] = useState(false);

  // State to prevent double restoration
  const [isRestoring, setIsRestoring] = useState(false);
  const [lastRestoredReport, setLastRestoredReport] = useState(null);
  const [lastActionTime, setLastActionTime] = useState(0);

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

  // ==============================================
  // LOADING FUNCTIONS
  // ==============================================

  useEffect(() => {
    emailjs.init(EMAILJS_PUBLIC_KEY);
    loadActiveBookings();
    loadAllInventoryItems();
    loadAvailableReturnBookings();
  }, []);

  const loadAvailableReturnBookings = async () => {
    try {
      setLoadingReturnBookings(true);
      console.log('🔍 Loading ALL bookings for return process...');

      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const q = query(
        collection(db, "bookings"),
        orderBy("endDate", "desc")
      );

      const querySnapshot = await getDocs(q);
      const returnBookings = [];

      querySnapshot.forEach((doc) => {
        const bookingData = {
          id: doc.id,
          ...doc.data()
        };

        const status = bookingData.status?.toLowerCase() || 'pending';

        if (status === 'cancelled' || status === 'completed') {
          return;
        }

        const endDate = new Date(bookingData.endDate);
        endDate.setHours(0, 0, 0, 0);

        if (endDate <= today) {
          returnBookings.push(bookingData);
        }
      });

      console.log(`✅ Found ${returnBookings.length} bookings available for return`);
      setAvailableReturnBookings(returnBookings);
    } catch (error) {
      console.error('Error loading return bookings:', error);
      showMessage('Error loading bookings for return process', 'error');
    } finally {
      setLoadingReturnBookings(false);
    }
  };

  const loadAllInventoryItems = async () => {
    try {
      setLoadingInventory(true);
      let combinedItems = [...rentalItems];

      try {
        const inventoryResult = await firebaseService.getInventoryItems();
        if (inventoryResult.success && inventoryResult.inventoryItems.length > 0) {
          console.log('✅ Loaded', inventoryResult.inventoryItems.length, 'items from inventory');
          combinedItems = [...combinedItems, ...inventoryResult.inventoryItems];
        }
      } catch (firebaseError) {
        console.error('Error loading from Firebase inventory:', firebaseError);
      }

      try {
        const savedInventoryItems = localStorage.getItem('rentalItems');
        if (savedInventoryItems) {
          const inventoryItems = JSON.parse(savedInventoryItems);
          combinedItems = [...combinedItems, ...inventoryItems];
        }
      } catch (localStorageError) {
        console.error('Error loading from localStorage:', localStorageError);
      }

      const uniqueItems = combinedItems.reduce((acc, current) => {
        const existingIndex = acc.findIndex(item => item.id === current.id);
        if (existingIndex === -1) {
          acc.push(current);
        } else {
          acc[existingIndex] = { ...acc[existingIndex], ...current };
        }
        return acc;
      }, []);

      console.log('Total inventory items loaded:', uniqueItems.length);
      setAllInventoryItems(uniqueItems);

    } catch (error) {
      console.error('Error loading inventory items:', error);
      setAllInventoryItems(rentalItems);
    } finally {
      setLoadingInventory(false);
    }
  };

  const loadActiveBookings = async () => {
    try {
      setLoadingBookings(true);
      let bookingsData = [];

      const q = query(
        collection(db, "bookings"),
        orderBy("timestamp", "desc")
      );

      const querySnapshot = await getDocs(q);
      querySnapshot.forEach((doc) => {
        const bookingData = {
          id: doc.id,
          ...doc.data()
        };

        const status = bookingData.status?.toLowerCase() || 'pending';
        if (status !== 'cancelled') {
          bookingsData.push(bookingData);
        }
      });

      console.log(`✅ Loaded ${bookingsData.length} bookings for damage reporting`);
      setBookings(bookingsData);

    } catch (error) {
      console.error('Error loading bookings:', error);
      showMessage('Error loading bookings data: ' + error.message, 'error');
    } finally {
      setLoadingBookings(false);
    }
  };

  const refreshDamageReports = async () => {
    setRefreshingReports(true);
    try {
      await loadAllInventoryItems();
      await loadActiveBookings();
      await loadAvailableReturnBookings();
      showMessage('All data refreshed successfully!', 'success');
    } catch (error) {
      showMessage('Error refreshing data: ' + error.message, 'error');
    } finally {
      setRefreshingReports(false);
    }
  };

  // ==============================================
  // DIRECT INVENTORY UPDATE FUNCTION - FIXED VERSION
  // ==============================================

  // This function directly updates item quantities in all data sources
  const updateItemQuantityDirectly = async (itemId, newTotal, newAvailable, itemName = '') => {
    try {
      console.log(`🔄 DIRECT UPDATE: ${itemId} (${itemName}) - Total: ${newTotal}, Available: ${newAvailable}`);

      let itemToUpdate = allInventoryItems.find(item => item.id === itemId);

      if (!itemToUpdate && itemName) {
        itemToUpdate = allInventoryItems.find(item =>
          item.name.toLowerCase() === itemName.toLowerCase()
        );
      }

      if (!itemToUpdate) {
        console.error(`Item ${itemId || itemName} not found in inventory`);
        showMessage(`Item ${itemName || itemId} not found in inventory`, 'error');
        return false;
      }

      console.log(`📊 CURRENT: ${itemToUpdate.name} - Total=${itemToUpdate.totalQuantity}, Available=${itemToUpdate.availableQuantity}`);
      console.log(`📈 SETTING: Total=${newTotal}, Available=${newAvailable}`);

      // Create updated item object
      const updatedItem = {
        ...itemToUpdate,
        totalQuantity: newTotal,
        availableQuantity: newAvailable,
        maxQuantity: newTotal,
        updatedAt: new Date().toISOString()
      };

      // Update local state
      setAllInventoryItems(prev =>
        prev.map(item =>
          item.id === itemToUpdate.id ? updatedItem : item
        )
      );

      // Save to ALL data sources
      const isPredefined = rentalItems.some(item => item.id === itemToUpdate.id);

      // 1. Save to predefined items collection (if predefined)
      if (isPredefined) {
        console.log(`📝 Saving ${itemToUpdate.name} to predefined items collection`);
        const updatedRentalItems = rentalItems.map(item =>
          item.id === itemToUpdate.id ? updatedItem : item
        );
        await firebaseService.saveRentalItems(updatedRentalItems);
      }

      // 2. Always save to inventory collection
      console.log(`📝 Saving ${itemToUpdate.name} to inventory collection`);
      const inventoryResult = await firebaseService.getInventoryItems();
      if (inventoryResult.success) {
        const currentItems = inventoryResult.inventoryItems || [];
        const itemIndex = currentItems.findIndex(item => item.id === itemToUpdate.id);

        let updatedItems;
        if (itemIndex !== -1) {
          updatedItems = [...currentItems];
          updatedItems[itemIndex] = updatedItem;
        } else {
          updatedItems = [...currentItems, updatedItem];
        }

        await firebaseService.saveInventoryItems(updatedItems);
      }

      // 3. Update localStorage
      console.log(`📝 Updating ${itemToUpdate.name} in localStorage`);
      try {
        const savedItems = localStorage.getItem('rentalItems');
        if (savedItems) {
          const items = JSON.parse(savedItems);
          const itemIndex = items.findIndex(item => item.id === itemToUpdate.id);

          let updatedLocalItems;
          if (itemIndex !== -1) {
            updatedLocalItems = [...items];
            updatedLocalItems[itemIndex] = updatedItem;
          } else {
            updatedLocalItems = [...items, updatedItem];
          }

          localStorage.setItem('rentalItems', JSON.stringify(updatedLocalItems));
        } else {
          localStorage.setItem('rentalItems', JSON.stringify([updatedItem]));
        }
      } catch (localError) {
        console.error('Error updating localStorage:', localError);
      }

      // 4. Update productInfo
      console.log(`📝 Updating ${itemToUpdate.name} in productInfo`);
      try {
        const savedProductInfo = localStorage.getItem('productInfo');
        if (savedProductInfo) {
          const productInfo = JSON.parse(savedProductInfo);
          if (productInfo[itemToUpdate.id]) {
            productInfo[itemToUpdate.id] = {
              ...productInfo[itemToUpdate.id],
              totalQuantity: newTotal,
              availableQuantity: newAvailable
            };
            localStorage.setItem('productInfo', JSON.stringify(productInfo));
          }
        }
      } catch (error) {
        console.error('Error updating productInfo:', error);
      }

      console.log(`✅ SUCCESS: ${itemToUpdate.name} - Total ${newTotal}, Available ${newAvailable} (ALL data sources updated)`);
      return true;

    } catch (error) {
      console.error('❌ Error updating item quantity directly:', error);
      showMessage(`Error updating inventory: ${error.message}`, 'error');
      return false;
    }
  };

  // Helper function to update item quantity - FIXED VERSION
  const updateItemQuantity = async (itemId, quantityChange, itemName = '', isDamageRestore = false) => {
    console.log('🔍 DEBUG updateItemQuantity:', {
      itemId,
      itemName,
      quantityChange,
      isDamageRestore
    });

    let itemToUpdate = allInventoryItems.find(item => item.id === itemId);

    if (!itemToUpdate && itemName) {
      itemToUpdate = allInventoryItems.find(item =>
        item.name.toLowerCase() === itemName.toLowerCase()
      );
    }

    if (!itemToUpdate) {
      console.error(`Item ${itemId || itemName} not found in inventory`);
      showMessage(`Item ${itemName || itemId} not found in inventory`, 'error');
      return false;
    }

    const currentTotal = parseInt(itemToUpdate.totalQuantity) || 1;
    const currentAvailable = parseInt(itemToUpdate.availableQuantity) || 0;

    console.log(`📊 CURRENT VALUES: ${itemToUpdate.name} - Total=${currentTotal}, Available=${currentAvailable}`);

    let newTotal = currentTotal;
    let newAvailable = currentAvailable;

    if (isDamageRestore) {
      // When restoring from damage report deletion/repair, increase BOTH by exactly 1
      newTotal = currentTotal + 1;
      newAvailable = currentAvailable + 1;
      console.log(`🔄 RESTORING: Increasing BOTH quantities by 1`);
    } else if (quantityChange < 0) {
      // When damaging, reduce BOTH by exactly 1
      newTotal = Math.max(1, currentTotal - 1);
      newAvailable = Math.max(0, currentAvailable - 1);
      console.log(`🔴 DAMAGING: Reducing BOTH quantities by 1`);
    } else {
      // For other positive changes
      newTotal = currentTotal + quantityChange;
      newAvailable = Math.min(currentAvailable + quantityChange, newTotal);
      console.log(`🟢 POSITIVE CHANGE: Adjusting quantities`);
    }

    console.log(`📈 NEW VALUES: Total=${newTotal}, Available=${newAvailable}`);

    return await updateItemQuantityDirectly(itemId, newTotal, newAvailable, itemName);
  };

  // ==============================================
  // SINGLE RESTORATION HELPER FUNCTION (NO DOUBLE RESTORATION)
  // ==============================================

  const restoreItemQuantityOnce = async (itemId, itemName) => {
    // Prevent rapid successive calls
    const now = Date.now();
    if (now - lastActionTime < 2000) { // 2 second cooldown
      console.log('⏳ Too soon after last action, skipping...');
      return false;
    }

    setLastActionTime(now);

    // Check localStorage for recent restoration
    const lastRestoreKey = `last_restore_${itemId}`;
    const lastRestore = localStorage.getItem(lastRestoreKey);

    if (lastRestore) {
      const lastRestoreTime = parseInt(lastRestore);
      if (now - lastRestoreTime < 5000) { // 5 second window
        console.log('⏭️ Skipping - already restored recently');
        return false;
      }
    }

    // Mark as restoring
    localStorage.setItem(lastRestoreKey, now.toString());

    if (isRestoring) {
      console.log('⏳ Already in restoration process, skipping...');
      return false;
    }

    setIsRestoring(true);

    try {
      // Find current item
      let itemToUpdate = allInventoryItems.find(item => item.id === itemId);

      if (!itemToUpdate && itemName) {
        itemToUpdate = allInventoryItems.find(item =>
          item.name.toLowerCase() === itemName.toLowerCase()
        );
      }

      if (!itemToUpdate) {
        console.warn(`Item ${itemName || itemId} not found for restoration`);
        return false;
      }

      const currentTotal = parseInt(itemToUpdate.totalQuantity) || 1;
      const currentAvailable = parseInt(itemToUpdate.availableQuantity) || 0;

      // CRITICAL: Always restore by exactly 1, no matter what
      const newTotal = currentTotal + 1;
      const newAvailable = currentAvailable + 1;

      console.log(`🔧 RESTORING ONCE: ${itemName}`);
      console.log(`Current: Total=${currentTotal}, Available=${currentAvailable}`);
      console.log(`New: Total=${newTotal}, Available=${newAvailable}`);

      const result = await updateItemQuantityDirectly(itemId, newTotal, newAvailable, itemName);

      // Clear the restore key after successful restoration
      setTimeout(() => {
        localStorage.removeItem(lastRestoreKey);
      }, 10000); // Clear after 10 seconds

      return result;
    } finally {
      // Reset restoration state
      setTimeout(() => {
        setIsRestoring(false);
      }, 1000);
    }
  };

  // ==============================================
  // SIMPLIFIED RETURN PROCESS FUNCTIONS (NO DAMAGE REPORTING)
  // ==============================================

  const extractItemsFromBooking = (booking) => {
    const items = [];

    if (booking.package && booking.package.items) {
      booking.package.items.forEach(item => {
        items.push({
          id: item.id,
          name: item.name,
          quantity: item.quantity || 1,
          type: 'package',
          category: item.category || 'uncategorized',
          originalQuantity: item.quantity || 1
        });
      });
    }

    if (booking.items && Array.isArray(booking.items)) {
      booking.items.forEach(item => {
        items.push({
          id: item.id,
          name: item.name,
          quantity: item.quantity || 1,
          type: 'individual',
          category: item.category || 'uncategorized',
          originalQuantity: item.quantity || 1
        });
      });
    }

    const combinedItems = items.reduce((acc, current) => {
      const existingItem = acc.find(item => item.id === current.id);
      if (existingItem) {
        existingItem.quantity += current.quantity;
        existingItem.originalQuantity += current.quantity;
      } else {
        acc.push(current);
      }
      return acc;
    }, []);

    return combinedItems;
  };

  const handleReturnBookingSelect = (bookingId) => {
    const booking = availableReturnBookings.find(b => b.id === bookingId);
    if (booking) {
      setSelectedReturnBooking(booking);
      
      const items = extractItemsFromBooking(booking);
      setReturnItems(items.map(item => ({
        ...item,
        returnedQuantity: item.quantity
      })));
    } else {
      setSelectedReturnBooking(null);
      setReturnItems([]);
    }
  };

  const updateReturnedQuantity = (itemId, quantity) => {
    setReturnItems(prev =>
      prev.map(item =>
        item.id === itemId
          ? { ...item, returnedQuantity: Math.max(0, Math.min(item.quantity, parseInt(quantity) || 0)) }
          : item
      )
    );
  };

  const processReturn = async () => {
    if (!selectedReturnBooking) {
      showMessage('Please select a booking to process', 'error');
      return;
    }

    if (returnItems.length === 0) {
      showMessage('No items to return', 'error');
      return;
    }

    setProcessingReturn(true);

    try {
      let restoredCount = 0;
      let totalItems = 0;

      for (const item of returnItems) {
        if (item.returnedQuantity > 0) {
          totalItems += item.returnedQuantity;
          
          const itemToUpdate = allInventoryItems.find(i => i.id === item.id);
          if (itemToUpdate) {
            const currentTotal = parseInt(itemToUpdate.totalQuantity) || 1;
            const currentAvailable = parseInt(itemToUpdate.availableQuantity) || 0;
            const newAvailable = Math.min(currentAvailable + item.returnedQuantity, currentTotal);

            const updatedItem = {
              ...itemToUpdate,
              availableQuantity: newAvailable,
              updatedAt: new Date().toISOString()
            };

            // Update local state
            setAllInventoryItems(prev =>
              prev.map(i => i.id === item.id ? updatedItem : i)
            );

            // Update predefined items collection
            const isPredefined = rentalItems.some(i => i.id === item.id);
            if (isPredefined) {
              const updatedRentalItems = rentalItems.map(i =>
                i.id === item.id ? updatedItem : i
              );
              await firebaseService.saveRentalItems(updatedRentalItems);
            }

            // Update inventory collection
            const inventoryResult = await firebaseService.getInventoryItems();
            if (inventoryResult.success) {
              const currentItems = inventoryResult.inventoryItems || [];
              const itemIndex = currentItems.findIndex(i => i.id === item.id);
              
              let updatedItems;
              if (itemIndex !== -1) {
                updatedItems = [...currentItems];
                updatedItems[itemIndex] = updatedItem;
              } else {
                updatedItems = [...currentItems, updatedItem];
              }
              
              await firebaseService.saveInventoryItems(updatedItems);
            }

            // Update localStorage
            try {
              const savedItems = localStorage.getItem('rentalItems');
              if (savedItems) {
                const items = JSON.parse(savedItems);
                const itemIndex = items.findIndex(i => i.id === item.id);
                
                let updatedLocalItems;
                if (itemIndex !== -1) {
                  updatedLocalItems = [...items];
                  updatedLocalItems[itemIndex] = updatedItem;
                } else {
                  updatedLocalItems = [...items, updatedItem];
                }
                
                localStorage.setItem('rentalItems', JSON.stringify(updatedLocalItems));
              }
            } catch (localError) {
              console.error('Error updating localStorage:', localError);
            }

            restoredCount++;
            console.log(`✅ Restored ${item.returnedQuantity} of ${item.name} to available inventory`);
          }
        }
      }

      // Update booking status to completed
      if (selectedReturnBooking) {
        try {
          const bookingRef = doc(db, 'bookings', selectedReturnBooking.id);
          await updateDoc(bookingRef, {
            status: 'completed',
            returnDate: new Date().toISOString().split('T')[0],
            returnNotes: returnNotes || 'Items returned successfully',
            updatedAt: new Date().toISOString()
          });
          console.log('✅ Booking marked as completed');
          
        } catch (error) {
          console.error('Error updating booking status:', error);
        }
      }

      showMessage(
        `✅ Return processed successfully! ${restoredCount} items restored (${totalItems} total units) to available inventory.`,
        'success'
      );

      // Reset form
      setSelectedReturnBooking(null);
      setReturnItems([]);
      setReturnNotes('');
      
      // Refresh data
      await loadAvailableReturnBookings();
      await loadAllInventoryItems();

    } catch (error) {
      console.error('Error processing return:', error);
      showMessage('Error processing return. Please try again.', 'error');
    } finally {
      setProcessingReturn(false);
    }
  };

  const cancelReturn = () => {
    setSelectedReturnBooking(null);
    setReturnItems([]);
    setReturnNotes('');
  };

  // ==============================================
  // DAMAGE REPORT FUNCTIONS
  // ==============================================

  const extractBookingItems = (booking) => {
    if (!booking) {
      setBookingItems([]);
      return;
    }

    const items = [];

    if (booking.package && booking.package.items) {
      booking.package.items.forEach(item => {
        items.push({
          id: item.id,
          name: item.name,
          quantity: item.quantity || 1,
          type: 'package',
          category: item.category || 'uncategorized'
        });
      });
    }

    if (booking.items && Array.isArray(booking.items)) {
      booking.items.forEach(item => {
        items.push({
          id: item.id,
          name: item.name,
          quantity: item.quantity || 1,
          type: 'individual',
          category: item.category || 'uncategorized'
        });
      });
    }

    console.log('Extracted booking items:', items);
    setBookingItems(items);
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

      extractBookingItems(selected);
    }
  };

  const handleItemSelect = (itemId) => {
    const selectedBookingItem = bookingItems.find(item => item.id === itemId);
    if (selectedBookingItem) {
      setNewDamageReport({
        ...newDamageReport,
        itemId: selectedBookingItem.id,
        itemName: selectedBookingItem.name
      });
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

  const handleSubmitDamageReport = async (e) => {
    e.preventDefault();

    // Prevent rapid successive submissions
    const now = Date.now();
    if (now - lastActionTime < 2000) {
      showMessage('⏳ Please wait before submitting another report', 'warning');
      return;
    }

    setLastActionTime(now);
    setActionLoading(true);

    try {
      console.log('🔴 STARTING DAMAGE REPORT PROCESS...');
      console.log('📝 Item:', newDamageReport.itemName, 'ID:', newDamageReport.itemId);

      // When reporting damage, reduce BOTH total and available quantity by exactly 1
      const quantityUpdated = await updateItemQuantity(newDamageReport.itemId, -1, newDamageReport.itemName, false);

      if (!quantityUpdated) {
        showMessage('Failed to update item quantity. Please try again.', 'error');
        setActionLoading(false);
        return;
      }

      console.log('✅ Item quantity updated successfully');

      const report = {
        ...newDamageReport,
        status: 'damaged',
        createdAt: new Date().toISOString()
      };

      console.log('📝 Saving damage report to database...');
      const result = await firebaseService.saveDamageReport(report);

      if (result.success) {
        console.log('✅ Damage report saved to database');

        let emailSuccess = true;
        let emailMessage = '';

        if (emailConfig.enabled && emailConfig.sendToCustomer && newDamageReport.customerEmail) {
          console.log('📧 Sending email notification...');
          const emailResult = await sendDamageEmailNotification(newDamageReport);
          if (emailResult.success) {
            emailMessage = `Mailjet email sent to ${newDamageReport.customerEmail}`;
            console.log('✅ Email sent successfully');
          } else {
            emailSuccess = false;
            emailMessage = `But Mailjet email failed: ${emailResult.error}`;
            console.warn('⚠️ Email sending failed:', emailResult.error);
          }
        }

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

        // Dispatch event instead of full refresh
        window.dispatchEvent(new CustomEvent('damageReportAdded'));

        if (emailSuccess && emailConfig.enabled && emailConfig.sendToCustomer) {
          showMessage(`✅ Damage report submitted successfully! Item TOTAL quantity reduced by 1 (affects ALL dates). ${emailMessage}`, 'success');
        } else if (!emailSuccess) {
          showMessage(`✅ Damage report submitted successfully! Item TOTAL quantity reduced by 1 (affects ALL dates). ${emailMessage}`, 'warning');
        } else {
          showMessage('✅ Damage report submitted successfully! Item TOTAL quantity reduced by 1 (affects ALL dates).', 'success');
        }
      } else {
        // Rollback the quantity change if report save failed
        console.warn('⚠️ Report save failed, rolling back quantity change...');
        await updateItemQuantity(newDamageReport.itemId, 1, newDamageReport.itemName, true);
        showMessage(`❌ Error: ${result.error}`, 'error');
      }
    } catch (error) {
      console.error('❌ Error submitting damage report:', error);
      showMessage('❌ Error submitting damage report. Please try again.', 'error');
    } finally {
      setActionLoading(false);
    }
  };

  const handleRepairComplete = async (report) => {
    const confirmRepair = window.confirm(`Mark "${report.itemName}" as repaired and restore BOTH total and available quantity by 1?`);

    if (confirmRepair) {
      setActionLoading(true);
      try {
        console.log(`🔧 Starting repair process for ${report.itemName}...`);

        const result = await updateDamageStatus(report.id, 'repaired', parseFloat(report.estimatedRepairCost || 0));

        if (!result.success) {
          showMessage(`❌ Error: ${result.error}`, 'error');
          return;
        }

        console.log(`✅ Report status updated to 'repaired'`);
        console.log(`🔄 Restoring quantities for ${report.itemName}...`);

        // When repairing, increase BOTH total and available quantity by exactly 1
        const restored = await updateItemQuantity(report.itemId, 1, report.itemName, true);

        if (restored) {
          showMessage('✅ Item marked as repaired! BOTH total and available quantity increased by 1 (affects ALL dates).', 'success');
          window.dispatchEvent(new CustomEvent('damageReportUpdated'));
        } else {
          showMessage('⚠️ Item status updated but failed to restore inventory quantity.', 'warning');
        }
      } catch (error) {
        console.error('❌ Error in handleRepairComplete:', error);
        showMessage('❌ Error updating repair status. Please try again.', 'error');
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
        showMessage(`❌ Error: ${result.error}`, 'error');
      } else {
        showMessage(`✅ Status updated to ${newStatus} successfully!`, 'success');
        window.dispatchEvent(new CustomEvent('damageReportUpdated'));
      }
    } catch (error) {
      showMessage('❌ Error updating status. Please try again.', 'error');
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
          setShowWriteOffModal(false);
          setSelectedReport(null);
          window.dispatchEvent(new CustomEvent('damageReportUpdated'));
          showMessage('✅ Item written off successfully!', 'success');
        } else {
          showMessage(`❌ Error: ${result.error}`, 'error');
        }
      } catch (error) {
        showMessage('❌ Error writing off item. Please try again.', 'error');
      } finally {
        setActionLoading(false);
      }
    }
  };

  // ==============================================
  // FIXED: DELETE DAMAGE REPORT FUNCTION - NO DOUBLE RESTORATION
  // ==============================================

  const handleDeleteConfirm = async () => {
    if (selectedReport) {
      setActionLoading(true);
      try {
        console.log('🗑️ DELETING REPORT:', selectedReport);

        // Check if we should restore quantity
        const shouldRestoreQuantity = selectedReport.status === 'damaged' || selectedReport.status === 'under-repair';

        if (shouldRestoreQuantity) {
          console.log(`🔵 RESTORING QUANTITY for ${selectedReport.itemName}`);

          // CRITICAL FIX: Use a different approach - just update once
          let itemToUpdate = allInventoryItems.find(item => item.id === selectedReport.itemId);

          if (itemToUpdate) {
            const currentTotal = parseInt(itemToUpdate.totalQuantity) || 1;
            const currentAvailable = parseInt(itemToUpdate.availableQuantity) || 0;

            // Increase by exactly 1
            const newTotal = currentTotal + 1;
            const newAvailable = currentAvailable + 1;

            console.log(`🔧 DIRECT RESTORE: ${selectedReport.itemName}`);
            console.log(`Current: Total=${currentTotal}, Available=${currentAvailable}`);
            console.log(`New: Total=${newTotal}, Available=${newAvailable}`);

            // Update directly WITHOUT triggering refreshes
            await updateItemQuantityDirectly(
              selectedReport.itemId,
              newTotal,
              newAvailable,
              selectedReport.itemName
            );
          }
        }

        // Delete the damage report from Firebase
        console.log('🗑️ Deleting report from database...');

        // IMPORTANT: Pass a flag to prevent auto-refresh
        const result = await deleteDamageReport(selectedReport.id, { skipRefresh: true });

        if (result.success) {
          console.log('✅ Report deleted successfully');

          showMessage(
            '✅ Damage report deleted!' +
            (shouldRestoreQuantity ? ' Quantity restored by 1.' : ''),
            'success'
          );

          setShowDeleteModal(false);
          setSelectedReport(null);

          // Dispatch a specific event that we can handle without refresh
          window.dispatchEvent(new CustomEvent('damageReportManuallyDeleted', {
            detail: { reportId: selectedReport.id }
          }));

          // DO NOT trigger any automatic refreshes

        } else {
          showMessage(`❌ Error: ${result.error}`, 'error');
        }

      } catch (error) {
        console.error('❌ Error deleting report:', error);
        showMessage('❌ Error: ' + error.message, 'error');
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
    // Check if this is the same report that was just restored
    if (lastRestoredReport && lastRestoredReport.id === report.id) {
      const timeSinceRestore = Date.now() - lastRestoredReport.timestamp;
      if (timeSinceRestore < 5000) { // 5 seconds
        console.log('⚠️ This report was just restored, asking for confirmation...');
        if (!window.confirm('This report was recently restored. Are you sure you want to delete it?')) {
          return;
        }
      }
    }

    setSelectedReport(report);
    setShowDeleteModal(true);
  };

  const closeModals = () => {
    setShowWriteOffModal(false);
    setShowDeleteModal(false);
    setSelectedReport(null);
  };

  // ==============================================
  // EVENT LISTENERS FOR UPDATES
  // ==============================================

  useEffect(() => {
    const handleDamageReportUpdates = () => {
      // Refresh data when events are received
      setTimeout(() => {
        loadAllInventoryItems();
      }, 500);
    };

    window.addEventListener('damageReportAdded', handleDamageReportUpdates);
    window.addEventListener('damageReportUpdated', handleDamageReportUpdates);
    window.addEventListener('damageReportDeleted', handleDamageReportUpdates);

    return () => {
      window.removeEventListener('damageReportAdded', handleDamageReportUpdates);
      window.removeEventListener('damageReportUpdated', handleDamageReportUpdates);
      window.removeEventListener('damageReportDeleted', handleDamageReportUpdates);
    };
  }, []);

  // ==============================================
  // RENDER FUNCTIONS
  // ==============================================

  const filteredItems = selectedCategory === 'all'
    ? allInventoryItems
    : allInventoryItems.filter(item => item.category === selectedCategory);

  const damagedItems = damageReports.filter(report => report.status === 'damaged');
  const underRepairItems = damageReports.filter(report => report.status === 'under-repair');
  const repairedItems = damageReports.filter(report => report.status === 'repaired');
  const writtenOffItems = damageReports.filter(report => report.status === 'written-off');

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
        {/* SIMPLIFIED RETURN PROCESS - INLINE SECTION */}
        <div className="return-process-section" style={{
          marginBottom: '2rem',
          padding: '1.5rem',
          backgroundColor: '#f8f9fa',
          borderRadius: '8px',
          border: '1px solid #dee2e6'
        }}>
          <h3 style={{ marginBottom: '1rem', color: '#2e7d32' }}>Item Return Process</h3>
          
          <p style={{ color: '#555', marginBottom: '1rem' }}> 
            Process item returns from completed bookings. All returned items are restored to available inventory.
          </p>

          <div className="form-group" style={{ marginBottom: '1rem' }}>
            <label>Select Booking to Process Return:</label>
            <select
              value={selectedReturnBooking?.id || ''}
              onChange={(e) => handleReturnBookingSelect(e.target.value)}
              disabled={processingReturn || loadingReturnBookings}
              style={{ width: '100%', padding: '0.5rem' }}
            >
              <option value="">Choose a booking ready for return...</option>
              {loadingReturnBookings ? (
                <option value="" disabled>Loading bookings...</option>
              ) : availableReturnBookings.length === 0 ? (
                <option value="" disabled>No bookings available for return</option>
              ) : (
                availableReturnBookings.map(booking => (
                  <option key={booking.id} value={booking.id}>
                    {booking.name || booking.userName} - {booking.venue} ({booking.startDate} to {booking.endDate}) - Status: {booking.status || 'pending'}
                  </option>
                ))
              )}
            </select>
            <div style={{ marginTop: '0.5rem', fontSize: '0.875rem', color: '#666' }}>
              Showing {availableReturnBookings.length} bookings with end date today or earlier
            </div>
          </div>

          {selectedReturnBooking && (
            <div className="return-details" style={{
              marginTop: '1.5rem',
              padding: '1rem',
              backgroundColor: 'white',
              borderRadius: '4px',
              border: '1px solid #e9ecef'
            }}>
              <h4 style={{ marginBottom: '1rem' }}>Return Details - {selectedReturnBooking.name || selectedReturnBooking.userName}</h4>
              
              <div style={{ marginBottom: '1rem', padding: '0.5rem', backgroundColor: '#f8f9fa', borderRadius: '4px' }}>
                <p style={{ margin: '0.25rem 0' }}><strong>Booking:</strong> {selectedReturnBooking.name || selectedReturnBooking.userName}</p>
                <p style={{ margin: '0.25rem 0' }}><strong>Venue:</strong> {selectedReturnBooking.venue || 'N/A'}</p>
                <p style={{ margin: '0.25rem 0' }}><strong>Dates:</strong> {selectedReturnBooking.startDate} to {selectedReturnBooking.endDate}</p>
              </div>

              <div className="form-group" style={{ marginBottom: '1rem' }}>
                <label>Return Notes:</label>
                <textarea
                  value={returnNotes}
                  onChange={(e) => setReturnNotes(e.target.value)}
                  placeholder="Add any notes about the return..."
                  rows="2"
                  style={{ width: '100%', padding: '0.5rem' }}
                />
              </div>

              <h5>Items to Return ({returnItems.length})</h5>
              <div className="return-items-table" style={{ maxHeight: '300px', overflowY: 'auto', marginBottom: '1rem' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ backgroundColor: '#f8f9fa' }}>
                      <th style={{ padding: '8px', textAlign: 'left' }}>Item Name</th>
                      <th style={{ padding: '8px', textAlign: 'center' }}>Borrowed</th>
                      <th style={{ padding: '8px', textAlign: 'center' }}>Returning</th>
                    </tr>
                  </thead>
                  <tbody>
                    {returnItems.map(item => (
                      <tr key={item.id} style={{ borderBottom: '1px solid #dee2e6' }}>
                        <td style={{ padding: '8px' }}>{item.name}</td>
                        <td style={{ padding: '8px', textAlign: 'center' }}>{item.quantity}</td>
                        <td style={{ padding: '8px', textAlign: 'center' }}>
                          <input
                            type="number"
                            min="0"
                            max={item.quantity}
                            value={item.returnedQuantity || item.quantity}
                            onChange={(e) => updateReturnedQuantity(item.id, e.target.value)}
                            disabled={processingReturn}
                            style={{ width: '60px', textAlign: 'center', padding: '4px' }}
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div style={{ marginTop: '1rem', padding: '0.75rem', backgroundColor: '#e8f5e9', borderRadius: '4px' }}>
                <p style={{ margin: 0, color: '#2e7d32' }}>
                  <strong>Note:</strong> All returned items will be restored to available inventory.
                </p>
              </div>

              <div className="return-actions" style={{ marginTop: '1.5rem', display: 'flex', gap: '1rem' }}>
                <button
                  onClick={cancelReturn}
                  className="btn btn-secondary"
                  disabled={processingReturn}
                >
                  Cancel
                </button>
                <button
                  onClick={processReturn}
                  className="btn btn-primary"
                  disabled={processingReturn || returnItems.length === 0}
                >
                  {processingReturn ? 'Processing Return...' : 'Complete Return'}
                </button>
              </div>
            </div>
          )}
        </div>

        <div className="report-damage-section">
          <h2>Report New Damaged Item</h2>
          <p className="section-description">
            Report one damaged item at a time. The item's TOTAL quantity will be reduced by 1 (affects ALL dates).
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
                    <option value="" disabled>No bookings found</option>
                  ) : (
                    bookings.map(booking => (
                      <option key={booking.id} value={booking.id}>
                        {booking.name || booking.userName} - {booking.venue} ({booking.startDate} to {booking.endDate}) - {booking.status || 'pending'}
                      </option>
                    ))
                  )}
                </select>

                {!loadingBookings && (
                  <div style={{ marginTop: '10px', color: '#666', fontSize: '14px' }}>
                    {bookings.length} bookings loaded
                  </div>
                )}
              </div>

              <div className="form-group">
                <label>Select Item *</label>
                <select
                  value={newDamageReport.itemId}
                  onChange={(e) => handleItemSelect(e.target.value)}
                  required
                  disabled={actionLoading || !selectedBooking}
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
              >
                {refreshingReports ? 'Refreshing...' : 'Refresh All Data'}
              </button>
              <button
                type="submit"
                className="btn btn-primary"
                disabled={actionLoading || !selectedBooking || !newDamageReport.itemId}
              >
                {actionLoading ? 'Submitting...' : 'Mark Item as Damaged'}
              </button>
            </div>
          </form>
        </div>

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
                  <th>Total Quantity</th>
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
                        (item.availableQuantity || 0) < (item.totalQuantity || 1) * 0.3 ? 'low-stock' : ''
                    }>
                      <td>{item.name}</td>
                      <td>{item.category || 'Uncategorized'}</td>
                      <td>{item.totalQuantity || 1}</td>
                      <td>{item.availableQuantity || 0}</td>
                      <td>
                        {(item.availableQuantity || 0) === 0 ? (
                          <span className="status-badge out-of-stock">Out of Stock</span>
                        ) : (item.availableQuantity || 0) < (item.totalQuantity || 1) * 0.3 ? (
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
                      <p><strong>Customer:</strong> {report.customerName}</p>
                      <p><strong>Booking ID:</strong> {report.rentalId}</p>
                    </div>
                    <div className="report-actions">
                      <button
                        onClick={() => handleStatusUpdate(report.id, 'under-repair')}
                        className="btn btn-secondary"
                        disabled={actionLoading}
                        style={{ marginRight: '8px' }}
                      >
                        Start Repair
                      </button>
                      <button
                        onClick={() => openWriteOffModal(report)}
                        className="btn btn-secondary"
                        disabled={actionLoading}
                        style={{ marginRight: '8px' }}
                      >
                        Write Off
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
                    </div>
                    <div className="report-actions">
                      <button
                        onClick={() => handleRepairComplete(report)}
                        className="btn btn-secondary"
                        disabled={actionLoading}
                        style={{ marginRight: '8px' }}
                      >
                        Mark as Repaired
                      </button>
                      <button
                        onClick={() => handleStatusUpdate(report.id, 'damaged')}
                        className="btn btn-secondary"
                        disabled={actionLoading}
                        style={{ marginRight: '8px' }}
                      >
                        Back to Damaged
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
              <h3>Confirm Write Off</h3>
              <button className="modal-close" onClick={closeModals}>×</button>
            </div>
            <div className="modal-body">
              <p>Are you sure you want to write off this item?</p>
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
                {actionLoading ? 'Processing...' : 'Confirm Write Off'}
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
                {selectedReport.status === 'damaged' || selectedReport.status === 'under-repair' ? (
                  'This will restore the item\'s BOTH total and available quantity back to inventory by 1 (affects ALL dates).'
                ) : (
                  'This will delete the damage report but will NOT affect inventory quantities.'
                )}
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

export default AdminMaintenancePanel;