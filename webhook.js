const express = require('express');
const { MessagingResponse } = require('twilio').twiml;

const app = express();
app.use(express.urlencoded({ extended: false }));

// Store user sessions
const userSessions = {};

// Menu items (from your React app)
const menuItems = {
  coffee: {
    'Espresso': 3.00,
    'Americano': 3.20,
    'Flat White': 3.60,
    'Latte': 3.70,
    'Cappuccino': 3.80,
    'Mocha': 4.20,
    'Hot Chocolate': 4.00
  },
  food: {
    'Big Brew Breakfast': 14.00,
    'Little Brew Breakfast': 8.50,
    'Eggs Benedict': 10.00,
    'Eggs Benedict with Bacon': 13.00,
    'Eggs Benedict with Salmon': 14.00,
    'Breakfast Sandwich': 10.00,
    'Eggs on Toast': 6.50,
    'Steak & Eggs': 17.50,
    'Green Eggs': 11.00,
    'French Toast': 12.00,
    'Avocado Toast': 10.00,
    'Korean Hashbrown Bites': 6.75,
    'Corn Ribs': 5.00,
    'Halloumi & Berry Ketchup': 6.00
  }
};

function getUserSession(phoneNumber) {
  if (!userSessions[phoneNumber]) {
    userSessions[phoneNumber] = {
      tableNumber: null,
      cart: [],
      currentFlow: null,
      orderData: {},
      customerName: ''
    };
  }
  return userSessions[phoneNumber];
}

// Add the missing findMenuItem function
function findMenuItem(searchText) {
  const lowerSearch = searchText.toLowerCase();
  
  // Check coffee items
  for (const [item, price] of Object.entries(menuItems.coffee)) {
    if (item.toLowerCase().includes(lowerSearch) || lowerSearch.includes(item.toLowerCase())) {
      return { name: item, price, category: 'coffee' };
    }
  }
  
  // Check food items  
  for (const [item, price] of Object.entries(menuItems.food)) {
    if (item.toLowerCase().includes(lowerSearch) || lowerSearch.includes(item.toLowerCase())) {
      return { name: item, price, category: 'food' };
    }
  }
  
  return null;
}

function processMessage(text, session) {
  const lowerText = text.toLowerCase();
  
  // Handle table number setup first
  if (!session.tableNumber) {
    if (lowerText.includes('hi') || lowerText.includes('hello')) {
      return "Hello! Welcome to Brew Coffee Shop!\n\nFirst, what table are you sitting at? (e.g., 'Table 5' or just '5')";
    }
    
    const tableNum = text.toLowerCase().replace('table', '').trim();
    session.tableNumber = tableNum;
    return `Perfect! Table ${tableNum} noted.\n\nType 'menu' to see our food, 'coffee' for drinks, or just tell me what you'd like!`;
  }

  // Handle checkout
  if (session.currentFlow === 'checkout') {
    const total = session.cart.reduce((sum, item) => sum + item.price, 0).toFixed(2);
    const orderNumber = Math.floor(Math.random() * 1000) + 100;
    
    let orderSummary = `ORDER PLACED!\n\nOrder #${orderNumber}\nTable: ${session.tableNumber}\nName: ${text}\n\nYOUR ORDER:\n`;
    
    session.cart.forEach((item, index) => {
      orderSummary += `${index + 1}. ${item.name} - £${item.price.toFixed(2)}\n`;
    });
    
    orderSummary += `\nTotal: £${total}\n\nYour order is being prepared!\nWe'll bring it to Table ${session.tableNumber}`;
    
    session.cart = [];
    session.currentFlow = null;
    return orderSummary;
  }

  // Direct item ordering
  const foundItem = findMenuItem(text);
  if (foundItem) {
    const cartItem = {
      id: Date.now(),
      name: foundItem.name,
      price: foundItem.price,
      table: session.tableNumber
    };
    session.cart.push(cartItem);
    
    return `Added ${foundItem.name} - £${foundItem.price.toFixed(2)} to cart!\n\nType 'checkout' to order or add more items!`;
  }

  // Cart management
  if (lowerText.includes('cart')) {
    if (session.cart.length === 0) {
      return "Your cart is empty. Type menu items to add them!";
    }
    
    const total = session.cart.reduce((sum, item) => sum + item.price, 0).toFixed(2);
    let cartMsg = `YOUR ORDER - Table ${session.tableNumber}\n\n`;
    
    session.cart.forEach((item, index) => {
      cartMsg += `${index + 1}. ${item.name} - £${item.price.toFixed(2)}\n`;
    });
    
    cartMsg += `\nTotal: £${total}\n\nType 'checkout' to place order!`;
    return cartMsg;
  }

  if (lowerText.includes('checkout')) {
    if (session.cart.length === 0) {
      return "Your cart is empty! Add some items first.";
    }
    session.currentFlow = 'checkout';
    return "What name should we use for your order?";
  }

  // Menu display
  if (lowerText.includes('menu')) {
    return "MENU:\n\nCOFFEE:\n• Latte - £3.70\n• Cappuccino - £3.80\n• Americano - £3.20\n\nFOOD:\n• Big Brew Breakfast - £14.00\n• Eggs Benedict - £10.00\n• Avocado Toast - £10.00\n\nJust type what you want!";
  }

  // Default response
  return "Type 'menu' to see options, or just tell me what you'd like!\n\n(e.g., 'latte', 'big breakfast')";
}

app.post('/webhook', (req, res) => {
  const incomingMessage = req.body.Body;
  const fromNumber = req.body.From;
  
  const session = getUserSession(fromNumber);
  const response = processMessage(incomingMessage, session);
  
  const twiml = new MessagingResponse();
  twiml.message(response);
  
  res.type('text/xml').send(twiml.toString());
});

app.listen(process.env.PORT || 3000, () => {
  console.log('Webhook server running...');
});
