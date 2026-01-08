import React, { useState, useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { firebaseService } from '../services/firebaseService';
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
const RentItems = () => {
  const [cart, setCart] = useState({});
  const [total, setTotal] = useState(0);
  const [noItemsMessage, setNoItemsMessage] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState('');
  const [allItems, setAllItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [cartValidationErrors, setCartValidationErrors] = useState([]);
  const navigate = useNavigate();

  const [sidebarVisible, setSidebarVisible] = useState(false);
  const { user, isVerified, isAdmin } = useAuth();
  
  const showSidebar = () => {
    setSidebarVisible(true);
  };

  const hideSidebar = () => {
    setSidebarVisible(false);
  };
  const categoryRefs = useRef({});

  // Load all items directly from Firebase (both collections)
  const loadAllItems = async () => {
    setLoading(true);
    try {
      console.log('🔄 Loading all items from Firebase...');

      let combinedItems = [];

      // 1. Load PREDEFINED items from system/rentalInventory
      try {
        const rentalResult = await firebaseService.getRentalItems();
        if (rentalResult.success) {
          console.log('✅ Predefined items:', rentalResult.rentalItems);
          combinedItems = [...rentalResult.rentalItems];
          console.log('✅ Loaded', rentalResult.rentalItems?.length || 0, 'predefined rental items');
        } else {
          console.log('ℹ️ No predefined rental items found');
        }
      } catch (error) {
        console.error('❌ Error loading predefined rental items:', error);
      }

      // 2. Load USER-ADDED items from inventory/currentInventory
      try {
        const inventoryResult = await firebaseService.getInventoryItems();
        if (inventoryResult.success && inventoryResult.inventoryItems.length > 0) {
          console.log('✅ Inventory items:', inventoryResult.inventoryItems);
          // Combine with rental items
          combinedItems = [...combinedItems, ...inventoryResult.inventoryItems];
          console.log('✅ Loaded', inventoryResult.inventoryItems.length, 'user-added inventory items');
        } else {
          console.log('ℹ️ No inventory items found in inventory/currentInventory');

          // Try alternative: inventoryItems collection
          const collectionResult = await firebaseService.getAllInventoryItems();
          if (collectionResult.success && collectionResult.items.length > 0) {
            console.log('✅ Found items in inventoryItems collection:', collectionResult.items.length);
            combinedItems = [...combinedItems, ...collectionResult.items];
          }
        }
      } catch (error) {
        console.error('❌ Error loading inventory items:', error);
      }

      // Ensure all items have required fields
      const normalizedItems = combinedItems.map(item => ({
        ...item,
        id: item.id || `item-${Date.now()}`,
        name: item.name || 'Unnamed Item',
        category: item.category || 'uncategorized',
        price: item.price || 0,
        availableQuantity: item.availableQuantity || item.quantity || 0,
        reservedQuantity: item.reservedQuantity || 0,
        totalQuantity: item.totalQuantity || item.maxQuantity || 1
      }));

      console.log('📊 Total items loaded:', normalizedItems.length);
      console.log('Sample items:', normalizedItems.slice(0, 5).map(item => ({
        id: item.id,
        name: item.name.substring(0, 30),
        category: item.category,
        availableQuantity: item.availableQuantity,
        source: item.isPredefined ? 'predefined' : 'inventory'
      })));

      setAllItems(normalizedItems);

    } catch (error) {
      console.error('❌ Error loading all items:', error);
    } finally {
      setLoading(false);
    }
  };

  // Load all items on component mount
  useEffect(() => {
    loadAllItems();
  }, []);

  // Get max quantity available for rent (available - reserved)
  const getMaxQuantity = (itemId) => {
    const item = allItems.find(item => item.id === itemId);
    if (!item) {
      console.log('Item not found:', itemId);
      return 0;
    }

    const available = item.availableQuantity || 0;
    const reserved = item.reservedQuantity || 0;
    const max = Math.max(0, available - reserved);

    console.log(`Max quantity for ${item.name}: ${available} - ${reserved} = ${max}`);
    return max;
  };

  // Validate cart items against current inventory
  const validateCartAgainstInventory = () => {
    const errors = [];

    Object.entries(cart).forEach(([itemName, cartItem]) => {
      const item = allItems.find(item => item.id === cartItem.itemId);
      if (!item) {
        errors.push(`"${itemName}" is no longer available in inventory.`);
        return;
      }

      const maxQty = getMaxQuantity(cartItem.itemId);
      if (cartItem.quantity > maxQty) {
        errors.push(
          `"${itemName}": Only ${maxQty} units available, but you have ${cartItem.quantity} in cart.`
        );
      }
    });

    setCartValidationErrors(errors);
    return errors.length === 0;
  };

  // Validate cart whenever cart or allItems changes
  useEffect(() => {
    if (Object.keys(cart).length > 0 && allItems.length > 0) {
      validateCartAgainstInventory();
    } else {
      setCartValidationErrors([]);
    }
  }, [cart, allItems]);

  // Load cart from localStorage for the specific user
  useEffect(() => {
    if (user) {
      const userCartKey = `rentalCart_${user.uid}`;
      const savedCart = localStorage.getItem(userCartKey);
      if (savedCart) {
        try {
          const parsedCart = JSON.parse(savedCart);

          // Validate cart items - remove any that no longer exist
          const validatedCart = {};
          Object.entries(parsedCart).forEach(([itemName, cartItem]) => {
            const item = allItems.find(item => item.id === cartItem.itemId);
            if (item) {
              // Also validate quantity against current inventory
              const maxQty = getMaxQuantity(cartItem.itemId);
              const adjustedQty = Math.min(cartItem.quantity, maxQty);
              if (adjustedQty > 0) {
                validatedCart[itemName] = { ...cartItem, quantity: adjustedQty };
              }
            }
          });

          setCart(validatedCart);
          if (Object.keys(validatedCart).length > 0) {
            setNoItemsMessage(false);
          }
        } catch (error) {
          console.error('Error loading cart from localStorage:', error);
          localStorage.removeItem(userCartKey);
        }
      }
    } else {
      // If user is not logged in, clear the cart
      setCart({});
      setNoItemsMessage(true);
      setCartValidationErrors([]);
    }
  }, [user, allItems]);

  // Save cart to localStorage for the specific user whenever it changes
  useEffect(() => {
    if (user && Object.keys(cart).length > 0) {
      const userCartKey = `rentalCart_${user.uid}`;
      localStorage.setItem(userCartKey, JSON.stringify(cart));
    }
  }, [cart, user]);

  // Calculate total whenever cart changes
  useEffect(() => {
    const newTotal = Object.values(cart).reduce((sum, item) => {
      return sum + (item.quantity * item.price);
    }, 0);
    setTotal(newTotal);

    // Save selected items to localStorage for confirmation page
    if (Object.keys(cart).length > 0) {
      const selectedItems = Object.entries(cart).map(([name, item]) => ({
        id: item.itemId,
        name,
        price: item.price,
        quantity: item.quantity,
        subtotal: item.price * item.quantity
      }));
      localStorage.setItem("selectedItems", JSON.stringify(selectedItems));
    }
  }, [cart]);

  // Listen for inventory updates from InventoryPanel and DamagedItemsPanel
  useEffect(() => {
    const handleInventoryUpdate = () => {
      console.log('🔄 Inventory updated event received, reloading items...');
      loadAllItems();

      // Validate cart items after reload
      if (user && Object.keys(cart).length > 0) {
        const validatedCart = {};
        Object.entries(cart).forEach(([itemName, cartItem]) => {
          const item = allItems.find(item => item.id === cartItem.itemId);
          if (item) {
            const maxQty = getMaxQuantity(cartItem.itemId);
            const adjustedQty = Math.min(cartItem.quantity, maxQty);
            if (adjustedQty > 0) {
              validatedCart[itemName] = { ...cartItem, quantity: adjustedQty };
            }
          }
        });

        if (Object.keys(validatedCart).length !== Object.keys(cart).length) {
          setCart(validatedCart);
        }
      }
    };

    // Listen for custom events
    window.addEventListener('inventoryUpdated', handleInventoryUpdate);

    // Listen for damage report events
    const handleDamageUpdate = (e) => {
      console.log('🔧 Damage report processed:', e.detail);
      setTimeout(() => {
        loadAllItems();
      }, 1000); // Wait 1 second for Firebase to update
    };

    window.addEventListener('damageReportProcessed', handleDamageUpdate);

    return () => {
      window.removeEventListener('inventoryUpdated', handleInventoryUpdate);
      window.removeEventListener('damageReportProcessed', handleDamageUpdate);
    };
  }, [user, cart, allItems]);

  // Subscribe to real-time Firebase updates for inventory
  useEffect(() => {
    console.log('📡 Setting up Firebase real-time listeners...');

    // Subscribe to predefined items changes
    const unsubscribeRentalItems = firebaseService.subscribeToRentalItems((items) => {
      console.log('📡 Predefined items updated:', items?.length || 0);
      loadAllItems(); // Reload all items when predefined items change
    });

    // Subscribe to inventory items changes
    const unsubscribeInventory = firebaseService.subscribeToInventory((items) => {
      console.log('📡 Inventory items updated:', items?.length || 0);
      loadAllItems(); // Reload all items when inventory changes
    });

    return () => {
      unsubscribeRentalItems?.();
      unsubscribeInventory?.();
    };
  }, []);



  // 移除 scrollToCategory 函数，改为直接过滤
  const filterByCategory = (category) => {
    setSelectedCategory(category);
  };

  const [showVerificationModal, setShowVerificationModal] = useState(false);

  const getItemImage = (item) => {
    if (!item) return '/assets/items/default.png';

    // Check if item has image property
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

    return filenameMap[item.id] || '/assets/items/default.png';
  };

  // Add item to cart
  const addToCart = (itemId, itemName, price) => {
    if (!user) {
      showMessage("Please log in to add items to your cart.");
      navigate('/login-register');
      return;
    }

    const maxQty = getMaxQuantity(itemId);

    if (maxQty <= 0) {
      showMessage("This item is currently out of stock.");
      return;
    }

    setCart(prevCart => {
      const newCart = { ...prevCart };

      if (newCart[itemName]) {
        const newQty = newCart[itemName].quantity + 1;
        if (newQty > maxQty) {
          showMessage(`Only ${maxQty} units available for "${itemName}".`);
          return prevCart;
        }
        newCart[itemName] = { ...newCart[itemName], quantity: newQty, itemId };
      } else {
        newCart[itemName] = { quantity: 1, price, itemId };
      }

      return newCart;
    });

    setNoItemsMessage(false);
  };

  // Remove item from cart
  const removeFromCart = (name) => {
    setCart(prevCart => {
      const newCart = { ...prevCart };
      delete newCart[name];
      return newCart;
    });
  };

  // Update quantity in cart
  const updateCartQuantity = (name, newQuantity) => {
    if (!user) {
      showMessage("Please log in to modify your cart.");
      return;
    }

    const itemId = cart[name]?.itemId;
    if (!itemId) return;

    const maxQty = getMaxQuantity(itemId);

    if (newQuantity <= 0) {
      removeFromCart(name);
      return;
    }

    if (newQuantity > maxQty) {
      showMessage(`Only ${maxQty} units available for "${name}".`);
      return;
    }

    setCart(prevCart => ({
      ...prevCart,
      [name]: {
        ...prevCart[name],
        quantity: newQuantity
      }
    }));
  };

  const clearCart = () => {
    if (user) {
      const userCartKey = `rentalCart_${user.uid}`;
      localStorage.removeItem(userCartKey);
    }
    setCart({});
    setNoItemsMessage(true);
    setCartValidationErrors([]);
    localStorage.removeItem("selectedItems");
  };

  const checkout = () => {
    if (!user) {
      showMessage("Please log in to proceed with booking.");
      navigate('/login-register');
      return;
    }

    if (!isVerified) {
      setShowVerificationModal(true);
      return;
    }

    if (Object.keys(cart).length === 0) {
      setNoItemsMessage(true);
      return;
    }

    // VALIDATE CART AGAINST INVENTORY BEFORE PROCEEDING
    const isValid = validateCartAgainstInventory();
    if (!isValid) {
      showMessage("Your cart contains items that exceed available inventory. Please adjust your quantities before proceeding.");
      return;
    }

    const selectedItems = Object.entries(cart).map(([name, item]) => ({
      id: item.itemId,
      name,
      price: item.price,
      quantity: item.quantity,
      subtotal: item.price * item.quantity
    }));

    localStorage.removeItem("selectedPackage");
    localStorage.setItem("selectedItems", JSON.stringify(selectedItems));

    console.log('Saved items to localStorage for checkout:', selectedItems);
    window.location.href = "/Confirmation";
  };

  const handleStartVerification = () => {
    setShowVerificationModal(false);
    navigate('/userDashboard');
  };

  const handleCloseVerificationModal = () => setShowVerificationModal(false);

  // Filter items by category
  const getItemsByCategory = (category) => {
    if (!selectedCategory || selectedCategory === '') {
      return allItems.filter(item => item.category === category);
    } else {
      return allItems.filter(item => item.category === selectedCategory && item.category === category);
    }
  };

  // 检查当前类别是否有项目
  const hasItemsInCategory = (category) => {
    return allItems.some(item => item.category === category);
  };

  // ProductCard component
  const ProductCard = ({ item }) => {
    const imageUrl = getItemImage(item);
    const available = item.availableQuantity || 0;
    const reserved = item.reservedQuantity || 0;
    const availableForRent = Math.max(0, available - reserved);
    const currentInCart = cart[item.name] ? cart[item.name].quantity : 0;
    const itemId = item.id;

    // Check if this item has validation errors
    const itemErrors = cartValidationErrors.filter(error =>
      error.includes(`"${item.name}"`)
    );

    return (
      <div key={itemId} className="card" data-product={item.name}>
        <div className="card-top">
          <div className="image-wrapper">
            <Link to={`/information?item=${itemId}`} className="clickable-image" title={`Click for more info about ${item.name}`}>
              <img
                src={imageUrl}
                alt={item.name}
                onError={(e) => {
                  e.target.src = '/assets/items/default.png';
                  e.target.alt = `${item.name} - Image not available`;
                }}
                style={{
                  width: '100%',
                  height: '200px',
                  objectFit: 'cover',
                  borderRadius: '8px'
                }}
              />
            </Link>
          </div>
          <div className="card-info">
            <h3>{item.name}</h3>
            <p className="price">₱{(item.price || 0).toLocaleString()}</p>
            <p className={`stock-info ${availableForRent <= 0 ? 'out-of-stock' : ''}`}>
              {availableForRent > 0
                ? `${availableForRent} available`
                : 'Out of stock'}
            </p>
            {reserved > 0 && (
              <p className="reserved-info">
                {reserved} reserved for bookings
              </p>
            )}
            {currentInCart > 0 && (
              <p className="in-cart-info">
                In cart: {currentInCart}
              </p>
            )}
            {itemErrors.length > 0 && (
              <p className="error-info" style={{ color: 'red', fontSize: '12px' }}>
                ⚠️ Exceeds available inventory
              </p>
            )}
          </div>
        </div>
        <div className="card-bottom">
          <button
            onClick={() => addToCart(itemId, item.name, item.price || 0)}
            disabled={availableForRent === 0}
            className={availableForRent === 0 ? 'disabled' : ''}
          >
            {availableForRent === 0 ? 'Out of Stock' : 'Add to Cart'}
          </button>
        </div>
      </div>
    );
  };



  return (
    <>
      {/* Navbar and sidebar */}
      <nav>
        <ul className={`sidebar ${sidebarVisible ? 'active' : ''}`}>
          <li onClick={hideSidebar}><a href="#"><svg xmlns="http://www.w3.org/2000/svg" height="24px" viewBox="0 -960 960 960" width="24px" fill="#1f1f1f"><path d="m256-200-56-56 224-224-224-224 56-56 224 224 224-224 56 56-224 224 224 224-56 56-224-224-224 224Z" /></svg></a></li>
          <li><Link to="/home" onClick={hideSidebar}>Home</Link></li>
          <li><Link to="/rent-schedule" onClick={hideSidebar}>Schedule</Link></li>
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
          <li className="hideOnMobile"><Link to="/rent-schedule">Schedule</Link></li>
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

      {/* Rent Items Content */}
      <section className="rent-header">
        <h1 className='rent-title'>Rent Items</h1>
        <p>Quality Gear You Can Trust, Ready When You Are</p>
      </section>


      <section className="rent-wrapper">
        <div className="top-bar">
          <div className="category-buttons">
            <button
              onClick={() => filterByCategory('')}
              className={selectedCategory === '' ? 'active' : ''}
            >
              All items
            </button>
            {hasItemsInCategory('tripod') && (
              <button
                onClick={() => filterByCategory('tripod')}
                className={selectedCategory === 'tripod' ? 'active' : ''}
              >
                Tripod
              </button>
            )}
            {hasItemsInCategory('camera') && (
              <button
                onClick={() => filterByCategory('camera')}
                className={selectedCategory === 'camera' ? 'active' : ''}
              >
                Camera
              </button>
            )}
            {hasItemsInCategory('comset') && (
              <button
                onClick={() => filterByCategory('comset')}
                className={selectedCategory === 'comset' ? 'active' : ''}
              >
                Comset
              </button>
            )}
            {hasItemsInCategory('switcher') && (
              <button
                onClick={() => filterByCategory('switcher')}
                className={selectedCategory === 'switcher' ? 'active' : ''}
              >
                Switcher
              </button>
            )}
            {hasItemsInCategory('audio-mixer') && (
              <button
                onClick={() => filterByCategory('audio-mixer')}
                className={selectedCategory === 'audio-mixer' ? 'active' : ''}
              >
                Audio Mixer
              </button>
            )}
            {hasItemsInCategory('monitor') && (
              <button
                onClick={() => filterByCategory('monitor')}
                className={selectedCategory === 'monitor' ? 'active' : ''}
              >
                Monitor
              </button>
            )}
            {hasItemsInCategory('video-transmitter') && (
              <button
                onClick={() => filterByCategory('video-transmitter')}
                className={selectedCategory === 'video-transmitter' ? 'active' : ''}
              >
                Video Transmitter
              </button>
            )}
            {hasItemsInCategory('camera-dolly') && (
              <button
                onClick={() => filterByCategory('camera-dolly')}
                className={selectedCategory === 'camera-dolly' ? 'active' : ''}
              >
                Camera Dolly
              </button>
            )}
          </div>
        </div>

        <div className="container">
          <div className="products">
            {(!selectedCategory || selectedCategory === '') ? (
              <>
                {hasItemsInCategory('tripod') && (
                  <div id="tripod" className="category-group">
                    <h2 className="category-title">Tripod</h2>
                    <div className="product-grid">
                      {getItemsByCategory('tripod').map(item => (
                        <ProductCard key={item.id} item={item} />
                      ))}
                    </div>
                  </div>
                )}

                {hasItemsInCategory('camera') && (
                  <div id="camera" className="category-group">
                    <h2 className="category-title">Camera</h2>
                    <div className="product-grid">
                      {getItemsByCategory('camera').map(item => (
                        <ProductCard key={item.id} item={item} />
                      ))}
                    </div>
                  </div>
                )}

                {hasItemsInCategory('comset') && (
                  <div id="comset" className="category-group">
                    <h2 className="category-title">Comset</h2>
                    <div className="product-grid">
                      {getItemsByCategory('comset').map(item => (
                        <ProductCard key={item.id} item={item} />
                      ))}
                    </div>
                  </div>
                )}

                {hasItemsInCategory('switcher') && (
                  <div id="switcher" className="category-group">
                    <h2 className="category-title">Switcher</h2>
                    <div className="product-grid">
                      {getItemsByCategory('switcher').map(item => (
                        <ProductCard key={item.id} item={item} />
                      ))}
                    </div>
                  </div>
                )}

                {hasItemsInCategory('audio-mixer') && (
                  <div id="audio-mixer" className="category-group">
                    <h2 className="category-title">Audio Mixer</h2>
                    <div className="product-grid">
                      {getItemsByCategory('audio-mixer').map(item => (
                        <ProductCard key={item.id} item={item} />
                      ))}
                    </div>
                  </div>
                )}

                {hasItemsInCategory('monitor') && (
                  <div id="monitor" className="category-group">
                    <h2 className="category-title">Monitor</h2>
                    <div className="product-grid">
                      {getItemsByCategory('monitor').map(item => (
                        <ProductCard key={item.id} item={item} />
                      ))}
                    </div>
                  </div>
                )}

                {hasItemsInCategory('video-transmitter') && (
                  <div id="video-transmitter" className="category-group">
                    <h2 className="category-title">Video Transmitter</h2>
                    <div className="product-grid">
                      {getItemsByCategory('video-transmitter').map(item => (
                        <ProductCard key={item.id} item={item} />
                      ))}
                    </div>
                  </div>
                )}

                {hasItemsInCategory('camera-dolly') && (
                  <div id="camera-dolly" className="category-group">
                    <h2 className="category-title">Camera Dolly</h2>
                    <div className="product-grid">
                      {getItemsByCategory('camera-dolly').map(item => (
                        <ProductCard key={item.id} item={item} />
                      ))}
                    </div>
                  </div>
                )}
              </>
            ) : (
              // Category Section
              <div id={selectedCategory} className="category-group">
                <h2 className="category-title">
                  {selectedCategory === 'tripod' && 'Tripod'}
                  {selectedCategory === 'camera' && 'Camera'}
                  {selectedCategory === 'comset' && 'Comset'}
                  {selectedCategory === 'switcher' && 'Switcher'}
                  {selectedCategory === 'audio-mixer' && 'Audio Mixer'}
                  {selectedCategory === 'monitor' && 'Monitor'}
                  {selectedCategory === 'video-transmitter' && 'Video Transmitter'}
                  {selectedCategory === 'camera-dolly' && 'Camera Dolly'}
                </h2>
                <div className="product-grid">
                  {getItemsByCategory(selectedCategory).map(item => (
                    <ProductCard key={item.id} item={item} />
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Cart Section */}
        <div className="cart">
          {!user && (
            <div className="login-prompt">
              <p>Please log in to add items to your cart and save your selections.</p>
              <button
                onClick={() => navigate('/login-register')}
                className="login-btn"
              >
                Log In / Register
              </button>
            </div>
          )}

          {/* Cart Validation Errors */}
          {cartValidationErrors.length > 0 && (
            <div className="cart-validation-errors">
              <h4>⚠️ Inventory Issues:</h4>
              <ul>
                {cartValidationErrors.map((error, index) => (
                  <li key={index} style={{ color: 'red', fontSize: '14px' }}>
                    {error}
                  </li>
                ))}
              </ul>
              <p style={{ fontSize: '12px', color: '#666' }}>
                Please adjust quantities or remove items before proceeding.
              </p>
            </div>
          )}

          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th>Price</th>
                <th>Quantity</th>
                <th>Subtotal</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {Object.entries(cart).map(([name, item]) => {
                const maxQty = getMaxQuantity(item.itemId);
                const hasError = cartValidationErrors.some(error =>
                  error.includes(`"${name}"`)
                );

                return (
                  <tr key={name} style={hasError ? { backgroundColor: '#ffe6e6' } : {}}>
                    <td>
                      {name}
                      {hasError && (
                        <span style={{ color: 'red', fontSize: '12px', display: 'block' }}>
                          ⚠️ Exceeds available ({maxQty})
                        </span>
                      )}
                    </td>
                    <td>₱{(item.price || 0).toLocaleString()}</td>
                    <td>
                      <div className="quantity-controls">
                        <button
                          onClick={() => updateCartQuantity(name, item.quantity - 1)}
                          className="qty-btn"
                        >
                          -
                        </button>
                        <span className="quantity-display">{item.quantity}</span>
                        <button
                          onClick={() => updateCartQuantity(name, item.quantity + 1)}
                          className="qty-btn"
                          disabled={item.quantity >= maxQty}
                        >
                          +
                        </button>
                      </div>
                    </td>
                    <td>₱{((item.price || 0) * item.quantity).toLocaleString()}</td>
                    <td>
                      <button onClick={() => removeFromCart(name)} className="remove-btn">
                        Remove
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          {Object.keys(cart).length === 0 ? (
            <p className="empty-cart-message">
              {user ? 'Your cart is empty. Add items to get started.' : 'Please log in to view your cart.'}
            </p>
          ) : (
            <>
              <div className="cart-total">
                <p>Total: ₱{total.toLocaleString()}</p>
              </div>
              <div className="cart-actions">
                <button
                  onClick={checkout}
                  className="checkout-btn"
                  disabled={cartValidationErrors.length > 0}
                  style={cartValidationErrors.length > 0 ? {
                    opacity: 0.5,
                    cursor: 'not-allowed'
                  } : {}}
                >
                  {cartValidationErrors.length > 0
                    ? 'Fix Inventory Issues First'
                    : 'Proceed to Confirmation'}
                </button>
                <button onClick={clearCart} className="clear-btn">
                  Clear Cart
                </button>
              </div>
            </>
          )}
        </div>
      </section>

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

export default RentItems;