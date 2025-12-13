// information.js - UPDATED WITH INVENTORY INTEGRATION
import React, { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const Information = () => {
  const [activeProduct, setActiveProduct] = useState('');
  const [activePackage, setActivePackage] = useState('');
  const [inventoryProducts, setInventoryProducts] = useState({});
  const location = useLocation();
  const navigate = useNavigate();
  const [sidebarVisible, setSidebarVisible] = useState(false);
  const { user, isAdmin } = useAuth();

  const showSidebar = () => {
    setSidebarVisible(true);
  };

  const hideSidebar = () => {
    setSidebarVisible(false);
  };

  // Load inventory products from localStorage
  useEffect(() => {
    const savedProductInfo = localStorage.getItem('productInfo');
    if (savedProductInfo) {
      setInventoryProducts(JSON.parse(savedProductInfo));
    }
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const itemId = params.get("item");
    const packageId = params.get("package");

    if (itemId) {
      setActiveProduct(itemId);
      setActivePackage('');
      const section = document.getElementById(itemId);
      if (section) {
        section.style.display = "block";
        section.scrollIntoView({ behavior: "smooth" });
      }
    } else if (packageId) {
      setActivePackage(packageId);
      setActiveProduct('');
      const section = document.getElementById(packageId);
      if (section) {
        section.style.display = "block";
        section.scrollIntoView({ behavior: "smooth" });
      }
    }
  }, [location, inventoryProducts]);

  // Function to handle clicking on product images within packages
  const handleProductClick = (productId) => {
    navigate(`/information?item=${productId}`);
  };

  // Combine predefined products with inventory products - FIXED TO PRESERVE PREDEFINED DESCRIPTIONS
  const getProductInfo = () => {
    // NEVER OVERWRITE THESE RICH DESCRIPTIONS
    const predefinedProductInfo = {
      // Individual Products
      "sachtler-tripod": {
        title: "Sachtler Video 20 S1 100mm Ball Head Tripod System",
        image: "/assets/items/Sachtler.png",
        description: "Unlock flawless performance and professional stability with the Sachtler Video 20 S1 100mm Ball Head Tripod System. Engineered for filmmakers, videographers, and content creators, this high-end tripod system delivers smooth, precise camera control with a robust 100mm ball head. The Video 20 S1 features a durable, lightweight design, offering excellent load capacity and versatility for even the most demanding shoots. this system ensures steady support and fluid movement, enhancing your creative workflow."
      },
      "cartoni-tripod": {
        title: "Cartoni Laser Z100 Fluid Head Tripod Aluminum 2",
        image: "/assets/items/Cartoni.png",
        description: "Get precision and stability with the Cartoni Laser Z100 Fluid Head Tripod—the perfect solution for your next shoot. Designed for professional filmmakers and videographers, this aluminum tripod system features the Z100 fluid head, offering exceptional fluidity and control for smooth panning and tilting. With an impressive load capacity and durable construction, the Z100 is ideal for supporting a variety of camera setups, from lightweight rigs to heavier professional cameras. Whether you're working on-location or in the studio, this tripod ensures steady and reliable performance."
      },
      "eimage-tripod": {
        title: "E-Image 2-Stage Aluminum Tripod with GH15 Head",
        image: "/assets/items/E-imageTripod.jpg",
        description: "Experience professional stability and versatility with the E-Image 2-Stage Aluminum Tripod featuring the GH15 Fluid Head. Designed for videographers and filmmakers, this robust tripod system offers smooth panning and tilting capabilities with its advanced fluid head technology. The two-stage aluminum legs provide quick height adjustments and excellent stability on various surfaces. Perfect for both studio and location shoots, this tripod ensures reliable performance for your camera equipment."
      },
      "pmw-200": {
        title: "Sony PMW-200 Camera",
        image: "/assets/items/PMW.png",
        description: "The Sony PMW-200 is a professional handheld flash memory camcorder that delivers exceptional image quality and versatility. Featuring three 1/3-type Exmor CMOS sensors and 10-bit 4:2:2 HD recording, this camera produces broadcast-quality footage with excellent low-light performance. With its compact design and comprehensive professional features, the PMW-200 is ideal for news gathering, documentary production, and event coverage."
      },
      "sony-pmw-350k": {
        title: "Sony PMW-350K Camera",
        image: "/assets/items/sony.png",
        description: "The Sony PMW-350K is a high-performance XDCAM EX camcorder designed for professional broadcast and production applications. Equipped with three 2/3-inch type Exmor CMOS sensors and 10-bit 4:2:2 HD recording capability, it delivers superior image quality with excellent color reproduction and dynamic range. This camera system offers exceptional flexibility for various shooting scenarios from studio production to field acquisition."
      },
      "panasonic-hpx3100": {
        title: "Panasonic AJ HPX3100 Camera",
        image: "/assets/items/Panasonic.png",
        description: "The Panasonic AJ-HPX3100 is a professional P2 HD camcorder that offers outstanding performance for broadcast and production applications. Featuring three 2/3-inch CCD sensors and AVC-Intra 100/50 recording, this camera delivers exceptional image quality with rich color reproduction and detail. With its robust construction and comprehensive connectivity options, the HPX3100 is perfect for demanding professional environments."
      },
      "saramonic-comset": {
        title: "Saramonic WiTalk-WT7S 7-Person Full-Duplex Wireless Intercom System",
        image: "/assets/items/Saramonic.png",
        description: "The Saramonic WiTalk-WT7S is a comprehensive wireless intercom system designed for film production, live events, and broadcast applications. Operating in the 1.9 GHz DECT frequency band, this system provides crystal-clear full-duplex communication for up to 7 users simultaneously. With its reliable wireless connectivity and professional-grade headsets, it ensures seamless coordination among crew members during productions."
      },
      "lumantek-switcher": {
        title: "Lumantek ez-Pro VS10 3G-SDI/HDMI Video Switcher",
        image: "/assets/items/Lumantek.png",
        description: "The Lumantek ez-Pro VS10 is a versatile professional video switcher that supports both 3G-SDI and HDMI inputs. Featuring a 5-inch LED touchscreen for intuitive operation, this compact switcher offers seamless transitions, picture-in-picture capability, and built-in title generator. Ideal for live streaming, broadcast, and multi-camera production setups requiring reliable switching performance."
      },
      "sony-mcx-500": {
        title: "Sony MCX-500 Switcher",
        image: "/assets/items/sony-switcher.png",
        description: "The Sony MCX-500 is a compact live production switcher that brings professional multi-camera production capabilities to a wide range of applications. With 8-input support including HDMI and SDI connections, this switcher offers advanced features like picture-in-picture, chroma key, and built-in streaming capability. Perfect for live events, web streaming, and small studio productions seeking broadcast-quality switching."
      },
      "blackmagic-atem": {
        title: "Blackmagic Design ATEM Mini Pro Switcher",
        image: "/assets/items/blackmagic-switcher.jpg",
        description: "The Blackmagic Design ATEM Mini Pro is a professional live production switcher that offers broadcast-quality switching in a compact form factor. Featuring 4 HDMI inputs, built-in streaming capability, and advanced production features like chroma key and DVE effects. Perfect for live streaming, podcast production, and multi-camera setups requiring professional switching capabilities."
      },
      "behringer-mixer": {
        title: "Behringer Xenyx QX602MP3 6-Channel Mixer",
        image: "/assets/items/Behringer.png",
        description: "The Behringer Xenyx QX602MP3 is a versatile 6-channel audio mixer designed for musicians, podcasters, and content creators. Featuring high-quality Xenyx mic preamps, built-in digital effects, and USB connectivity for computer recording, this compact mixer offers professional audio performance in an affordable package. The integrated MP3 player input makes it ideal for background music applications."
      },
      "xtuga-mixer": {
        title: "Xtuga E22 USB / XLR Audio Interface",
        image: "/assets/items/XTUGA-E22Mixer.jpg",
        description: "The Xtuga E22 is a professional USB/XLR audio interface that provides studio-quality recording capabilities for musicians and content creators. With its combination XLR/TRS inputs, phantom power support, and high-resolution audio conversion, this interface delivers clean, professional audio capture for vocals, instruments, and podcasting applications."
      },
      "atem-monitor": {
        title: "ATEM156-CO HDMI 15.6\" Video Monitor with Flightcase",
        image: "/assets/items/monitor.png",
        description: "The ATEM156-CO is a professional 15.6-inch HDMI video monitor designed for on-set monitoring and production applications. Housed in a durable flight case, this monitor features high-resolution display, multiple input options, and professional monitoring tools. Ideal for camera operators, directors, and production crew requiring accurate video monitoring in various shooting environments."
      },
      "lilliput-monitor": {
        title: "Lilliput BM150-4K Carry-On 4K Monitor (V-Mount)",
        image: "/assets/items/LillitputMonitor.png",
        description: "The Lilliput BM150-4K is a portable 15-inch 4K monitor designed for professional video production. Featuring V-Mount battery compatibility and ultra-high definition display, this monitor offers excellent color accuracy and brightness for on-location monitoring. Its compact carry-on design makes it perfect for field production where space and power efficiency are crucial."
      },
      "tvlogic-monitor": {
        title: "TV Logic Multi Format Monitor",
        image: "/assets/items/tvLogicMonitor.png",
        description: "The TV Logic multi-format monitor is a professional-grade display solution for broadcast and production environments. Supporting multiple video formats and featuring advanced calibration options, this monitor provides accurate color reproduction and detailed image analysis tools. Essential for color-critical applications and quality control in professional video production."
      },
      "accsoon-transmitter": {
        title: "Accsoon CineView Master 4K",
        image: "/assets/items/Accsoon.png",
        description: "The Accsoon CineView Master 4K is a wireless video transmission system that enables real-time 4K video monitoring for film production and live events. With low latency transmission and reliable wireless performance, this system allows directors and crew members to monitor camera feeds wirelessly from various locations on set."
      },
      "hollyland-transmitter": {
        title: "Hollyland Mars 4K Wireless Video Transmitter",
        image: "/assets/items/Hollyland.png",
        description: "The Hollyland Mars 4K is a professional wireless video transmission system designed for high-quality 4K video monitoring. Featuring long-range transmission capability, low latency, and stable connectivity, this system is ideal for film production, live events, and broadcasting applications where reliable wireless video transmission is essential."
      },
      "dolly-platform": {
        title: "Dolly Platform with Tracks",
        image: "/assets/items/DollyPlatformTracks.jpg",
        description: "Professional camera dolly system with precision tracks for smooth camera movement in film and video production. This robust dolly platform provides stable tracking shots with fluid motion control, essential for creating cinematic sequences and professional camera work in various production scenarios."
      },
      "wheels-slider": {
        title: "Wheels Slider Tripod",
        image: "/assets/items/heavyDutyDolly.png",
        description: "Versatile wheeled tripod dolly system that combines the stability of a tripod with the mobility of a dolly. Featuring smooth-rolling wheels and adjustable positioning, this system enables dynamic camera movements while maintaining stable support for your camera equipment during productions."
      },

      // Packages
      "basic-video-package": {
        title: "Basic Video Package",
        description: "Perfect for small events and interviews. This package includes essential equipment for professional video production with reliable performance and ease of use.",
        items: [
          { id: "pmw-200", name: "Sony PMW-200 Camera", image: "/assets/items/pmw.png" },
          { id: "sachtler-tripod", name: "Sachtler Video 20 S1 Tripod", image: "/assets/items/Sachtler.png" },
          { id: "saramonic-comset", name: "Saramonic Wireless Intercom", image: "/assets/items/Saramonic.png" }
        ]
      },
      "professional-video-package": {
        title: "Professional Video Package",
        description: "Ideal for weddings and corporate events. Comprehensive setup for professional multi-camera productions with advanced switching capabilities.",
        items: [
          { id: "sony-pmw-350k", name: "Sony PMW-350K Camera", image: "/assets/items/sony.png" },
          { id: "cartoni-tripod", name: "Cartoni Laser Z100 Tripod", image: "/assets/items/Cartoni.png" },
          { id: "lumantek-switcher", name: "Lumantek Video Switcher", image: "/assets/items/Lumantek.png" },
          { id: "saramonic-comset", name: "Saramonic Wireless Intercom", image: "/assets/items/Saramonic.png" }
        ]
      },
      "multicam-production-package": {
        title: "Multicam Production Package",
        description: "Complete setup for live productions and broadcasts. Premium equipment for large-scale multi-camera productions with professional monitoring and transmission.",
        items: [
          { id: "pmw-200", name: "Sony PMW-200 Camera", image: "/assets/items/pmw.png" },
          { id: "panasonic-hpx3100", name: "Panasonic HPX3100 Camera", image: "/assets/items/Panasonic.png" },
          { id: "sony-mcx-500", name: "Sony MCX-500 Switcher", image: "/assets/items/sony-switcher.png" },
          { id: "saramonic-comset", name: "Saramonic Wireless Intercom", image: "/assets/items/Saramonic.png" },
          { id: "atem-monitor", name: "ATEM156 Monitor", image: "/assets/items/monitor.png" }
        ]
      }
    };

    // Merge with inventory products - FIXED: Predefined items ALWAYS take priority
    const mergedProductInfo = { ...predefinedProductInfo };

    // Only add inventory products if they don't overwrite predefined ones
    Object.keys(inventoryProducts).forEach(key => {
      // Only add inventory product if it's NOT already in predefinedProductInfo
      if (!predefinedProductInfo[key]) {
        mergedProductInfo[key] = inventoryProducts[key];
      }
      // If it IS in predefinedProductInfo, we preserve the predefined data (rich descriptions)
    });

    return mergedProductInfo;
  };

  const productInfo = getProductInfo();

  const getBackPath = () => {
    if (activePackage) return '/packages';
    if (window.location.search.includes('package')) return '/packages';
    return '/rent-items';
  };

  return (
    <>
      {/* Navbar and sidebar */}
      <nav>
        <ul className={`sidebar ${sidebarVisible ? 'active' : ''}`}>
          <li onClick={hideSidebar}><a href="#"><svg xmlns="http://www.w3.org/2000/svg" height="24px" viewBox="0 -960 960 960" width="24px" fill="#1f1f1f"><path d="m256-200-56-56 224-224-224-224 56-56 224 224 224-224 56 56-224 224 224 224-56 56-224-224-224 224Z" /></svg></a></li>
          <li><Link to="/home" onClick={hideSidebar}>Home</Link></li>
          <li><Link to="/rent-items" onClick={hideSidebar}>Rent</Link></li>
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
          <li className="hideOnMobile"><Link to="/rent-items">Rent</Link></li>
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

      {/* Information Content */}
      <h1 className="rent-header">Product Information</h1>

      <section className="confirmation-container">
        {Object.entries(productInfo).map(([key, product]) => (
          <div
            key={key}
            id={key}
            className="product-info"
            style={{ display: (activeProduct === key || activePackage === key) ? 'block' : 'none' }}
          >
            <h2>{product.title}</h2>

            {/* Check if it's a package (has items array) or single product */}
            {product.items ? (
              // Render package with all items - MAKE IMAGES CLICKABLE
              <div className="package-items">
                <p className="package-description">{product.description}</p>
                <h3>Package Includes:</h3>
                <div className="items-grid">
                  {product.items.map((item, index) => {
                    // Get the full product details from productInfo using the item id
                    const fullProduct = productInfo[item.id];
                    return (
                      <div key={index} className="package-item">
                        <div
                          className="clickable-image"
                          onClick={() => handleProductClick(item.id)}
                          style={{ cursor: 'pointer' }}
                        >
                          <img
                            src={fullProduct ? fullProduct.image : item.image}
                            alt={fullProduct ? fullProduct.title : item.name}
                            onError={(e) => {
                              e.target.src = '/assets/items/default.png';
                              e.target.alt = `${item.name} - Image not available`;
                            }}
                          />
                          <div className="image-overlay">
                            <span>Click for details</span>
                          </div>
                        </div>
                        <h4>{fullProduct ? fullProduct.title : item.name}</h4>
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : (
              // Render single product (KEEP descriptions for single products)
              <>
                <img
                  src={product.image}
                  alt={product.title}
                  style={{ marginBottom: '20px', maxWidth: '100%', height: 'auto' }}
                  onError={(e) => {
                    e.target.src = '/assets/items/default.png';
                    e.target.alt = `${product.title} - Image not available`;
                  }}
                />
                <p style={{ marginTop: '20px', lineHeight: '1.6' }}>{product.description}</p>
              </>
            )}

            <button
              onClick={() => navigate(getBackPath())}
              className="back-btn"
            >
              ← Back to {activePackage ? 'Packages' : 'Rent Items'}
            </button>
          </div>
        ))}
      </section>

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
