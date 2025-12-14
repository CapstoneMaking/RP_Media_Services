// information.js - UPDATED WITH APPCONTEXT INTEGRATION
import React, { useCallback, useEffect, useState, useRef } from 'react'; // ADD useRef
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useApp } from '../context/AppContext';
import { firebaseService } from '../services/firebaseService'; // ADD THIS IMPORT

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

const Information = () => {
  const [activeProduct, setActiveProduct] = useState('');
  const [activePackage, setActivePackage] = useState('');
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [productImages, setProductImages] = useState([]);
  const [showVerificationModal, setShowVerificationModal] = useState(false);
  const [isLoading, setIsLoading] = useState(true); // ADD loading state
  const location = useLocation();
  const navigate = useNavigate();
  
  const { user } = useAuth();
  const { 
    getAllRentalItems,
    getAvailableForRent,
    isItemAvailable
  } = useApp();

  // Use refs to store ALL product data from all sources
  const allProductsRef = useRef({});
  const [forceUpdate, setForceUpdate] = useState(0);

  // Packages data (same as in packages.js)
  const packages = [
    {
      id: 'basic-video-package',
      name: 'Package 1',
      title: 'Package 1: Basic Video Package',
      description: 'Perfect for small events and basic video production',
      price: 15000,
      displayItems: [
        "1 camera (inclusion: sdi, battery, charger and sd card)",
        "1 tripod", 
        "1 wheel slider",
        "1 cameraman"
      ],
      items: [
        { id: 'pmw-200', name: 'PMW-200', quantity: 1 },
        { id: 'sachtler-tripod', name: 'Sachtler Video 20 S1 100mm Ball Head Tripod System', quantity: 1 },
        { id: 'wheels-slider', name: 'Wheels Slider Tripod', quantity: 1 }
      ]
    },
    {
      id: 'professional-video-package',
      name: 'Package 2',
      title: 'Package 2: Professional Video Package',
      description: 'Professional multi-camera setup for events',
      price: 45000,
      displayItems: [
        "2 cameras (inclusion: sdi, battery, charger and sd card)",
        "2 tripods",
        "1 wheel slider", 
        "1 switcher",
        "1 monitor",
        "1 communication set",
        "2 cameramen",
        "1 switcher operator"
      ],
      items: [
        { id: 'sony-pmw-350k', name: 'sony pmw-350k', quantity: 1 },
        { id: 'cartoni-tripod', name: 'Cartoni Laser Z100 Fluid Head Tripod Aluminum 2', quantity: 1 },
        { id: 'lumantek-switcher', name: 'Lumantek ez-Pro VS10 3G-SDI/HDMI Video Switcher with 5" LED Touchscreen', quantity: 1 },
        { id: 'saramonic-comset', name: 'Saramonic WiTalk-WT7S 7-Person Full-Duplex Wireless Intercom System with Single-Ear Remote Headsets (1.9 GHz)', quantity: 1 },
        { id: 'accsoon-transmitter', name: 'Accsoon CineView Master 4K', quantity: 1 }
      ]
    },
    {
      id: 'multicam-production-package',
      name: 'Package 3',
      title: 'Package 3: Multicam Production Package',
      description: 'Premium broadcast package for large productions',
      price: 60000,
      displayItems: [
        "3 cameras (inclusion: sdi, battery, charger and sd card)",
        "3 tripods",
        "1 wheel slider", 
        "1 switcher",
        "1 monitor",
        "1 communication set",
        "3 cameramen",
        "1 switcher operator"
      ],
      items: [
        { id: 'pmw-200', name: 'PMW-200', quantity: 2 },
        { id: 'panasonic-hpx3100', name: 'Panasonic AJ HPX3100', quantity: 1 },
        { id: 'sony-mcx-500', name: 'sony mcx-500', quantity: 1 },
        { id: 'saramonic-comset', name: 'Saramonic WiTalk-WT7S 7-Person Full-Duplex Wireless Intercom System with Single-Ear Remote Headsets (1.9 GHz)', quantity: 1 },
        { id: 'atem-monitor', name: 'monitor ATEM156-CO HDMI 15.6 Video Monitor with Flightcase', quantity: 2 },
        { id: 'hollyland-transmitter', name: 'Hollyland Mars 4K Wireless Video Transmitter', quantity: 1 }
      ]
    }
  ];

  // ==============================================
  // NEW FUNCTION: Load ALL products from ALL sources
  // ==============================================
  useEffect(() => {
    const loadAllProducts = async () => {
      setIsLoading(true);
      console.log('🚀 Loading products from ALL sources...');
      
      try {
        // 1. Load from system/rentalInventory (predefined items)
        const rentalResult = await firebaseService.getRentalItems();
        const predefinedItems = rentalResult.success ? rentalResult.rentalItems : [];
        
        console.log('✅ Loaded from system/rentalInventory:', predefinedItems.length, 'predefined items');
        
        // 2. Load from inventory/currentInventory (user-added items)
        const inventoryResult = await firebaseService.getInventoryItems();
        const userAddedItems = inventoryResult.success ? inventoryResult.inventoryItems : [];
        
        console.log('✅ Loaded from inventory/currentInventory:', userAddedItems.length, 'user-added items');
        
        // 3. Load productInfo from localStorage
        let productInfoFromStorage = {};
        try {
          const savedProductInfo = localStorage.getItem('productInfo');
          if (savedProductInfo) {
            productInfoFromStorage = JSON.parse(savedProductInfo);
            console.log('✅ Loaded productInfo from localStorage:', Object.keys(productInfoFromStorage).length, 'items');
          }
        } catch (error) {
          console.error('Error loading productInfo:', error);
        }
        
        // 4. Get predefined product info (from your existing code)
        const predefinedProductInfo = {
          "sachtler-tripod": {
            title: "Sachtler Video 20 S1 100mm Ball Head Tripod System",
            image: "/assets/items/Sachtler.png",
            images: [
              "/assets/items/Sachtler.png",
              "/assets/items/camera_item/sachtler2.jpg",
              "/assets/items/camera_item/sachtler3.jpg",  
            ],
            description: "Unlock flawless performance and professional stability with the Sachtler Video 20 S1 100mm Ball Head Tripod System. Engineered for filmmakers, videographers, and content creators, this high-end tripod system delivers smooth, precise camera control with a robust 100mm ball head. The Video 20 S1 features a durable, lightweight design, offering excellent load capacity and versatility for even the most demanding shoots. this system ensures steady support and fluid movement, enhancing your creative workflow.",
            specifications: [
              "100mm Ball Head System",
              "Professional Stability",
              "Smooth Camera Control",
              "Lightweight Design",
              "Excellent Load Capacity"
            ],
            category: "tripod"
          },
          // ... (include ALL other predefined products from your original code)
        };
        
        // Combine ALL items into one object
        const allItems = {};
        
        // Add predefined items first (mark them as predefined)
        predefinedItems.forEach(item => {
          if (item.id) {
            allItems[item.id] = {
              ...item,
              isPredefined: true,
              source: 'system/rentalInventory'
            };
          }
        });
        
        // Add user-added items from Firebase (override predefined if same ID)
        userAddedItems.forEach(item => {
          if (item.id) {
            allItems[item.id] = {
              ...item,
              isPredefined: false,
              source: 'inventory/currentInventory'
            };
          }
        });
        
        // Merge with productInfo from localStorage for descriptions and specifications
        Object.keys(productInfoFromStorage).forEach(itemId => {
          if (allItems[itemId]) {
            // Merge productInfo data with item data
            allItems[itemId] = {
              ...allItems[itemId],
              title: productInfoFromStorage[itemId].title || allItems[itemId].name,
              description: productInfoFromStorage[itemId].description || allItems[itemId].description,
              image: productInfoFromStorage[itemId].image || allItems[itemId].image,
              specifications: productInfoFromStorage[itemId].specifications || allItems[itemId].specifications || [],
              category: productInfoFromStorage[itemId].category || allItems[itemId].category
            };
          } else {
            // Item exists in productInfo but not in inventory (shouldn't happen)
            allItems[itemId] = {
              id: itemId,
              ...productInfoFromStorage[itemId],
              isPredefined: false,
              source: 'productInfo'
            };
          }
        });
        
        // Merge with predefined product info
        Object.keys(predefinedProductInfo).forEach(itemId => {
          if (allItems[itemId]) {
            allItems[itemId] = {
              ...allItems[itemId],
              title: predefinedProductInfo[itemId].title || allItems[itemId].title,
              description: predefinedProductInfo[itemId].description || allItems[itemId].description,
              image: predefinedProductInfo[itemId].image || allItems[itemId].image,
              specifications: predefinedProductInfo[itemId].specifications || allItems[itemId].specifications || [],
              category: predefinedProductInfo[itemId].category || allItems[itemId].category,
              images: predefinedProductInfo[itemId].images || allItems[itemId].images || []
            };
          } else {
            // Item only exists in predefinedProductInfo
            allItems[itemId] = {
              id: itemId,
              ...predefinedProductInfo[itemId],
              isPredefined: true,
              source: 'predefinedProductInfo'
            };
          }
        });
        
        // Add packages
        packages.forEach(pkg => {
          allItems[pkg.id] = {
            id: pkg.id,
            title: pkg.title || pkg.name,
            description: pkg.description,
            items: pkg.items.map(item => ({
              id: item.id,
              name: item.name,
              quantity: item.quantity
            })),
            displayItems: pkg.displayItems,
            isPackage: true,
            packageData: pkg,
            specifications: pkg.displayItems || [],
            source: 'packages'
          };
        });
        
        // Store in ref
        allProductsRef.current = allItems;
        
        console.log('🎉 TOTAL products loaded:', Object.keys(allItems).length, 'items');
        console.log('📊 Breakdown:');
        console.log('- Predefined items:', Object.values(allItems).filter(item => item.isPredefined).length);
        console.log('- User-added items:', Object.values(allItems).filter(item => !item.isPredefined && !item.isPackage).length);
        console.log('- Packages:', Object.values(allItems).filter(item => item.isPackage).length);
        
        setIsLoading(false);
        setForceUpdate(prev => prev + 1); // Force re-render
        
      } catch (error) {
        console.error('❌ Error loading all products:', error);
        setIsLoading(false);
      }
    };
    
    loadAllProducts();
    
    // Listen for inventory updates
    const handleInventoryUpdate = () => {
      console.log('📢 Received inventory update event, reloading...');
      loadAllProducts();
    };
    
    window.addEventListener('inventoryUpdated', handleInventoryUpdate);
    
    return () => {
      window.removeEventListener('inventoryUpdated', handleInventoryUpdate);
    };
  }, []);

  // Check package availability (same as in packages.js)
  const getPackageAvailability = useCallback((pkg) => {
    const unavailableItems = pkg.items.filter(item => 
      !isItemAvailable(item.id, item.quantity)
    );
    return {
      isAvailable: unavailableItems.length === 0,
      unavailableItems
    };
  }, [isItemAvailable]);

  // CHANGED: Direct proceed to schedule function for ℹ icon view
  const handleProceedToSchedule = () => {
    const allProducts = allProductsRef.current;
    const pkg = allProducts[activePackage]?.packageData;
    if (!pkg) return;

    const availability = getPackageAvailability(pkg);
    
    if (!availability.isAvailable) {
      const unavailableNames = availability.unavailableItems.map(item => item.name).join(', ');
      showMessage(`Package unavailable. Following items are out of stock: ${unavailableNames}`);
      return;
    }

    // Check if user is logged in
    if (!user) {
      showMessage("Please log in to schedule a package.");
      navigate('/login-register');
      return;
    }

    // Save package to localStorage
    localStorage.setItem("selectedPackage", JSON.stringify(pkg));
    localStorage.removeItem("selectedItems"); // Clear any individual items

    // Check verification status
    const isVerified = user.isVerified || user.verified || false;
    
    if (!isVerified) {
      // Show verification modal
      setShowVerificationModal(true);
      return;
    }

    // If verified, proceed to schedule
    navigate("/rent-schedule");
  };

  // ADDED: Verification modal handlers
  const handleStartVerification = () => {
    setShowVerificationModal(false);
    navigate("/user-dashboard?tab=verification"); // Adjust based on your routes
  };

  const handleCloseVerificationModal = () => {
    setShowVerificationModal(false);
  };

  // ==============================================
  // UPDATED: Get current product with real-time data
  // ==============================================
  const getCurrentProductData = useCallback(() => {
    if (!activeProduct && !activePackage) return null;
    
    const itemId = activeProduct || activePackage;
    console.log('🔍 Getting product data for:', itemId);
    
    // Get all items from AppContext
    const allItems = getAllRentalItems ? getAllRentalItems() : [];
    const realTimeProduct = allItems.find(item => item.id === itemId);
    
    if (realTimeProduct) {
      console.log('✅ Found real-time product in AppContext:', {
        name: realTimeProduct.name,
        price: realTimeProduct.price,
        available: realTimeProduct.availableQuantity,
        reserved: realTimeProduct.reservedQuantity
      });
    } else {
      console.log('ℹ️ No real-time data in AppContext for:', itemId);
    }
    
    return realTimeProduct;
  }, [activeProduct, activePackage, getAllRentalItems]);

  // ==============================================
  // UPDATED: Get current product - checks ALL sources
  // ==============================================
  const currentProduct = React.useMemo(() => {
    const itemId = activeProduct || activePackage;
    if (!itemId) return null;
    
    // Get from our combined products ref
    const baseProduct = allProductsRef.current[itemId];
    if (!baseProduct) return null;
    
    // For packages
    if (baseProduct.isPackage) {
      const pkg = baseProduct.packageData;
      if (pkg) {
        const availability = getPackageAvailability(pkg);
        return {
          ...baseProduct,
          price: `₱${pkg.price.toLocaleString()}/day`,
          isPackage: true,
          isAvailable: availability.isAvailable,
          unavailableItems: availability.unavailableItems,
          packageData: pkg,
          // CRITICAL: Ensure specifications exist
          specifications: baseProduct.specifications || pkg.displayItems || []
        };
      }
    }
    
    // For individual items
    const realTimeProduct = getCurrentProductData();
    const combinedProduct = { ...baseProduct };
    
    if (realTimeProduct) {
      combinedProduct.price = realTimeProduct.price ? `₱${realTimeProduct.price.toLocaleString()}/day` : 'Price on request';
      const stock = getAvailableForRent ? getAvailableForRent(realTimeProduct) : 0;
      combinedProduct.stock = stock;
      combinedProduct.available = realTimeProduct.availableQuantity || 0;
      combinedProduct.reserved = realTimeProduct.reservedQuantity || 0;
    } else {
      // Fallback prices
      const predefinedPrices = {
        "sachtler-tripod": "₱3,500/day",
        "cartoni-tripod": "₱3,500/day",
        "eimage-tripod": "₱2,500/day",
        "pmw-200": "₱5,000/day",
        "sony-pmw-350k": "₱7,000/day",
        "panasonic-hpx3100": "₱8,000/day",
        "saramonic-comset": "₱3,000/day",
        "lumantek-switcher": "₱4,000/day",
        "sony-mcx-500": "₱4,500/day",
        "blackmagic-atem": "₱4,500/day",
        "behringer-mixer": "₱1,500/day",
        "xtuga-mixer": "₱1,200/day",
        "atem-monitor": "₱2,000/day",
        "lilliput-monitor": "₱1,800/day",
        "tvlogic-monitor": "₱2,200/day",
        "accsoon-transmitter": "₱2,500/day",
        "hollyland-transmitter": "₱3,000/day",
        "dolly-platform": "₱5,000/day",
        "wheels-slider": "₱3,500/day"
      };
      combinedProduct.price = predefinedPrices[activeProduct] || 'Price on request';
    }
    
    // CRITICAL: Ensure specifications are always an array
    if (!combinedProduct.specifications || !Array.isArray(combinedProduct.specifications)) {
      combinedProduct.specifications = [];
    }
    
    // DEBUG: Log product info
    console.log('📋 Current Product:', {
      id: combinedProduct.id,
      title: combinedProduct.title,
      source: combinedProduct.source,
      hasSpecifications: !!combinedProduct.specifications,
      specificationsCount: combinedProduct.specifications?.length || 0,
      specifications: combinedProduct.specifications
    });
    
    return combinedProduct;
  }, [activeProduct, activePackage, getCurrentProductData, getAvailableForRent, getPackageAvailability, forceUpdate]);

  // ==============================================
  // NEW FUNCTION: Get specifications - GUARANTEED TO WORK
  // ==============================================
  const displaySpecifications = React.useMemo(() => {
    if (!currentProduct) return [];
    
    // For packages, use displayItems
    if (currentProduct.isPackage && currentProduct.displayItems) {
      return currentProduct.displayItems;
    }
    
    // For individual items, check specifications
    if (currentProduct.specifications && Array.isArray(currentProduct.specifications)) {
      return currentProduct.specifications.filter(spec => spec && spec.trim() !== '');
    }
    
    // Last resort: check in allProductsRef
    const allProducts = allProductsRef.current;
    const itemId = activeProduct || activePackage;
    const itemInRef = allProducts[itemId];
    
    if (itemInRef && itemInRef.specifications && Array.isArray(itemInRef.specifications)) {
      return itemInRef.specifications.filter(spec => spec && spec.trim() !== '');
    }
    
    return [];
  }, [currentProduct, activeProduct, activePackage]);

  // Load URL parameters
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const itemId = params.get("item");
    const packageId = params.get("package");
    
    if (itemId) {
      setActiveProduct(itemId);
      setActivePackage('');
    } else if (packageId) {
      setActivePackage(packageId);
      setActiveProduct('');
    }
    
    setCurrentImageIndex(0);
  }, [location]);

  // Load product images
  useEffect(() => {
    if (!currentProduct) return;
    
    const images = [];
    const allProducts = allProductsRef.current;
    
    if (currentProduct.items) {
      // For packages
      currentProduct.items.forEach(item => {
        const fullProduct = allProducts[item.id];
        images.push({
          src: fullProduct?.image || item.image || '/assets/items/default.png',
          alt: fullProduct?.title || item.name
        });
      });
    } else if (currentProduct.images && currentProduct.images.length > 0) {
      // Single products with multiple images
      currentProduct.images.forEach(img => {
        images.push({
          src: img,
          alt: currentProduct.title
        });
      });
    } else if (currentProduct.image) {
      // Single product with single image
      images.push({
        src: currentProduct.image,
        alt: currentProduct.title
      });
    } else {
      images.push({
        src: '/assets/items/default.png',
        alt: currentProduct.title
      });
    }
    
    setProductImages(images);
  }, [currentProduct]);

  // Function to handle clicking on product images within packages
  const handleProductClick = (productId) => {
    navigate(`/information?item=${productId}`);
  };

  // Image carousel navigation functions
  const nextImage = () => {
    setCurrentImageIndex((prevIndex) => 
      prevIndex === productImages.length - 1 ? 0 : prevIndex + 1
    );
  };

  const prevImage = () => {
    setCurrentImageIndex((prevIndex) => 
      prevIndex === 0 ? productImages.length - 1 : prevIndex - 1
    );
  };

  const getBackPath = () => {
    if (activePackage) return '/packages';
    if (window.location.search.includes('package')) return '/packages';
    return '/rent-items';
  };

  // ==============================================
  // UPDATED: Add to Cart function
  // ==============================================
  const handleAddToCart = () => {
    if (!currentProduct || !user) {
      showMessage("Please log in to add items to your cart.");
      navigate('/login-register');
      return;
    }
    
    if (currentProduct.isPackage) {
      showMessage("To select this package, please go to the Packages page.");
      navigate('/packages');
      return;
    }
    
    const availableStock = currentProduct.stock || 0;
    if (availableStock <= 0) {
      showMessage("This item is currently out of stock.");
      return;
    }
    
    const userCartKey = `rentalCart_${user.uid}`;
    const savedCart = localStorage.getItem(userCartKey);
    let cart = savedCart ? JSON.parse(savedCart) : {};
    
    const cleanedCart = {};
    Object.keys(cart).forEach(key => {
      if (cart[key] && cart[key].itemId && cart[key].quantity > 0) {
        cleanedCart[key] = cart[key];
      }
    });
    
    cart = cleanedCart;
    
    const itemName = currentProduct.title;
    const itemId = activeProduct || activePackage;
    
    let itemPrice = 0;
    const realTimeProduct = getCurrentProductData();
    if (realTimeProduct && realTimeProduct.price) {
      itemPrice = realTimeProduct.price;
    } else {
      const predefinedPrices = {
        "sachtler-tripod": 3500, "cartoni-tripod": 3500, "eimage-tripod": 2500,
        "pmw-200": 5000, "sony-pmw-350k": 7000, "panasonic-hpx3100": 8000,
        "saramonic-comset": 3000, "lumantek-switcher": 4000, "sony-mcx-500": 4500,
        "blackmagic-atem": 4500, "behringer-mixer": 1500, "xtuga-mixer": 1200,
        "atem-monitor": 2000, "lilliput-monitor": 1800, "tvlogic-monitor": 2200,
        "accsoon-transmitter": 2500, "hollyland-transmitter": 3000,
        "dolly-platform": 5000, "wheels-slider": 3500
      };
      itemPrice = predefinedPrices[itemId] || 0;
    }
    
    let existingCartKey = null;
    Object.keys(cart).forEach(key => {
      if (cart[key].itemId === itemId) {
        existingCartKey = key;
      }
    });
    
    if (existingCartKey && existingCartKey !== itemName) {
      cart[itemName] = { ...cart[existingCartKey] };
      delete cart[existingCartKey];
      existingCartKey = itemName;
    }
    
    const currentInCart = existingCartKey ? cart[existingCartKey].quantity : 0;
    
    if (currentInCart >= availableStock) {
      showMessage(`Only ${availableStock} units available for "${itemName}". You already have ${currentInCart} in your cart.`);
      return;
    }
    
    if (existingCartKey) {
      cart[existingCartKey].quantity += 1;
      cart[existingCartKey].price = itemPrice;
    } else {
      cart[itemName] = {
        quantity: 1,
        price: itemPrice,
        itemId
      };
    }
    
    localStorage.setItem(userCartKey, JSON.stringify(cart));
    const newQuantity = existingCartKey ? cart[existingCartKey].quantity : 1;
    showMessage(`${itemName} added to cart! (Total: ${newQuantity})`);
    
    window.dispatchEvent(new CustomEvent('cartUpdated', {
      detail: { itemId, quantity: newQuantity }
    }));
  };

  const showSidebar = () => {
    const sidebar = document.querySelector('.sidebar');
    if (sidebar) sidebar.style.display = 'flex';
  };

  const hideSidebar = () => {
    const sidebar = document.querySelector('.sidebar');
    if (sidebar) sidebar.style.display = 'none';
  };

  // Loading state
  if (isLoading) {
    return (
      <div className="loading-container">
        <div className="spinner"></div>
        <p>Loading product information...</p>
      </div>
    );
  }

  if (!currentProduct) {
    return (
      <div className="no-product-found">
        <p>Product not found. Please go back and try again.</p>
        <button 
          onClick={() => navigate('/rent-items')}
          className="back-btn"
        >
          ← Back to Rent Items
        </button>
      </div>
    );
  }

  return (
    <>
      {/* Navbar with Sidebar */}
      <nav>
        <ul className="sidebar">
          <li onClick={hideSidebar}><a href="#"><svg xmlns="http://www.w3.org/2000/svg" height="24px" viewBox="0 -960 960 960" width="24px" fill="#1f1f1f"><path d="m256-200-56-56 224-224-224-224 56-56 224 224 224-224 56 56-224 224 224 224-56 56-224-224-224 224Z"/></svg></a></li>
          <li><Link to="/home">Home</Link></li>
          <li><Link to="/rent-items">Rent</Link></li>
          <li><Link to="/packages">Packages</Link></li>
          <li><Link to="/services">Services</Link></li>
          <li><Link to="/photobooth">Photobooth</Link></li>
          <li><Link to="/about">About us</Link></li>
          <li><a href="/login-register">Login</a></li>
        </ul>
        <ul>
          <li className="hideOnMobile"><Link to="/home"><img src="/assets/logoNew - Copy.png" width="200px" height="150px" alt="Logo" /></Link></li>
          <li className="hideOnMobile"><Link to="/home">Home</Link></li>
          <li className="hideOnMobile"><Link to="/rent-items">Rent</Link></li>
          <li className="hideOnMobile"><Link to="/packages">Packages</Link></li>
          <li className="hideOnMobile"><Link to="/services">Services</Link></li>
          <li className="hideOnMobile"><Link to="/photobooth">Photobooth</Link></li>
          <li className="hideOnMobile"><Link to="/about">About Us</Link></li>
          <li className="hideOnMobile"><a href="/login-register"><svg xmlns="http://www.w3.org/2000/svg" height="24px" viewBox="0 -960 960 960" width="24px" fill="#1f1f1f"><path d="M480-480q-66 0-113-47t-47-113q0-66 47-113t113-47q66 0 113 47t47 113q0 66-47 113t-113 47ZM160-160v-112q0-34 17.5-62.5T224-378q62-31 126-46.5T480-440q66 0 130 15.5T736-378q29 15 46.5 43.5T800-272v112H160Z"/></svg></a></li>
          <li className="menu-button" onClick={showSidebar}><a href="#"><svg xmlns="http://www.w3.org/2000/svg" height="24px" viewBox="0 -960 960 960" width="24px" fill="#1f1f1f"><path d="M120-240v-80h720v80H120Zm0-200v-80h720v80H120Zm0-200v-80h720v80H120Z"/></svg></a></li>
        </ul>
      </nav>

      {/* Information Content */}
      <h1 className="rent-header">Product Information</h1>
      
      <section className="confirmation-container">
        {currentProduct ? (
          <div 
            id={activeProduct || activePackage} 
            className="product-info lazada-style"
            style={{ display: 'block' }}
          >
            <div className="product-detail-container">
              
              {/* LEFT SIDE: Image Carousel */}
              <div className="product-image-column">
                <div className="image-carousel">
                  <div className="main-image-container">
                    <img 
                      src={productImages[currentImageIndex]?.src || '/assets/items/default.png'} 
                      alt={productImages[currentImageIndex]?.alt || currentProduct.title}
                      className="main-product-image"
                      onError={(e) => {
                        e.target.src = '/assets/items/default.png';
                        e.target.alt = `${currentProduct.title} - Image not available`;
                      }}
                    />
                    {productImages.length > 1 && (
                      <>
                        <button className="carousel-btn prev-btn" onClick={prevImage}>
                          <svg xmlns="http://www.w3.org/2000/svg" height="24px" viewBox="0 -960 960 960" width="24px" fill="#ffffff">
                            <path d="M560-240 320-480l240-240 56 56-184 184 184 184-56 56Z"/>
                          </svg>
                        </button>
                        <button className="carousel-btn next-btn" onClick={nextImage}>
                          <svg xmlns="http://www.w3.org/2000/svg" height="24px" viewBox="0 -960 960 960" width="24px" fill="#ffffff">
                            <path d="M504-480 320-664l56-56 240 240-240 240-56-56 184-184Z"/>
                          </svg>
                        </button>
                      </>
                    )}
                  </div>
                  
                  {productImages.length > 1 && (
                    <div className="thumbnail-container">
                      {productImages.map((img, index) => (
                        <div 
                          key={index} 
                          className={`thumbnail ${index === currentImageIndex ? 'active' : ''}`}
                          onClick={() => setCurrentImageIndex(index)}
                        >
                          <img 
                            src={img.src} 
                            alt={`${img.alt} thumbnail ${index + 1}`}
                            onError={(e) => {
                              e.target.src = '/assets/items/default.png';
                            }}
                          />
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* RIGHT SIDE: Product Details */}
              <div className="product-details-column">
                <h1 className="product-title">{currentProduct.title}</h1>
                
                {/* Price Section - SYNCED WITH APPCONTEXT */}
                <div className="price-section">
                  <h2 className="product-price">{currentProduct.price || 'Price on request'}</h2>
                  
                  {/* For packages */}
                  {currentProduct.isPackage && (
                    <div className="stock-info-section">
                      <span className={`stock-status ${currentProduct.isAvailable ? 'in-stock' : 'out-of-stock'}`}>
                        {currentProduct.isAvailable 
                          ? `✓ Package Available` 
                          : '✗ Package Unavailable'}
                      </span>
                      {currentProduct.unavailableItems && currentProduct.unavailableItems.length > 0 && (
                        <div className="unavailable-items">
                          <strong>Unavailable items:</strong>
                          <ul>
                            {currentProduct.unavailableItems.map((item, index) => (
                              <li key={index}>{item.name}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  )}
                  
                  {/* For individual items */}
                  {!currentProduct.isPackage && currentProduct.stock !== undefined && (
                    <div className="stock-info-section">
                      <span className={`stock-status ${currentProduct.stock > 0 ? 'in-stock' : 'out-of-stock'}`}>
                        {currentProduct.stock > 0 
                          ? `✓ In Stock (${currentProduct.stock} available)` 
                          : '✗ Out of Stock'}
                      </span>
                      {currentProduct.reserved > 0 && (
                        <span className="reserved-info">
                          ({currentProduct.reserved} reserved for bookings)
                        </span>
                      )}
                      {currentProduct.available > 0 && currentProduct.reserved > 0 && (
                        <span className="total-info">
                          Total: {currentProduct.available} units ({currentProduct.available - currentProduct.reserved} available for rent)
                        </span>
                      )}
                    </div>
                  )}
                  
                  {!user && (
                    <p className="login-reminder-small">
                      Please log in to add this item to your cart.
                    </p>
                  )}
                </div>

                {/* Description */}
                <div className="description-section">
                  <h3>Description</h3>
                  <p className="product-description">{currentProduct.description}</p>
                </div>

                {/* ============================================== */}
                {/* SPECIFICATIONS SECTION - NOW WORKING FOR ALL ITEMS */}
                {/* ============================================== */}
                {displaySpecifications.length > 0 && (
                  <div className="specifications-section">
                    <h3>{currentProduct.isPackage ? 'Package Includes' : 'Specifications'}</h3>
                    <ul className="specifications-list">
                      {displaySpecifications.map((spec, index) => (
                        <li key={index}>{spec}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Package Items (if package) */}
                {currentProduct.items && currentProduct.isPackage && (
                  <div className="package-items-section">
                    <h3>Equipment Included</h3>
                    <div className="package-items-grid">
                      {currentProduct.items.map((item, index) => {
                        const allProducts = allProductsRef.current;
                        const fullProduct = allProducts[item.id];
                        return (
                          <div 
                            key={index} 
                            className="package-item-card"
                            onClick={() => handleProductClick(item.id)}
                          >
                            <img 
                              src={fullProduct?.image || item.image} 
                              alt={fullProduct?.title || item.name}
                              onError={(e) => {
                                e.target.src = '/assets/items/default.png';
                              }}
                            />
                            <span>{fullProduct?.title || item.name}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Action Buttons - UPDATED: Proceed to Schedule for packages */}
                <div className="action-buttons">
                  {currentProduct.isPackage ? (
                    // For packages: Proceed to Schedule button (same style as select package)
                    <button 
                      onClick={handleProceedToSchedule}
                      disabled={!user || !currentProduct.isAvailable}
                      className="proceed-schedule-btn"
                    >
                      {!user ? 'Login to Proceed to Schedule' : 
                       (!currentProduct.isAvailable ? 'Package Unavailable' : 'Proceed to Schedule')}
                    </button>
                  ) : (
                    // For individual items - keep Add to Cart
                    <button 
                      className="add-to-cart-btn" 
                      onClick={handleAddToCart}
                      disabled={!user || (currentProduct.stock !== undefined && currentProduct.stock <= 0)}
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" height="20px" viewBox="0 -960 960 960" width="20px" fill="#ffffff">
                        <path d="M280-80q-33 0-56.5-23.5T200-160q0-33 23.5-56.5T280-240q33 0 56.5 23.5T360-160q0 33-23.5 56.5T280-80Zm400 0q-33 0-56.5-23.5T600-160q0-33 23.5-56.5T680-240q33 0 56.5 23.5T760-160q0 33-23.5 56.5T680-80ZM246-720l96 200h280l110-200H246Zm-38-80h590q23 0 35 20.5t1 41.5L692-482q-11 20-29.5 31T622-440H324l-44 80h480v80H280q-45 0-68-39.5t-2-78.5l54-98-144-304H40v-80h130l38 80Zm134 280h280-280Z"/>
                      </svg>
                      {!user ? 'Login to Add to Cart' : 
                       (currentProduct.stock <= 0 ? 'Out of Stock' : 'Add to Cart')}
                    </button>
                  )}
                  
                  <button 
                    onClick={() => navigate(getBackPath())}
                    className="back-btn"
                  >
                    ← Back to {activePackage ? 'Packages' : 'Rent Items'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="no-product-found">
            <p>Product not found. Please go back and try again.</p>
            <button 
              onClick={() => navigate('/rent-items')}
              className="back-btn"
            >
              ← Back to Rent Items
            </button>
          </div>
        )}
      </section>

      {/* ADDED: Verification Required Modal */}
      <div 
        className="policy-modal" 
        style={{ display: showVerificationModal ? 'flex' : 'none' }}
      >
        <div className="policy-modal-content">
          <span className="close-modal" onClick={handleCloseVerificationModal}>&times;</span>
          <div className="verification-content">
            <h2>Identity Verification Required</h2>
            <p>
              You need to verify your identity before you can proceed to scheduling. 
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

export default Information;