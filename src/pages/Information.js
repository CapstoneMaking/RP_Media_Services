// information.js - UPDATED WITH APPCONTEXT INTEGRATION
import React, { useCallback, useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useApp } from '../context/AppContext'; // FIXED: Changed from AppContext to useApp

const Information = () => {
  const [activeProduct, setActiveProduct] = useState('');
  const [activePackage, setActivePackage] = useState('');
  const [inventoryProducts, setInventoryProducts] = useState({});
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [productImages, setProductImages] = useState([]);
  const [packageSelected, setPackageSelected] = useState(false);
  const [selectedPackageDetails, setSelectedPackageDetails] = useState(null);
  const [showVerificationModal, setShowVerificationModal] = useState(false); // ADDED: For ID verification
  const location = useLocation();
  const navigate = useNavigate();
  
  const { user } = useAuth();
  const { 
    getAllRentalItems,  // Get all items from AppContext
    getAvailableForRent, // Helper function for available stock
    isItemAvailable // Add this to check package availability
  } = useApp();

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

  // Check package availability (same as in packages.js)
  const getPackageAvailability = (pkg) => {
    const unavailableItems = pkg.items.filter(item => 
      !isItemAvailable(item.id, item.quantity)
    );
    return {
      isAvailable: unavailableItems.length === 0,
      unavailableItems
    };
  };

  // CHANGED: Direct proceed to schedule function for ℹ icon view
  const handleProceedToSchedule = () => {
    const pkg = packages.find(p => p.id === activePackage);
    if (!pkg) return;

    const availability = getPackageAvailability(pkg);
    
    if (!availability.isAvailable) {
      const unavailableNames = availability.unavailableItems.map(item => item.name).join(', ');
      alert(`Package unavailable. Following items are out of stock: ${unavailableNames}`);
      return;
    }

    // Check if user is logged in
    if (!user) {
      alert("Please log in to schedule a package.");
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
  // FIX 1: Get real-time product data from AppContext
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

  // Load inventory products from localStorage
  useEffect(() => {
    const savedProductInfo = localStorage.getItem('productInfo');
    if (savedProductInfo) {
      setInventoryProducts(JSON.parse(savedProductInfo));
    }

    // Check if there's already a selected package for this active package
    const savedPackage = localStorage.getItem("selectedPackage");
    if (savedPackage && activePackage) {
      try {
        const pkg = JSON.parse(savedPackage);
        if (pkg.id === activePackage) {
          setSelectedPackageDetails(pkg);
          setPackageSelected(true);
        }
      } catch (error) {
        console.error('Error parsing saved package:', error);
      }
    }
  }, [activePackage]);

  const showSidebar = () => {
    const sidebar = document.querySelector('.sidebar');
    sidebar.style.display = 'flex';
  };

  const hideSidebar = () => {
    const sidebar = document.querySelector('.sidebar');
    sidebar.style.display = 'none';
  };

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const itemId = params.get("item");
    const packageId = params.get("package");
    
    if (itemId) {
      setActiveProduct(itemId);
      setActivePackage('');
      setPackageSelected(false);
      setSelectedPackageDetails(null);
      setCurrentImageIndex(0);
      const section = document.getElementById(itemId);
      if (section) {
        section.style.display = "block";
        section.scrollIntoView({ behavior: "smooth" });
      }
    } else if (packageId) {
      setActivePackage(packageId);
      setActiveProduct('');
      setCurrentImageIndex(0);
      const section = document.getElementById(packageId);
      if (section) {
        section.style.display = "block";
        section.scrollIntoView({ behavior: "smooth" });
      }
    }
  }, [location, inventoryProducts]);

  // ==============================================
  // FIX 2: Combine predefined data with AppContext data
  // ==============================================
  const getProductInfo = useCallback(() => {
    const predefinedProductInfo = {
      // Individual Products - ONLY DESCRIPTIVE DATA (no prices/stock)
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
      "cartoni-tripod": {
        title: "Cartoni Laser Z100 Fluid Head Tripod Aluminum 2",
        image: "/assets/items/Cartoni.png",
        images: [
          "/assets/items/Cartoni.png",
          "/assets/items/camera_item/cartoni3.jpg",
          "/assets/items/camera_item/cartoni2.jpg",  
        ],
        description: "Get precision and stability with the Cartoni Laser Z100 Fluid Head Tripod—the perfect solution for your next shoot. Designed for professional filmmakers and videographers, this aluminum tripod system features the Z100 fluid head, offering exceptional fluidity and control for smooth panning and tilting. With an impressive load capacity and durable construction, the Z100 is ideal for supporting a variety of camera setups, from lightweight rigs to heavier professional cameras. Whether you're working on-location or in the studio, this tripod ensures steady and reliable performance.",
        specifications: [
          "Z100 Fluid Head",
          "Aluminum Construction",
          "Exceptional Fluidity",
          "Professional Load Capacity",
          "Studio & Location Ready"
        ],
        category: "tripod"
      },
      "eimage-tripod": {
        title: "E-Image 2-Stage Aluminum Tripod with GH15 Head",
        image: "/assets/items/E-imageTripod.jpg",
        images: [
          "/assets/items/E-imageTripod.jpg",
          "/assets/items/camera_item/e-image2.jpg",
          "/assets/items/camera_item/e-image3.jpg",  
        ],
        description: "Experience professional stability and versatility with the E-Image 2-Stage Aluminum Tripod featuring the GH15 Fluid Head. Designed for videographers and filmmakers, this robust tripod system offers smooth panning and tilting capabilities with its advanced fluid head technology. The two-stage aluminum legs provide quick height adjustments and excellent stability on various surfaces. Perfect for both studio and location shoots, this tripod ensures reliable performance for your camera equipment.",
        specifications: [
          "2-Stage Aluminum Legs",
          "GH15 Fluid Head",
          "Quick Height Adjustment",
          "Various Surface Stability",
          "Professional Performance"
        ],
        category: "tripod"
      },
      "pmw-200": {
        title: "Sony PMW-200 Camera",
        image: "/assets/items/pmw.png",
        images: [
          "/assets/items/pmw.png",
          "/assets/items/camera_item/PMW2.jpg",
          "/assets/items/camera_item/PMW3.jpg",  
        ],
        description: "The Sony PMW-200 is a professional handheld flash memory camcorder that delivers exceptional image quality and versatility. Featuring three 1/3-type Exmor CMOS sensors and 10-bit 4:2:2 HD recording, this camera produces broadcast-quality footage with excellent low-light performance. With its compact design and comprehensive professional features, the PMW-200 is ideal for news gathering, documentary production, and event coverage.",
        specifications: [
          "Three 1/3-type Exmor CMOS Sensors",
          "10-bit 4:2:2 HD Recording",
          "Broadcast-Quality Footage",
          "Excellent Low-Light Performance",
          "Compact Design"
        ],
        category: "camera"
      },
      "sony-pmw-350k": {
        title: "Sony PMW-350K Camera",
        image: "/assets/items/sony.png",
        images: [
          "/assets/items/sony.png",
          "/assets/items/camera_item/sony2.jpg",
          "/assets/items/camera_item/sony3.jpg",  
        ],
        description: "The Sony PMW-350K is a high-performance XDCAM EX camcorder designed for professional broadcast and production applications. Equipped with three 2/3-inch type Exmor CMOS sensors and 10-bit 4:2:2 HD recording capability, it delivers superior image quality with excellent color reproduction and dynamic range. This camera system offers exceptional flexibility for various shooting scenarios from studio production to field acquisition.",
        specifications: [
          "Three 2/3-inch Exmor CMOS Sensors",
          "10-bit 4:2:2 HD Recording",
          "Superior Image Quality",
          "Exceptional Color Reproduction",
          "Professional Broadcast Ready"
        ],
        category: "camera"
      },
      "panasonic-hpx3100": {
        title: "Panasonic AJ HPX3100 Camera",
        image: "/assets/items/Panasonic.png",
        images: [
          "/assets/items/Panasonic.png",
          "/assets/items/camera_item/panasonic2.jpg",
          "/assets/items/camera_item/panasonic3.jpg",  
        ],
        description: "The Panasonic AJ-HPX3100 is a professional P2 HD camcorder that offers outstanding performance for broadcast and production applications. Featuring three 2/3-inch CCD sensors and AVC-Intra 100/50 recording, this camera delivers exceptional image quality with rich color reproduction and detail. With its robust construction and comprehensive connectivity options, the HPX3100 is perfect for demanding professional environments.",
        specifications: [
          "Three 2/3-inch CCD Sensors",
          "AVC-Intra 100/50 Recording",
          "Exceptional Image Quality",
          "Rich Color Reproduction",
          "Robust Construction"
        ],
        category: "camera"
      },
      "saramonic-comset": {
        title: "Saramonic WiTalk-WT7S 7-Person Full-Duplex Wireless Intercom System",
        image: "/assets/items/Saramonic.png",
        images: [
          "/assets/items/Saramonic.png",
          "/assets/items/camera_item/saramonic2.jpg",
          "/assets/items/camera_item/saramonic3.jpg",
          "/assets/items/camera_item/saramonic4.jpg",
          "/assets/items/camera_item/saramonic5.jpg",  
        ],
        description: "The Saramonic WiTalk-WT7S is a comprehensive wireless intercom system designed for film production, live events, and broadcast applications. Operating in the 1.9 GHz DECT frequency band, this system provides crystal-clear full-duplex communication for up to 7 users simultaneously. With its reliable wireless connectivity and professional-grade headsets, it ensures seamless coordination among crew members during productions.",
        specifications: [
          "7-Person Full-Duplex",
          "1.9 GHz DECT Frequency",
          "Crystal-Clear Communication",
          "Wireless Connectivity",
          "Professional-Grade Headsets"
        ],
        category: "comset"
      },
      "lumantek-switcher": {
        title: "Lumantek ez-Pro VS10 3G-SDI/HDMI Video Switcher",
        image: "/assets/items/Lumantek.png",
        images: [
          "/assets/items/Lumantek.png",
          "/assets/items/camera_item/Lumantek2.jpg",  
        ],
        description: "The Lumantek ez-Pro VS10 is a versatile professional video switcher that supports both 3G-SDI and HDMI inputs. Featuring a 5-inch LED touchscreen for intuitive operation, this compact switcher offers seamless transitions, picture-in-picture capability, and built-in title generator. Ideal for live streaming, broadcast, and multi-camera production setups requiring reliable switching performance.",
        specifications: [
          "3G-SDI/HDMI Inputs",
          "5-inch LED Touchscreen",
          "Seamless Transitions",
          "Picture-in-Picture",
          "Built-in Title Generator"
        ],
        category: "switcher"
      },
      "sony-mcx-500": {
        title: "Sony MCX-500 Switcher",
        image: "/assets/items/sony-switcher.png",
        images: [
          "/assets/items/sony-switcher.png",
          "/assets/items/camera_item/sony-switcher2.jpg",
          "/assets/items/camera_item/sony-switcher3.jpg",  
        ],
        description: "The Sony MCX-500 is a compact live production switcher that brings professional multi-camera production capabilities to a wide range of applications. With 8-input support including HDMI and SDI connections, this switcher offers advanced features like picture-in-picture, chroma key, and built-in streaming capability. Perfect for live events, web streaming, and small studio productions seeking broadcast-quality switching.",
        specifications: [
          "8-Input Support",
          "HDMI and SDI Connections",
          "Picture-in-Picture",
          "Chroma Key",
          "Built-in Streaming"
        ],
        category: "switcher"
      },
      "blackmagic-atem": {
        title: "Blackmagic Design ATEM Mini Pro Switcher",
        image: "/assets/items/blackmagic-switcher.jpg",
        images: [
          "/assets/items/blackmagic-switcher.jpg",
        ],
        description: "The Blackmagic Design ATEM Mini Pro is a professional live production switcher that offers broadcast-quality switching in a compact form factor. Featuring 4 HDMI inputs, built-in streaming capability, and advanced production features like chroma key and DVE effects. Perfect for live streaming, podcast production, and multi-camera setups requiring professional switching capabilities.",
        specifications: [
          "4 HDMI Inputs",
          "Built-in Streaming",
          "Chroma Key",
          "DVE Effects",
          "Compact Design"
        ],
        category: "switcher"
      },
      "behringer-mixer": {
        title: "Behringer Xenyx QX602MP3 6-Channel Mixer",
        image: "/assets/items/Behringer.png",
        images: [
          "/assets/items/Behringer.png",
          "/assets/items/camera_item/Behringer2.jpg",
          "/assets/items/camera_item/Behringer3.jpg",  
        ],
        description: "The Behringer Xenyx QX602MP3 is a versatile 6-channel audio mixer designed for musicians, podcasters, and content creators. Featuring high-quality Xenyx mic preamps, built-in digital effects, and USB connectivity for computer recording, this compact mixer offers professional audio performance in an affordable package. The integrated MP3 player input makes it ideal for background music applications.",
        specifications: [
          "6-Channel Mixer",
          "Xenyx Mic Preamps",
          "Built-in Digital Effects",
          "USB Connectivity",
          "MP3 Player Input"
        ],
        category: "audio-mixer"
      },
      "xtuga-mixer": {
        title: "Xtuga E22 USB / XLR Audio Interface",
        image: "/assets/items/XTUGA-E22Mixer.jpg",
        images: [
          "/assets/items/XTUGA-E22Mixer.jpg",
          "/assets/items/camera_item/XTUGA-E22Mixer3.jpg",
          "/assets/items/camera_item/XTUGA-E22Mixer2.jpg",  
        ],
        description: "The Xtuga E22 is a professional USB/XLR audio interface that provides studio-quality recording capabilities for musicians and content creators. With its combination XLR/TRS inputs, phantom power support, and high-resolution audio conversion, this interface delivers clean, professional audio capture for vocals, instruments, and podcasting applications.",
        specifications: [
          "USB/XLR Audio Interface",
          "XLR/TRS Inputs",
          "Phantom Power Support",
          "High-Resolution Audio",
          "Studio Quality"
        ],
        category: "audio-mixer"
      },
      "atem-monitor": {
        title: "ATEM156-CO HDMI 15.6\" Video Monitor with Flightcase",
        image: "/assets/items/monitor.png",
        images: [
          "/assets/items/monitor.png",
          "/assets/items/camera_item/monitor1.jpg", 
        ],
        description: "The ATEM156-CO is a professional 15.6-inch HDMI video monitor designed for on-set monitoring and production applications. Housed in a durable flight case, this monitor features high-resolution display, multiple input options, and professional monitoring tools. Ideal for camera operators, directors, and production crew requiring accurate video monitoring in various shooting environments.",
        specifications: [
          "15.6-inch HDMI Monitor",
          "Durable Flight Case",
          "High-Resolution Display",
          "Multiple Input Options",
          "Professional Monitoring Tools"
        ],
        category: "monitor"
      },
      "lilliput-monitor": {
        title: "Lilliput BM150-4K Carry-On 4K Monitor (V-Mount)",
        image: "/assets/items/LillitputMonitor.png",
        images: [
          "/assets/items/LillitputMonitor.png",
          "/assets/items/camera_item/LillitputMonitor1.jpg",
          "/assets/items/camera_item/LillitputMonitor2.jpg",  
        ],
        description: "The Lilliput BM150-4K is a portable 15-inch 4K monitor designed for professional video production. Featuring V-Mount battery compatibility and ultra-high definition display, this monitor offers excellent color accuracy and brightness for on-location monitoring. Its compact carry-on design makes it perfect for field production where space and power efficiency are crucial.",
        specifications: [
          "15-inch 4K Monitor",
          "V-Mount Battery Compatible",
          "Ultra HD Display",
          "Excellent Color Accuracy",
          "Carry-On Design"
        ],
        category: "monitor"
      },
      "tvlogic-monitor": {
        title: "TV Logic Multi Format Monitor",
        image: "/assets/items/tvLogicMonitor.png",
        images: [
          "/assets/items/tvLogicMonitor.png",
          "/assets/items/camera_item/tvLogicMonitor1.jpg", 
        ],
        description: "The TV Logic multi-format monitor is a professional-grade display solution for broadcast and production environments. Supporting multiple video formats and featuring advanced calibration options, this monitor provides accurate color reproduction and detailed image analysis tools. Essential for color-critical applications and quality control in professional video production.",
        specifications: [
          "Multi Format Monitor",
          "Multiple Video Formats",
          "Advanced Calibration",
          "Accurate Color Reproduction",
          "Image Analysis Tools"
        ],
        category: "monitor"
      },
      "accsoon-transmitter": {
        title: "Accsoon CineView Master 4K",
        image: "/assets/items/Accsoon.png",
        images: [
          "/assets/items/Accsoon.png",
          "/assets/items/camera_item/Accsoon1.jpg",
          "/assets/items/camera_item/Accsoon2.jpg",  
        ],
        description: "The Accsoon CineView Master 4K is a wireless video transmission system that enables real-time 4K video monitoring for film production and live events. With low latency transmission and reliable wireless performance, this system allows directors and crew members to monitor camera feeds wirelessly from various locations on set.",
        specifications: [
          "Wireless 4K Transmission",
          "Real-Time Monitoring",
          "Low Latency",
          "Reliable Wireless",
          "Film Production Ready"
        ],
        category: "video-transmitter"
      },
      "hollyland-transmitter": {
        title: "Hollyland Mars 4K Wireless Video Transmitter",
        image: "/assets/items/Hollyland.png",
        images: [
          "/assets/items/Hollyland.png",
          "/assets/items/camera_item/Hollyland.jpg",
          "/assets/items/camera_item/Hollyland2.jpg",  
        ],
        description: "The Hollyland Mars 4K is a professional wireless video transmission system designed for high-quality 4K video monitoring. Featuring long-range transmission capability, low latency, and stable connectivity, this system is ideal for film production, live events, and broadcasting applications where reliable wireless video transmission is essential.",
        specifications: [
          "4K Wireless Video Transmitter",
          "Long-Range Transmission",
          "Low Latency",
          "Stable Connectivity",
          "Professional Grade"
        ],
        category: "video-transmitter"
      },
      "dolly-platform": {
        title: "Dolly Platform with Tracks",
        image: "/assets/items/DollyPlatformTracks.jpg",
        images: [
          "/assets/items/DollyPlatformTracks.jpg",
        ],
        description: "Professional camera dolly system with precision tracks for smooth camera movement in film and video production. This robust dolly platform provides stable tracking shots with fluid motion control, essential for creating cinematic sequences and professional camera work in various production scenarios.",
        specifications: [
          "Camera Dolly System",
          "Precision Tracks",
          "Smooth Camera Movement",
          "Robust Platform",
          "Fluid Motion Control"
        ],
        category: "camera-dolly"
      },
      "wheels-slider": {
        title: "Wheels Slider Tripod",
        image: "/assets/items/heavyDutyDolly.png",
        images: [
          "/assets/items/heavyDutyDolly.png",
        ],
        description: "Versatile wheeled tripod dolly system that combines the stability of a tripod with the mobility of a dolly. Featuring smooth-rolling wheels and adjustable positioning, this system enables dynamic camera movements while maintaining stable support for your camera equipment during productions.",
        specifications: [
          "Wheeled Tripod Dolly",
          "Smooth-Rolling Wheels",
          "Adjustable Positioning",
          "Dynamic Camera Movements",
          "Stable Support"
        ],
        category: "camera-dolly"
      }
    };

    // Merge with inventory products
    const mergedProductInfo = { ...predefinedProductInfo };
    
    Object.keys(inventoryProducts).forEach(key => {
      if (!predefinedProductInfo[key]) {
        mergedProductInfo[key] = inventoryProducts[key];
      }
    });

    // Add packages to product info
    packages.forEach(pkg => {
      mergedProductInfo[pkg.id] = {
        title: pkg.title || pkg.name,
        description: pkg.description,
        items: pkg.items.map(item => ({
          id: item.id,
          name: item.name,
          image: predefinedProductInfo[item.id]?.image || '/assets/items/default.png'
        })),
        displayItems: pkg.displayItems,
        isPackage: true,
        packageData: pkg
      };
    });

    return mergedProductInfo;
  }, [inventoryProducts]);

  // ==============================================
  // FIX 3: Updated product images useEffect
  // ==============================================
  useEffect(() => {
    if (!activeProduct && !activePackage) return;
    
    const productInfo = getProductInfo();
    const currentProduct = activeProduct ? productInfo[activeProduct] : 
                         activePackage ? productInfo[activePackage] : null;
    
    if (currentProduct) {
      if (currentProduct.items) {
        // For packages
        const images = currentProduct.items.map(item => ({
          src: productInfo[item.id]?.image || item.image || '/assets/items/default.png',
          alt: productInfo[item.id]?.title || item.name
        }));
        setProductImages(images);
      } else if (currentProduct.images && currentProduct.images.length > 0) {
        // Single products with multiple images
        const images = currentProduct.images.map(img => ({
          src: img,
          alt: currentProduct.title
        }));
        setProductImages(images);
      } else if (currentProduct.image) {
        // Single product with single image
        setProductImages([{
          src: currentProduct.image,
          alt: currentProduct.title
        }]);
      } else {
        setProductImages([{
          src: '/assets/items/default.png',
          alt: currentProduct.title
        }]);
      }
    }
  }, [activeProduct, activePackage, getProductInfo]);

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

  // ==============================================
  // FIX 4: Get combined product data (predefined + AppContext)
  // ==============================================
  const currentProduct = React.useMemo(() => {
    const productInfo = getProductInfo();
    const baseProduct = activeProduct ? productInfo[activeProduct] : 
                       activePackage ? productInfo[activePackage] : null;
    
    if (!baseProduct) return null;
    
    // For packages
    if (baseProduct.isPackage) {
      const pkg = packages.find(p => p.id === activePackage);
      if (pkg) {
        const availability = getPackageAvailability(pkg);
        return {
          ...baseProduct,
          price: `₱${pkg.price.toLocaleString()}/day`,
          isPackage: true,
          isAvailable: availability.isAvailable,
          unavailableItems: availability.unavailableItems,
          packageData: pkg
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
      // Fallback to AppContext initial rental items if no real-time data
      const allItems = getAllRentalItems ? getAllRentalItems() : [];
      const appContextItem = allItems.find(item => item.id === activeProduct);
      
      if (appContextItem) {
        combinedProduct.price = appContextItem.price ? `₱${appContextItem.price.toLocaleString()}/day` : 'Price on request';
        const stock = getAvailableForRent ? getAvailableForRent(appContextItem) : 0;
        combinedProduct.stock = stock;
        combinedProduct.available = appContextItem.availableQuantity || 0;
        combinedProduct.reserved = appContextItem.reservedQuantity || 0;
      } else {
        // Final fallback to predefined prices
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
        
        // Fallback stock for predefined items
        const predefinedStock = {
          "sachtler-tripod": 2,
          "cartoni-tripod": 4,
          "eimage-tripod": 3,
          "pmw-200": 3,
          "sony-pmw-350k": 2,
          "panasonic-hpx3100": 3,
          "saramonic-comset": 2,
          "lumantek-switcher": 2,
          "sony-mcx-500": 2,
          "blackmagic-atem": 2,
          "behringer-mixer": 2,
          "xtuga-mixer": 2,
          "atem-monitor": 2,
          "lilliput-monitor": 2,
          "tvlogic-monitor": 2,
          "accsoon-transmitter": 3,
          "hollyland-transmitter": 3,
          "dolly-platform": 1,
          "wheels-slider": 3
        };
        
        combinedProduct.stock = predefinedStock[activeProduct] || 0;
      }
    }
    
    return combinedProduct;
  }, [activeProduct, activePackage, getProductInfo, getCurrentProductData, getAllRentalItems, getAvailableForRent]);

  const getBackPath = () => {
    if (activePackage) return '/packages';
    if (window.location.search.includes('package')) return '/packages';
    return '/rent-items';
  };

  // ==============================================
  // FIX 5: Updated Add to Cart function - SIMPLER & MORE RELIABLE
  // ==============================================
  const handleAddToCart = () => {
    if (!currentProduct) return;
    
    if (!user) {
      alert("Please log in to add items to your cart.");
      navigate('/login-register');
      return;
    }
    
    // If it's a package, redirect to packages page
    if (currentProduct.isPackage) {
      alert("To select this package, please go to the Packages page.");
      navigate('/packages');
      return;
    }
    
    // Individual item logic
    const availableStock = currentProduct.stock || 0;
    if (availableStock <= 0) {
      alert("This item is currently out of stock.");
      return;
    }
    
    const userCartKey = `rentalCart_${user.uid}`;
    
    // ALWAYS get fresh cart from localStorage
    const savedCart = localStorage.getItem(userCartKey);
    let cart = savedCart ? JSON.parse(savedCart) : {};
    
    // Clean cart of any invalid entries (safety check)
    const cleanedCart = {};
    Object.keys(cart).forEach(key => {
      if (cart[key] && cart[key].itemId && cart[key].quantity > 0) {
        cleanedCart[key] = cart[key];
      }
    });
    
    cart = cleanedCart;
    
    const itemName = currentProduct.title;
    const itemId = activeProduct || activePackage;
    
    // Get price from AppContext
    let itemPrice = 0;
    const realTimeProduct = getCurrentProductData();
    if (realTimeProduct && realTimeProduct.price) {
      itemPrice = realTimeProduct.price;
    } else {
      // Fallback prices (matching AppContext)
      const predefinedPrices = {
        "sachtler-tripod": 3500,
        "cartoni-tripod": 3500,
        "eimage-tripod": 2500,
        "pmw-200": 5000,
        "sony-pmw-350k": 7000,
        "panasonic-hpx3100": 8000,
        "saramonic-comset": 3000,
        "lumantek-switcher": 4000,
        "sony-mcx-500": 4500,
        "blackmagic-atem": 4500,
        "behringer-mixer": 1500,
        "xtuga-mixer": 1200,
        "atem-monitor": 2000,
        "lilliput-monitor": 1800,
        "tvlogic-monitor": 2200,
        "accsoon-transmitter": 2500,
        "hollyland-transmitter": 3000,
        "dolly-platform": 5000,
        "wheels-slider": 3500
      };
      itemPrice = predefinedPrices[itemId] || 0;
    }
    
    // Check if item already exists in cart by ID
    let existingCartKey = null;
    Object.keys(cart).forEach(key => {
      if (cart[key].itemId === itemId) {
        existingCartKey = key;
      }
    });
    
    // If item exists but with different display name, update the name
    if (existingCartKey && existingCartKey !== itemName) {
      cart[itemName] = { ...cart[existingCartKey] };
      delete cart[existingCartKey];
      existingCartKey = itemName;
    }
    
    // Calculate current quantity
    const currentInCart = existingCartKey ? cart[existingCartKey].quantity : 0;
    
    // Check if adding would exceed available stock
    if (currentInCart >= availableStock) {
      alert(`Only ${availableStock} units available for "${itemName}". You already have ${currentInCart} in your cart.`);
      return;
    }
    
    // Update cart quantity
    if (existingCartKey) {
      cart[existingCartKey].quantity += 1;
      cart[existingCartKey].price = itemPrice; // Ensure price is correct
    } else {
      cart[itemName] = {
        quantity: 1,
        price: itemPrice,
        itemId
      };
    }
    
    // Save updated cart to localStorage
    localStorage.setItem(userCartKey, JSON.stringify(cart));
    
    // Show success message
    const newQuantity = existingCartKey ? cart[existingCartKey].quantity : 1;
    alert(`${itemName} added to cart! (Total: ${newQuantity})`);
    
    // Trigger cart update event for RentItems.js
    window.dispatchEvent(new CustomEvent('cartUpdated', {
      detail: { itemId, quantity: newQuantity }
    }));
  };

  // Get productInfo for use in JSX
  const productInfo = React.useMemo(() => getProductInfo(), [getProductInfo]);

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

                {/* Package Includes (for packages) */}
                {currentProduct.displayItems && (
                  <div className="specifications-section">
                    <h3>Package Includes</h3>
                    <ul className="specifications-list">
                      {currentProduct.displayItems.map((item, index) => (
                        <li key={index}>{item}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Specifications (for individual items) */}
                {currentProduct.specifications && (
                  <div className="specifications-section">
                    <h3>Specifications</h3>
                    <ul className="specifications-list">
                      {currentProduct.specifications.map((spec, index) => (
                        <li key={index}>{spec}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Package Items (if package) */}
                {currentProduct.items && (
                  <div className="package-items-section">
                    <h3>Equipment Included</h3>
                    <div className="package-items-grid">
                      {currentProduct.items.map((item, index) => {
                        const fullProduct = productInfo[item.id];
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
                      className="proceed-schedule-btn" // CHANGED: Same style as select package
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

            {/* Package Selection Confirmation - REMOVED since no selection in ℹ view */}
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