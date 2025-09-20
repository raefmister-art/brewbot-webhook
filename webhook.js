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
  
  for (const [item, price] of Object.entries(menuItems.coffee)) {
    if (item.toLowerCase().includes(lowerSearch) || lowerSearch.includes(item.toLowerCase())) {
      return { name: item, price, category: 'coffee' };
    }
  }
  
  for (const [item, price] of Object.entries(menuItems.food)) {
    if (item.toLowerCase().includes(lowerSearch) || lowerSearch.includes(item.toLowerCase())) {
      return { name: item, price, category: 'food' };
    }
  }
  
  return null;
}

function processMessage(text, session) {
  const lowerText = text.toLowerCase();
  
  if (!session.tableNumber) {
    if (lowerText.includes('hi') || lowerText.includes('hello')) {
      return "Hello! Welcome to Brew Coffee Shop!\n\nFirst, what table are you sitting at? (e.g., 'Table 5' or just '5')";
    }
    
    const tableNum = text.toLowerCase().replace('table', '').trim();
    session.tableNumber = tableNum;
    return `Perfect! Table ${tableNum} noted.\n\nType 'menu' to see our food, 'coffee' for drinks, or just tell me what you'd like!`;
  }

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
    
    orderSummary += `\nTotal: £${total}\n\nYour order is being prepared!\nReady in: 10-15 minutes\nWe'll bring it to Table ${session.tableNumber}\n\nThank you for choosing Brew Coffee Shop!`;
    
    session.cart = [];
    session.currentFlow = null;
    return orderSummary;
  }

  if (lowerText === 'coffee') {
    return `COFFEE & DRINKS MENU\n\n• Espresso - £3.00\n• Americano - £3.20\n• Flat White - £3.60\n• Latte - £3.70\n• Cappuccino - £3.80\n• Mocha - £4.20\n• Hot Chocolate - £4.00\n\nWe serve North Star Coffee from Leeds!\nPlant-based milk available.\n\nJust type the drink name you want!`;
  }

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

  if (lowerText.includes('menu')) {
    return `BREW COFFEE SHOP MENU\n\nCOFFEE & DRINKS:\n• Espresso - £3.00\n• Americano - £3.20\n• Flat White - £3.60\n• Latte - £3.70\n• Cappuccino - £3.80\n• Mocha - £4.20\n• Hot Chocolate - £4.00\n\nBREAKFAST:\n• Big Brew Breakfast - £14.00\n• Little Brew Breakfast - £8.50\n• Eggs Benedict - £10.00\n• Eggs Benedict with Bacon - £13.00\n• Eggs Benedict with Salmon - £14.00\n• Breakfast Sandwich - £10.00\n• Eggs on Toast - £6.50\n\nBRUNCH & MAINS:\n• Steak & Eggs - £17.50\n• Green Eggs - £11.00\n• French Toast - £12.00\n• Avocado Toast - £10.00\n\nSIDES:\n• Korean Hashbrown Bites - £6.75\n• Corn Ribs - £5.00\n• Halloumi & Berry Ketchup - £6.00\n\nJust type what you want!`;
  }

  return "Type 'menu' to see options, 'coffee' for drinks, or just tell me what you'd like!\n\n(e.g., 'latte', 'big breakfast')";
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
                                    <div class="item">
                                        <span>\${item.name}</span>
                                        <span>£\${item.price.toFixed(2)}</span>
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
