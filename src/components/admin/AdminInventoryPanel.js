// AdminInventoryPanel.js - DATE-SPECIFIC ONLY VIEW
import React, { useState, useEffect, useCallback } from 'react';
import { useApp } from '../../context/AppContext';
import { firebaseService } from '../../services/firebaseService';
import { cloudinaryService } from '../../services/cloudinaryService';
import { collection, getDocs, query, where, doc, getDoc, updateDoc } from 'firebase/firestore';
import { db } from '../../utils/firebase';

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

const AdminInventoryPanel = () => {
  const [items, setItems] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [bookings, setBookings] = useState([]);
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [activeBookingsCount, setActiveBookingsCount] = useState(0);

  // Form data state
  const [formData, setFormData] = useState(() => ({
    // Basic Information
    id: '',
    name: '',
    description: '',
    category: '',
    price: 0,
    availableQuantity: 1,
    totalQuantity: 1,

    // Specifications (array)
    specifications: ['', '', ''],

    // Images (single image for simplicity)
    image: null,
    imageFile: null
  }));

  const [uploadingImage, setUploadingImage] = useState(false);

  const { rentalItems } = useApp();

  const categories = [
    'tripod',
    'camera',
    'comset',
    'switcher',
    'audio-mixer',
    'monitor',
    'video-transmitter',
    'camera-dolly',
    'uncategorized'
  ];

  // Image mapping for predefined items
  const getPredefinedImage = (itemId) => {
    const filenameMap = {
      'sachtler-tripod': '/assets/items/Sachtler.png',
      'cartoni-tripod': '/assets/items/Cartoni.png',
      'eimage-tripod': '/assets/items/E-imageTripod.jpg',
      'pmw-200': '/assets/items/pmw.png',
      'sony-pmw-350k': '/assets/items/sony.png',
      'panasonic-hpx3100': '/assets/items/Panasonic.png',
      'saramonic-comset': '/assets/items/Saramonic.png',
      'lumantek-switcher': '/assets/items/Lumantek.png',
      'sony-mcx-500': '/assets/items/sony-switcher.png',
      'blackmagic-atem': '/assets/items/blackmagic-switcher.jpg',
      'behringer-mixer': '/assets/items/Behringer.png',
      'xtuga-mixer': '/assets/items/XTUGA-E22Mixer.jpg',
      'atem-monitor': '/assets/items/monitor.png',
      'lilliput-monitor': '/assets/items/LillitputMonitor.png',
      'tvlogic-monitor': '/assets/items/tvLogicMonitor.png',
      'accsoon-transmitter': '/assets/items/Accsoon.png',
      'hollyland-transmitter': '/assets/items/Hollyland.png',
      'dolly-platform': '/assets/items/DollyPlatformTracks.jpg',
      'wheels-slider': '/assets/items/heavyDutyDolly.png'
    };

    return filenameMap[itemId] || '/assets/items/default.png';
  };

  // Get image URL for any item
  const getItemImage = (item) => {
    if (!item) return '/assets/items/default.png';

    // Check for predefined item image first
    if (item.isPredefined && item.id) {
      const predefinedImage = getPredefinedImage(item.id);
      if (predefinedImage !== '/assets/items/default.png') {
        return predefinedImage;
      }
    }

    // Check for image property
    if (item.image) {
      if (item.image.startsWith('data:image') || item.image.startsWith('http') || item.image.startsWith('/')) {
        return item.image;
      }
    }

    // Check for Cloudinary data
    if (item.cloudinaryData && item.cloudinaryData.secure_url) {
      return item.cloudinaryData.secure_url;
    }

    return '/assets/items/default.png';
  };

  // Helper function to get complete item data
  const getCompleteItemData = (item) => {
    const completeItem = { ...item };

    // Try to get additional data from productInfo
    try {
      const savedProductInfo = localStorage.getItem('productInfo');
      if (savedProductInfo) {
        const productInfo = JSON.parse(savedProductInfo);
        if (productInfo[item.id]) {
          // Merge productInfo data with inventory data
          if (productInfo[item.id].description && productInfo[item.id].description.trim() !== '') {
            completeItem.description = productInfo[item.id].description;
          }
          // Also get image from productInfo if available
          if (productInfo[item.id].image && !completeItem.image) {
            completeItem.image = productInfo[item.id].image;
          }
          // Get specifications from productInfo
          if (productInfo[item.id].specifications && !completeItem.specifications) {
            completeItem.specifications = productInfo[item.id].specifications;
          }
        }
      }
    } catch (error) {
      console.error('Error getting complete item data:', error);
    }

    // Ensure specifications is an array
    if (!completeItem.specifications || !Array.isArray(completeItem.specifications)) {
      completeItem.specifications = [];
    }

    return completeItem;
  };

  // Format price without commas
  const formatPrice = (price) => {
    if (!price && price !== 0) return '0';
    const num = parseFloat(price) || 0;
    return num.toFixed(0);
  };

  // Parse price when saving
  const parsePrice = (priceString) => {
    return parseFloat(priceString.replace(/[^\d.]/g, '')) || 0;
  };

  // Enhanced item data normalization
  const normalizeItemData = (item) => {
    // Ensure all items have required fields
    const normalizedItem = {
      ...item,
      id: item.id || `item-${Date.now()}`,
      name: item.name || 'Unnamed Item',
      description: item.description || '',
      category: item.category || 'uncategorized',
      price: item.price || 0,
      availableQuantity: item.availableQuantity || item.quantity || 0,
      totalQuantity: item.totalQuantity || item.maxQuantity || 1,

      // Specifications
      specifications: Array.isArray(item.specifications) ? item.specifications : [],

      // Ensure isPackage is set for predefined packages
      isPackage: item.isPackage || false
    };

    // Try to get description from productInfo if item doesn't have one
    if (!normalizedItem.description || normalizedItem.description.trim() === '') {
      try {
        const savedProductInfo = localStorage.getItem('productInfo');
        if (savedProductInfo) {
          const productInfo = JSON.parse(savedProductInfo);
          if (productInfo[normalizedItem.id] && productInfo[normalizedItem.id].description) {
            normalizedItem.description = productInfo[normalizedItem.id].description;
          }
          // Also get specifications
          if (productInfo[normalizedItem.id] && productInfo[normalizedItem.id].specifications) {
            normalizedItem.specifications = productInfo[normalizedItem.id].specifications;
          }
        }
      } catch (error) {
        console.error('Error loading data from productInfo:', error);
      }
    }

    return normalizedItem;
  };

  // ==============================================
  // BOOKINGS INTEGRATION FUNCTIONS - DATE-SPECIFIC ONLY
  // ==============================================

  // Fetch all bookings from Firebase
  const fetchBookings = async () => {
    try {
      console.log('📅 Fetching bookings for inventory calculation...');

      const bookingsRef = collection(db, "bookings");
      const q = query(bookingsRef);
      const querySnapshot = await getDocs(q);

      const bookingsData = [];
      querySnapshot.forEach((doc) => {
        bookingsData.push({
          id: doc.id,
          ...doc.data()
        });
      });

      console.log('✅ Loaded bookings:', bookingsData.length);
      setBookings(bookingsData);

      // Count active bookings for selected date
      const activeBookingsOnDate = bookingsData.filter(booking => {
        const status = booking.status?.toLowerCase() || 'pending';
        return ['active', 'pending'].includes(status) &&
          isDateInRange(selectedDate, booking.startDate, booking.endDate);
      });
      setActiveBookingsCount(activeBookingsOnDate.length);

      return bookingsData;
    } catch (error) {
      console.error('Error fetching bookings:', error);
      showMessage('Error loading bookings data');
      return [];
    }
  };

  // Check if date is within booking range
  const isDateInRange = (date, startDate, endDate) => {
    const checkDate = new Date(date);
    const start = new Date(startDate);
    const end = new Date(endDate);

    // Reset times to compare dates only
    checkDate.setHours(0, 0, 0, 0);
    start.setHours(0, 0, 0, 0);
    end.setHours(0, 0, 0, 0);

    return checkDate >= start && checkDate <= end;
  };

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

  // Calculate reserved quantity ONLY for the selected date
  const calculateReservedQuantityForDate = (itemId, targetDate) => {
    if (!targetDate) return 0;

    let reserved = 0;

    bookings.forEach(booking => {
      // Check booking status - only count active/pending bookings
      const bookingStatus = booking.status?.toLowerCase() || 'pending';
      if (!['active', 'pending'].includes(bookingStatus)) {
        return; // Skip completed/cancelled bookings
      }

      // Check if target date is within booking range
      if (!isDateInRange(targetDate, booking.startDate, booking.endDate)) {
        return; // Skip bookings that don't include this date
      }

      // Get items from booking
      const bookingItems = getItemsFromBooking(booking);

      // Find this item in booking items
      const bookedItem = bookingItems.find(item => item.id === itemId);
      if (bookedItem) {
        reserved += bookedItem.quantity;
      }
    });

    return reserved;
  };

  // Calculate available quantity for an item on the selected date
  const calculateAvailableForDate = (item, date) => {
    const totalQuantity = item.totalQuantity || item.maxQuantity || 1;
    const reservedQuantity = calculateReservedQuantityForDate(item.id, date);

    return Math.max(0, totalQuantity - reservedQuantity);
  };

  // Update items with date-specific availability
  const updateItemsWithDateAvailability = (itemsArray, targetDate) => {
    return itemsArray.map(item => {
      const availableOnDate = calculateAvailableForDate(item, targetDate);
      const reservedOnDate = calculateReservedQuantityForDate(item.id, targetDate);
      const totalQuantity = item.totalQuantity || item.maxQuantity || 1;

      return {
        ...item,
        availableForDate: availableOnDate,
        reservedForDate: reservedOnDate,
        totalForDate: totalQuantity,
        isAvailableOnDate: availableOnDate > 0
      };
    });
  };

  // Get bookings that contain a specific item
  const getBookingsForItem = (itemId) => {
    return bookings.filter(booking => {
      const bookingItems = getItemsFromBooking(booking);
      return bookingItems.some(item => item.id === itemId);
    });
  };

  // Get active bookings for an item on the selected date
  const getActiveBookingsForItemOnDate = (itemId, date) => {
    return bookings.filter(booking => {
      // Check booking status
      const bookingStatus = booking.status?.toLowerCase() || 'pending';
      if (!['active', 'pending'].includes(bookingStatus)) {
        return false;
      }

      // Check date range
      if (!isDateInRange(date, booking.startDate, booking.endDate)) {
        return false;
      }

      // Check if item is in booking
      const bookingItems = getItemsFromBooking(booking);
      return bookingItems.some(item => item.id === itemId);
    });
  };

  // ==============================================
  // INVENTORY MANAGEMENT FUNCTIONS
  // ==============================================

  // Save inventory items to Firebase
  const saveInventoryToFirebase = async (inventoryItems) => {
    try {
      console.log('🔄 Saving inventory to Firebase:', inventoryItems.length, 'items');

      // Clean items before saving (remove File objects)
      const cleanItems = inventoryItems.map(item => {
        const { imageFile, ...cleanItem } = item;
        return cleanItem;
      });

      // Save to main inventory document
      const result = await firebaseService.saveInventoryItems(cleanItems);

      if (result.success) {
        console.log('✅ Inventory saved to Firebase successfully');
        return true;
      } else {
        console.error('❌ Failed to save inventory to Firebase:', result.error);
        return false;
      }
    } catch (error) {
      console.error('❌ Error saving inventory to Firebase:', error);
      return false;
    }
  };

  // Save predefined items to Firebase
  const savePredefinedItemsToFirebase = async (predefinedItems) => {
    try {
      console.log('🔄 Saving predefined items to Firebase:', predefinedItems.length, 'items');

      const result = await firebaseService.saveRentalItems(predefinedItems);

      if (result.success) {
        console.log('✅ Predefined items saved to Firebase successfully');
        return true;
      } else {
        console.error('❌ Failed to save predefined items to Firebase:', result.error);
        return false;
      }
    } catch (error) {
      console.error('❌ Error saving predefined items to Firebase:', error);
      return false;
    }
  };

  // Load ALL inventory items from all sources
  const loadAllInventoryItems = useCallback(async () => {
    try {
      console.log('🔄🔄🔄 LOAD ALL INVENTORY ITEMS - START');

      let allItems = [];
      let inventoryItemsMap = new Map(); // Store inventory items by id for quick lookup

      // 1. First, load user-added inventory items (MOST RELIABLE for quantities)
      try {
        const inventoryResult = await firebaseService.getInventoryItems();
        if (inventoryResult.success && inventoryResult.inventoryItems.length > 0) {
          console.log('📦 INVENTORY ITEMS from inventory collection (primary source):');
          inventoryResult.inventoryItems.forEach((item, i) => {
            console.log(`  ${i + 1}. ${item.name || item.id}: Total=${item.totalQuantity}, Available=${item.availableQuantity}`);
            // Store in map for quick lookup
            inventoryItemsMap.set(item.id, {
              ...item,
              isPredefined: false,
              source: 'inventory'
            });
          });

          // Add inventory items first (they have the most accurate quantity data)
          allItems = [...inventoryResult.inventoryItems.map(item => ({
            ...item,
            isPredefined: false,
            source: 'inventory'
          }))];
        }
      } catch (inventoryError) {
        console.error('Error loading inventory items:', inventoryError);
      }

      // 2. Load predefined rental items (merge with inventory data if exists)
      try {
        const rentalResult = await firebaseService.getRentalItems();
        if (rentalResult.success && rentalResult.rentalItems.length > 0) {
          console.log('📦 PREDEFINED ITEMS from rentalItems collection:');

          rentalResult.rentalItems.forEach((item, i) => {
            console.log(`  ${i + 1}. ${item.name || item.id}: Total=${item.totalQuantity}, Available=${item.availableQuantity}, Max=${item.maxQuantity}`);

            // Check if we already have this item from inventory collection
            const existingFromInventory = inventoryItemsMap.get(item.id);

            if (existingFromInventory) {
              console.log(`  ⚠️ ${item.name || item.id} exists in both collections. Using inventory data for quantities.`);
              // Don't add duplicate - inventory collection has priority
            } else {
              // Add predefined item (not in inventory collection)
              allItems.push({
                ...item,
                isPredefined: true,
                source: 'predefined'
              });
            }
          });
        }
      } catch (rentalError) {
        console.error('Error loading rental items:', rentalError);
      }

      // 3. Load from localStorage as final fallback
      try {
        const savedInventoryItems = localStorage.getItem('rentalItems');
        if (savedInventoryItems) {
          const inventoryItems = JSON.parse(savedInventoryItems);
          console.log('📦 ITEMS from localStorage rentalItems:', inventoryItems.length);

          inventoryItems.forEach(item => {
            const existingItem = allItems.find(i => i.id === item.id);
            if (!existingItem) {
              allItems.push({
                ...item,
                isPredefined: false,
                source: 'inventory'
              });
            }
          });
        }
      } catch (localStorageError) {
        console.error('Error loading from localStorage:', localStorageError);
      }

      console.log('🔄🔄🔄 LOAD ALL INVENTORY ITEMS - END');
      console.log('📊 Total items loaded:', allItems.length);

      // Remove any remaining duplicates (keep first occurrence)
      const uniqueItems = [];
      const seenIds = new Set();

      allItems.forEach(item => {
        const itemId = item.id;
        if (itemId && !seenIds.has(itemId)) {
          seenIds.add(itemId);
          uniqueItems.push(item);
        }
      });

      const normalizedItems = uniqueItems.map(item => normalizeItemData(item));

      return normalizedItems;
    } catch (error) {
      console.error('❌ Error loading all inventory items:', error);
      return [];
    }
  }, []);

  // Refresh inventory with date-specific availability
  const refreshInventory = async () => {
    setRefreshing(true);
    try {
      console.log('🔄 Refreshing inventory with date-specific availability...');

      // Clear current state first
      setItems([]);

      // 1. Load fresh data from all sources
      const freshItems = await loadAllInventoryItems();

      // 2. Load bookings for calendar integration
      const freshBookings = await fetchBookings();

      if (freshItems.length === 0) {
        console.log('ℹ️ No items found in any data source');
        setItems([]);
        showMessage('No inventory items found in any data source.');
      } else {
        // 3. Update items with date-specific availability
        const itemsWithAvailability = updateItemsWithDateAvailability(freshItems, selectedDate);

        console.log(`✅ Refreshed ${freshItems.length} items for date: ${selectedDate}`);
        setItems(itemsWithAvailability);
      }

      // Log details about what was loaded
      console.log('📊 Refresh details:');
      console.log('- Predefined items:', freshItems.filter(item => item.isPredefined).length);
      console.log('- User-added items:', freshItems.filter(item => !item.isPredefined).length);
      console.log('- Bookings affecting selected date:', activeBookingsCount);

    } catch (error) {
      console.error('❌ Error refreshing inventory:', error);
      showMessage(`❌ Error refreshing inventory: ${error.message}`);
    } finally {
      setRefreshing(false);
    }
  };

  // Add this useEffect near the other useEffects (around line 416-460)
  useEffect(() => {
    // Listen for cross-tab updates via localStorage
    const handleCrossTabUpdate = (e) => {
      if (e.key === 'CROSS_TAB_INVENTORY_UPDATE') {
        try {
          const update = JSON.parse(e.newValue);
          console.log('📢 Cross-tab update received:', update);

          if (update && update.type === 'INVENTORY_QUANTITY_UPDATE') {
            // Force a complete refresh
            refreshInventory();

            // Clear the storage item
            localStorage.removeItem('CROSS_TAB_INVENTORY_UPDATE');
          }
        } catch (error) {
          console.error('Error processing cross-tab update:', error);
        }
      }
    };

    // Also check on component mount
    const pendingUpdate = localStorage.getItem('CROSS_TAB_INVENTORY_UPDATE');
    if (pendingUpdate) {
      try {
        const update = JSON.parse(pendingUpdate);
        if (update && update.type === 'INVENTORY_QUANTITY_UPDATE') {
          console.log('📢 Processing pending cross-tab update on mount');
          refreshInventory();
          localStorage.removeItem('CROSS_TAB_INVENTORY_UPDATE');
        }
      } catch (error) {
        console.error('Error processing pending update:', error);
      }
    }

    window.addEventListener('storage', handleCrossTabUpdate);

    return () => {
      window.removeEventListener('storage', handleCrossTabUpdate);
    };
  }, [refreshInventory]);

  // Listen for inventory updates from Maintenance Panel
  useEffect(() => {
    const handleInventoryForceRefresh = (event) => {
      console.log('📢 Force refresh requested from Maintenance Panel:', event.detail);
      
      // Force reload from ALL sources
      console.log('🔄 FORCE REFRESH triggered from Maintenance Panel');
      
      // Clear all caches
      localStorage.removeItem('rentalItems_cache');
      localStorage.removeItem('inventory_cache');
      
      // Reload fresh data
      refreshInventory();
    };

    window.addEventListener('inventoryForceRefresh', handleInventoryForceRefresh);
    
    return () => {
      window.removeEventListener('inventoryForceRefresh', handleInventoryForceRefresh);
    };
  }, [refreshInventory]);

  // Initial load on component mount
  useEffect(() => {
    loadInventory();
  }, []);

  // Initial load function
  const loadInventory = async () => {
    setLoading(true);
    try {
      console.log('🔄 Initial inventory load...');
      const loadedItems = await loadAllInventoryItems();

      // Load bookings for integration
      await fetchBookings();

      if (loadedItems.length > 0) {
        // Always show date-specific availability
        const itemsWithAvailability = updateItemsWithDateAvailability(loadedItems, selectedDate);
        console.log('✅ Initial load successful');
        setItems(itemsWithAvailability);
      } else {
        console.log('ℹ️ No items found on initial load');
        setItems([]);
      }

    } catch (error) {
      console.error('❌ Error loading inventory:', error);
    } finally {
      setLoading(false);
    }
  };

  // Update items when selected date changes
  useEffect(() => {
    if (items.length > 0 && bookings.length > 0) {
      const updatedItems = updateItemsWithDateAvailability(items, selectedDate);
      setItems(updatedItems);

      // Update active bookings count for the new date
      const activeBookingsOnDate = bookings.filter(booking => {
        const status = booking.status?.toLowerCase() || 'pending';
        return ['active', 'pending'].includes(status) &&
          isDateInRange(selectedDate, booking.startDate, booking.endDate);
      });
      setActiveBookingsCount(activeBookingsOnDate.length);
    }
  }, [selectedDate]);

  // Update items when bookings change
  useEffect(() => {
    if (items.length > 0 && bookings.length > 0) {
      const updatedItems = updateItemsWithDateAvailability(items, selectedDate);
      setItems(updatedItems);
    }
  }, [bookings]);

  // Save to localStorage and update product info
  useEffect(() => {
    if (items.length === 0) return;

    // Separate predefined items from user-added items
    const predefinedItems = items.filter(item => item.isPredefined);
    const userAddedItems = items.filter(item => !item.isPredefined);

    // Save user-added items to localStorage
    if (userAddedItems.length > 0) {
      localStorage.setItem('rentalItems', JSON.stringify(userAddedItems));

      // Update product info for information.js
      updateProductInfo(predefinedItems, userAddedItems);
    }
  }, [items]);

  // Update product information
  const updateProductInfo = (predefinedItems, userAddedItems) => {
    let productInfo = {};

    // First, load existing productInfo
    try {
      const savedProductInfo = localStorage.getItem('productInfo');
      if (savedProductInfo) {
        productInfo = JSON.parse(savedProductInfo);
      }
    } catch (error) {
      console.error('Error loading existing productInfo:', error);
    }

    // For predefined items, update title and description but preserve rich descriptions if they exist
    predefinedItems.forEach(item => {
      if (productInfo[item.id]) {
        // Check if we should preserve the existing rich description or use the new one
        const existingDescription = productInfo[item.id].description || '';
        const hasRichDescription = existingDescription.length > 100;

        productInfo[item.id] = {
          ...productInfo[item.id],
          title: item.name,
          description: hasRichDescription ? existingDescription : item.description || existingDescription,
          // Preserve existing specifications or update
          specifications: productInfo[item.id].specifications || item.specifications || [],
          category: item.category || 'uncategorized'
        };
      } else {
        // New predefined item (shouldn't happen)
        productInfo[item.id] = {
          title: item.name,
          image: getPredefinedImage(item.id),
          description: item.description || 'No description available.',
          specifications: item.specifications || [],
          category: item.category || 'uncategorized'
        };
      }
    });

    // For user-added items, update everything
    userAddedItems.forEach(item => {
      productInfo[item.id] = {
        title: item.name,
        image: getItemImage(item),
        description: item.description || 'No description available.',
        specifications: item.specifications || [],
        category: item.category || 'uncategorized',
        isPackage: item.isPackage || false
      };
    });

    localStorage.setItem('productInfo', JSON.stringify(productInfo));
  };

  // ==============================================
  // FORM HANDLERS
  // ==============================================

  // Handle basic input changes
  const handleInputChange = (e) => {
    const { name, value, type } = e.target;

    if (name === 'price') {
      const formattedValue = value.replace(/[^\d.]/g, '');
      setFormData(prev => ({
        ...prev,
        [name]: formattedValue
      }));
    } else if (name === 'totalQuantity' || name === 'availableQuantity') {
      const numValue = parseInt(value) || 0;
      setFormData(prev => ({
        ...prev,
        [name]: numValue
      }));
    } else if (name === 'image') {
      // Handle image file upload
      const file = e.target.files[0];
      if (file) {
        const reader = new FileReader();
        reader.onload = (e) => {
          setFormData(prev => ({
            ...prev,
            image: e.target.result,
            imageFile: file
          }));
        };
        reader.readAsDataURL(file);
      }
    } else {
      setFormData(prev => ({
        ...prev,
        [name]: value
      }));
    }
  };

  // Handle specification changes
  const handleSpecificationChange = (index, value) => {
    setFormData(prev => {
      const newSpecifications = [...(prev.specifications || [])];
      newSpecifications[index] = value;
      return {
        ...prev,
        specifications: newSpecifications
      };
    });
  };

  // Add specification field
  const addSpecification = () => {
    setFormData(prev => ({
      ...prev,
      specifications: [...(prev.specifications || []), '']
    }));
  };

  // Remove specification field
  const removeSpecification = (index) => {
    setFormData(prev => {
      const currentSpecs = prev.specifications || [];
      const newSpecifications = currentSpecs.filter((_, i) => i !== index);
      return {
        ...prev,
        specifications: newSpecifications
      };
    });
  };

  // Upload image to Cloudinary
  const uploadImageToCloudinary = async () => {
    if (!formData.imageFile) return formData.image;

    setUploadingImage(true);

    try {
      // Upload to Cloudinary
      const cloudinaryResult = await cloudinaryService.uploadImage(formData.imageFile);
      setUploadingImage(false);
      return cloudinaryResult.secure_url;
    } catch (error) {
      console.error('Error uploading image:', error);
      setUploadingImage(false);
      throw error;
    }
  };

  // Form submission
  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);

    try {
      // Upload image to Cloudinary if there's a new image
      let finalImage = formData.image;
      if (formData.imageFile) {
        finalImage = await uploadImageToCloudinary();
      }

      // Parse price
      const parsedPrice = parsePrice(formData.price || '0');

      // Prepare item data
      const itemData = {
        // Basic Info
        id: editingItem?.id || formData.name.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
        name: formData.name || '',
        description: formData.description || '',
        category: formData.category || '',
        price: parsedPrice,
        availableQuantity: parseInt(formData.availableQuantity) || 1,
        totalQuantity: parseInt(formData.totalQuantity) || 1,

        // Specifications (filter out empty strings)
        specifications: (formData.specifications || []).filter(spec => spec && spec.trim() !== ''),

        // Image
        image: finalImage || getPredefinedImage(editingItem?.id) || '/assets/items/default.png',

        // Metadata
        createdAt: editingItem?.createdAt || new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        isPredefined: editingItem?.isPredefined || false,
        source: editingItem?.source || 'inventory'
      };

      // Generate unique ID if needed
      let itemId = itemData.id;
      let counter = 1;
      while (items.some(item => item.id === itemId && item !== editingItem)) {
        itemId = `${itemData.id}-${counter}`;
        counter++;
      }
      itemData.id = itemId;

      // Check if editing a predefined item
      const isEditingPredefined = editingItem?.isPredefined || false;

      let updatedItems;
      if (editingItem) {
        console.log('✏️ Updating item:', editingItem.id);
        console.log('Is predefined item?', isEditingPredefined);

        // Create the updated item object
        const updatedItem = {
          ...editingItem, // Start with the original item
          name: formData.name || '',
          description: formData.description || '',
          category: formData.category || '',
          price: parsedPrice,
          availableQuantity: parseInt(formData.availableQuantity) || 1,
          totalQuantity: parseInt(formData.totalQuantity) || 1,

          // Specifications
          specifications: (formData.specifications || []).filter(spec => spec && spec.trim() !== ''),

          // Update image if changed (but predefined items keep their original image path)
          image: isEditingPredefined ? editingItem.image : finalImage || editingItem.image || '/assets/items/default.png'
        };

        // Update the items array
        updatedItems = items.map(item =>
          item.id === editingItem.id ? updatedItem : item
        );

        console.log('✅ Item updated locally:', updatedItem);

        // If it's a predefined item, save to Firebase rentalItems
        if (isEditingPredefined) {
          const predefinedItems = updatedItems.filter(item => item.isPredefined);
          const firebaseSuccess = await savePredefinedItemsToFirebase(predefinedItems);

          if (!firebaseSuccess) {
            showMessage('⚠️ Predefined item updated locally but failed to save to Firebase.');
          }
        }
      } else {
        // Adding new item
        console.log('➕ Adding new item with ID:', itemId);
        updatedItems = [...items, itemData];
      }

      // Update items with date-specific availability
      const itemsWithAvailability = updateItemsWithDateAvailability(updatedItems, selectedDate);
      setItems(itemsWithAvailability);

      // If it's NOT a predefined item, save to Firebase inventory
      if (!isEditingPredefined) {
        const userAddedItems = updatedItems.filter(item => !item.isPredefined);

        console.log('🔄 Saving', userAddedItems.length, 'user-added items to Firebase inventory...');

        const firebaseSuccess = await saveInventoryToFirebase(userAddedItems);

        if (firebaseSuccess) {
          console.log('✅ Item saved successfully to Firebase inventory');

          // Update localStorage
          localStorage.setItem('rentalItems', JSON.stringify(userAddedItems));

          // Update productInfo for Information page
          updateProductInfoForItem(editingItem ? editingItem.id : null, formData, finalImage);

          showMessage('✅ Item saved successfully!');
        } else {
          console.log('⚠️ Item saved locally but failed to save to Firebase inventory');
          showMessage('⚠️ Item saved locally but failed to save to database. Please check your connection.');
        }
      } else {
        // For predefined items, still update productInfo
        updateProductInfoForItem(editingItem.id, formData, finalImage);
        showMessage('✅ Predefined item updated successfully!');
      }

      // Trigger refresh to sync with other components
      setTimeout(() => {
        refreshInventory();
        // Dispatch event to update other components
        window.dispatchEvent(new Event('inventoryUpdated'));
      }, 500);

      resetForm();
    } catch (error) {
      console.error('❌ Error saving item:', error);
      showMessage('❌ Error saving item: ' + error.message);
    } finally {
      setSaving(false);
    }
  };

  // Update productInfo for a specific item
  const updateProductInfoForItem = (itemId, formData, image = '') => {
    try {
      let productInfo = {};

      // Load existing productInfo
      const savedProductInfo = localStorage.getItem('productInfo');
      if (savedProductInfo) {
        productInfo = JSON.parse(savedProductInfo);
      }

      // Create or update the item in productInfo
      const targetId = itemId || (formData.name || '').toLowerCase().replace(/[^a-z0-9]+/g, '-');
      const finalImage = image || formData.image || getPredefinedImage(targetId) || '/assets/items/default.png';

      productInfo[targetId] = {
        title: formData.name || '',
        image: finalImage,
        description: formData.description || 'No description available.',
        specifications: (formData.specifications || []).filter(spec => spec && spec.trim() !== ''),
        category: formData.category || 'uncategorized'
      };

      localStorage.setItem('productInfo', JSON.stringify(productInfo));
      console.log('✅ Updated productInfo for item:', targetId);
    } catch (error) {
      console.error('Error updating productInfo:', error);
    }
  };

  // Open form for editing
  const handleEdit = (item) => {
    const completeItem = getCompleteItemData(item);

    setFormData({
      // Basic Information
      id: completeItem.id || '',
      name: completeItem.name || '',
      description: completeItem.description || '',
      category: completeItem.category || '',
      price: formatPrice(completeItem.price || 0),
      availableQuantity: completeItem.availableQuantity || completeItem.quantity || 1,
      totalQuantity: completeItem.totalQuantity || completeItem.maxQuantity || 1,

      // Specifications
      specifications: completeItem.specifications && completeItem.specifications.length > 0
        ? [...completeItem.specifications, '']
        : ['', '', ''],

      // Image
      image: getItemImage(completeItem),
      imageFile: null
    });

    setEditingItem(completeItem);
    setShowForm(true);
  };

  // Reset form
  const resetForm = () => {
    setFormData({
      id: '',
      name: '',
      description: '',
      category: '',
      price: 0,
      availableQuantity: 1,
      totalQuantity: 1,
      specifications: ['', '', ''],
      image: null,
      imageFile: null
    });
    setEditingItem(null);
    setShowForm(false);
    setUploadingImage(false);
  };

  // Handle delete - PREVENT deletion of predefined items
  const handleDelete = async (itemId) => {
    const itemToDelete = items.find(item => item.id === itemId);

    if (!itemToDelete) return;

    // PREVENT deletion of predefined items
    if (itemToDelete.isPredefined) {
      showMessage('❌ Predefined items cannot be deleted. You can only edit them.');
      return;
    }

    if (window.confirm('Are you sure you want to delete this item? This will remove it from all sections including Rent Items and Information pages.')) {
      console.log('🗑️ Deleting item:', itemId);

      try {
        // 1. Remove from local state
        const updatedItems = items.filter(item => item.id !== itemId);
        setItems(updatedItems);

        // 2. Remove from localStorage rentalItems
        const savedInventoryItems = localStorage.getItem('rentalItems');
        if (savedInventoryItems) {
          const inventoryItems = JSON.parse(savedInventoryItems);
          const updatedInventoryItems = inventoryItems.filter(item => item.id !== itemId);
          localStorage.setItem('rentalItems', JSON.stringify(updatedInventoryItems));
        }

        // Update Firebase - save updated user items
        const userAddedItems = updatedItems.filter(item => !item.isPredefined);

        console.log('🔄 Updating Firebase after deletion...');
        await saveInventoryToFirebase(userAddedItems);

        // 3. Remove from productInfo in localStorage
        const savedProductInfo = localStorage.getItem('productInfo');
        if (savedProductInfo) {
          const productInfo = JSON.parse(savedProductInfo);
          delete productInfo[itemId];
          localStorage.setItem('productInfo', JSON.stringify(productInfo));
        }

        // 4. Remove from any active cart
        const savedCart = localStorage.getItem('selectedItems');
        if (savedCart) {
          const cartItems = JSON.parse(savedCart);
          const updatedCartItems = cartItems.filter(item => item.id !== itemId);
          if (updatedCartItems.length > 0) {
            localStorage.setItem('selectedItems', JSON.stringify(updatedCartItems));
          } else {
            localStorage.removeItem('selectedItems');
          }
        }

        // 5. Trigger refresh to sync with other components
        setTimeout(() => {
          refreshInventory();
          window.dispatchEvent(new Event('inventoryUpdated'));
        }, 500);

        console.log(`✅ Item ${itemId} deleted successfully`);
        showMessage('✅ Item deleted successfully!');
      } catch (error) {
        console.error('❌ Error deleting item:', error);
        showMessage('❌ Error deleting item. Please try again.');
      }
    }
  };

  const getItemsByCategory = (category) => {
    if (category === 'all') return items;
    return items.filter(item => item.category === category);
  };

  // Get stock status based on date-specific availability
  const getStockStatus = (item) => {
    const availableOnDate = item.availableForDate || 0;
    const totalOnDate = item.totalForDate || item.totalQuantity || 1;

    if (availableOnDate === 0) return 'out-of-stock';
    if (availableOnDate < totalOnDate * 0.3) return 'low-stock';
    return 'in-stock';
  };

  // Get stock display for the selected date
  const getStockDisplay = (item) => {
    const availableOnDate = item.availableForDate || 0;
    const reservedOnDate = item.reservedForDate || 0;
    const totalOnDate = item.totalForDate || item.totalQuantity || 1;

    return `${availableOnDate}/${totalOnDate}`;
  };

  const filteredItems = getItemsByCategory(selectedCategory);

  if (loading && items.length === 0) {
    return (
      <div className="inventory-panel">
        <div className="loading-container">
          <div className="spinner"></div>
          <p>Loading inventory data...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="inventory-panel">
      <div className="panel-content">
        {/* Calendar Integration Controls */}
        <div className="calendar-integration-section" style={{
          marginBottom: '2rem',
          padding: '1.5rem',
          backgroundColor: '#f8f9fa',
          borderRadius: '8px',
          border: '1px solid #dee2e6'
        }}>
          <h3 style={{ marginBottom: '1rem', color: '#495057' }}>📅 Inventory Availability</h3>

          <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <label style={{ fontWeight: '500', whiteSpace: 'nowrap' }}>Check Availability for Date:</label>
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                style={{
                  padding: '0.5rem',
                  border: '1px solid #ced4da',
                  borderRadius: '4px',
                  fontSize: '1rem'
                }}
              />
            </div>

            <button
              onClick={refreshInventory}
              className="btn btn-info"
              style={{ padding: '0.5rem 1.5rem' }}
              disabled={refreshing}
            >
              {refreshing ? 'Refreshing...' : 'Refresh'}
            </button>
            <div className="controls-left">
              <button
                onClick={() => setShowForm(true)}
                className="btn btn-primary"
                disabled={saving || refreshing}
              >
                + Add New Item
              </button>
            </div>

            <div style={{
              fontSize: '0.875rem',
              color: '#6c757d',
              backgroundColor: '#e9ecef',
              padding: '0.5rem 1rem',
              borderRadius: '4px'
            }}>
              ⚡ {activeBookingsCount} bookings on {selectedDate}
            </div>
          </div>
        </div>

        {/* Controls Section */}
        <div className="inventory-controls">


          <div className="controls-right">
            <div className="category-filter">
              <label>Filter by Category:</label>
              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                disabled={refreshing}
              >
                <option value="all">All Categories</option>
                {categories.map(category => (
                  <option key={category} value={category}>
                    {category.charAt(0).toUpperCase() + category.slice(1)}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Inventory Summary */}
        <div className="inventory-summary">
          <div className="summary-card total-items">
            <h3>Total Items</h3>
            <p className="summary-number">{items.length}</p>
          </div>
          <div className="summary-card in-stock">
            <h3>Available</h3>
            <p className="summary-number">
              {items.filter(item => item.isAvailableOnDate).length}
            </p>
          </div>
          <div className="summary-card out-of-stock">
            <h3>Reserved</h3>
            <p className="summary-number">
              {items.filter(item => !item.isAvailableOnDate).length}
            </p>
          </div>
          <div className="summary-card predefined-items">
            <h3>Predefined</h3>
            <p className="summary-number">
              {items.filter(item => item.isPredefined).length}
            </p>
          </div>
        </div>

        {/* Inventory Table */}
        <div className="inventory-table-section">
          <h3>
            Inventory Items for {new Date(selectedDate).toLocaleDateString()} ({filteredItems.length})
            {refreshing && <span className="refreshing-badge">Refreshing...</span>}
          </h3>

          {filteredItems.length === 0 ? (
            <div className="no-items-message">
              <p>No items found in this category.</p>
              <button
                onClick={() => setShowForm(true)}
                className="btn btn-primary"
              >
                Add Your First Item
              </button>
            </div>
          ) : (
            <div className="inventory-table-container">
              <table className="inventory-table">
                <thead>
                  <tr>
                    <th>Image</th>
                    <th>Item Name</th>
                    <th>Type</th>
                    <th>Category</th>
                    <th>Price</th>
                    <th>Bookings</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredItems.map(item => {
                    const dateBookings = getActiveBookingsForItemOnDate(item.id, selectedDate);

                    return (
                      <tr key={item.id} className={`inventory-row ${getStockStatus(item)}`}>
                        <td className="item-image-cell">
                          <div className="item-image-container">
                            <img
                              src={getItemImage(item)}
                              alt={item.name}
                              className="item-thumbnail"
                              onError={(e) => {
                                e.target.src = '/assets/items/default.png';
                              }}
                            />
                          </div>
                        </td>
                        <td className="item-name-cell">
                          <strong>{item.name}</strong>
                          {item.isPackage && <span className="package-badge">Package</span>}
                          {!item.isAvailableOnDate && (
                            <span className="unavailable-badge" style={{
                              display: 'inline-block',
                              marginLeft: '0.5rem',
                              fontSize: '0.75rem',
                              backgroundColor: '#dc3545',
                              color: 'white',
                              padding: '0.125rem 0.375rem',
                              borderRadius: '4px'
                            }}>
                              Reserved
                            </span>
                          )}
                        </td>
                        <td className="item-type">
                          {item.isPredefined ? (
                            <span className="type-badge predefined">Predefined</span>
                          ) : (
                            <span className="type-badge custom">Custom</span>
                          )}
                        </td>
                        <td className="item-category">
                          <span className="category-badge">{item.category || 'uncategorized'}</span>
                        </td>
                        <td className="item-price">
                          ₱{formatPrice(item.price || 0)}
                        </td>
                        <td className="item-stock">
                          {getStockDisplay(item)}
                        </td>
                        <td className="item-actions">
                          <button
                            onClick={() => handleEdit(item)}
                            className="btn btn-warning btn-sm"
                            title={item.isPredefined ? "Edit Predefined Item" : "Edit Item Details"}
                            disabled={refreshing}
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => handleDelete(item.id)}
                            className="btn btn-danger btn-sm"
                            title={item.isPredefined ? "Predefined items cannot be deleted" : "Delete Item"}
                            disabled={item.isPredefined || refreshing}
                            style={item.isPredefined ? { opacity: 0.5, cursor: 'not-allowed' } : {}}
                          >
                            Delete
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Item Form Modal */}
      {showForm && (
        <div className="modal-overlay">
          <div className="modal-content inventory-form">
            <div className="modal-header">
              <h2>{editingItem ? 'Edit Item' : 'Add New Item'}</h2>
              {editingItem?.isPredefined && (
                <div className="predefined-warning" style={{
                  backgroundColor: '#fff3cd',
                  color: '#856404',
                  padding: '5px 10px',
                  borderRadius: '4px',
                  fontSize: '14px',
                  marginTop: '5px'
                }}>
                  ⚠️ Editing a predefined system item
                </div>
              )}
              <button className="modal-close" onClick={resetForm}>×</button>
            </div>

            <form onSubmit={handleSubmit} className="inventory-form-content">
              {uploadingImage && (
                <div className="uploading-overlay">
                  <div className="uploading-progress">
                    <div className="spinner"></div>
                    <p>Uploading image...</p>
                  </div>
                </div>
              )}

              <div className="form-grid">
                {/* Basic Information */}
                <div className="form-group">
                  <label>Item Name *</label>
                  <input
                    type="text"
                    name="name"
                    value={formData.name || ''}
                    onChange={handleInputChange}
                    required
                    disabled={saving || refreshing}
                    placeholder="e.g., Sony Camera, Tripod Stand"
                  />
                </div>

                <div className="form-group">
                  <label>Category *</label>
                  <select
                    name="category"
                    value={formData.category || ''}
                    onChange={handleInputChange}
                    required
                    disabled={saving || refreshing}
                  >
                    <option value="">Select Category</option>
                    {categories.map(category => (
                      <option key={category} value={category}>
                        {category.charAt(0).toUpperCase() + category.slice(1)}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="form-group">
                  <label>Price (₱) *</label>
                  <input
                    type="text"
                    name="price"
                    value={formatPrice(formData.price || 0)}
                    onChange={handleInputChange}
                    required
                    disabled={saving || refreshing}
                    placeholder="2500"
                    pattern="[0-9]*"
                    inputMode="numeric"
                  />
                </div>

                <div className="form-group">
                  <label>Total Quantity *</label>
                  <input
                    type="number"
                    name="totalQuantity"
                    value={formData.totalQuantity || 1}
                    onChange={handleInputChange}
                    min="1"
                    required
                    disabled={saving || refreshing}
                    placeholder="Total items available"
                  />
                </div>

                <div className="form-group">
                  <label>Available Quantity *</label>
                  <input
                    type="number"
                    name="availableQuantity"
                    value={formData.availableQuantity || 1}
                    onChange={handleInputChange}
                    min="0"
                    max={formData.totalQuantity || 1}
                    required
                    disabled={saving || refreshing}
                    placeholder="Currently available items"
                  />
                  <p style={{ fontSize: '0.75rem', color: '#6c757d', marginTop: '0.25rem' }}>
                    Note: Actual availability on specific dates depends on bookings
                  </p>
                </div>

                <div className="form-group full-width">
                  <label>Description *</label>
                  <textarea
                    name="description"
                    value={formData.description || ''}
                    onChange={handleInputChange}
                    rows="4"
                    placeholder="Describe the item features, specifications, and usage..."
                    disabled={saving || refreshing}
                    required
                  />
                  <p style={{ fontSize: '0.8rem', color: '#666', marginTop: '0.5rem' }}>
                    This description will appear in the Information page
                  </p>
                </div>

                {/* Specifications Section */}
                <div className="form-group full-width">
                  <label>Specifications</label>
                  <div className="specifications-container">
                    {(formData.specifications || []).map((spec, index) => (
                      <div key={index} className="specification-input-group">
                        <input
                          type="text"
                          value={spec || ''}
                          onChange={(e) => handleSpecificationChange(index, e.target.value)}
                          placeholder={`Specification ${index + 1} (e.g., "4K Resolution", "20MP Sensor")`}
                          disabled={saving || refreshing}
                          className="spec-input"
                        />
                        <button
                          type="button"
                          onClick={() => removeSpecification(index)}
                          className="btn btn-danger btn-sm"
                          disabled={saving || refreshing || (formData.specifications || []).length <= 1}
                        >
                          Remove
                        </button>
                      </div>
                    ))}

                    <button
                      type="button"
                      onClick={addSpecification}
                      className="btn btn-secondary btn-sm"
                      disabled={saving || refreshing}
                    >
                      + Add Specification
                    </button>
                  </div>
                  <p style={{ fontSize: '0.8rem', color: '#666', marginTop: '0.5rem' }}>
                    These specifications will appear as bullet points in the Information page
                  </p>
                </div>

                {/* Image Upload */}
                <div className="form-group full-width">
                  <label>Item Image</label>
                  <input
                    type="file"
                    accept="image/*"
                    name="image"
                    onChange={handleInputChange}
                    disabled={saving || refreshing || uploadingImage || editingItem?.isPredefined}
                  />
                  {editingItem?.isPredefined && (
                    <p style={{ fontSize: '0.8rem', color: '#666', marginTop: '0.5rem' }}>
                      Note: Predefined items use system images. Custom images are not supported.
                    </p>
                  )}
                  {formData.image && (
                    <div className="image-preview">
                      <img src={formData.image} alt="Preview" />
                      <p style={{ fontSize: '0.8rem', color: '#666', marginTop: '0.5rem' }}>
                        This image will appear in Rent Items and Information pages
                      </p>
                    </div>
                  )}
                </div>
              </div>

              <div className="form-actions">
                <button
                  type="button"
                  onClick={resetForm}
                  className="btn btn-secondary"
                  disabled={saving || refreshing || uploadingImage}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={saving || refreshing || uploadingImage}
                >
                  {saving ? 'Saving...' :
                    uploadingImage ? 'Uploading Image...' :
                      refreshing ? 'Refreshing...' :
                        editingItem ? 'Update Item' : 'Save Item'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};

export default AdminInventoryPanel;