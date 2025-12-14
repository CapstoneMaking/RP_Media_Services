// AdminInventoryPanel.js - SIMPLIFIED FORM WITH ONLY ESSENTIAL FIELDS
import React, { useState, useEffect } from 'react';
import { useApp } from '../../context/AppContext';
import { firebaseService } from '../../services/firebaseService';
import { cloudinaryService } from '../../services/cloudinaryService';

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
  
  // Form data state - SIMPLIFIED
  const [formData, setFormData] = useState(() => ({
    // Basic Information (ONLY ESSENTIAL FIELDS)
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
      reservedQuantity: item.reservedQuantity || 0,
      
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
  const loadAllInventoryItems = async () => {
    try {
      console.log('🔄 Loading ALL inventory items...');
      
      let allItems = [];
      
      // 1. Load predefined rental items from system/rentalInventory
      try {
        const rentalResult = await firebaseService.getRentalItems();
        if (rentalResult.success && rentalResult.rentalItems.length > 0) {
          console.log('✅ Loaded', rentalResult.rentalItems.length, 'predefined items from Firebase');
          // Mark predefined items
          const markedPredefinedItems = rentalResult.rentalItems.map(item => ({
            ...item,
            isPredefined: true,
            source: 'predefined'
          }));
          allItems = [...markedPredefinedItems];
        } else {
          console.log('ℹ️ No predefined items found in Firebase');
        }
      } catch (rentalError) {
        console.error('Error loading rental items:', rentalError);
      }
      
      // 2. Load user-added inventory items from inventory/currentInventory
      try {
        const inventoryResult = await firebaseService.getInventoryItems();
        if (inventoryResult.success && inventoryResult.inventoryItems.length > 0) {
          console.log('✅ Loaded', inventoryResult.inventoryItems.length, 'inventory items from Firebase');
          // Mark inventory items
          const markedInventoryItems = inventoryResult.inventoryItems.map(item => ({
            ...item,
            isPredefined: false,
            source: 'inventory'
          }));
          allItems = [...allItems, ...markedInventoryItems];
        } else {
          console.log('ℹ️ No inventory items found in inventory/currentInventory');
        }
      } catch (inventoryError) {
        console.error('Error loading inventory items:', inventoryError);
      }
      
      // 3. Load from localStorage as final fallback
      try {
        const savedInventoryItems = localStorage.getItem('rentalItems');
        if (savedInventoryItems) {
          const inventoryItems = JSON.parse(savedInventoryItems);
          console.log('✅ Loaded', inventoryItems.length, 'items from localStorage');
          // Mark as inventory items if not already marked
          const markedLocalItems = inventoryItems.map(item => {
            const existingItem = allItems.find(i => i.id === item.id);
            if (existingItem) {
              return existingItem; // Skip duplicates
            }
            return {
              ...item,
              isPredefined: false,
              source: 'inventory'
            };
          });
          allItems = [...allItems, ...markedLocalItems];
        }
      } catch (localStorageError) {
        console.error('Error loading from localStorage:', localStorageError);
      }
      
      // Remove duplicates based on item id (keep the first occurrence)
      const uniqueItems = [];
      const seenIds = new Set();
      
      allItems.forEach(item => {
        const itemId = item.id;
        if (itemId && !seenIds.has(itemId)) {
          seenIds.add(itemId);
          uniqueItems.push(item);
        }
      });
      
      // Normalize all items
      const normalizedItems = uniqueItems.map(item => normalizeItemData(item));
      
      console.log('📊 Total unique items loaded:', normalizedItems.length);
      return normalizedItems;
    } catch (error) {
      console.error('❌ Error loading all inventory items:', error);
      return [];
    }
  };

  // Enhanced refresh function
  const refreshInventory = async () => {
    setRefreshing(true);
    try {
      console.log('🔄 Refreshing inventory from all sources...');
      
      // Clear current state first
      setItems([]);
      
      // Load fresh data from all sources
      const freshItems = await loadAllInventoryItems();
      
      if (freshItems.length === 0) {
        console.log('ℹ️ No items found in any data source');
        setItems([]);
        showMessage('No inventory items found in any data source.');
      } else {
        console.log(`✅ Refreshed ${freshItems.length} items`);
        setItems(freshItems);
      }
      
      // Log details about what was loaded
      console.log('📊 Refresh details:');
      console.log('- Predefined items:', freshItems.filter(item => item.isPredefined).length);
      console.log('- User-added items:', freshItems.filter(item => !item.isPredefined).length);
      
    } catch (error) {
      console.error('❌ Error refreshing inventory:', error);
      showMessage(`❌ Error refreshing inventory: ${error.message}`);
    } finally {
      setRefreshing(false);
    }
  };

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
      
      if (loadedItems.length > 0) {
        console.log('✅ Initial load successful');
        setItems(loadedItems);
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

  // Listen for inventory updates from other components
  useEffect(() => {
    const handleInventoryUpdate = () => {
      console.log('📢 Received inventoryUpdated event, refreshing...');
      refreshInventory();
    };
    
    window.addEventListener('inventoryUpdated', handleInventoryUpdate);
    
    return () => {
      window.removeEventListener('inventoryUpdated', handleInventoryUpdate);
    };
  }, []);

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
  // FORM HANDLERS - SIMPLIFIED
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

  // Form submission - SIMPLIFIED
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
      
      // Prepare item data - ONLY ESSENTIAL FIELDS
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

      // Update local state
      setItems(updatedItems);
      
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

  const getStockStatus = (item) => {
    const available = item.availableQuantity || item.quantity || 0;
    const total = item.totalQuantity || item.quantity || 1;
    
    if (available === 0) return 'out-of-stock';
    if (available < total * 0.3) return 'low-stock';
    return 'in-stock';
  };

  const getStockDisplay = (item) => {
    const available = item.availableQuantity || item.quantity || 0;
    const total = item.totalQuantity || item.maxQuantity || 1;
    
    if (item.quantity && !item.availableQuantity && !item.totalQuantity) {
      return `${item.quantity}/${item.quantity}`;
    }
      
    return `${available}/${total}`;
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
        {/* Controls Section */}
        <div className="inventory-controls">
          <div className="controls-left">
            <button 
              onClick={() => setShowForm(true)}
              className="btn btn-primary"
              disabled={saving || refreshing}
            >
              + Add New Item
            </button>
            <button 
              onClick={refreshInventory}
              className="btn btn-secondary"
              disabled={refreshing}
            >
              {refreshing ? 'Refreshing...' : 'Refresh Inventory'}
            </button>
          </div>
          
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
            <h3>In Stock</h3>
            <p className="summary-number">
              {items.filter(item => {
                const available = item.availableQuantity || item.quantity || 0;
                return available > 0;
              }).length}
            </p>
          </div>
          <div className="summary-card out-of-stock">
            <h3>Out of Stock</h3>
            <p className="summary-number">
              {items.filter(item => {
                const available = item.availableQuantity || item.quantity || 0;
                return available === 0;
              }).length}
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
            Inventory Items ({filteredItems.length})
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
                    <th>Stock</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredItems.map(item => (
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
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Item Form Modal - SIMPLIFIED */}
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