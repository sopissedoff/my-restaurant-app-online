import React, { useState, useEffect } from 'react';
import { ShoppingCart, Star, Home, X, Plus, Minus, ChevronRight, UtensilsCrossed, Gift, BadgeDollarSign, Sparkles, User } from 'lucide-react'; // Added User icon
import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, signInWithCustomToken, onAuthStateChanged } from 'firebase/auth';
import { getFirestore, collection, query, onSnapshot, doc, getDoc, addDoc, serverTimestamp } from 'firebase/firestore';

// Utility for formatting currency
const formatCurrency = (amount) => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(amount);
};

// --- Mock Data (will be replaced by Firestore) ---
// Kept for initial structure, but actual data will come from Firestore
const menuCategories = [
  { id: 'tacos', name: 'Tacos' },
  { id: 'burritos', name: 'Burritos' },
  { id: 'quesadillas', name: 'Quesadillas' },
  { id: 'sides', name: 'Sides' },
  { id: 'drinks', name: 'Drinks' },
];

// --- Components ---

const Header = ({ currentPage, onNavigate, cartItemCount, userId }) => {
  return (
    <header className="fixed top-0 left-0 right-0 bg-gradient-to-r from-red-700 to-orange-500 shadow-xl z-20 p-4 border-b border-orange-600">
      <div className="container mx-auto flex justify-between items-center px-4">
        <h1 className="text-3xl font-extrabold text-white tracking-wider drop-shadow-md">
          El Sabor Mexicano
        </h1>
        <nav className="flex items-center space-x-4 md:space-x-6">
          <button
            onClick={() => onNavigate('menu')}
            className={`flex items-center space-x-2 p-2 rounded-full transition-all duration-300 transform hover:scale-105 ${
              currentPage === 'menu' ? 'bg-white text-red-700 shadow-lg' : 'text-white hover:text-red-100 hover:bg-white/20'
            }`}
          >
            <UtensilsCrossed size={20} />
            <span className="font-semibold text-sm md:text-base">Menu</span>
          </button>
          <button
            onClick={() => onNavigate('rewards')}
            className={`flex items-center space-x-2 p-2 rounded-full transition-all duration-300 transform hover:scale-105 ${
              currentPage === 'rewards' ? 'bg-white text-red-700 shadow-lg' : 'text-white hover:text-red-100 hover:bg-white/20'
            }`}
          >
            <Star size={20} />
            <span className="font-semibold text-sm md:text-base">Rewards</span>
          </button>
          <button
            onClick={() => onNavigate('cart')}
            className={`relative flex items-center space-x-2 p-2 rounded-full transition-all duration-300 transform hover:scale-105 ${
              currentPage === 'cart' ? 'bg-white text-red-700 shadow-lg' : 'text-white hover:text-red-100 hover:bg-white/20'
            }`}
          >
            <ShoppingCart size={20} />
            <span className="font-semibold text-sm md:text-base">Cart</span>
            {cartItemCount > 0 && (
              <span className="absolute -top-1 -right-1 bg-yellow-400 text-red-800 text-xs font-bold rounded-full h-5 w-5 flex items-center justify-center animate-ping-once-then-pulse">
                {cartItemCount}
              </span>
            )}
          </button>
          {userId && (
            <div className="flex items-center space-x-1 p-2 rounded-full bg-white/10 text-white text-xs md:text-sm max-w-[80px] md:max-w-[120px] overflow-hidden whitespace-nowrap overflow-ellipsis">
              <User size={16} />
              <span title={userId}>ID: {userId.substring(0, 6)}...</span> {/* Displaying truncated ID */}
            </div>
          )}
        </nav>
      </div>
    </header>
  );
};

const MenuItemCard = ({ item, onAddToCart, onShowDetails }) => {
  return (
    <div
      className="bg-white rounded-xl shadow-xl hover:shadow-2xl transition-all duration-300 overflow-hidden cursor-pointer flex flex-col h-full transform hover:-translate-y-1"
      onClick={() => onShowDetails(item)}
    >
      <div className="w-full h-48 md:h-56 bg-gray-100 flex items-center justify-center overflow-hidden rounded-t-xl">
        <img
          src={item.image}
          alt={item.name}
          className="w-full h-full object-cover transform hover:scale-110 transition-transform duration-500"
          onError={(e) => {
            e.target.onerror = null;
            e.target.src = `https://placehold.co/400x300/F5EFE6/333333?text=${encodeURIComponent(item.name)}`;
          }}
        />
      </div>
      <div className="p-4 flex-grow flex flex-col justify-between">
        <div>
          <h3 className="text-xl font-bold text-gray-800 mb-2">{item.name}</h3>
          <p className="text-sm text-gray-600 mb-3 line-clamp-2">{item.description}</p>
        </div>
        <div className="flex justify-between items-center mt-auto pt-3 border-t border-gray-100">
          <span className="text-lg font-extrabold text-red-600">{formatCurrency(item.price)}</span>
          <button
            onClick={(e) => {
              e.stopPropagation(); // Prevent opening details when clicking add to cart
              onAddToCart(item);
            }}
            className="flex items-center space-x-1 bg-gradient-to-r from-red-600 to-orange-500 text-white px-5 py-2 rounded-full hover:from-red-700 hover:to-orange-600 transition-all duration-300 shadow-md hover:shadow-lg focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-opacity-75 transform hover:scale-105"
          >
            <Plus size={18} />
            <span className="font-semibold text-sm">Add</span>
          </button>
        </div>
      </div>
    </div>
  );
};

const ItemDetailModal = ({ item, onClose, onAddToCart }) => {
  const [quantity, setQuantity] = useState(1);
  const [selectedOptions, setSelectedOptions] = useState(() => {
    const initialOptions = {};
    item.options?.forEach(option => {
      initialOptions[option.type] = Array.isArray(option.default) ? [...option.default] : option.default;
    });
    return initialOptions;
  });

  const handleOptionChange = (type, value) => {
    setSelectedOptions(prev => {
      const currentChoice = prev[type];
      if (Array.isArray(currentChoice)) {
        // Toggle for multi-select (checkbox-like behavior)
        if (currentChoice.includes(value)) {
          return { ...prev, [type]: currentChoice.filter(choice => choice !== value) };
        } else {
          return { ...prev, [type]: [...currentChoice, value] };
        }
      } else {
        // Single select (radio-like behavior)
        return { ...prev, [type]: value };
      }
    });
  };

  const handleAddToCart = () => {
    onAddToCart({ ...item, quantity, options: selectedOptions });
    onClose();
  };

  if (!item) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center p-4 z-50 animate-fade-in">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md max-h-[90vh] overflow-y-auto flex flex-col transform animate-scale-in">
        <div className="relative p-6 pb-2">
          <button
            onClick={onClose}
            className="absolute top-4 right-4 bg-gray-100 p-2 rounded-full text-gray-600 hover:bg-gray-200 transition-colors duration-200 z-10 hover:rotate-90 transform"
          >
            <X size={20} />
          </button>
          <img
            src={item.image}
            alt={item.name}
            className="w-full h-48 object-cover rounded-lg mb-4 shadow-md"
            onError={(e) => {
              e.target.onerror = null;
              e.target.src = `https://placehold.co/400x300/F5EFE6/333333?text=${encodeURIComponent(item.name)}`;
            }}
          />
          <h2 className="text-3xl font-extrabold text-gray-800 mb-2">{item.name}</h2>
          <p className="text-gray-600 mb-4 text-base">{item.description}</p>

          {item.options && item.options.length > 0 && (
            <div className="mb-4 space-y-4 border-t pt-4 border-gray-100">
              <h3 className="text-xl font-bold text-gray-800">Customize Your Order</h3>
              {item.options.map((option) => (
                <div key={option.type}>
                  <label className="block text-gray-700 text-sm font-semibold mb-2">{option.name}:</label>
                  {Array.isArray(option.choices) ? (
                    <div className="flex flex-wrap gap-2">
                      {option.choices.map((choice) => (
                        <button
                          key={choice}
                          onClick={() => handleOptionChange(option.type, choice)}
                          className={`px-4 py-2 rounded-full text-sm font-medium transition-all duration-200 shadow-sm ${
                            (Array.isArray(selectedOptions[option.type]) && selectedOptions[option.type].includes(choice)) ||
                            (!Array.isArray(selectedOptions[option.type]) && selectedOptions[option.type] === choice)
                              ? 'bg-red-600 text-white shadow-md transform scale-105'
                              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                          }`}
                        >
                          {choice}
                        </button>
                      ))}
                    </div>
                  ) : null}
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="p-6 border-t border-gray-100 flex-none bg-gray-50 rounded-b-2xl">
          <div className="flex items-center justify-between mb-4">
            <span className="text-2xl font-extrabold text-red-600">{formatCurrency(item.price * quantity)}</span>
            <div className="flex items-center space-x-3">
              <button
                onClick={() => setQuantity(prev => Math.max(1, prev - 1))}
                className="bg-gray-200 p-2 rounded-full text-gray-700 hover:bg-gray-300 transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed transform hover:scale-105"
              >
                <Minus size={20} />
              </button>
              <span className="text-xl font-bold text-gray-800 w-8 text-center">{quantity}</span>
              <button
                onClick={() => setQuantity(prev => prev + 1)}
                className="bg-gray-200 p-2 rounded-full text-gray-700 hover:bg-gray-300 transition-colors duration-200 transform hover:scale-105"
              >
                <Plus size={20} />
              </button>
            </div>
          </div>
          <button
            onClick={handleAddToCart}
            className="w-full bg-gradient-to-r from-red-600 to-orange-500 text-white py-3 rounded-full text-xl font-bold hover:from-red-700 hover:to-orange-600 transition-all duration-300 shadow-lg focus:outline-none focus:ring-4 focus:ring-red-300 focus:ring-opacity-75 transform hover:scale-100-5"
          >
            Add to Cart
          </button>
        </div>
      </div>
    </div>
  );
};

const MenuPage = ({ onAddToCart, onShowDetails, menuItems }) => { // menuItems now passed as prop
  const [activeCategory, setActiveCategory] = useState(menuCategories[0].id);

  // Filter items based on active category
  const filteredItems = menuItems.filter(item => item.category === activeCategory);

  // If no items in category, display a message
  const noItemsMessage = filteredItems.length === 0 && menuItems.length > 0 ? (
    <div className="text-center py-10 text-gray-600">
      <p className="text-xl font-semibold">No items found in this category.</p>
      <p className="text-md mt-2">Please select another category or check back later!</p>
    </div>
  ) : null;

  return (
    <div className="p-4 pt-28 pb-8"> {/* Increased padding-top to account for fixed header */}
      {/* Hero/Promotion Section */}
      <div className="bg-gradient-to-br from-red-500 to-orange-400 text-white rounded-2xl shadow-xl p-6 md:p-8 mb-10 text-center animate-fade-in-up">
        <Sparkles size={48} className="mx-auto mb-4 text-yellow-300 animate-pulse-slow" />
        <h2 className="text-4xl font-extrabold mb-2 leading-tight">Flavor Fiesta Special!</h2>
        <p className="text-xl font-medium mb-4">Get 20% off all Tacos this week!</p>
        <button
          onClick={() => setActiveCategory('tacos')}
          className="bg-white text-red-700 px-6 py-3 rounded-full text-lg font-bold shadow-lg hover:bg-gray-100 transition-colors duration-300 transform hover:scale-105"
        >
          Order Tacos Now!
        </button>
      </div>

      <h2 className="text-4xl font-extrabold text-gray-900 mb-8 text-center drop-shadow-sm">Our Delicious Menu</h2>

      {/* Category Navigation */}
      <div className="flex flex-wrap justify-center gap-3 mb-10 sticky top-24 bg-white z-10 py-3 rounded-xl shadow-lg border border-gray-100">
        {menuCategories.map(category => (
          <button
            key={category.id}
            onClick={() => setActiveCategory(category.id)}
            className={`px-6 py-3 rounded-full text-base md:text-lg font-semibold transition-all duration-300 focus:outline-none focus:ring-4 focus:ring-red-300 focus:ring-opacity-75 transform hover:scale-105 ${
              activeCategory === category.id
                ? 'bg-gradient-to-r from-red-600 to-orange-500 text-white shadow-lg'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            {category.name}
          </button>
        ))}
      </div>

      {/* Menu Items Grid */}
      {noItemsMessage || (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {filteredItems.map(item => (
            <MenuItemCard key={item.id} item={item} onAddToCart={onAddToCart} onShowDetails={onShowDetails} />
          ))}
        </div>
      )}
      {menuItems.length === 0 && (
        <div className="text-center py-10 text-gray-600">
          <p className="text-xl font-semibold">Loading menu or no items available.</p>
          <p className="text-md mt-2">Please ensure your Firebase Firestore has menu items in the 'menuItems' collection.</p>
        </div>
      )}
    </div>
  );
};

const CartPage = ({ cartItems, updateQuantity, removeItem, onNavigate, db, userId, setCartItems }) => {
  const subtotal = cartItems.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const taxRate = 0.08; // 8% tax
  const tax = subtotal * taxRate;
  const total = subtotal + tax;

  const handleCheckout = async () => {
    if (!db || !userId) {
      console.error("Firestore database or user ID not available.");
      alert("Error: Cannot place order. Please try again later."); // Use alert for simplicity, replace with custom modal
      return;
    }

    if (cartItems.length === 0) {
      alert("Your cart is empty. Please add items before checking out."); // Use alert for simplicity, replace with custom modal
      return;
    }

    try {
      // Define the path for orders: /artifacts/{appId}/users/{userId}/orders
      const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';
      const ordersCollectionRef = collection(db, `artifacts/${appId}/users/${userId}/orders`);

      const orderData = {
        userId: userId,
        items: cartItems.map(item => ({
          id: item.id,
          name: item.name,
          price: item.price,
          quantity: item.quantity,
          options: item.options,
        })),
        subtotal: subtotal,
        tax: tax,
        total: total,
        status: 'pending', // e.g., pending, preparing, ready, delivered
        createdAt: serverTimestamp(), // Firestore special timestamp
      };

      await addDoc(ordersCollectionRef, orderData);
      alert('Order placed successfully! (Check console for details)'); // Use alert for simplicity, replace with custom modal
      console.log('Order placed:', orderData);
      setCartItems([]); // Clear cart after successful order
    } catch (error) {
      console.error("Error placing order: ", error);
      alert("Failed to place order. Please try again."); // Use alert for simplicity, replace with custom modal
    }
  };

  return (
    <div className="p-4 pt-28 pb-8 min-h-screen bg-gray-50">
      <h2 className="text-4xl font-extrabold text-gray-900 mb-8 text-center drop-shadow-sm">Your Cart</h2>

      {cartItems.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-xl shadow-lg max-w-2xl mx-auto">
          <ShoppingCart size={80} className="text-gray-300 mx-auto mb-6" />
          <p className="text-2xl font-semibold text-gray-600 mb-6">Your cart is feeling a bit empty!</p>
          <button
            onClick={() => onNavigate('menu')}
            className="inline-flex items-center px-8 py-4 bg-gradient-to-r from-red-600 to-orange-500 text-white rounded-full text-xl font-bold hover:from-red-700 hover:to-orange-600 transition-all duration-300 shadow-xl transform hover:scale-105"
          >
            Explore Our Menu <ChevronRight size={24} className="ml-2" />
          </button>
        </div>
      ) : (
        <div className="max-w-3xl mx-auto bg-white rounded-2xl shadow-xl p-6 md:p-8">
          <ul className="divide-y divide-gray-200">
            {cartItems.map((item, index) => (
              <li key={item.id + '-' + index} className="py-4 flex items-center justify-between animate-fade-in-right">
                <div className="flex items-center flex-grow">
                  <img
                    src={item.image}
                    alt={item.name}
                    className="w-20 h-20 object-cover rounded-xl mr-4 flex-shrink-0 shadow-sm"
                    onError={(e) => {
                      e.target.onerror = null;
                      e.target.src = `https://placehold.co/160x160/F5EFE6/333333?text=${encodeURIComponent(item.name)}`;
                    }}
                  />
                  <div className="flex-grow">
                    <h3 className="text-lg font-bold text-gray-800">{item.name}</h3>
                    {item.options && Object.keys(item.options).length > 0 && (
                      <p className="text-sm text-gray-500 line-clamp-1">
                        {Object.entries(item.options)
                          .map(([key, value]) => {
                            const displayValue = Array.isArray(value) ? value.join(', ') : value;
                            return `${key.charAt(0).toUpperCase() + key.slice(1)}: ${displayValue}`;
                          })
                          .join(' | ')}
                      </p>
                    )}
                    <p className="text-md font-medium text-gray-600 mt-1">{formatCurrency(item.price)} each</p>
                  </div>
                </div>
                <div className="flex items-center space-x-3 ml-4 flex-shrink-0">
                  <button
                    onClick={() => updateQuantity(item.id, index, item.quantity - 1)}
                    disabled={item.quantity <= 1}
                    className="bg-gray-100 p-2 rounded-full text-gray-600 hover:bg-gray-200 transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed transform hover:scale-110"
                  >
                    <Minus size={18} />
                  </button>
                  <span className="text-xl font-bold text-gray-800 w-8 text-center">{item.quantity}</span>
                  <button
                    onClick={() => updateQuantity(item.id, index, item.quantity + 1)}
                    className="bg-gray-100 p-2 rounded-full text-gray-600 hover:bg-gray-200 transition-colors duration-200 transform hover:scale-110"
                  >
                    <Plus size={18} />
                  </button>
                  <button
                    onClick={() => removeItem(item.id, index)}
                    className="bg-red-100 p-2 rounded-full text-red-600 hover:bg-red-200 transition-colors duration-200 ml-3 transform hover:scale-110"
                    title="Remove item"
                  >
                    <X size={18} />
                  </button>
                </div>
              </li>
            ))}
          </ul>

          <div className="mt-8 pt-6 border-t-2 border-dashed border-gray-200 space-y-4">
            <div className="flex justify-between text-xl font-semibold text-gray-700">
              <span>Subtotal:</span>
              <span>{formatCurrency(subtotal)}</span>
            </div>
            <div className="flex justify-between text-xl font-semibold text-gray-700">
              <span>Tax (8%):</span>
              <span>{formatCurrency(tax)}</span>
            </div>
            <div className="flex justify-between text-3xl font-extrabold text-red-700 mt-4">
              <span>Total:</span>
              <span>{formatCurrency(total)}</span>
            </div>
          </div>

          <button
            onClick={handleCheckout}
            className="w-full mt-8 py-4 bg-gradient-to-r from-red-600 to-orange-500 text-white rounded-full text-2xl font-bold hover:from-red-700 hover:to-orange-600 transition-all duration-300 shadow-xl focus:outline-none focus:ring-4 focus:ring-red-300 focus:ring-opacity-75 transform hover:scale-100-5"
          >
            Proceed to Checkout
          </button>
        </div>
      )}
    </div>
  );
};

const RewardsPage = ({ db, userId }) => {
  const [points, setPoints] = useState(0); // Points will come from Firestore
  const pointsToNextReward = 2000; // Example: 2000 points for a significant reward
  const progress = Math.min(100, (points / pointsToNextReward) * 100);

  useEffect(() => {
    // Listen for real-time updates to user's points
    if (!db || !userId) return;

    const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';
    const userDocRef = doc(db, `artifacts/${appId}/users/${userId}/profile/points`); // Using 'profile/points' as a subcollection/document for user-specific data

    const unsubscribe = onSnapshot(userDocRef, (docSnap) => {
      if (docSnap.exists()) {
        setPoints(docSnap.data().value || 0);
      } else {
        // If user document doesn't exist, initialize points to 0
        setPoints(0);
        // Optionally, create the document with initial points if it's the first time
        // setDoc(userDocRef, { value: 0 });
      }
    }, (error) => {
      console.error("Error fetching user points: ", error);
    });

    return () => unsubscribe(); // Cleanup listener on unmount
  }, [db, userId]);

  return (
    <div className="p-4 pt-28 pb-8 min-h-screen flex flex-col items-center bg-gray-50">
      <h2 className="text-4xl font-extrabold text-gray-900 mb-8 text-center drop-shadow-sm">Your Rewards</h2>

      <div className="bg-gradient-to-br from-red-600 to-orange-500 text-white rounded-2xl shadow-xl p-6 md:p-8 w-full max-w-md text-center mb-8 transform animate-pulse-once">
        <Gift size={64} className="mx-auto mb-4 text-yellow-300 animate-bounce-slow" />
        <h3 className="text-3xl font-bold mb-2">Current Points:</h3>
        <p className="text-6xl font-extrabold text-yellow-200">{points}</p>
        <p className="text-lg mt-4 font-medium">Keep earning to unlock amazing rewards!</p>
      </div>

      <div className="bg-white rounded-2xl shadow-xl p-6 md:p-8 w-full max-w-md">
        <h3 className="text-2xl font-bold text-gray-800 mb-4 flex items-center justify-center">
          <BadgeDollarSign size={28} className="mr-2 text-red-500" />
          Your Next Reward
        </h3>
        <p className="text-gray-600 text-center text-lg mb-4">
          You need <span className="font-bold text-red-600">{pointsToNextReward - (points % pointsToNextReward)}</span> more points for a Free Entrée!
        </p>
        <div className="w-full bg-gray-200 rounded-full h-5 mb-4 relative overflow-hidden">
          <div
            className="bg-gradient-to-r from-red-500 to-orange-400 h-5 rounded-full transition-all duration-1000 ease-out"
            style={{ width: `${progress}%` }}
          ></div>
          <span className="absolute inset-0 flex items-center justify-center text-sm font-bold text-gray-800">
            {progress.toFixed(0)}% Complete
          </span>
        </div>
        <p className="text-sm text-gray-500 text-center mt-2">Target: {pointsToNextReward} points</p>

        <div className="mt-8 text-center border-t border-gray-100 pt-6">
          <h4 className="text-xl font-bold text-gray-800 mb-3">How to Earn Points:</h4>
          <ul className="list-disc list-inside text-gray-700 space-y-2 text-left mx-auto max-w-xs">
            <li>1 point for every $1 spent on delicious food</li>
            <li>Bonus points for special menu items or events</li>
            <li>Refer a friend and get 100 points!</li>
          </ul>
          <h4 className="text-xl font-bold text-gray-800 mt-6 mb-3">How to Redeem:</h4>
          <p className="text-gray-700">
            Easily redeem your accumulated points for exclusive discounts, free items, or special offers directly at checkout.
          </p>
        </div>
      </div>
    </div>
  );
};


// --- Main App Component ---
const App = () => {
  const [currentPage, setCurrentPage] = useState('menu');
  const [cartItems, setCartItems] = useState([]);
  const [selectedItemForDetails, setSelectedItemForDetails] = useState(null);

  // Firebase states
  const [db, setDb] = useState(null);
  const [auth, setAuth] = useState(null);
  const [userId, setUserId] = useState(null);
  const [isAuthReady, setIsAuthReady] = useState(false); // To ensure Firebase is ready
  const [menuItems, setMenuItems] = useState([]); // State for menu items from Firestore

  useEffect(() => {
    // 1. Initialize Firebase
    try {
      // Corrected logic: ONLY use process.env variables for Netlify deployment
      const appId = process.env.REACT_APP_FIREBASE_APP_ID || 'default-app-id';
      const firebaseConfig = {
        apiKey: process.env.REACT_APP_FIREBASE_API_KEY,
        authDomain: process.env.REACT_APP_FIREBASE_AUTH_DOMAIN,
        projectId: process.env.REACT_APP_FIREBASE_PROJECT_ID,
        storageBucket: process.env.REACT_APP_FIREBASE_STORAGE_BUCKET,
        messagingSenderId: process.env.REACT_APP_FIREBASE_MESSAGING_SENDER_ID,
        appId: process.env.REACT_APP_FIREBASE_APP_ID_CONFIG,
        measurementId: process.env.REACT_APP_FIREBASE_MEASUREMENT_ID,
      };
      const initialAuthToken = process.env.REACT_APP_FIREBASE_AUTH_TOKEN;

      if (!firebaseConfig.apiKey || !firebaseConfig.projectId) {
        console.error("Firebase config is incomplete. Please ensure all REACT_APP_FIREBASE_ environment variables are set in Netlify.");
        // Fallback for development/Canvas if env vars are not set
        // In Canvas, __firebase_config and __app_id are provided
        // The following lines were the cause of the issue and have been removed
        // const canvasFirebaseConfig = typeof __firebase_config !== 'undefined' ? JSON.parse(__firebase_config) : null;
        // const canvasAppId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';
        // const canvasAuthToken = typeof __initial_auth_token !== 'undefined' ? __initial_auth_token : null;

        // if (canvasFirebaseConfig && canvasAppId) {
        //     console.warn("Using Canvas-provided Firebase config. Set Netlify environment variables for deployment.");
        //     Object.assign(firebaseConfig, canvasFirebaseConfig); // Merge Canvas config
        //     // Use canvasAuthToken if present, otherwise initialAuthToken remains undefined
        //     // Note: initialAuthToken is only used if there's no existing user in onAuthStateChanged
        // } else {
        //     // This block will execute if running locally without .env and not in Canvas
        //     console.error("Neither Netlify environment variables nor Canvas globals are available for Firebase configuration.");
        //     // You might want to halt app loading or show a clear error to the user here
        // }

        // --- NEW Fallback for Canvas: Direct usage within Canvas environment ---
        // This leverages the fact that __firebase_config etc. are globals in Canvas
        if (typeof __firebase_config !== 'undefined') {
            console.warn("Using Canvas-provided Firebase config.");
            Object.assign(firebaseConfig, JSON.parse(__firebase_config));
            // Ensure appId is correctly set from Canvas globals for Firestore paths
            // if it's not provided via process.env
            appId = typeof __app_id !== 'undefined' ? __app_id : appId; // Re-assign appId if Canvas provides it
            // effectiveAuthToken logic below will handle __initial_auth_token
        } else {
             // This block will execute if running locally without .env and not in Canvas
            console.error("Neither Netlify environment variables nor Canvas globals are available for Firebase configuration. App may not function correctly.");
        }
      }

      const app = initializeApp(firebaseConfig);
      const firestore = getFirestore(app);
      const firebaseAuth = getAuth(app);

      setDb(firestore);
      setAuth(firebaseAuth);

      const unsubscribeAuth = onAuthStateChanged(firebaseAuth, async (user) => {
        if (user) {
          setUserId(user.uid);
          setIsAuthReady(true);
        } else {
          try {
            // Prioritize Netlify's initialAuthToken, then Canvas's, then anonymous
            const effectiveAuthToken = process.env.REACT_APP_FIREBASE_AUTH_TOKEN || (typeof __initial_auth_token !== 'undefined' ? __initial_auth_token : null);

            if (effectiveAuthToken) {
              await signInWithCustomToken(firebaseAuth, effectiveAuthToken);
            } else {
              await signInAnonymously(firebaseAuth);
            }
          } catch (error) {
            console.error("Error signing in anonymously or with custom token:", error);
            setIsAuthReady(true);
          }
        }
      });

      return () => unsubscribeAuth();

    } catch (error) {
      console.error("Failed to initialize Firebase:", error);
    }
  }, []);

  useEffect(() => {
    if (db && isAuthReady) {
      // Ensure appId used here is the one resolved by the initialization useEffect
      // If process.env.REACT_APP_FIREBASE_APP_ID is set, use it. Otherwise, use Canvas global.
      const resolvedAppId = process.env.REACT_APP_FIREBASE_APP_ID || (typeof __app_id !== 'undefined' ? __app_id : 'default-app-id');
      const menuCollectionRef = collection(db, `artifacts/${resolvedAppId}/public/data/menuItems`);
      
      const unsubscribe = onSnapshot(menuCollectionRef, (snapshot) => {
        const items = [];
        snapshot.forEach(doc => {
          items.push({ id: doc.id, ...doc.data() });
        });
        setMenuItems(items);
      }, (error) => {
        console.error("Error fetching menu items: ", error);
      });

      return () => unsubscribe();
    }
  }, [db, isAuthReady]);

  const handleNavigate = (page) => {
    setCurrentPage(page);
  };

  const handleAddToCart = (item) => {
    const existingItemIndex = cartItems.findIndex(
      (cartItem) =>
        cartItem.id === item.id &&
        JSON.stringify(cartItem.options) === JSON.stringify(item.options)
    );

    if (existingItemIndex > -1) {
      setCartItems((prevItems) =>
        prevItems.map((cartItem, index) =>
          index === existingItemIndex
            ? { ...cartItem, quantity: cartItem.quantity + item.quantity }
            : cartItem
        )
      );
    } else {
      setCartItems((prevItems) => [...prevItems, { ...item, quantity: item.quantity || 1 }]);
    }
  };

  const updateQuantity = (itemId, itemIndex, newQuantity) => {
    if (newQuantity <= 0) {
      removeItem(itemId, itemIndex);
    } else {
      setCartItems((prevItems) =>
        prevItems.map((item, index) =>
          index === itemIndex ? { ...item, quantity: newQuantity } : item
        )
      );
    }
  };

  const removeItem = (itemId, itemIndex) => {
    setCartItems((prevItems) => prevItems.filter((_, index) => index !== itemIndex));
  };

  const showItemDetails = (item) => {
    setSelectedItemForDetails(item);
  };

  const hideItemDetails = () => {
    setSelectedItemForDetails(null);
  };

  const style = `
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');
    body {
      font-family: 'Inter', sans-serif;
      background-color: #f8f8f8;
      margin: 0;
      padding: 0;
    }

    /* Custom Animations */
    @keyframes ping-once-then-pulse {
      0% { transform: scale(0.2); opacity: 0; }
      20% { transform: scale(1.2); opacity: 1; }
      40%, 100% { transform: scale(1); opacity: 1; }
      50% { transform: scale(1.05); }
      75% { transform: scale(1); }
    }
    .animate-ping-once-then-pulse {
      animation: ping-once-then-pulse 2s ease-out forwards;
    }

    @keyframes fade-in {
      from { opacity: 0; }
      to { opacity: 1; }
    }
    .animate-fade-in {
      animation: fade-in 0.3s ease-out forwards;
    }

    @keyframes scale-in {
      from { transform: scale(0.9); opacity: 0; }
      to { transform: scale(1); opacity: 1; }
    }
    .animate-scale-in {
      animation: scale-in 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards; /* Overshoot effect */
    }

    @keyframes fade-in-up {
      from { opacity: 0; transform: translateY(20px); }
      to { opacity: 1; transform: translateY(0); }
    }
    .animate-fade-in-up {
      animation: fade-in-up 0.5s ease-out forwards;
    }

    @keyframes fade-in-right {
      from { opacity: 0; transform: translateX(20px); }
      to { opacity: 1; transform: translateX(0); }
    }
    .animate-fade-in-right {
      animation: fade-in-right 0.4s ease-out forwards;
    }

    @keyframes pulse-slow {
      0%, 100% { transform: scale(1); }
      50% { transform: scale(1.03); }
    }
    .animate-pulse-slow {
      animation: pulse-slow 2s infinite ease-in-out;
    }

    @keyframes bounce-slow {
      0%, 100% { transform: translateY(0); }
      50% { transform: translateY(-5px); }
    }
    .animate-bounce-slow {
      animation: bounce-slow 1.5s infinite ease-in-out;
    }
  `;

  if (!isAuthReady) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-100">
        <div className="text-center text-gray-700">
          <p className="text-xl font-semibold">Loading app...</p>
          <div className="mt-4 animate-spin rounded-full h-12 w-12 border-4 border-t-4 border-red-500 border-opacity-25"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <style>{style}</style>
      <Header
        currentPage={currentPage}
        onNavigate={handleNavigate}
        cartItemCount={cartItems.reduce((acc, item) => acc + item.quantity, 0)}
        userId={userId}
      />

      <main className="container mx-auto p-4 pt-16">
        {currentPage === 'menu' && (
          <MenuPage onAddToCart={handleAddToCart} onShowDetails={showItemDetails} menuItems={menuItems} />
        )}
        {currentPage === 'cart' && (
          <CartPage
            cartItems={cartItems}
            updateQuantity={updateQuantity}
            removeItem={removeItem}
            onNavigate={handleNavigate}
            db={db}
            userId={userId}
            setCartItems={setCartItems}
          />
        )}
        {currentPage === 'rewards' && <RewardsPage db={db} userId={userId} />}
      </main>

      {selectedItemForDetails && (
        <ItemDetailModal
          item={selectedItemForDetails}
          onClose={hideItemDetails}
          onAddToCart={handleAddToCart}
        />
      )}
    </div>
  );
};

export default App;
