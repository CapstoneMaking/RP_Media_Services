// AdminInventoryPanel.js - WITH PREDEFINED ITEMS EDITING SUPPORT
import React, { useState, useEffect } from 'react';
import { useApp } from '../../context/AppContext';
import { firebaseService } from '../../services/firebaseService';

const AdminInventoryPanel = () => {
  const [items, setItems] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [formData, setFormData] = useState({
    id: '',
    name: '',
    description: '',
    category: '',
    price: 0,
    availableQuantity: 1,
    totalQuantity: 1,
    image: null,
    imageFile: null
  });

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
    
    // Check for predefined items
    if (isPredefinedItem(item.id)) {
      return getPredefinedImage(item.id);
    }
    
    return '/assets/items/default.png';
  };

  // Helper function to get complete item data including description from productInfo
  const getCompleteItemData = (item) => {
    const completeItem = { ...item };
    
    // Try to get additional data from productInfo
    try {
      const savedProductInfo = localStorage.getItem('productInfo');
      if (savedProductInfo) {
        const productInfo = JSON.parse(savedProductInfo);
        if (productInfo[item.id]) {
          // Merge productInfo data with inventory data
          // Preserve description from productInfo if it exists
          if (productInfo[item.id].description && productInfo[item.id].description.trim() !== '') {
            completeItem.description = productInfo[item.id].description;
          }
          // Also get image from productInfo if available
          if (productInfo[item.id].image && !completeItem.image) {
            completeItem.image = productInfo[item.id].image;
          }
        }
      }
    } catch (error) {
      console.error('Error getting complete item data:', error);
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
      reservedQuantity: item.reservedQuantity || 0
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
        }
      } catch (error) {
        console.error('Error loading description from productInfo:', error);
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
        
        // If image is a base64 string, we need to upload it to Cloudinary
        if (cleanItem.image && cleanItem.image.startsWith('data:image')) {
          console.warn('Item has base64 image that needs upload:', cleanItem.id);
          // Keep the base64 for now
        }
        
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

  // NEW: Save predefined items to Firebase
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
      
      // 3. Load from inventoryItems collection as backup
      try {
        const collectionResult = await firebaseService.getAllInventoryItems();
        if (collectionResult.success && collectionResult.items.length > 0) {
          console.log('✅ Loaded', collectionResult.items.length, 'items from inventoryItems collection');
          // Mark as inventory items if not already marked
          const markedCollectionItems = collectionResult.items.map(item => {
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
          allItems = [...allItems, ...markedCollectionItems];
        }
      } catch (collectionError) {
        console.error('Error loading from collection:', collectionError);
      }
      
      // 4. Load from localStorage as final fallback
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
      
      // Normalize all items - now includes description from productInfo
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
        alert('No inventory items found in any data source.');
      } else {
        console.log(`✅ Refreshed ${freshItems.length} items`);
        setItems(freshItems);
      }
      
      // Log details about what was loaded
      console.log('📊 Refresh details:');
      console.log('- Predefined items:', freshItems.filter(item => item.isPredefined).length);
      console.log('- User-added items:', freshItems.filter(item => !item.isPredefined).length);
      console.log('- By category:', 
        freshItems.reduce((acc, item) => {
          const cat = item.category || 'uncategorized';
          acc[cat] = (acc[cat] || 0) + 1;
          return acc;
        }, {})
      );
      
    } catch (error) {
      console.error('❌ Error refreshing inventory:', error);
      alert(`❌ Error refreshing inventory: ${error.message}`);
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

  // Update product information - Update ALL items including edited ones
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
        const hasRichDescription = existingDescription.length > 100; // Assume rich descriptions are longer
        
        productInfo[item.id] = {
          ...productInfo[item.id],
          title: item.name,
          description: hasRichDescription ? existingDescription : item.description || existingDescription
        };
      } else {
        // New predefined item (shouldn't happen)
        productInfo[item.id] = {
          title: item.name,
          image: getPredefinedImage(item.id),
          description: item.description || 'No description available.'
        };
      }
    });
    
    // For user-added items, update everything
    userAddedItems.forEach(item => {
      productInfo[item.id] = {
        title: item.name,
        image: getItemImage(item),
        description: item.description || 'No description available.'
      };
    });

    localStorage.setItem('productInfo', JSON.stringify(productInfo));
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    
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
    } else {
      setFormData(prev => ({
        ...prev,
        [name]: value
      }));
    }
  };

  const handleImageChange = (e) => {
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
  };

  // Handle form submission - properly update all data sources
  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    console.log('🔄 Starting item save process...', { editingItem, formData });

    try {
      // Parse price to ensure it's a number
      const parsedPrice = parsePrice(formData.price);
      
      let updatedItems;
      let isEditingPredefined = editingItem?.isPredefined || false;
      
      if (editingItem) {
        console.log('✏️ Updating existing item:', editingItem.id);
        console.log('Is predefined item?', isEditingPredefined);
        
        // Create the updated item object
        const updatedItem = {
          ...editingItem, // Start with the original item
          name: formData.name,
          description: formData.description,
          category: formData.category,
          price: parsedPrice,
          availableQuantity: parseInt(formData.availableQuantity) || 1,
          totalQuantity: parseInt(formData.totalQuantity) || 1,
          // Update image if changed (but predefined items keep their original image path)
          image: isEditingPredefined ? editingItem.image : (formData.image !== editingItem.image ? formData.image : editingItem.image)
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
            alert('⚠️ Item updated locally but failed to save to Firebase rental items.');
          }
        }
      } else {
        // Generate unique ID for new item
        const newItemId = formData.name.toLowerCase().replace(/[^a-z0-9]+/g, '-');
        
        // Check if ID already exists
        let counter = 1;
        let tempId = newItemId;
        while (items.some(item => item.id === tempId)) {
          tempId = `${newItemId}-${counter}`;
          counter++;
        }
        
        console.log('➕ Adding new item with ID:', tempId);
        const newItem = {
          id: tempId,
          name: formData.name,
          description: formData.description || '',
          category: formData.category,
          price: parsedPrice,
          availableQuantity: parseInt(formData.availableQuantity) || 1,
          totalQuantity: parseInt(formData.totalQuantity) || 1,
          image: formData.image,
          createdAt: new Date().toISOString(),
          isPredefined: false,
          source: 'inventory'
        };
        updatedItems = [...items, newItem];
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
          
          // Update productInfo in localStorage
          updateProductInfoForItem(editingItem ? editingItem.id : null, formData);
          
          alert('✅ Item saved successfully!');
        } else {
          console.log('⚠️ Item saved locally but failed to save to Firebase inventory');
          alert('⚠️ Item saved locally but failed to save to database. Please check your connection.');
        }
      } else {
        // For predefined items, still update productInfo
        updateProductInfoForItem(editingItem.id, formData);
        alert('✅ Predefined item updated successfully!');
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
      alert('❌ Error saving item: ' + error.message);
    } finally {
      setSaving(false);
    }
  };

  // Helper function to update productInfo for a specific item
  const updateProductInfoForItem = (itemId, formData) => {
    try {
      let productInfo = {};
      
      // Load existing productInfo
      const savedProductInfo = localStorage.getItem('productInfo');
      if (savedProductInfo) {
        productInfo = JSON.parse(savedProductInfo);
      }
      
      // Create or update the item in productInfo
      const targetId = itemId || formData.name.toLowerCase().replace(/[^a-z0-9]+/g, '-');
      
      productInfo[targetId] = {
        title: formData.name,
        image: formData.image || getPredefinedImage(targetId) || '/assets/items/default.png',
        description: formData.description || 'No description available.'
      };
      
      localStorage.setItem('productInfo', JSON.stringify(productInfo));
      console.log('✅ Updated productInfo for item:', targetId);
    } catch (error) {
      console.error('Error updating productInfo:', error);
    }
  };

  const handleEdit = (item) => {
    console.log('📝 Editing item:', item.id);
    console.log('Is predefined?', item.isPredefined);
    
    // Get complete item data including description from productInfo
    const completeItem = getCompleteItemData(item);
    
    setFormData({
      id: completeItem.id,
      name: completeItem.name,
      description: completeItem.description || '',
      category: completeItem.category || '',
      price: formatPrice(completeItem.price || 0),
      availableQuantity: completeItem.availableQuantity || completeItem.quantity || 1,
      totalQuantity: completeItem.totalQuantity || completeItem.maxQuantity || 1,
      image: getItemImage(completeItem),
      imageFile: null
    });
    setEditingItem(completeItem);
    setShowForm(true);
  };

  // Handle delete - PREVENT deletion of predefined items
  const handleDelete = async (itemId) => {
    const itemToDelete = items.find(item => item.id === itemId);
    
    if (!itemToDelete) return;
    
    // PREVENT deletion of predefined items
    if (itemToDelete.isPredefined) {
      alert('❌ Predefined items cannot be deleted. You can only edit them.');
      return;
    }
    
    if (window.confirm('Are you sure you want to delete this item? This will remove it from all sections including Rent Items and Information pages.')) {
      console.log('🗑️ Deleting item:', itemId);
      
      try {
        // 1. Remove from local state
        const updatedItems = items.filter(item => item.id !== itemId);
        setItems(updatedItems);

        // 2. It's a user-added item (predefined items already filtered out)
        
        // Remove from localStorage rentalItems
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
        alert('✅ Item deleted successfully!');
      } catch (error) {
        console.error('❌ Error deleting item:', error);
        alert('❌ Error deleting item. Please try again.');
      }
    }
  };

  const resetForm = () => {
    setFormData({
      id: '',
      name: '',
      description: '',
      category: '',
      price: 0,
      availableQuantity: 1,
      totalQuantity: 1,
      image: null,
      imageFile: null
    });
    setEditingItem(null);
    setShowForm(false);
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

  const isPredefinedItem = (itemId) => {
    const item = items.find(item => item.id === itemId);
    return item ? item.isPredefined : false;
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
              {refreshing ? (
                <>
                   Refreshing...
                </>
              ) : (
                'Refresh Inventory'
              )}
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
        </div>

        {/* Refresh Status Indicator */}
        {refreshing && (
          <div className="refresh-status">
            <div className="refresh-spinner"></div>
            <p>Refreshing inventory data from all sources...</p>
          </div>
        )}

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
                disabled={saving || refreshing}
              >
                Add Your First Item
              </button>
            </div>
          ) : (
            <div className="inventory-table-container">
              <table className="inventory-table">
                <thead>
                  <tr>
                    <th>Item Image</th>
                    <th>Item Name</th>
                    <th>Category</th>
                    <th>Price</th>
                    <th>Stock</th>
                    <th>Status</th>
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
                      <td className="item-status">
                        <span className={`status-badge ${getStockStatus(item)}`}>
                          {getStockStatus(item) === 'out-of-stock' ? 'Out of Stock' :
                           getStockStatus(item) === 'low-stock' ? 'Low Stock' : 'In Stock'}
                        </span>
                      </td>
                      <td className="item-actions">
                        <button
                          onClick={() => handleEdit(item)}
                          className="btn btn-warning btn-sm"
                          title="Edit Item"
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

      {/* Add/Edit Item Form Modal */}
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
              <div className="form-grid">
                <div className="form-group">
                  <label>Item Name *</label>
                  <input
                    type="text"
                    name="name"
                    value={formData.name}
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
                    value={formData.category}
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
                    value={formatPrice(formData.price)}
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
                    value={formData.totalQuantity}
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
                    value={formData.availableQuantity}
                    onChange={handleInputChange}
                    min="0"
                    max={formData.totalQuantity}
                    required
                    disabled={saving || refreshing}
                    placeholder="Currently available items"
                  />
                </div>

                <div className="form-group full-width">
                  <label>Description *</label>
                  <textarea
                    name="description"
                    value={formData.description}
                    onChange={handleInputChange}
                    rows="5"
                    placeholder="Describe the item features, specifications, and usage..."
                    disabled={saving || refreshing}
                    required
                  />
                  <p style={{ fontSize: '0.8rem', color: '#666', marginTop: '0.5rem' }}>
                    This description will appear in the Information page
                  </p>
                </div>

                <div className="form-group full-width">
                  <label>Item Image</label>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleImageChange}
                    disabled={saving || refreshing || editingItem?.isPredefined}
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
                  disabled={saving || refreshing}
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  className="btn btn-primary"
                  disabled={saving || refreshing}
                >
                  {saving ? 'Saving...' : refreshing ? 'Refreshing...' : editingItem ? 'Update Item' : 'Add Item'}
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