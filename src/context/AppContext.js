// AppContext.js - UPDATED WITH RESERVED QUANTITY TRACKING
import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import { firebaseService } from '../services/firebaseService';
import { cloudinaryService } from '../services/cloudinaryService';

const AppContext = createContext();

export const useApp = () => {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return context;
};

export const AppProvider = ({ children }) => {
  const [collections, setCollections] = useState([]);
  const [files, setFiles] = useState([]);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  
  // Damaged Items Management State
  const [rentalItems, setRentalItems] = useState([]);
  const [damageReports, setDamageReports] = useState([]);
  const [loadingDamagedItems, setLoadingDamagedItems] = useState(false);

  // Use refs to track state and prevent duplicates
  const filesRef = useRef([]);
  const collectionsRef = useRef([]);
  const isSubscribedRef = useRef(false);

  // Initial rental items data structure - UPDATED WITH RESERVED QUANTITY
  const initialRentalItems = [
    {
      id: 'sachtler-tripod',
      name: 'Sachtler Video 20 S1 100mm Ball Head Tripod System',
      category: 'tripod',
      totalQuantity: 2,
      availableQuantity: 2,
      reservedQuantity: 0,
      price: 3500
    },
    {
      id: 'cartoni-tripod',
      name: 'Cartoni Laser Z100 Fluid Head Tripod Aluminum 2',
      category: 'tripod',
      totalQuantity: 4,
      availableQuantity: 4,
      reservedQuantity: 0,
      price: 3500
    },
    {
      id: 'eimage-tripod',
      name: 'E-Image 2-Stage Aluminum Tripod with GH15 Head',
      category: 'tripod',
      totalQuantity: 3,
      availableQuantity: 3,
      reservedQuantity: 0,
      price: 2500
    },
    {
      id: 'pmw-200',
      name: 'PMW-200',
      category: 'camera',
      totalQuantity: 3,
      availableQuantity: 3,
      reservedQuantity: 0,
      price: 5000
    },
    {
      id: 'sony-pmw-350k',
      name: 'sony pmw-350k',
      category: 'camera',
      totalQuantity: 2,
      availableQuantity: 2,
      reservedQuantity: 0,
      price: 7000
    },
    {
      id: 'panasonic-hpx3100',
      name: 'Panasonic AJ HPX3100',
      category: 'camera',
      totalQuantity: 3,
      availableQuantity: 3,
      reservedQuantity: 0,
      price: 8000
    },
    {
      id: 'saramonic-comset',
      name: 'Saramonic WiTalk-WT7S 7-Person Full-Duplex Wireless Intercom System',
      category: 'comset',
      totalQuantity: 2,
      availableQuantity: 2,
      reservedQuantity: 0,
      price: 3000
    },
    {
      id: 'lumantek-switcher',
      name: 'Lumantek ez-Pro VS10 3G-SDI/HDMI Video Switcher',
      category: 'switcher',
      totalQuantity: 2,
      availableQuantity: 2,
      reservedQuantity: 0,
      price: 4000
    },
    {
      id: 'sony-mcx-500',
      name: 'sony mcx-500',
      category: 'switcher',
      totalQuantity: 2,
      availableQuantity: 2,
      reservedQuantity: 0,
      price: 4500
    },
    {
      id: 'behringer-mixer',
      name: 'Behringer Xenyx QX602MP3 6-Channel Mixer',
      category: 'audio-mixer',
      totalQuantity: 2,
      availableQuantity: 2,
      reservedQuantity: 0,
      price: 1500
    },
    {
      id: 'xtuga-mixer',
      name: 'Xtuga E22 Best USB / XLR Audio Interface',
      category: 'audio-mixer',
      totalQuantity: 2,
      availableQuantity: 2,
      reservedQuantity: 0,
      price: 1200
    },
    {
      id: 'atem-monitor',
      name: 'monitor ATEM156-CO HDMI 15.6 Video Monitor',
      category: 'monitor',
      totalQuantity: 2,
      availableQuantity: 2,
      reservedQuantity: 0,
      price: 2000
    },
    {
      id: 'lilliput-monitor',
      name: 'Lilliput BM150-4K Carry-On 4K Monitor',
      category: 'monitor',
      totalQuantity: 2,
      availableQuantity: 2,
      reservedQuantity: 0,
      price: 1800
    },
    {
      id: 'tvlogic-monitor',
      name: 'tv logic multi format',
      category: 'monitor',
      totalQuantity: 2,
      availableQuantity: 2,
      reservedQuantity: 0,
      price: 2200
    },
    {
      id: 'accsoon-transmitter',
      name: 'Accsoon CineView Master 4K',
      category: 'video-transmitter',
      totalQuantity: 3,
      availableQuantity: 3,
      reservedQuantity: 0,
      price: 2500
    },
    {
      id: 'hollyland-transmitter',
      name: 'Hollyland Mars 4K Wireless Video Transmitter',
      category: 'video-transmitter',
      totalQuantity: 3,
      availableQuantity: 3,
      reservedQuantity: 0,
      price: 3000
    },
    {
      id: 'dolly-platform',
      name: 'Dolly Platform with Tracks',
      category: 'camera-dolly',
      totalQuantity: 1,
      availableQuantity: 1,
      reservedQuantity: 0,
      price: 5000
    },
    {
      id: 'wheels-slider',
      name: 'Wheels Slider Tripod',
      category: 'camera-dolly',
      totalQuantity: 3,
      availableQuantity: 3,
      reservedQuantity: 0,
      price: 3500
    }
  ];

  useEffect(() => {
    if (!isSubscribedRef.current) {
      loadInitialData();
      setupListeners();
      loadInventoryItems(); // Load inventory items from localStorage
      isSubscribedRef.current = true;
    }

    return () => {
      // Cleanup if needed
    };
  }, []);

  // Load inventory items from localStorage and combine with Firebase items
  const loadInventoryItems = () => {
    try {
      const savedInventoryItems = localStorage.getItem('rentalItems');
      if (savedInventoryItems) {
        const inventoryItems = JSON.parse(savedInventoryItems);
        // Ensure all inventory items have reservedQuantity
        const updatedItems = inventoryItems.map(item => ({
          ...item,
          reservedQuantity: item.reservedQuantity || 0,
          totalQuantity: item.totalQuantity || item.maxQuantity || 1
        }));
        updateProductInfo(updatedItems);
      }
    } catch (error) {
      console.error('Error loading inventory items:', error);
    }
  };

  // Update product information for information.js
  const updateProductInfo = (inventoryItems) => {
    const productInfo = {};
    
    inventoryItems.forEach(item => {
      productInfo[item.id] = {
        title: item.name,
        image: item.image || '/assets/items/default.png',
        description: item.description || 'No description available.'
      };
    });

    // Save to localStorage for information.js to access
    localStorage.setItem('productInfo', JSON.stringify(productInfo));
  };

  // Get all rental items (Firebase + Inventory)
  const getAllRentalItems = () => {
    const inventoryItems = JSON.parse(localStorage.getItem('rentalItems') || '[]');
    const allItems = [...rentalItems, ...inventoryItems];
    
    // Ensure all items have reservedQuantity
    return allItems.map(item => ({
      ...item,
      reservedQuantity: item.reservedQuantity || 0,
      totalQuantity: item.totalQuantity || item.maxQuantity || 1
    }));
  };

  // Get available items for display (available - reserved)
  const getAvailableForRent = (item) => {
    const available = (item.availableQuantity || 0) - (item.reservedQuantity || 0);
    return Math.max(0, available);
  };

  const setupListeners = () => {
    // Collections listener
    firebaseService.subscribeToCollections((newCollections) => {
      const uniqueCollections = removeDuplicatesById(newCollections);
      setCollections(uniqueCollections);
      collectionsRef.current = uniqueCollections;
    });

    // Files listener - with duplicate protection
    firebaseService.subscribeToFiles((newFiles) => {
      const uniqueFiles = removeDuplicatesById(newFiles);
      const finalFiles = removeDuplicatesByCloudinaryId(uniqueFiles);
      setFiles(finalFiles);
      filesRef.current = finalFiles;
    });

    // Users listener
    firebaseService.subscribeToUsers((newUsers) => {
      const uniqueUsers = removeDuplicatesById(newUsers);
      setUsers(uniqueUsers);
    });

    // Damaged Items listeners
    firebaseService.subscribeToDamageReports((newReports) => {
      setDamageReports(newReports);
    });

    firebaseService.subscribeToRentalItems((newRentalItems) => {
      if (newRentalItems.length > 0) {
        // Ensure all items have reservedQuantity
        const itemsWithReserved = newRentalItems.map(item => ({
          ...item,
          reservedQuantity: item.reservedQuantity || 0,
          totalQuantity: item.totalQuantity || item.maxQuantity || 1
        }));
        setRentalItems(itemsWithReserved);
      } else {
        // Initialize rental items if they don't exist in Firebase
        initializeRentalItems();
      }
    });
  };

  // Initialize rental items in Firebase
  const initializeRentalItems = async () => {
    try {
      const result = await firebaseService.saveRentalItems(initialRentalItems);
      if (result.success) {
        setRentalItems(initialRentalItems);
      }
    } catch (error) {
      console.error('Error initializing rental items:', error);
    }
  };

  // Load initial rental items and damage reports from Firebase
  const loadDamagedItemsData = async () => {
    setLoadingDamagedItems(true);
    try {
      // Load rental items
      const rentalResult = await firebaseService.getRentalItems();
      if (rentalResult.success) {
        if (rentalResult.rentalItems.length > 0) {
          // Ensure all items have reservedQuantity
          const itemsWithReserved = rentalResult.rentalItems.map(item => ({
            ...item,
            reservedQuantity: item.reservedQuantity || 0,
            totalQuantity: item.totalQuantity || item.maxQuantity || 1
          }));
          setRentalItems(itemsWithReserved);
        } else {
          await initializeRentalItems();
        }
      }

      // Load damage reports
      const reportsResult = await firebaseService.getDamageReports();
      if (reportsResult.success) {
        setDamageReports(reportsResult.reports);
      }
    } catch (error) {
      console.error('Error loading damaged items data:', error);
    } finally {
      setLoadingDamagedItems(false);
    }
  };

  // Helper function to remove duplicates by id
  const removeDuplicatesById = (items) => {
    const seen = new Set();
    return items.filter(item => {
      if (seen.has(item.id)) {
        return false;
      }
      seen.add(item.id);
      return true;
    });
  };

  // Helper function to remove duplicates by Cloudinary public_id
  const removeDuplicatesByCloudinaryId = (files) => {
    const seen = new Set();
    return files.filter(file => {
      const cloudinaryId = file.cloudinaryData?.public_id;
      if (!cloudinaryId) return true;
      if (seen.has(cloudinaryId)) {
        return false;
      }
      seen.add(cloudinaryId);
      return true;
    });
  };

  const loadInitialData = async () => {
    try {
      setLoading(true);
      await loadCollections();
      await loadFiles();
      await loadUsers();
      await loadDamagedItemsData();
      loadInventoryItems(); // Load inventory items
      setError(null);
    } catch (err) {
      setError('Failed to load initial data');
      console.error('Error loading initial data:', err);
    } finally {
      setLoading(false);
    }
  };

  const loadCollections = async () => {
    try {
      const result = await firebaseService.getCollections();
      if (result.success) {
        const uniqueCollections = removeDuplicatesById(result.collections);
        setCollections(uniqueCollections);
        collectionsRef.current = uniqueCollections;
      } else {
        setError('Failed to load collections');
      }
    } catch (err) {
      setError('Error loading collections');
      console.error('Error loading collections:', err);
    }
  };

  const loadFiles = async () => {
    try {
      const result = await firebaseService.getFiles();
      if (result.success) {
        const uniqueById = removeDuplicatesById(result.files);
        const uniqueFiles = removeDuplicatesByCloudinaryId(uniqueById);
        setFiles(uniqueFiles);
        filesRef.current = uniqueFiles;
      } else {
        setError('Failed to load files');
      }
    } catch (err) {
      setError('Error loading files');
      console.error('Error loading files:', err);
    }
  };

  const loadUsers = async () => {
    try {
      const result = await firebaseService.getUsers();
      if (result.success) {
        const uniqueUsers = removeDuplicatesById(result.users);
        setUsers(uniqueUsers);
      } else {
        setError('Failed to load users');
      }
    } catch (err) {
      setError('Error loading users');
      console.error('Error loading users:', err);
    }
  };

  // Collection Management
  const createCollection = async (collectionData) => {
    setLoading(true);
    try {
      const result = await firebaseService.createCollection(collectionData);
      setLoading(false);
      return result;
    } catch (error) {
      setLoading(false);
      return { success: false, error: error.message };
    }
  };

  const deleteCollection = async (collectionId) => {
    setLoading(true);
    try {
      const result = await firebaseService.deleteCollection(collectionId);
      setLoading(false);
      return result;
    } catch (error) {
      setLoading(false);
      return { success: false, error: error.message };
    }
  };

  // File Management
  const uploadFileToCollection = async (file, collectionId, title, description) => {
    try {
      const cloudinaryResult = await cloudinaryService.uploadImage(file);

      const existingCheck = await firebaseService.getFilesByCloudinaryId(cloudinaryResult.public_id);
      if (existingCheck.success && existingCheck.files.length > 0) {
        return { 
          success: false, 
          error: 'This file has already been uploaded' 
        };
      }

      const fileData = {
        title: title || file.name.split('.')[0],
        description: description || '',
        collectionId: collectionId,
        cloudinaryData: {
          public_id: cloudinaryResult.public_id,
          secure_url: cloudinaryResult.secure_url,
          format: cloudinaryResult.format,
          bytes: cloudinaryResult.bytes,
          created_at: cloudinaryResult.created_at,
          width: cloudinaryResult.width,
          height: cloudinaryResult.height
        },
        fileName: file.name,
        fileSize: file.size,
        fileType: file.type,
        uploader: 'admin',
        originalFileName: file.name,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      const result = await firebaseService.saveFileData(fileData);
      return result;
    } catch (error) {
      console.error('Upload error:', error);
      return { success: false, error: error.message };
    }
  };

  const uploadMultipleFilesToCollection = async (files, collectionId, baseTitle, description) => {
    console.log(` Starting batch upload of ${files.length} files to collection ${collectionId}`);
    const results = [];
    
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      console.log(` Uploading file ${i + 1}/${files.length}:`, file.name);

      try {
        const individualTitle = files.length > 1 
          ? `${baseTitle} - ${file.name.split('.')[0]}`
          : baseTitle;

        console.log(' Step 1: Uploading to Cloudinary...');
        const cloudinaryResult = await cloudinaryService.uploadImage(file);
        console.log(' Cloudinary upload successful:', cloudinaryResult.public_id);

        console.log(' Step 2: Saving to Firebase...');
        const fileData = {
          title: individualTitle,
          description: description || '',
          collectionId: collectionId,
          cloudinaryData: cloudinaryResult,
          fileName: file.name,
          fileSize: file.size,
          fileType: file.type,
          uploader: 'admin',
          originalFileName: file.name,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        };

        const firebaseResult = await firebaseService.saveFileData(fileData);
        
        if (firebaseResult.success) {
          console.log(' Firebase save successful:', firebaseResult.id);
          results.push({ success: true, file: firebaseResult.file });
        } else {
          console.error(' Firebase save failed:', firebaseResult.error);
          results.push({ success: false, error: `Firebase: ${firebaseResult.error}` });
          
          try {
            await cloudinaryService.deleteImage(cloudinaryResult.public_id);
            console.log(' Cleaned up Cloudinary file after Firebase failure');
          } catch (cleanupError) {
            console.error(' Failed to cleanup Cloudinary file:', cleanupError);
          }
        }
      } catch (error) {
        console.error(` Upload failed for ${file.name}:`, error);
        results.push({ success: false, error: `Upload: ${error.message}` });
      }
    }
    
    console.log(' Batch upload completed. Results:', results);
    return results;
  };

  const deleteFile = async (fileId, publicId) => {
    setLoading(true);
    try {
      let cloudinarySuccess = true;
      
      if (publicId) {
        try {
          await cloudinaryService.deleteImage(publicId);
        } catch (cloudinaryError) {
          console.error(' Cloudinary deletion failed:', cloudinaryError);
          cloudinarySuccess = false;
        }
      }
      
      const firebaseResult = await firebaseService.deleteFile(fileId);
      
      if (firebaseResult.success) {
        setFiles(prev => prev.filter(f => f.id !== fileId));
        setLoading(false);
        return { 
          success: true, 
          cloudinaryDeleted: cloudinarySuccess,
          message: cloudinarySuccess ? 'File deleted successfully' : 'File deleted from database but Cloudinary deletion failed'
        };
      } else {
        setLoading(false);
        return { 
          success: false, 
          error: `Failed to delete from database: ${firebaseResult.error}` 
        };
      }
    } catch (error) {
      setLoading(false);
      return { 
        success: false, 
        error: `Unexpected error: ${error.message}` 
      };
    }
  };

  const getCollectionFiles = async (collectionId) => {
    try {
      const result = await firebaseService.getFilesByCollection(collectionId);
      if (result.success) {
        const uniqueById = removeDuplicatesById(result.files);
        const uniqueFiles = removeDuplicatesByCloudinaryId(uniqueById);
        return uniqueFiles;
      } else {
        const collectionFiles = filesRef.current.filter(file => file.collectionId === collectionId);
        return removeDuplicatesByCloudinaryId(collectionFiles);
      }
    } catch (error) {
      console.error('Error in getCollectionFiles:', error);
      const collectionFiles = filesRef.current.filter(file => file.collectionId === collectionId);
      return removeDuplicatesByCloudinaryId(collectionFiles);
    }
  };

  // DAMAGED ITEMS MANAGEMENT FUNCTIONS WITH FIREBASE
  // In AppContext.js - SIMPLIFIED reportDamage function
const reportDamage = async (damageData) => {
  setLoadingDamagedItems(true);
  try {
    // Get all items to check what type of item we're dealing with
    const allItems = getAllRentalItems();
    const selectedItem = allItems.find(item => item.id === damageData.itemId);
    
    if (!selectedItem) {
      return { success: false, error: 'Selected item not found' };
    }

    // Check if item is actually available for damage reporting
    const availableForDamage = (selectedItem.availableQuantity || 0) - (selectedItem.reservedQuantity || 0);
    
    if (availableForDamage <= 0) {
      return { 
        success: false, 
        error: 'This item is not available for damage reporting. No items in stock or all are reserved.' 
      };
    }

    // Create damage report
    const report = {
      ...damageData,
      status: 'damaged',
      repairCost: 0,
      repairedAt: null,
      createdAt: new Date().toISOString(),
      itemType: selectedItem.type || 'rental'
    };

    // Save damage report to Firebase - ONLY THIS SHOULD UPDATE
    const reportResult = await firebaseService.saveDamageReport(report);
    return reportResult;
    
  } catch (error) {
    console.error('Error reporting damage:', error);
    return { success: false, error: error.message };
  } finally {
    setLoadingDamagedItems(false);
  }
};

  const updateDamageStatus = async (reportId, newStatus, actualRepairCost = 0) => {
    setLoadingDamagedItems(true);
    try {
      const report = damageReports.find(r => r.id === reportId);
      if (!report) {
        return { success: false, error: 'Damage report not found' };
      }

      const updateData = {
        status: newStatus,
        repairCost: actualRepairCost
      };

      if (newStatus === 'repaired') {
        updateData.repairedAt = new Date().toISOString();
        
        // Determine item type from report or by checking
        const allItems = getAllRentalItems();
        const item = allItems.find(i => i.id === report.itemId);
        const isInventoryItem = item?.type === 'inventory' || item?.source === 'inventory';
        
        if (isInventoryItem) {
          // Update ONLY inventory items
          const inventoryItems = JSON.parse(localStorage.getItem('rentalItems') || '[]');
          const updatedInventoryItems = inventoryItems.map(invItem => {
            if (invItem.id === report.itemId) {
              return {
                ...invItem,
                availableQuantity: (invItem.availableQuantity || 0) + 1
              };
            }
            return invItem;
          });
          localStorage.setItem('rentalItems', JSON.stringify(updatedInventoryItems));
          updateProductInfo(updatedInventoryItems);
          
          // Also update Firebase inventory if it exists
          try {
            const inventoryResult = await firebaseService.getInventoryItems();
            if (inventoryResult.success && inventoryResult.inventoryItems.length > 0) {
              const firebaseInventory = inventoryResult.inventoryItems.map(invItem => {
                if (invItem.id === report.itemId) {
                  return {
                    ...invItem,
                    availableQuantity: (invItem.availableQuantity || 0) + 1
                  };
                }
                return invItem;
              });
              await firebaseService.saveInventoryItems(firebaseInventory);
            }
          } catch (firebaseError) {
            console.error('Failed to update Firebase inventory:', firebaseError);
          }
        } else {
          // Update ONLY Firebase rental items
          const updatedItems = rentalItems.map(rentalItem => {
            if (rentalItem.id === report.itemId) {
              return {
                ...rentalItem,
                availableQuantity: rentalItem.availableQuantity + 1
              };
            }
            return rentalItem;
          });

          const itemsResult = await firebaseService.saveRentalItems(updatedItems);
          if (!itemsResult.success) {
            return itemsResult;
          }
          setRentalItems(updatedItems);
        }
      }

      // Update damage report in Firebase
      const reportResult = await firebaseService.updateDamageReport(reportId, updateData);
      return reportResult;
    } catch (error) {
      console.error('Error updating damage status:', error);
      return { success: false, error: error.message };
    } finally {
      setLoadingDamagedItems(false);
    }
  };

  const deleteDamageReport = async (reportId) => {
    setLoadingDamagedItems(true);
    try {
      const report = damageReports.find(r => r.id === reportId);
      if (!report) {
        return { success: false, error: 'Damage report not found' };
      }

      if (report.status !== 'damaged') {
        return { success: false, error: 'Cannot delete reports that are already being processed.' };
      }

      // Determine item type
      const allItems = getAllRentalItems();
      const item = allItems.find(i => i.id === report.itemId);
      const isInventoryItem = item?.type === 'inventory' || item?.source === 'inventory';
      
      if (isInventoryItem) {
        // Update ONLY inventory items
        const inventoryItems = JSON.parse(localStorage.getItem('rentalItems') || '[]');
        const updatedInventoryItems = inventoryItems.map(invItem => {
          if (invItem.id === report.itemId) {
            return {
              ...invItem,
              availableQuantity: (invItem.availableQuantity || 0) + 1
            };
          }
          return invItem;
        });
        localStorage.setItem('rentalItems', JSON.stringify(updatedInventoryItems));
        updateProductInfo(updatedInventoryItems);
        
        // Also update Firebase inventory if it exists
        try {
          const inventoryResult = await firebaseService.getInventoryItems();
          if (inventoryResult.success && inventoryResult.inventoryItems.length > 0) {
            const firebaseInventory = inventoryResult.inventoryItems.map(invItem => {
              if (invItem.id === report.itemId) {
                return {
                  ...invItem,
                  availableQuantity: (invItem.availableQuantity || 0) + 1
                };
              }
              return invItem;
            });
            await firebaseService.saveInventoryItems(firebaseInventory);
          }
        } catch (firebaseError) {
          console.error('Failed to update Firebase inventory:', firebaseError);
        }
      } else {
        // Update ONLY Firebase rental items
        const updatedItems = rentalItems.map(rentalItem => {
          if (rentalItem.id === report.itemId) {
            return {
              ...rentalItem,
              availableQuantity: rentalItem.availableQuantity + 1
            };
          }
          return rentalItem;
        });

        const itemsResult = await firebaseService.saveRentalItems(updatedItems);
        if (!itemsResult.success) {
          return itemsResult;
        }
        setRentalItems(updatedItems);
      }

      // Delete damage report from Firebase
      const reportResult = await firebaseService.deleteDamageReport(reportId);
      if (!reportResult.success) {
        return reportResult;
      }

      return { success: true };
    } catch (error) {
      console.error('Error deleting damage report:', error);
      return { success: false, error: error.message };
    } finally {
      setLoadingDamagedItems(false);
    }
  };

  // NEW: Reserve items for booking (DOES NOT reduce availableQuantity)
  const reserveItemsForBooking = async (bookedItems) => {
    try {
      const updatedFirebaseItems = [...rentalItems];
      const inventoryItems = JSON.parse(localStorage.getItem('rentalItems') || '[]');
      const updatedInventoryItems = [...inventoryItems];
      
      let allSuccessful = true;
      let errors = [];
      
      // Validate first
      for (const bookedItem of bookedItems) {
        const itemId = bookedItem.id;
        const quantity = bookedItem.quantity;
        
        // Find the item
        const allItems = getAllRentalItems();
        const item = allItems.find(item => item.id === itemId);
        
        if (!item) {
          errors.push(`Item ${bookedItem.name} not found`);
          allSuccessful = false;
          continue;
        }
        
        const availableForRent = (item.availableQuantity || 0) - (item.reservedQuantity || 0);
        
        if (availableForRent < quantity) {
          errors.push(`Only ${availableForRent} units available for ${item.name}. Cannot reserve ${quantity}.`);
          allSuccessful = false;
        }
      }
      
      if (!allSuccessful) {
        return { success: false, errors };
      }
      
      // Reserve items (increase reservedQuantity)
      bookedItems.forEach(bookedItem => {
        // Update Firebase items
        const firebaseItemIndex = updatedFirebaseItems.findIndex(item => item.id === bookedItem.id);
        if (firebaseItemIndex !== -1) {
          updatedFirebaseItems[firebaseItemIndex] = {
            ...updatedFirebaseItems[firebaseItemIndex],
            reservedQuantity: (updatedFirebaseItems[firebaseItemIndex].reservedQuantity || 0) + bookedItem.quantity
          };
        }
        
        // Update inventory items
        const inventoryItemIndex = updatedInventoryItems.findIndex(item => item.id === bookedItem.id);
        if (inventoryItemIndex !== -1) {
          updatedInventoryItems[inventoryItemIndex] = {
            ...updatedInventoryItems[inventoryItemIndex],
            reservedQuantity: (updatedInventoryItems[inventoryItemIndex].reservedQuantity || 0) + bookedItem.quantity
          };
        }
      });

      // Save Firebase items
      const firebaseResult = await firebaseService.saveRentalItems(updatedFirebaseItems);
      if (firebaseResult.success) {
        setRentalItems(updatedFirebaseItems);
      } else {
        return firebaseResult;
      }

      // Save inventory items
      localStorage.setItem('rentalItems', JSON.stringify(updatedInventoryItems));
      updateProductInfo(updatedInventoryItems);

      return { success: true };
    } catch (error) {
      console.error('Error reserving items:', error);
      return { success: false, error: error.message };
    }
  };

  // NEW: Release reserved items (when booking is cancelled or completed)
  const releaseReservedItems = async (reservedItems) => {
    try {
      const updatedFirebaseItems = [...rentalItems];
      const inventoryItems = JSON.parse(localStorage.getItem('rentalItems') || '[]');
      const updatedInventoryItems = [...inventoryItems];
      
      reservedItems.forEach(reservedItem => {
        // Update Firebase items
        const firebaseItemIndex = updatedFirebaseItems.findIndex(item => item.id === reservedItem.id);
        if (firebaseItemIndex !== -1) {
          const currentReserved = updatedFirebaseItems[firebaseItemIndex].reservedQuantity || 0;
          updatedFirebaseItems[firebaseItemIndex] = {
            ...updatedFirebaseItems[firebaseItemIndex],
            reservedQuantity: Math.max(0, currentReserved - reservedItem.quantity)
          };
        }
        
        // Update inventory items
        const inventoryItemIndex = updatedInventoryItems.findIndex(item => item.id === reservedItem.id);
        if (inventoryItemIndex !== -1) {
          const currentReserved = updatedInventoryItems[inventoryItemIndex].reservedQuantity || 0;
          updatedInventoryItems[inventoryItemIndex] = {
            ...updatedInventoryItems[inventoryItemIndex],
            reservedQuantity: Math.max(0, currentReserved - reservedItem.quantity)
          };
        }
      });

      // Save Firebase items
      const firebaseResult = await firebaseService.saveRentalItems(updatedFirebaseItems);
      if (firebaseResult.success) {
        setRentalItems(updatedFirebaseItems);
      } else {
        return firebaseResult;
      }

      // Save inventory items
      localStorage.setItem('rentalItems', JSON.stringify(updatedInventoryItems));
      updateProductInfo(updatedInventoryItems);

      return { success: true };
    } catch (error) {
      console.error('Error releasing reserved items:', error);
      return { success: false, error: error.message };
    }
  };

  // Utility functions - UPDATED to work with combined items and reserved quantity
  const getAvailableRentalItems = () => {
    const allItems = getAllRentalItems();
    return allItems.filter(item => {
      const availableForRent = (item.availableQuantity || 0) - (item.reservedQuantity || 0);
      return availableForRent > 0;
    });
  };

  const isItemAvailable = (itemId, quantity = 1) => {
    const allItems = getAllRentalItems();
    const item = allItems.find(item => item.id === itemId);
    if (!item) return false;
    
    const availableForRent = (item.availableQuantity || 0) - (item.reservedQuantity || 0);
    return availableForRent >= quantity;
  };

  // REMOVED: updateItemQuantitiesAfterRental and restoreItemQuantitiesAfterReturn
  // These functions are no longer needed since booking doesn't reduce availableQuantity

  const resetDamagedItemsData = async () => {
    setLoadingDamagedItems(true);
    try {
      // Reset Firebase rental items to initial state
      const itemsResult = await firebaseService.saveRentalItems(initialRentalItems);
      if (!itemsResult.success) {
        return itemsResult;
      }

      // Delete all damage reports
      const reports = await firebaseService.getDamageReports();
      if (reports.success) {
        for (const report of reports.reports) {
          await firebaseService.deleteDamageReport(report.id);
        }
      }

      // Clear inventory items
      localStorage.removeItem('rentalItems');
      localStorage.removeItem('productInfo');

      setRentalItems(initialRentalItems);
      setDamageReports([]);

      return { success: true };
    } catch (error) {
      console.error('Error resetting damaged items data:', error);
      return { success: false, error: error.message };
    } finally {
      setLoadingDamagedItems(false);
    }
  };

  const value = {
    // Core App State
    collections,
    files,
    users,
    loading,
    error,
    
    // Damaged Items Management
    rentalItems,
    damageReports,
    loadingDamagedItems,
    
    // Collection Management
    createCollection,
    deleteCollection,
    uploadFileToCollection,
    uploadMultipleFilesToCollection,
    deleteFile,
    getCollectionFiles,
    loadCollections,
    loadFiles,
    
    // Damaged Items Functions
    reportDamage,
    updateDamageStatus,
    deleteDamageReport,
    getAvailableRentalItems,
    isItemAvailable,
    resetDamagedItemsData,
    
    // NEW: Booking Reservation Functions
    reserveItemsForBooking,
    releaseReservedItems,
    
    // Inventory Integration
    getAllRentalItems,
    getAvailableForRent // Export helper function
  };

  return (
    <AppContext.Provider value={value}>
      {children}
    </AppContext.Provider>
  );
};