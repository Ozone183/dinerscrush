import { initializeApp } from 'firebase/app';
import { getFirestore, collection, addDoc, doc, setDoc } from 'firebase/firestore';
import { getAuth, createUserWithEmailAndPassword } from 'firebase/auth';

// Keep your existing Firebase config here
const firebaseConfig = {
  apiKey: "AIzaSyBBiAUhia89ERb39h68l-xZFiSNZxy-tP8",
  authDomain: "dinerscrush-8588e.firebaseapp.com",
  projectId: "dinerscrush-8588e",
  storageBucket: "dinerscrush-8588e.firebasestorage.app",
  messagingSenderId: "535629324020",
  appId: "1:535629324020:web:3b79295642ae33322608a1",
  measurementId: "G-06DMK03Z34"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

// Seed ONLY the new restaurants so you don’t duplicate Nabby’s / Urban Kitchen
const restaurants = [
  {
    name: "Metro Grill & Bar",
    email: "metro@dinerscrush.com",
    password: "Metro123456!",
    phone: "(815) 577-8191",
    cuisine: "Bar & Grill • American",
    address: "2019 Essington Rd, Joliet, IL 60435",
    description:
      "Metro Grill & Bar serving appetizers, salads, wraps, panini, tacos, sandwiches, burgers, broasted chicken, pasta, comfort food, and entrees.",
    menu: [
      // Appetizers
      { name: "Fried Parmesan Green Beans", price: 12.99, description: "", category: "Appetizers" },
      { name: "Mini Gyros", price: 14.99, description: "", category: "Appetizers" },
      { name: "Firecracker Cauliflower", price: 13.49, description: "", category: "Appetizers" },
      { name: "House Made Monster Meatball", price: 14.99, description: "", category: "Appetizers" },
      { name: "Cheese Curds", price: 12.99, description: "", category: "Appetizers" },
      { name: "Saganaki", price: 13.99, description: "", category: "Appetizers" },
      { name: "House Made Reuben Rolls", price: 13.99, description: "", category: "Appetizers" },
      { name: "Bacon Ranch Cheddar Fries", price: 11.99, description: "", category: "Appetizers" },

      // Salads
      { name: "Saganaki Greek Salad", price: 14.99, description: "", category: "Salads" },
      { name: "Strawberry Chicken Salad", price: 15.99, description: "", category: "Salads" },
      { name: "Chicken Chopped Cobb", price: 15.99, description: "", category: "Salads" },
      { name: "Southwest Chicken Salad", price: 15.99, description: "", category: "Salads" },

      // Wraps
      { name: "Buffalo Chicken Wrap", price: 15.99, description: "", category: "Wraps" },
      { name: "Raspberry Chicken Wrap", price: 15.99, description: "", category: "Wraps" },
      { name: "Malibu Turkey Wrap", price: 15.99, description: "", category: "Wraps" },
      { name: "Sierra Chicken Wrap", price: 15.99, description: "", category: "Wraps" },
      { name: "Chipotle Steak Wrap", price: 18.99, description: "", category: "Wraps" },

      // Panini
      { name: "Tennessee Panini", price: 15.49, description: "", category: "Panini" },
      { name: "Cheesesteak Panini", price: 16.99, description: "", category: "Panini" },
      { name: "Tuscan Panini", price: 15.49, description: "", category: "Panini" },
      { name: "Rancher's Panini", price: 16.99, description: "", category: "Panini" },
      { name: "Santorini Panini", price: 15.99, description: "", category: "Panini" },

      // Tacos
      { name: "Mango Mahi Tacos (3)", price: 15.99, description: "", category: "Tacos" },
      { name: "Fish N' Chippy Street Tacos (3)", price: 13.99, description: "", category: "Tacos" },
      { name: "Firecracker Cauliflower Tacos (3)", price: 13.99, description: "", category: "Tacos" },
      { name: "Brisket Tacos (3)", price: 15.99, description: "", category: "Tacos" },

      // Sandwiches
      { name: "Hot Honey Grilled Chicken Sandwich", price: 16.99, description: "", category: "Sandwiches" },
      { name: "Loaded Grilled Cheese", price: 13.99, description: "", category: "Sandwiches" },
      { name: "Poor Boy Steak Sandwich", price: 15.99, description: "", category: "Sandwiches" },
      { name: "Reuben", price: 15.99, description: "", category: "Sandwiches" },
      { name: "Corned Beef Sandwich", price: 13.99, description: "", category: "Sandwiches" },
      { name: "California Chicken Stacker", price: 15.99, description: "", category: "Sandwiches" },
      { name: "Sweet Baby Pulled Pork", price: 14.99, description: "", category: "Sandwiches" },
      { name: "Twisted Turkey", price: 16.99, description: "", category: "Sandwiches" },
      { name: "Savannah Chicken Salad", price: 14.99, description: "", category: "Sandwiches" },
      { name: "Loaded Meatloaf Sandwich", price: 16.99, description: "", category: "Sandwiches" },

      // Burgers
      { name: "Western Bacon Cheeseburger", price: 15.99, description: "", category: "Burgers" },
      { name: "Hot Mess Burger", price: 17.99, description: "", category: "Burgers" },
      { name: "Not Just A Cheeseburger", price: 13.99, description: "", category: "Burgers" },

      // Broasted Chicken
      { name: "2-Piece White Broasted Chicken", price: 12.49, description: "", category: "Broasted Chicken" },
      { name: "2-Piece Dark Broasted Chicken", price: 11.29, description: "", category: "Broasted Chicken" },
      { name: "4-Piece Mixed Broasted Chicken", price: 15.99, description: "", category: "Broasted Chicken" },
      { name: "4-Piece All White Broasted Chicken", price: 16.69, description: "", category: "Broasted Chicken" },
      { name: "4-Piece All Dark Broasted Chicken", price: 15.99, description: "", category: "Broasted Chicken" },
      { name: "Premium Jumbo Buffalo Wings", price: 11.99, description: "", category: "Broasted Chicken" },

      // Pasta
      { name: "Spaghetti Monster Meatball", price: 21.99, description: "", category: "Pasta" },
      { name: "Meat Sauce & Parmesan Only", price: 17.99, description: "", category: "Pasta" },
      { name: "Vodka Rigatoni with Chicken", price: 20.99, description: "", category: "Pasta" },
      { name: "Chicken Cavatappi Alfredo", price: 20.99, description: "", category: "Pasta" },

      // Comfort Food
      { name: "Brisket Mac & Cheese", price: 23.99, description: "", category: "Comfort Food" },
      { name: "Roast Turkey & Stuffing", price: 23.99, description: "", category: "Comfort Food" },
      { name: "Meatloaf & Corn Cakes", price: 23.99, description: "", category: "Comfort Food" },
      { name: "Fish & Chips", price: 18.99, description: "", category: "Comfort Food" },

      // Entrees
      { name: "Herb Crusted Chicken Breast", price: 20.99, description: "", category: "Entrees" },
      { name: "Argentinian Skirt Steak", price: 34.99, description: "", category: "Entrees" },
      { name: "Chimichurri Chicken", price: 19.99, description: "", category: "Entrees" },
      { name: "Wild Caught Salmon", price: 28.99, description: "", category: "Entrees" }
    ]
  },
  {
    name: "Michael's Pizza",
    email: "michaels@dinerscrush.com",
    password: "Michaels123456!",
    phone: "(815) 436-0707",
    cuisine: "Pizza • Italian • Sandwiches",
    address: "2405 Essington Rd, Joliet, IL 60435",
    description:
      "Family-owned Michael's Pizza serving specialty pizzas, stuffed pizzas, sandwiches, pastas, wings, salads, appetizers, and kids meals.",
    menu: [
      // Appetizers
      { name: "French Fries", price: 3.99, description: "", category: "Appetizers" },
      { name: "Nacho Cheese Fries", price: 4.49, description: "Served with a side of nacho cheese.", category: "Appetizers" },
      { name: "Mozzarella Sticks", price: 4.99, description: "6 sticks served with red sauce.", category: "Appetizers" },
      { name: "Dippin' Chicken Strips (5 pc)", price: 4.99, description: "", category: "Appetizers" },
      { name: "Dippin' Chicken Strips (10 pc)", price: 8.99, description: "", category: "Appetizers" },
      { name: "Dippin' Chicken Strips (20 pc)", price: 15.99, description: "", category: "Appetizers" },
      { name: "Garlic Bread", price: 2.99, description: "Cut into 6 pieces.", category: "Appetizers" },
      { name: "Garlic Bread with Cheese", price: 3.99, description: "Cut into 6 pieces.", category: "Appetizers" },
      { name: "Tomato Bread", price: 5.49, description: "Fresh tomato slices on garlic bread with melted mozzarella, cut into 4 pieces.", category: "Appetizers" },
      { name: "Tomato & Spinach Bread", price: 5.99, description: "Cut into 4 pieces.", category: "Appetizers" },
      { name: "Garlic Breadsticks (2 pc)", price: 2.99, description: "Served with red sauce.", category: "Appetizers" },
      { name: "Garlic Breadsticks (6 pc)", price: 6.99, description: "Served with red sauce.", category: "Appetizers" },
      { name: "Garlic Breadsticks (12 pc)", price: 12.99, description: "Served with red sauce.", category: "Appetizers" },
      { name: "Cheesy Breadsticks (2 pc)", price: 3.99, description: "Served with red sauce.", category: "Appetizers" },
      { name: "Cheesy Breadsticks (6 pc)", price: 8.99, description: "Served with red sauce.", category: "Appetizers" },
      { name: "Cheesy Breadsticks (12 pc)", price: 15.99, description: "Served with red sauce.", category: "Appetizers" },
      { name: "Breaded Mushrooms (1/2 lb.)", price: 5.49, description: "", category: "Appetizers" },
      { name: "Onion Rings (1/2 lb.)", price: 5.79, description: "", category: "Appetizers" },

      // Wings
      { name: "Traditional Wings (6 pc)", price: 9.99, description: "Sauces: Hot, Mild, BBQ, Calabrian Gold, Mango Habanero, or Parmesan Garlic.", category: "Wings" },
      { name: "Traditional Wings (10 pc)", price: 12.99, description: "Sauces: Hot, Mild, BBQ, Calabrian Gold, Mango Habanero, or Parmesan Garlic.", category: "Wings" },
      { name: "Boneless Wings (10 pc)", price: 7.99, description: "Sauces: Hot, Mild, BBQ, Calabrian Gold, Mango Habanero, or Parmesan Garlic.", category: "Wings" },
      { name: "Boneless Wings (20 pc)", price: 13.99, description: "Sauces: Hot, Mild, BBQ, Calabrian Gold, Mango Habanero, or Parmesan Garlic.", category: "Wings" },

      // Salads
      { name: "Garden Salad", price: 4.59, description: "Served with cucumber and tomatoes.", category: "Salads" },
      { name: "Garden Salad (Family Size)", price: 8.59, description: "Serves 4 and includes 4 dressings.", category: "Salads" },
      { name: "Caesar Salad", price: 4.99, description: "Romaine lettuce with croutons, parmesan cheese, and caesar dressing.", category: "Salads" },
      { name: "Caesar Salad (Family Size)", price: 8.99, description: "Serves 4 and includes 4 dressings.", category: "Salads" },

      // Sandwiches
      { name: "Italian Beef Bowl", price: 9.99, description: "Sliced Italian beef in au jus with melted mozzarella and choice of peppers. Low carb friendly.", category: "Sandwiches" },
      { name: "Chicken Breast Sandwich", price: 5.99, description: "Golden breaded chicken breast on a brioche bun with lettuce and mayo.", category: "Sandwiches" },
      { name: "Meatball Sandwich", price: 7.99, description: "Three homemade Italian meatballs with homemade pasta sauce on toasted garlic bread.", category: "Sandwiches" },
      { name: "Italian Beef Sandwich", price: 8.99, description: "Thinly sliced Italian beef with au jus on French bread.", category: "Sandwiches" },
      { name: "Beef & Cheese Sandwich", price: 9.99, description: "Italian beef covered with melted mozzarella.", category: "Sandwiches" },
      { name: "Chicken Parmesan Sandwich", price: 7.99, description: "Chicken breast on garlic bread topped with homemade pasta sauce, melted mozzarella, parmesan, and oregano.", category: "Sandwiches" },

      // Build Your Own Pizza
      { name: "Build Your Own Pizza (7\")", price: 6.75, description: "Deluxe cheese base. Add toppings $1.00 each. Double crust +$1.00. BBQ, extra virgin olive oil, or garlic sauce +$1.00.", category: "Build Your Own Pizza" },
      { name: "Build Your Own Pizza (12\")", price: 13.95, description: "Deluxe cheese base. Add toppings $2.25 each. Double crust +$2.25. BBQ, extra virgin olive oil, or garlic sauce +$2.25.", category: "Build Your Own Pizza" },
      { name: "Build Your Own Pizza (14\")", price: 15.95, description: "Deluxe cheese base. Add toppings $2.50 each. Double crust +$2.50. BBQ, extra virgin olive oil, or garlic sauce +$2.50.", category: "Build Your Own Pizza" },
      { name: "Build Your Own Pizza (16\")", price: 20.95, description: "Deluxe cheese base. Add toppings $2.75 each. Double crust +$2.75. BBQ, extra virgin olive oil, or garlic sauce +$2.75.", category: "Build Your Own Pizza" },
      { name: "Build Your Own Pizza (18\")", price: 22.95, description: "Deluxe cheese base. Add toppings $3.00 each. Double crust +$3.00. BBQ, extra virgin olive oil, or garlic sauce +$3.00.", category: "Build Your Own Pizza" },

      // Specialty Pizzas
      { name: "Chicago Fire (12\")", price: 21.95, description: "Italian beef, hot giardiniera, garlic, crushed red pepper, topped with mozzarella.", category: "Specialty Pizzas" },
      { name: "Chicago Fire (14\")", price: 24.95, description: "Italian beef, hot giardiniera, garlic, crushed red pepper, topped with mozzarella.", category: "Specialty Pizzas" },
      { name: "Chicago Fire (16\")", price: 29.95, description: "Italian beef, hot giardiniera, garlic, crushed red pepper, topped with mozzarella.", category: "Specialty Pizzas" },
      { name: "Chicago Fire (18\")", price: 32.95, description: "Italian beef, hot giardiniera, garlic, crushed red pepper, topped with mozzarella.", category: "Specialty Pizzas" },

      { name: "The Top 5 (12\")", price: 21.95, description: "Sausage, pepperoni, onion, green pepper, mushroom, topped with mozzarella.", category: "Specialty Pizzas" },
      { name: "The Top 5 (14\")", price: 24.95, description: "Sausage, pepperoni, onion, green pepper, mushroom, topped with mozzarella.", category: "Specialty Pizzas" },
      { name: "The Top 5 (16\")", price: 29.95, description: "Sausage, pepperoni, onion, green pepper, mushroom, topped with mozzarella.", category: "Specialty Pizzas" },
      { name: "The Top 5 (18\")", price: 32.95, description: "Sausage, pepperoni, onion, green pepper, mushroom, topped with mozzarella.", category: "Specialty Pizzas" },

      { name: "The Triple Double (12\")", price: 21.95, description: "Double crust, double sausage, topped with extra mozzarella.", category: "Specialty Pizzas" },
      { name: "The Triple Double (14\")", price: 24.95, description: "Double crust, double sausage, topped with extra mozzarella.", category: "Specialty Pizzas" },
      { name: "The Triple Double (16\")", price: 29.95, description: "Double crust, double sausage, topped with extra mozzarella.", category: "Specialty Pizzas" },
      { name: "The Triple Double (18\")", price: 32.95, description: "Double crust, double sausage, topped with extra mozzarella.", category: "Specialty Pizzas" },

      { name: "The Firestarter (12\")", price: 24.95, description: "BBQ sauce, chicken, jalapenos, mozzarella, topped with bacon.", category: "Specialty Pizzas" },
      { name: "The Firestarter (14\")", price: 27.95, description: "BBQ sauce, chicken, jalapenos, mozzarella, topped with bacon.", category: "Specialty Pizzas" },
      { name: "The Firestarter (16\")", price: 34.95, description: "BBQ sauce, chicken, jalapenos, mozzarella, topped with bacon.", category: "Specialty Pizzas" },
      { name: "The Firestarter (18\")", price: 37.95, description: "BBQ sauce, chicken, jalapenos, mozzarella, topped with bacon.", category: "Specialty Pizzas" },

      { name: "The Meat Max (12\")", price: 24.95, description: "Sausage, pepperoni, ham, extra mozzarella, topped with bacon.", category: "Specialty Pizzas" },
      { name: "The Meat Max (14\")", price: 27.95, description: "Sausage, pepperoni, ham, extra mozzarella, topped with bacon.", category: "Specialty Pizzas" },
      { name: "The Meat Max (16\")", price: 34.95, description: "Sausage, pepperoni, ham, extra mozzarella, topped with bacon.", category: "Specialty Pizzas" },
      { name: "The Meat Max (18\")", price: 37.95, description: "Sausage, pepperoni, ham, extra mozzarella, topped with bacon.", category: "Specialty Pizzas" },

      { name: "BBQ Special (12\")", price: 21.95, description: "Italian beef or chicken, BBQ sauce, topped with extra mozzarella.", category: "Specialty Pizzas" },
      { name: "BBQ Special (14\")", price: 24.95, description: "Italian beef or chicken, BBQ sauce, topped with extra mozzarella.", category: "Specialty Pizzas" },
      { name: "BBQ Special (16\")", price: 29.95, description: "Italian beef or chicken, BBQ sauce, topped with extra mozzarella.", category: "Specialty Pizzas" },
      { name: "BBQ Special (18\")", price: 32.95, description: "Italian beef or chicken, BBQ sauce, topped with extra mozzarella.", category: "Specialty Pizzas" },

      { name: "Taco Pizza (12\")", price: 24.95, description: "Taco sauce, seasoned ground beef, fresh tomato, jalapeno, topped with cheddar and mozzarella.", category: "Specialty Pizzas" },
      { name: "Taco Pizza (14\")", price: 27.95, description: "Taco sauce, seasoned ground beef, fresh tomato, jalapeno, topped with cheddar and mozzarella.", category: "Specialty Pizzas" },
      { name: "Taco Pizza (16\")", price: 34.95, description: "Taco sauce, seasoned ground beef, fresh tomato, jalapeno, topped with cheddar and mozzarella.", category: "Specialty Pizzas" },
      { name: "Taco Pizza (18\")", price: 37.95, description: "Taco sauce, seasoned ground beef, fresh tomato, jalapeno, topped with cheddar and mozzarella.", category: "Specialty Pizzas" },

      { name: "Tuscan Chicken (12\")", price: 24.95, description: "Extra virgin olive oil in place of pizza sauce, fresh spinach, tomato, chicken, garlic.", category: "Specialty Pizzas" },
      { name: "Tuscan Chicken (14\")", price: 27.95, description: "Extra virgin olive oil in place of pizza sauce, fresh spinach, tomato, chicken, garlic.", category: "Specialty Pizzas" },
      { name: "Tuscan Chicken (16\")", price: 34.95, description: "Extra virgin olive oil in place of pizza sauce, fresh spinach, tomato, chicken, garlic.", category: "Specialty Pizzas" },
      { name: "Tuscan Chicken (18\")", price: 37.95, description: "Extra virgin olive oil in place of pizza sauce, fresh spinach, tomato, chicken, garlic.", category: "Specialty Pizzas" },

      { name: "Vegetarian (12\")", price: 21.95, description: "Mushrooms, green pepper, onion, tomato, black olives, topped with mozzarella.", category: "Specialty Pizzas" },
      { name: "Vegetarian (14\")", price: 24.95, description: "Mushrooms, green pepper, onion, tomato, black olives, topped with mozzarella.", category: "Specialty Pizzas" },
      { name: "Vegetarian (16\")", price: 29.95, description: "Mushrooms, green pepper, onion, tomato, black olives, topped with mozzarella.", category: "Specialty Pizzas" },
      { name: "Vegetarian (18\")", price: 32.95, description: "Mushrooms, green pepper, onion, tomato, black olives, topped with mozzarella.", category: "Specialty Pizzas" },

      // Stuffed Pizzas
      { name: "Stuffed Deluxe Cheese Pizza (7\")", price: 9.95, description: "Thin crust in the bottom of a deep pan, filled with mozzarella, topped with another thin crust and pizza sauce. Allow up to 30 minutes for cooking.", category: "Stuffed Pizzas" },
      { name: "Stuffed Deluxe Cheese Pizza (12\")", price: 16.95, description: "Thin crust in the bottom of a deep pan, filled with mozzarella, topped with another thin crust and pizza sauce. Allow up to 30 minutes for cooking.", category: "Stuffed Pizzas" },
      { name: "Stuffed Deluxe Cheese Pizza (14\")", price: 18.95, description: "Thin crust in the bottom of a deep pan, filled with mozzarella, topped with another thin crust and pizza sauce. Allow up to 30 minutes for cooking.", category: "Stuffed Pizzas" },

      // Gluten Free
      { name: "Gluten Free Crust Pizza (10\")", price: 11.95, description: "Each topping $1.50.", category: "Gluten Free" },

      // Pastas
      { name: "Chicken Alfredo", price: 14.99, description: "Spaghetti with creamy alfredo and grilled chicken. Served with garlic bread or breadsticks.", category: "Pastas" },
      { name: "Baked Mostaccioli", price: 10.99, description: "Mostaccioli covered with homemade pasta sauce and baked with mozzarella. Served with garlic bread or breadsticks.", category: "Pastas" },
      { name: "Spaghetti & Meatballs", price: 11.99, description: "Classic spaghetti with homemade meatballs. Served with garlic bread or breadsticks.", category: "Pastas" },
      { name: "Spaghetti & Meatballs (Family Size)", price: 29.99, description: "Serves 4.", category: "Pastas" },
      { name: "Homemade Lasagna", price: 11.99, description: "From the family recipe, a favorite for years. Served with garlic bread or breadsticks.", category: "Pastas" },
      { name: "Chicken Parmigiana", price: 12.99, description: "Breaded chicken breast on a bed of spaghetti with homemade pasta sauce, melted mozzarella, parmesan, and oregano.", category: "Pastas" },
      { name: "Homemade Meatballs (2)", price: 3.99, description: "", category: "Pastas" },
      { name: "Homemade Meatballs (6)", price: 10.99, description: "", category: "Pastas" },

      // Kids Meals
      { name: "Mikey's Pizza Meal", price: 7.99, description: "7-inch mini cheese, sausage, or pepperoni pizza with a 100% juice box.", category: "Kids Meals" },
      { name: "Mikey's Dippin' Chicken Meal", price: 6.99, description: "4-piece dippin' chicken strips with your choice of sauce, small fries, and a 100% juice box.", category: "Kids Meals" },

      // Desserts
      { name: "Tiramisu", price: 5.99, description: "", category: "Desserts" },

      // Soft Drinks
      { name: "Canned Pop", price: 1.59, description: "", category: "Soft Drinks" },
      { name: "6-Pack", price: 4.99, description: "", category: "Soft Drinks" },
      { name: "2 Liter", price: 3.49, description: "Pepsi, Diet Pepsi, or Starry.", category: "Soft Drinks" },
      { name: "100% Juice Box", price: 1.00, description: "", category: "Soft Drinks" },
      { name: "Bottled Water", price: 1.00, description: "", category: "Soft Drinks" }
    ]
  }
];

async function seedDatabase() {
  console.log('🌱 Starting database seed...\n');

  for (const restaurant of restaurants) {
    try {
      console.log(`📝 Creating account for ${restaurant.name}...`);

      const userCredential = await createUserWithEmailAndPassword(
        auth,
        restaurant.email,
        restaurant.password
      );
      const userId = userCredential.user.uid;

      await setDoc(doc(db, 'users', userId), {
        name: restaurant.name,
        email: restaurant.email,
        phone: restaurant.phone,
        role: 'restaurant',
        cuisine: restaurant.cuisine,
        address: restaurant.address,
        description: restaurant.description,
        isActive: true,
        createdAt: new Date()
      });

      console.log(`✅ Created account for ${restaurant.name}`);

      console.log(`📝 Adding ${restaurant.menu.length} menu items for ${restaurant.name}...`);

      for (const item of restaurant.menu) {
        await addDoc(collection(db, 'menu'), {
          ...item,
          restaurantId: userId,
          createdAt: new Date()
        });
      }

      console.log(`✅ Added menu for ${restaurant.name}\n`);
    } catch (error) {
      console.error(`❌ Failed to seed ${restaurant.name}:`, error.message);
    }
  }

  console.log('\n🎉 Database seeding complete!');
  console.log('\n📋 Login Credentials:');
  restaurants.forEach((restaurant) => {
    console.log(`${restaurant.name}: ${restaurant.email} / ${restaurant.password}`);
  });
}

seedDatabase();

