const express = require('express');
const { MessagingResponse } = require('twilio').twiml;
const path = require('path');

const app = express();
app.use(express.urlencoded({ extended: false }));
app.use(express.json());
app.use(express.static('public'));

// Store user sessions and orders
const userSessions = {};
const activeOrders = [];

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

function findMultipleMenuItems(searchText) {
  const lowerSearch = searchText.toLowerCase();
  const foundItems = [];
  
  // Split search text by common separators
  const keywords = lowerSearch.split(/\s+and\s+|\s*,\s*|\s*\+\s*/).filter(word => word.trim());
  
  for (const keyword of keywords) {
    const item = findMenuItem(keyword.trim());
    if (item && !foundItems.some(existing => existing.name === item.name)) {
      foundItems.push(item);
    }
  }
  
  // If no multiple items found, try single item search
  if (foundItems.length === 0) {
    const singleItem = findMenuItem(searchText);
    if (singleItem) {
      foundItems.push(singleItem);
    }
  }
  
  return foundItems.length > 0 ? foundItems : null;
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
    
    // Create order for staff dashboard
    const newOrder = {
      id: orderNumber,
      table: session.tableNumber,
      customerName: text,
      items: [...session.cart],
      total: parseFloat(total),
      status: 'pending',
      timestamp: new Date(),
      estimatedTime: 15
    };
    
    activeOrders.push(newOrder);
    
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

  // Handle direct item ordering - now supports multiple items
  const foundItems = findMultipleMenuItems(text);
  if (foundItems) {
    if (foundItems.length === 1) {
      const foundItem = foundItems[0];
      if (foundItem.category === 'coffee') {
        session.currentFlow = 'ordering_coffee';
        session.orderData = { selectedDrink: foundItem.name, price: foundItem.price };
        return `${foundItem.name} - £${foundItem.price.toFixed(2)}\n\nMilk options:\n• Dairy milk (standard)\n• Oat milk\n• Almond milk\n• Soy milk\n\nWhat milk would you like?\n(Or just say 'dairy' for regular milk)`;
      } else {
        return addToCart(session, foundItem.name, foundItem.price, '', 'food');
      }
    } else {
      // Multiple items found - handle coffee + food combination properly
      let response = `Found ${foundItems.length} items!\n\n`;
      let totalPrice = 0;
      let coffeeItem = null;
      let foodItems = [];
      
      // Separate coffee and food items
      foundItems.forEach((item, index) => {
        response += `${index + 1}. ${item.name} - £${item.price.toFixed(2)}\n`;
        totalPrice += item.price;
        
        if (item.category === 'coffee' && !coffeeItem) {
          coffeeItem = item; // Only handle first coffee item for milk selection
        } else {
          foodItems.push(item);
        }
      });
      
      // Add all food items to cart immediately
      foodItems.forEach(item => {
        const cartItem = {
          id: Date.now() + Math.random(),
          name: item.name,
          price: item.price,
          notes: '',
          quantity: 1,
          table: session.tableNumber,
          category: 'food'
        };
        session.cart.push(cartItem);
      });
      
      if (coffeeItem) {
        // Set up coffee ordering flow for the coffee item
        session.currentFlow = 'ordering_coffee';
        session.orderData = { selectedDrink: coffeeItem.name, price: coffeeItem.price };
        
        response += `\nFood items added to cart!\n\nFor your ${coffeeItem.name}, what milk would you like?\n\nMilk options:\n• Dairy milk (standard)\n• Oat milk\n• Almond milk\n• Soy milk\n\n(Or just say 'dairy' for regular milk)`;
      } else {
        response += `\nTotal added: £${totalPrice.toFixed(2)}\n\nType 'cart' to see your full order or continue adding items!`;
      }
      
      return response;
    }
  }

  // Cart management - handle all variations
  if (lowerText.includes('cart') || lowerText.includes('basket') || lowerText.includes('my order') || lowerText.includes('order status')) {
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

  // Checkout - handle all variations
  if (lowerText.includes('checkout') || lowerText.includes('check out') || lowerText.includes('place order') || lowerText.includes('order now') || lowerText.includes('pay') || lowerText.includes('finish order') || lowerText.includes('complete order')) {
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

// Admin Dashboard Route
app.get('/admin', (req, res) => {
  res.send(`
<!DOCTYPE html>
<html>
<head>
    <title>Brew Coffee Shop - Kitchen Orders</title>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <style>
        body {
            font-family: Arial, sans-serif;
            margin: 0;
            padding: 20px;
            background-color: #f5f5f5;
        }
        .header {
            background: linear-gradient(135deg, #2c3e50, #3498db);
            color: white;
            padding: 20px;
            border-radius: 10px;
            margin-bottom: 20px;
            text-align: center;
        }
        .order-card {
            background: white;
            border-radius: 10px;
            padding: 20px;
            margin-bottom: 15px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
            border-left: 5px solid #e74c3c;
        }
        .order-card.completed {
            border-left-color: #27ae60;
            opacity: 0.7;
        }
        .order-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 15px;
        }
        .order-number {
            font-size: 24px;
            font-weight: bold;
            color: #2c3e50;
        }
        .table-info {
            font-size: 18px;
            background: #3498db;
            color: white;
            padding: 8px 16px;
            border-radius: 20px;
        }
        .customer-name {
            font-size: 16px;
            color: #7f8c8d;
            margin-bottom: 10px;
        }
        .order-items {
            margin-bottom: 15px;
        }
        .item {
            display: flex;
            justify-content: space-between;
            padding: 8px 0;
            border-bottom: 1px solid #ecf0f1;
        }
        .item:last-child {
            border-bottom: none;
            font-weight: bold;
            color: #2c3e50;
        }
        .item-notes {
            font-size: 12px;
            color: #7f8c8d;
            font-style: italic;
            padding-left: 20px;
        }
        .order-footer {
            display: flex;
            justify-content: space-between;
            align-items: center;
        }
        .complete-btn {
            background: #27ae60;
            color: white;
            border: none;
            padding: 10px 20px;
            border-radius: 5px;
            cursor: pointer;
            font-size: 16px;
        }
        .complete-btn:hover {
            background: #229954;
        }
        .time-info {
            color: #7f8c8d;
            font-size: 14px;
        }
        .refresh-btn {
            background: #3498db;
            color: white;
            border: none;
            padding: 10px 20px;
            border-radius: 5px;
            cursor: pointer;
            margin-bottom: 20px;
        }
        .no-orders {
            text-align: center;
            color: #7f8c8d;
            font-size: 18px;
            margin-top: 50px;
        }
    </style>
</head>
<body>
    <div class="header">
        <h1>Brew Coffee Shop - Kitchen Orders</h1>
        <p>WhatsApp Order Management System</p>
    </div>
    
    <button class="refresh-btn" onclick="window.location.reload()">Refresh Orders</button>
    
    <div id="orders-container">
        <!-- Orders will be loaded here -->
    </div>

    <script>
        function loadOrders() {
            fetch('/api/orders')
                .then(response => response.json())
                .then(orders => {
                    const container = document.getElementById('orders-container');
                    
                    if (orders.length === 0) {
                        container.innerHTML = '<div class="no-orders">No active orders</div>';
                        return;
                    }
                    
                    container.innerHTML = orders.map(order => \`
                        <div class="order-card \${order.status === 'completed' ? 'completed' : ''}">
                            <div class="order-header">
                                <div class="order-number">Order #\${order.id}</div>
                                <div class="table-info">Table \${order.table}</div>
                            </div>
                            <div class="customer-name">Customer: \${order.customerName}</div>
                            <div class="order-items">
                                \${order.items.map(item => \`
                                    <div>
                                        <div class="item">
                                            <span>\${item.name}</span>
                                            <span>£\${item.price.toFixed(2)}</span>
                                        </div>
                                        \${item.notes ? \`<div class="item-notes">\${item.notes}</div>\` : ''}
                                    </div>
                                \`).join('')}
                                <div class="item">
                                    <span><strong>TOTAL</strong></span>
                                    <span><strong>£\${order.total.toFixed(2)}</strong></span>
                                </div>
                            </div>
                            <div class="order-footer">
                                <div class="time-info">
                                    Ordered: \${new Date(order.timestamp).toLocaleTimeString()}
                                </div>
                                \${order.status === 'pending' ? 
                                    \`<button class="complete-btn" onclick="completeOrder(\${order.id})">Mark Complete</button>\` : 
                                    '<span style="color: #27ae60; font-weight: bold;">COMPLETED</span>'
                                }
                            </div>
                        </div>
                    \`).join('');
                })
                .catch(error => {
                    console.error('Error loading orders:', error);
                });
        }
        
        function completeOrder(orderId) {
            fetch('/api/orders/' + orderId + '/complete', {
                method: 'POST'
            })
            .then(() => loadOrders())
            .catch(error => console.error('Error completing order:', error));
        }
        
        // Load orders on page load
        loadOrders();
        
        // Auto-refresh every 10 seconds
        setInterval(loadOrders, 10000);
    </script>
</body>
</html>
  `);
});

// API Routes for Admin Dashboard
app.get('/api/orders', (req, res) => {
  // Return orders sorted by newest first
  const sortedOrders = activeOrders.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
  res.json(sortedOrders);
});

app.post('/api/orders/:id/complete', (req, res) => {
  const orderId = parseInt(req.params.id);
  const order = activeOrders.find(o => o.id === orderId);
  if (order) {
    order.status = 'completed';
  }
  res.json({ success: true });
});

// WhatsApp Webhook
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
  console.log('Webhook server with admin dashboard running...');
});
