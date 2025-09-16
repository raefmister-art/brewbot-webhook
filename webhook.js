// webhook.js
const express = require('express');
const { MessagingResponse } = require('twilio').twiml;

const app = express();
app.use(express.urlencoded({ extended: false }));

// Store user sessions (use database in production)
const userSessions = {};

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

function processMessage(text, session) {
  const lowerText = text.toLowerCase();
  
  // Handle table number setup first
  if (!session.tableNumber) {
    // Check for greetings first - don't treat them as table numbers
    if (lowerText.includes('hi') || lowerText.includes('hello') || lowerText.includes('hey') || lowerText === 'help') {
      return "Hello! Welcome to Brew Coffee Shop! ☕\n\nFirst, what table are you sitting at? (e.g., 'Table 5' or just '5')";
    }
    
    // Check for greetings first - don't treat them as table numbers
    if (lowerText.includes('hi') || lowerText.includes('hello') || lowerText.includes('hey') || lowerText === 'help') {
      return "Hello! Welcome to Brew Coffee Shop! ☕\n\nFirst, what table are you sitting at? (e.g., 'Table 5' or just '5')";
    }
    
    const tableNum = text.toLowerCase().replace('table', '').trim();
    session.tableNumber = tableNum;
    return `Perfect! Table ${tableNum} noted.\n\nI'm here to help you with:\n\n🍳 View Menu - See today's food & drinks\n☕ Order Food/Coffee - Place your order now!\n🎂 Order Cake - Custom celebration cakes\n⏰ Opening Hours - When we're open\n📍 Location - How to find us\n🛒 My Order - Check your current order\n❓ Ask Questions - Vegan? Gluten-free? Just ask!\n\nJust type what you need!`;
  }

  // Greetings and help (after table is set)
  if (lowerText.includes('hi') || lowerText.includes('hello') || lowerText.includes('hey') || lowerText === 'help') {
    return "Hello! Great to see you!\n\nWhat can I help you with?\n\nOrder - Place a food/drink order\nMenu - View our full menu\nCoffee - See coffee options\nCart - Check your current order\nHours - Opening times\nLocation - Find us\n\nJust tell me what you need!";
  }

  // Greetings and help - Handle BEFORE menu item search
  if (lowerText.includes('hi') || lowerText.includes('hello') || lowerText.includes('hey') || lowerText === 'help') {
    return "Hello! Great to see you!\n\nWhat can I help you with?\n\nOrder - Place a food/drink order\nMenu - View our full menu\nCoffee - See coffee options\nCart - Check your current order\nHours - Opening times\nLocation - Find us\n\nJust tell me what you need!";
  }

  // Handle direct item ordering (when not in ordering flow)
  if (!session.currentFlow) {
    const foundItems = findMultipleMenuItems(text);
    if (foundItems) {
      if (foundItems.length === 1) {
        const foundItem = foundItems[0];
        if (foundItem.category === 'coffee') {
          session.currentFlow = 'ordering_coffee';
          session.orderData = { selectedDrink: foundItem.name, price: foundItem.price };
          return `${foundItem.name} - £${foundItem.price.toFixed(2)}\n\nMilk options:\n• Dairy milk (standard)\n• Oat milk\n• Almond milk\n• Soy milk\n\nWhat milk would you like?\n(Or just say 'dairy' for regular milk)`;
        } else {
          const result = addToCart(session, foundItem.name, foundItem.price, '', 'food');
          return result;
        }
      } else {
        // Multiple items found
        let response = `Found ${foundItems.length} items! Adding to your cart:\n\n`;
        let totalPrice = 0;
        let hasCoffee = false;
        
        foundItems.forEach((item, index) => {
          if (item.category === 'coffee') {
            // Add coffee with default dairy milk
            addToCart(session, item.name, item.price, '', 'coffee');
            hasCoffee = true;
          } else {
            addToCart(session, item.name, item.price, '', 'food');
          }
          response += `${index + 1}. ${item.name} - £${item.price.toFixed(2)}\n`;
          totalPrice += item.price;
        });
        
        response += `\nTotal added: £${totalPrice.toFixed(2)}`;
        
        if (hasCoffee) {
          response += `\n\nNote: Coffee items added with dairy milk (default). Type 'cart' to see your order or continue adding items!`;
        } else {
          response += `\n\nType 'cart' to see your full order or continue adding items!`;
        }
        // Multiple items found
        let response = `Great! Found ${foundItems.length} items! Adding to your cart:\n\n`;
        let totalPrice = 0;
        let hasCoffee = false;
        
        foundItems.forEach((item, index) => {
          if (item.category === 'coffee') {
            // Add coffee with default dairy milk
            addToCart(session, item.name, item.price, '', 'coffee');
            hasCoffee = true;
          } else {
            addToCart(session, item.name, item.price, '', 'food');
          }
          response += `${index + 1}. ${item.name} - £${item.price.toFixed(2)}\n`;
          totalPrice += item.price;
        });
        
        response += `\nTotal added: £${totalPrice.toFixed(2)}`;
        
        if (hasCoffee) {
          response += `\n\nNote: Coffee items added with dairy milk (default).\n\nKeep ordering:\n• Type more items\n• Type 'cart' to review\n• Type 'checkout' when done`;
        } else {
          response += `\n\nKeep ordering:\n• Type more items\n• Type 'cart' to review\n• Type 'checkout' when done`;
        }
        
        session.currentFlow = null;
        return response;
      }
    } else {
      return `Sorry, I couldn't find "${text}" on our menu.\n\nTry typing:\n• Specific item names (e.g., 'latte', 'breakfast sandwich')\n• Multiple items (e.g., 'latte and eggs benedict')\n• 'coffee' to see coffee options\n• 'menu' to see everything\n\nWhat would you like to order?`;
    }
  }

  // Also handle multiple items in ordering flow
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
    
    // Try to find multiple items
    const foundItems = findMultipleMenuItems(text);
    if (foundItems) {
      if (foundItems.length === 1) {
        const foundItem = foundItems[0];
        if (foundItem.category === 'coffee') {
          session.currentFlow = 'ordering_coffee';
          session.orderData = { selectedDrink: foundItem.name, price: foundItem.price };
          return `${foundItem.name} - £${foundItem.price.toFixed(2)}\n\nMilk options:\n• Dairy milk (standard)\n• Oat milk\n• Almond milk\n• Soy milk\n\nWhat milk would you like?\n(Or just say 'dairy' for regular milk)`;
        } else {
          const result = addToCart(session, foundItem.name, foundItem.price, '', 'food');
          session.currentFlow = null;
          return result + "\n\nExcellent choice!\n\nKeep ordering:\n• Type another item name\n• Type 'menu' or 'coffee' to browse\n• Type 'cart' to review\n• Type 'checkout' when done\n\nWhat else would you like?";
        }
        notes: '',
        quantity: 1,
        table: session.tableNumber
      };
      session.cart.push(cartItem);
      
      return `✅ Added to your order!\n\n${cartItem.name} - £${cartItem.price.toFixed(2)}\nTable: ${session.tableNumber}\n\nType 'cart' to see your full order or 'menu' to add more items!`;
    }
  }

  // Handle ongoing flows
  if (session.currentFlow === 'coffee_order') {
    if (session.orderData.selectedDrink && !session.orderData.hasOwnProperty('milkChoice')) {
      const milkChoice = text.toLowerCase().includes('dairy') ? 'Dairy milk' : text;
      const notes = milkChoice === 'Dairy milk' ? '' : `with ${milkChoice}`;
      
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
      
      return `✅ Added to your order!\n\n${cartItem.name} - £${cartItem.price.toFixed(2)}\nTable: ${session.tableNumber}\n${notes ? `Notes: ${notes}\n` : ''}\nType 'cart' to see your full order or 'menu' to add more items!\n\nPerfect choice!\n\nWant to add more?\n• Type 'coffee' for another drink\n• Type 'food' to add some food\n• Type 'cart' to see your order\n• Type 'checkout' when ready!\n\nWhat else can I get you?`;
    }
  }

  if (session.currentFlow === 'checkout') {
    const total = session.cart.reduce((sum, item) => sum + item.price, 0).toFixed(2);
    const orderNumber = Math.floor(Math.random() * 1000) + 100;
    
    let orderSummary = `🎉 ORDER PLACED SUCCESSFULLY!\n\nOrder #${orderNumber}\nTable: ${session.tableNumber}\nName: ${text}\n\nYOUR ORDER:\n`;
    
    session.cart.forEach((item, index) => {
      orderSummary += `${index + 1}. ${item.name} - £${item.price.toFixed(2)}\n`;
      if (item.notes) orderSummary += `   ${item.notes}\n`;
    });
    
    orderSummary += `\n💰 Total: £${total}\n\nNEXT STEPS:\n✅ Your order is being prepared\n⏰ Ready in: 10-15 minutes\n💳 Pay at collection or we'll bring it to your table\n🔔 We'll bring your order to Table ${session.tableNumber}!\n\nThank you for choosing Brew!`;
    
    session.cart = [];
    session.currentFlow = null;
    session.orderData = {};
    return orderSummary;
  }

  // Clear cart command
  if (lowerText.includes('clear cart') || lowerText.includes('empty cart')) {
    session.cart = [];
    return "🗑️ Cart cleared!\n\nReady to start fresh? Type 'order' or 'menu' to begin!";
  }
  
  // Cart/order management
  if (lowerText.includes('cart') || lowerText.includes('my order') || lowerText.includes('order status')) {
    if (session.cart.length === 0) {
      return "🛒 Your order is empty\n\nType 'menu' to see what's available or 'order' to start ordering!";
    }

    const total = session.cart.reduce((sum, item) => sum + item.price, 0).toFixed(2);
    let cartMessage = `🛒 YOUR ORDER - Table ${session.tableNumber}\n\n`;
    
    session.cart.forEach((item, index) => {
      cartMessage += `${index + 1}. ${item.name} - £${item.price.toFixed(2)}\n`;
      if (item.notes) cartMessage += `   Notes: ${item.notes}\n`;
    });
    
    cartMessage += `\n💰 Total: £${total}\n\nReady to order?\n• Type 'checkout' to place your order\n• Type 'clear cart' to start over\n• Type 'menu' to add more items`;
    
    return cartMessage;
  }
  
  if (lowerText.includes('checkout') || lowerText.includes('place order') || lowerText.includes('pay')) {
    if (session.cart.length === 0) {
      return "🛒 Your cart is empty!\n\nType 'menu' or 'order' to add some delicious items first!";
    }
    
    session.currentFlow = 'checkout';
    return "🏁 ALMOST READY!\n\nI just need a name for your order so our team knows who it's for!\n\nWhat name should we use?\n\n(e.g., 'Sarah' or 'Table 5')";
  }

  // Direct coffee ordering
  if (lowerText.includes('espresso')) {
    session.currentFlow = 'coffee_order';
    session.orderData = { selectedDrink: 'Espresso', price: 3.00 };
    return `☕ Espresso - £3.00\n\nMilk options:\n• Dairy milk (standard)\n• Oat milk\n• Almond milk\n• Soy milk\n\nWhat milk would you like?\n(Or just say 'dairy' for regular milk)`;
  }
  
  if (lowerText.includes('americano')) {
    session.currentFlow = 'coffee_order';
    session.orderData = { selectedDrink: 'Americano', price: 3.20 };
    return `☕ Americano - £3.20\n\nMilk options:\n• Dairy milk (standard)\n• Oat milk\n• Almond milk\n• Soy milk\n\nWhat milk would you like?\n(Or just say 'dairy' for regular milk)`;
  }
  
  if (lowerText.includes('latte')) {
    session.currentFlow = 'coffee_order';
    session.orderData = { selectedDrink: 'Latte', price: 3.70 };
    return `☕ Latte - £3.70\n\nMilk options:\n• Dairy milk (standard)\n• Oat milk\n• Almond milk\n• Soy milk\n\nWhat milk would you like?\n(Or just say 'dairy' for regular milk)`;
  }
  
  if (lowerText.includes('cappuccino')) {
    session.currentFlow = 'coffee_order';
    session.orderData = { selectedDrink: 'Cappuccino', price: 3.80 };
    return `☕ Cappuccino - £3.80\n\nMilk options:\n• Dairy milk (standard)\n• Oat milk\n• Almond milk\n• Soy milk\n\nWhat milk would you like?\n(Or just say 'dairy' for regular milk)`;
  }
  
  if (lowerText.includes('flat white')) {
    session.currentFlow = 'coffee_order';
    session.orderData = { selectedDrink: 'Flat White', price: 3.60 };
    return `☕ Flat White - £3.60\n\nMilk options:\n• Dairy milk (standard)\n• Oat milk\n• Almond milk\n• Soy milk\n\nWhat milk would you like?\n(Or just say 'dairy' for regular milk)`;
  }
  
  if (lowerText.includes('mocha')) {
    session.currentFlow = 'coffee_order';
    session.orderData = { selectedDrink: 'Mocha', price: 4.20 };
    return `☕ Mocha - £4.20\n\nMilk options:\n• Dairy milk (standard)\n• Oat milk\n• Almond milk\n• Soy milk\n\nWhat milk would you like?\n(Or just say 'dairy' for regular milk)`;
  }

  // Coffee ordering menu
  if ((lowerText.includes('order') && lowerText.includes('coffee')) || (lowerText.includes('coffee') && lowerText.includes('order'))) {
    return "☕ COFFEE ORDER\n\nPOPULAR DRINKS:\n\n1️⃣ Flat White - £3.60\n2️⃣ Latte - £3.70\n3️⃣ Cappuccino - £3.80\n4️⃣ Americano - £3.20\n5️⃣ Mocha - £4.20\n6️⃣ Hot Chocolate - £4.00\n7️⃣ Espresso - £3.00\n\nJust type the number or drink name!\n\nWe serve amazing North Star Coffee from Leeds!";
  }

  // Menu requests
  if (lowerText.includes('menu') || lowerText.includes('food') || lowerText.includes('breakfast') || lowerText.includes('brunch') || lowerText.includes('eat')) {
    return "🍳 TODAY'S FOOD MENU\n\n🥞 BREAKFAST FAVOURITES:\n• Big Brew Breakfast - £14\n  Full English with everything!\n• Little Brew Breakfast - £8.50\n  Perfect lighter option\n• Eggs Benedict - £10\n  (+bacon £13, +salmon £14)\n• Breakfast Sandwich - £10\n• Eggs on Toast - £6.50\n\n🥗 BRUNCH SPECIALS:\n• Steak & Eggs - £17.50\n• Green Eggs (healthy!) - £11\n• French Toast - £12\n• Avocado Toast - £10\n\n🔥 POPULAR SIDES:\n• Korean Hashbrown Bites - £6.75\n• Corn Ribs - £5\n• Halloumi & Berry Ketchup - £6\n\n🌱 Vegan & Gluten-Free options available!\n\nWant to see coffee prices or order something? Just ask!";
  }

  // Coffee menu (not ordering)
  if (lowerText.includes('coffee') && !lowerText.includes('order')) {
    return "☕ COFFEE & DRINKS MENU\n\nWe serve North Star Coffee from Leeds!\n\n☕ HOT COFFEE:\n• Espresso - £3.00\n• Americano - £3.20\n• Flat White - £3.60\n• Latte - £3.70\n• Cappuccino - £3.80\n• Mocha - £4.20\n\n🍵 TEA & OTHER DRINKS:\n• English Breakfast Tea - £3.00\n• Specialty Teas - £3.00\n• Hot Chocolate - £4.00\n• Iced Latte - £3.90\n• Fresh Juice - £3.50\n\nPlant-based milk available!\n\nReady to order? Just let me know!";
  }

  // Location & hours
  if (lowerText.includes('hours') || lowerText.includes('open') || lowerText.includes('location') || lowerText.includes('address') || lowerText.includes('where')) {
    return `📍 FIND BREW COFFEE SHOP\n\nAddress:\n12 Brock Street\nLancaster, LA1\n\n🕒 OPENING HOURS:\n• Monday-Friday: 8:30am - 4:00pm\n• Saturday: 9:00am - 4:00pm  \n• Sunday: 10:00am - 4:00pm\n\n🍳 Food served: 9:00am - 3:00pm daily\n\n🚗 HOW TO GET HERE:\n• 5 minutes walk from Lancaster Castle\n• Street parking on Brock Street\n• Car park: St. Nicholas Arcades (2 min walk)\n\n🚌 PUBLIC TRANSPORT:\n• Bus station: 8 minutes walk\n• Train station: 12 minutes walk`;
  }

  // Fallback
  return "I'd love to help!\n\nTry asking me about:\n\n🛒 Order - Place a food or drink order\n🍳 Menu - Today's food options\n☕ Coffee - Drink prices and ordering\n🛒 Cart - See your current order\n🎂 Cake - Custom celebration orders\n⏰ Hours - When we're open\n📍 Location - How to find us\n🌱 Vegan - Plant-based options\n🌾 Gluten-Free - GF choices\n🎓 Student - Discount information\n📶 WiFi - Internet access\n\nJust type what you're interested in!";
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
