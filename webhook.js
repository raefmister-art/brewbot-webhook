// webhook.js
const express = require('express');
const { MessagingResponse } = require('twilio').twiml;

const app = express();
app.use(express.urlencoded({ extended: false }));

// Store user sessions (use database in production)
const userSessions = {};

// Menu items - matches your React version
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
  
  return `Added to cart!\n\n${itemName} - £${parseFloat(price).toFixed(2)}\n${notes ? `Notes: ${notes}\n` : ''}Type 'cart' to see your full order or continue ordering!`;
}

function processMessage(text, session) {
  const lowerText = text.toLowerCase();
  
  // Handle table number setup first
  if (!session.tableNumber) {
    const tableNum = text.toLowerCase().replace('table', '').trim();
    session.tableNumber = tableNum;
    return `Perfect! Table ${tableNum} noted.\n\nI'm here to help you with:\n\nOrder - Start placing your order\nMenu - View our full menu\nCoffee - See coffee & drink options\nCart - Check your current order\nHours - Opening times\nLocation - Find us\nHelp - Get assistance\n\nWhat would you like to do?`;
  }

  // Handle ongoing flows
  if (session.currentFlow === 'ordering_coffee') {
    if (session.orderData.selectedDrink && !session.orderData.hasOwnProperty('milkChoice')) {
      const milkChoice = text.toLowerCase().includes('dairy') ? 'dairy milk' : text.toLowerCase();
      const notes = milkChoice === 'dairy milk' ? '' : `with ${milkChoice}`;
      
      const result = addToCart(session, session.orderData.selectedDrink, session.orderData.price, notes, 'coffee');
      
      session.currentFlow = null;
      session.orderData = {};
      
      return result + "\n\nGreat choice!\n\nWant to add more?\n• Type an item name to add it\n• Type 'menu' to see all options\n• Type 'coffee' for coffee options\n• Type 'cart' to see your order\n• Type 'checkout' when ready to order!\n\nWhat else can I get you?";
    }
  }

  if (session.currentFlow === 'ordering_item') {
    // Handle menu commands first
    if (lowerText === 'menu') {
      let fullMenu = "FULL MENU\n\nFOOD MENU\n\nBREAKFAST:\n";
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
      
      fullMenu += "\nJust type the item name you'd like!\n(e.g., 'latte', 'big brew breakfast')";
      
      return fullMenu;
    }
    
    if (lowerText === 'coffee') {
      let coffeeMenu = "COFFEE & DRINKS\n\n";
      Object.entries(menuItems.coffee).forEach(([item, price]) => {
        coffeeMenu += `• ${item} - £${price.toFixed(2)}\n`;
      });
      coffeeMenu += "\nJust type the drink name you'd like!\n(e.g., 'latte' or 'cappuccino')";
      
      return coffeeMenu;
    }
    
    // Try to find the item they mentioned
    const foundItem = findMenuItem(text);
    if (foundItem) {
      if (foundItem.category === 'coffee') {
        session.currentFlow = 'ordering_coffee';
        session.orderData = { selectedDrink: foundItem.name, price: foundItem.price };
        return `${foundItem.name} - £${foundItem.price.toFixed(2)}\n\nMilk options:\n• Dairy milk (standard)\n• Oat milk\n• Almond milk\n• Soy milk\n\nWhat milk would you like?\n(Or just say 'dairy' for regular milk)`;
      } else {
        const result = addToCart(session, foundItem.name, foundItem.price, '', 'food');
        session.currentFlow = null;
        return result + "\n\nExcellent choice!\n\nKeep ordering:\n• Type another item name\n• Type 'menu' or 'coffee' to browse\n• Type 'cart' to review\n• Type 'checkout' when done\n\nWhat else would you like?";
      }
    } else {
      return `Sorry, I couldn't find "${text}" on our menu.\n\nTry typing:\n• Specific item names (e.g., 'latte', 'breakfast sandwich')\n• 'coffee' to see coffee options\n• 'menu' to see everything\n\nWhat would you like to order?`;
    }
  }

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
    session.customerName = text;
    
    return orderSummary;
  }

  // Main order flow
  if (lowerText.includes('order') && !lowerText.includes('my order')) {
    session.currentFlow = 'ordering_item';
    return "PLACE YOUR ORDER\n\nWhat would you like?\n\nType 'menu' to see everything\nType 'coffee' to see coffee & drinks\n\nOr just type what you want (e.g., 'latte', 'breakfast sandwich')\n\nWhat would you like to order?";
  }

  // Handle direct item ordering (when not in ordering flow)
  if (!session.currentFlow) {
    const foundItem = findMenuItem(text);
    if (foundItem) {
      if (foundItem.category === 'coffee') {
        session.currentFlow = 'ordering_coffee';
        session.orderData = { selectedDrink: foundItem.name, price: foundItem.price };
        return `${foundItem.name} - £${foundItem.price.toFixed(2)}\n\nMilk options:\n• Dairy milk (standard)\n• Oat milk\n• Almond milk\n• Soy milk\n\nWhat milk would you like?`;
      } else {
        return addToCart(session, foundItem.name, foundItem.price, '', 'food');
      }
    }
  }

  // Cart/order management
  if (lowerText.includes('cart') || lowerText.includes('my order')) {
    if (session.cart.length === 0) {
      return "Your cart is empty\n\nType 'order' to start ordering!";
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
  
  if (lowerText.includes('checkout') || lowerText.includes('place order')) {
    if (session.cart.length === 0) {
      return "Your cart is empty!\n\nType 'order' to add some delicious items first!";
    }
    
    session.currentFlow = 'checkout';
    return "READY TO ORDER!\n\nI just need a name for your order so our team knows who it's for.\n\nWhat name should we use?\n(e.g., 'Sarah', 'John', etc.)";
  }

  // Clear cart command
  if (lowerText.includes('clear cart')) {
    session.cart = [];
    return "Cart cleared!\n\nReady to start fresh? Type 'order' to begin!";
  }

  // Menu viewing
  if (lowerText.includes('menu') && !session.currentFlow) {
    return "BREW COFFEE SHOP MENU\n\nCOFFEE & DRINKS:\n• Espresso - £3.00\n• Americano - £3.20\n• Flat White - £3.60\n• Latte - £3.70\n• Cappuccino - £3.80\n• Mocha - £4.20\n• Hot Chocolate - £4.00\n\nPOPULAR FOOD:\n• Big Brew Breakfast - £14.00\n• Eggs Benedict - £10.00\n• Breakfast Sandwich - £10.00\n• Avocado Toast - £10.00\n• French Toast - £12.00\n\nReady to order? Type 'order' to get started!";
  }

  // Coffee menu
  if (lowerText === 'coffee' && !session.currentFlow) {
    let coffeeMenu = "COFFEE & DRINKS MENU\n\n";
    Object.entries(menuItems.coffee).forEach(([item, price]) => {
      coffeeMenu += `• ${item} - £${price.toFixed(2)}\n`;
    });
    coffeeMenu += "\nWe serve North Star Coffee from Leeds!\nPlant-based milk available.\n\nReady to order? Type 'order'!";
    
    return coffeeMenu;
  }

  // Location & hours
  if (lowerText.includes('hours') || lowerText.includes('location')) {
    return `BREW COFFEE SHOP\n\n12 Brock Street\nLancaster, LA1\n\nOPENING HOURS:\n• Mon-Fri: 8:30am - 4:00pm\n• Saturday: 9:00am - 4:00pm\n• Sunday: 10:00am - 4:00pm\n\nFood served: 9:00am - 3:00pm\n\n5 minutes walk from Lancaster Castle!`;
  }

  // Greetings
  if (lowerText.includes('hi') || lowerText.includes('hello') || lowerText.includes('hey')) {
    return "Hello! Great to see you!\n\nWhat can I help you with?\n\nOrder - Place a food/drink order\nMenu - View our full menu\nCoffee - See coffee options\nCart - Check your current order\nHours - Opening times\nLocation - Find us\n\nJust tell me what you need!";
  }

  // Fallback
  return "I'd love to help!\n\nTry:\n'order' - Start ordering\n'menu' - See our menu\n'coffee' - Coffee options\n'cart' - Your current order\n'hours' - Opening times\n'location' - Find us\n\nOr just type an item name like 'latte' or 'breakfast sandwich'!";
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
