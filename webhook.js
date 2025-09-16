// webhook.js
const express = require('express');
const { MessagingResponse } = require('twilio').twiml;

const app = express();
app.use(express.urlencoded({ extended: false }));

// Store user sessions (use database in production)
const userSessions = {};

// Menu items
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

function findMenuItem(searchText) {
  const lowerSearch = searchText.toLowerCase();
  
  // Define alternative names and partial matches
  const itemAliases = {
    'big brew breakfast': ['big breakfast', 'full english', 'big brew', 'full breakfast'],
    'little brew breakfast': ['little breakfast', 'small breakfast', 'little brew'],
    'eggs benedict': ['benedict', 'eggs ben'],
    'eggs benedict with bacon': ['benedict bacon', 'eggs ben bacon', 'benedict with bacon'],
    'eggs benedict with salmon': ['benedict salmon', 'eggs ben salmon', 'benedict with salmon'],
    'breakfast sandwich': ['sandwich', 'breakfast sarnie'],
    'eggs on toast': ['eggs toast', 'scrambled eggs'],
    'steak & eggs': ['steak eggs', 'steak and eggs'],
    'green eggs': ['green egg'],
    'french toast': ['french bread', 'eggy bread'],
    'avocado toast': ['avocado', 'avo toast'],
    'korean hashbrown bites': ['hashbrown', 'hashbrowns', 'hash brown', 'korean hashbrown', 'hashbrown bites'],
    'corn ribs': ['corn', 'ribs'],
    'halloumi & berry ketchup': ['halloumi', 'halloumi berry', 'cheese'],
    'espresso': ['coffee'],
    'americano': ['black coffee'],
    'flat white': ['flat'],
    'latte': ['coffee latte'],
    'cappuccino': ['capp', 'cap'],
    'mocha': ['chocolate coffee'],
    'hot chocolate': ['chocolate', 'hot choc', 'cocoa']
  };
  
  // Check coffee items
  for (const [item, price] of Object.entries(menuItems.coffee)) {
    const itemLower = item.toLowerCase();
    if (itemLower.includes(lowerSearch) || 
        lowerSearch.includes(itemLower) ||
        (itemAliases[itemLower] && itemAliases[itemLower].some(alias => 
          alias.includes(lowerSearch) || lowerSearch.includes(alias)))) {
      return { name: item, price, category: 'coffee' };
    }
  }
  
  // Check food items
  for (const [item, price] of Object.entries(menuItems.food)) {
    const itemLower = item.toLowerCase();
    if (itemLower.includes(lowerSearch) || 
        lowerSearch.includes(itemLower) ||
        (itemAliases[itemLower] && itemAliases[itemLower].some(alias => 
          alias.includes(lowerSearch) || lowerSearch.includes(alias)))) {
      return { name: item, price, category: 'food' };
    }
  }
  
  return null;
}

function addToCart(session, itemName, price, notes = '', category = '') {
  const cartItem = {
    id: Date.now(),
    name: itemName,
    price: parseFloat(price),
    notes: notes,
    quantity: 1,
    table: session.tableNumber,
    category: category
  };
  session.cart.push(cartItem);
  
  return `Added to cart!\n\n${cartItem.name} - £${cartItem.price.toFixed(2)}\nTable: ${session.tableNumber}\n${notes ? `Notes: ${notes}\n` : ''}Type 'cart' to see your full order or continue adding items!`;
}

function generateFullMenu() {
  let fullMenu = "FULL MENU\n\nFOOD MENU\n\nBREAKFAST:\n";
  
  // Breakfast items
  const breakfastItems = ['Big Brew Breakfast', 'Little Brew Breakfast', 'Eggs Benedict', 'Eggs Benedict with Bacon', 'Eggs Benedict with Salmon', 'Breakfast Sandwich', 'Eggs on Toast'];
  breakfastItems.forEach(item => {
    if (menuItems.food[item]) {
      fullMenu += `• ${item} - £${menuItems.food[item].toFixed(2)}\n`;
    }
  });
  
  fullMenu += "\nBRUNCH & MAINS:\n";
  const brunchItems = ['Steak & Eggs', 'Green Eggs', 'French Toast', 'Avocado Toast'];
  brunchItems.forEach(item => {
    if (menuItems.food[item]) {
      fullMenu += `• ${item} - £${menuItems.food[item].toFixed(2)}\n`;
    }
  });
  
  fullMenu += "\nSIDES:\n";
  const sideItems = ['Korean Hashbrown Bites', 'Corn Ribs', 'Halloumi & Berry Ketchup'];
  sideItems.forEach(item => {
    if (menuItems.food[item]) {
      fullMenu += `• ${item} - £${menuItems.food[item].toFixed(2)}\n`;
    }
  });
  
  fullMenu += "\nCOFFEE & DRINKS:\n";
  Object.entries(menuItems.coffee).forEach(([item, price]) => {
    fullMenu += `• ${item} - £${price.toFixed(2)}\n`;
  });
  
  fullMenu += "\nVegan & Gluten-Free options available!\n\nTo order, just type the item name!\n(e.g., 'latte', 'big brew breakfast')";
  
  return fullMenu;
}

function processMessage(text, session) {
  const lowerText = text.toLowerCase();
  
  // Handle table number setup first
  if (!session.tableNumber) {
    if (lowerText.includes('hi') || lowerText.includes('hello') || lowerText.includes('hey') || lowerText === 'help') {
      return "Hello! Welcome to Brew Coffee Shop!\n\nFirst, what table are you sitting at? (e.g., 'Table 5' or just '5')";
    }
    
    const tableNum = text.toLowerCase().replace('table', '').trim();
    session.tableNumber = tableNum;
    return `Perfect! Table ${tableNum} noted.\n\nI'm here to help you with:\n\nOrder - Start placing your order\nMenu - View our full menu\nCoffee - See coffee & drink options\nCart - Check your current order\nHours - Opening times\nLocation - Find us\n\nWhat would you like to do?`;
  }

  // Handle coffee ordering flow
  if (session.currentFlow === 'ordering_coffee') {
    if (session.orderData.selectedDrink && !session.orderData.hasOwnProperty('milkChoice')) {
      const milkChoice = text.toLowerCase().includes('dairy') ? 'dairy milk' : text.toLowerCase();
      const notes = milkChoice === 'dairy milk' ? '' : `with ${milkChoice}`;
      
      const cartItem = {
        id: Date.now(),
        name: session.orderData.selectedDrink,
        price: session.orderData.price,
        notes: notes,
        quantity: 1,
        table: session.tableNumber
      };
      session.cart.push(cartItem);
      
      session.currentFlow = null;
      session.orderData = {};
      
      return `Added to cart!\n\n${cartItem.name} - £${cartItem.price.toFixed(2)}\nTable: ${session.tableNumber}\n${notes ? `Notes: ${notes}\n` : ''}Type 'cart' to see your full order or continue adding items!\n\nGreat choice!\n\nWant to add more?\n• Type an item name to add it\n• Type 'menu' to see all options\n• Type 'cart' to see your order\n• Type 'checkout' when ready to order!\n\nWhat else can I get you?`;
    }
  }

  // Handle checkout flow
  if (session.currentFlow === 'checkout') {
    const total = session.cart.reduce((sum, item) => sum + item.price, 0).toFixed(2);
    const orderNumber = Math.floor(Math.random() * 1000) + 100;
    
    let orderSummary = `ORDER PLACED SUCCESSFULLY!\n\nOrder #${orderNumber}\nTable: ${session.tableNumber}\nName: ${text}\n\nYOUR ORDER:\n`;
    
    session.cart.forEach((item, index) => {
      orderSummary += `${index + 1}. ${item.name} - £${item.price.toFixed(2)}\n`;
      if (item.notes) orderSummary += `   ${item.notes}\n`;
    });
    
    orderSummary += `\nTotal: £${total}\n\nORDER SENT TO KITCHEN!\nYour order is being prepared\nReady in: 10-15 minutes\nWe'll bring it to Table ${session.tableNumber}\nPay when we deliver your order\n\nThank you for choosing Brew Coffee Shop!`;
    
    session.cart = [];
    session.currentFlow = null;
    session.orderData = {};
    return orderSummary;
  }

  // Menu display - MAIN FUNCTIONALITY
  if (lowerText.includes('menu')) {
    return generateFullMenu();
  }

  // Handle direct item ordering
  const foundItem = findMenuItem(text);
  if (foundItem) {
    if (foundItem.category === 'coffee') {
      session.currentFlow = 'ordering_coffee';
      session.orderData = { selectedDrink: foundItem.name, price: foundItem.price };
      return `${foundItem.name} - £${foundItem.price.toFixed(2)}\n\nMilk options:\n• Dairy milk (standard)\n• Oat milk\n• Almond milk\n• Soy milk\n\nWhat milk would you like?\n(Or just say 'dairy' for regular milk)`;
    } else {
      return addToCart(session, foundItem.name, foundItem.price, '', 'food');
    }
  }

  // Cart management
  if (lowerText.includes('cart') || lowerText.includes('my order')) {
    if (session.cart.length === 0) {
      return "Your cart is empty\n\nType 'menu' to see what's available or type an item name to add it!";
    }

    const total = session.cart.reduce((sum, item) => sum + item.price, 0).toFixed(2);
    let cartMessage = `YOUR ORDER - Table ${session.tableNumber}\n\n`;
    
    session.cart.forEach((item, index) => {
      cartMessage += `${index + 1}. ${item.name} - £${item.price.toFixed(2)}\n`;
      if (item.notes) cartMessage += `   ${item.notes}\n`;
    });
    
    cartMessage += `\nTotal: £${total}\n\nReady?\n• Type 'checkout' to place your order\n• Type 'clear cart' to start over\n• Continue adding items by typing their names`;
    
    return cartMessage;
  }

  // Checkout
  if (lowerText.includes('checkout') || lowerText.includes('place order')) {
    if (session.cart.length === 0) {
      return "Your cart is empty!\n\nType 'menu' to see what's available or type an item name to add something first!";
    }
    
    session.currentFlow = 'checkout';
    return "READY TO ORDER!\n\nI just need a name for your order so our team knows who it's for.\n\nWhat name should we use?\n(e.g., 'Sarah', 'John', etc.)";
  }

  // Clear cart
  if (lowerText.includes('clear cart') || lowerText.includes('empty cart')) {
    session.cart = [];
    return "Cart cleared!\n\nReady to start fresh? Type 'menu' to see what's available!";
  }

  // Coffee menu
  if (lowerText === 'coffee' && !session.currentFlow) {
    let coffeeMenu = "COFFEE & DRINKS MENU\n\n";
    Object.entries(menuItems.coffee).forEach(([item, price]) => {
      coffeeMenu += `• ${item} - £${price.toFixed(2)}\n`;
    });
    coffeeMenu += "\nWe serve North Star Coffee from Leeds!\nPlant-based milk available.\n\nTo order, just type the drink name!";
    return coffeeMenu;
  }

  // Hours & Location
  if (lowerText.includes('hours') || lowerText.includes('open') || lowerText.includes('location') || lowerText.includes('address') || lowerText.includes('where')) {
    return `BREW COFFEE SHOP\n\n12 Brock Street\nLancaster, LA1\n\nOPENING HOURS:\n• Monday-Friday: 8:30am - 4:00pm\n• Saturday: 9:00am - 4:00pm  \n• Sunday: 10:00am - 4:00pm\n\nFood served: 9:00am - 3:00pm daily\n\n5 minutes walk from Lancaster Castle!`;
  }

  // Greetings
  if (lowerText.includes('hi') || lowerText.includes('hello') || lowerText.includes('hey') || lowerText === 'help') {
    return "Hello! Great to see you!\n\nWhat can I help you with?\n\nOrder - Place a food/drink order\nMenu - View our full menu\nCoffee - See coffee options\nCart - Check your current order\nHours - Opening times\nLocation - Find us\n\nJust tell me what you need!";
  }

  // Fallback
  return "I'd love to help!\n\nTry:\n'menu' - See our full menu\n'coffee' - Coffee options\n'cart' - Your current order\n'hours' - Opening times\n'location' - Find us\n\nOr just type an item name like 'latte' or 'breakfast sandwich' to add it to your cart!";
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
