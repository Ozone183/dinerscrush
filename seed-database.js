import { initializeApp } from 'firebase/app';
import { getFirestore, collection, addDoc, doc, setDoc } from 'firebase/firestore';
import { getAuth, createUserWithEmailAndPassword } from 'firebase/auth';

// Your Firebase config
const firebaseConfig = {
  apiKey: "AIzaSyBBiAUhia89ERb39h68l-xZFiSNZxy-tP8",
  authDomain: "dinerscrush-8588e.firebaseapp.com",
  projectId: "dinerscrush-8588e",
  storageBucket: "dinerscrush-8588e.firebasestorage.app",
  messagingSenderId: "535629324020",
  appId: "1:535629324020:web:3b79295642ae33322608a1"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

const restaurants = [
  {
    name: "Urban Kitchen Restaurant",
    email: "urban@dinerscrush.com",
    password: "urban123456",
    phone: "(815) 782-6417",
    cuisine: "American • Latin • Italian",
    address: "2424 Plainfield Rd, Crest Hill, IL 60403",
    description: "A modern American kitchen with Latin and Italian influences. Known for our burgers, tacos, and pasta dishes.",
    menu: [
      // Starters
      { name: "Nachos", price: 10.50, description: "Crispy corn tortilla chips, cheese, seasoned pinto beans, jalapeños, fresh pico de gallo, and sour cream.", category: "Starters" },
      { name: "Guacamole & Chips", price: 9.00, description: "Crispy corn tortillas, house made guacamole, house made salsa.", category: "Starters" },
      { name: "Wings (6)", price: 10.00, description: "Choose from Buffalo, BBQ, or Sweet Chili sauce. Served with celery and ranch or blue cheese.", category: "Starters" },
      // Salads
      { name: "Cobb Salad", price: 13.99, description: "Grilled chicken, chopped romaine, avocado, hard-boiled egg, grape tomatoes, applewood smoked bacon, blue cheese crumbles.", category: "Salads" },
      { name: "Caesar Salad", price: 12.50, description: "Grilled chicken, chopped romaine, croutons, parmesan cheese, tossed with caesar dressing.", category: "Salads" },
      // Burgers
      { name: "Cheeseburger", price: 13.99, description: "American cheese, tomato, lettuce, mayo, onions, house made pickles, brioche bun.", category: "Burgers" },
      { name: "Urban Style Burger", price: 14.99, description: "BBQ sauce, bacon, onion rings, lettuce, tomato, American cheese, fried egg, and mayo.", category: "Burgers" },
      // Latin Food
      { name: "Birria Queso Tacos", price: 13.99, description: "Three corn tortilla tacos filled with braised beef birria, mozzarella, and mild cheddar cheese. Served with beef consome.", category: "Latin Food" },
      { name: "Steak Tacos", price: 13.99, description: "Three steak tacos topped with onions and cilantro. Served with corn in a cup.", category: "Latin Food" },
      { name: "Burritos", price: 11.00, description: "Choose steak, chicken, birria, or chorizo. Large flour tortilla filled with cheese, lettuce, pico de gallo, sour cream, and beans.", category: "Latin Food" },
      // Entrees
      { name: "BBQ Ribs", price: 18.00, description: "Southern style served with Kansas style BBQ sauce.", category: "Entrees" },
      { name: "Rosemary Cream Pasta", price: 18.00, description: "Fusilli pasta, rosemary cream sauce, shrimp.", category: "Entrees" }
    ]
  },
  {
    name: "Nabby's Restaurant & Catering",
    email: "nabbys@dinerscrush.com",
    password: "nabbys123456",
    phone: "(815) 555-1234",
    cuisine: "American • Breakfast • Catering",
    address: "Crest Hill, IL",
    description: "Family-owned restaurant serving breakfast, lunch, and catering. Known for our Italian beef and hearty breakfasts.",
    menu: [
      // Breakfast
      { name: "Eggs with Bacon or Sausage", price: 9.25, description: "Includes two eggs any style, hash browns & toast.", category: "Breakfast" },
      { name: "Steak and Eggs", price: 18.99, description: "8 oz. N.Y. Steak with two eggs any style, hash browns & toast.", category: "Breakfast" },
      { name: "Corned Beef Hash & Eggs", price: 10.35, description: "Includes two eggs any style, hash browns & toast.", category: "Breakfast" },
      // Omelettes
      { name: "Meat Lovers Omelette", price: 12.40, description: "Three egg omelette with meat, hash browns & toast.", category: "Omelettes" },
      { name: "Denver Omelette", price: 10.40, description: "Three egg omelette with ham, peppers, onions, hash browns & toast.", category: "Omelettes" },
      { name: "Veggie Omelette", price: 10.40, description: "Mushroom, onions, green pepper and tomato. Served with hash browns & toast.", category: "Omelettes" },
      // Sandwiches
      { name: "Italian Beef", price: 7.99, description: "Thinly sliced beef in Italian gravy served on French bread.", category: "Sandwiches" },
      { name: "Combo Beef & Sausage", price: 10.50, description: "Italian beef and sausage on French bread.", category: "Sandwiches" },
      { name: "Gyros", price: 7.30, description: "Seasoned beef and lamb served with tzatziki sauce.", category: "Sandwiches" },
      { name: "Grilled Chicken Breast Sandwich", price: 7.99, description: "All white meat grilled to perfection, served with lettuce, tomato & mayo.", category: "Sandwiches" },
      // Sides
      { name: "French Fries", price: 3.45, description: "Crispy golden fries.", category: "Sides" },
      { name: "Onion Rings", price: 4.50, description: "Beer battered onion rings.", category: "Sides" }
    ]
  }
];

async function seedDatabase() {
  console.log('🌱 Starting database seed...\n');
  
  for (const restaurant of restaurants) {
    try {
      console.log(`📝 Creating account for ${restaurant.name}...`);
      
      // Create user account
      const userCredential = await createUserWithEmailAndPassword(auth, restaurant.email, restaurant.password);
      const userId = userCredential.user.uid;
      
      // Save restaurant data to users collection
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
      
      // Add menu items
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
  console.log('Urban Kitchen: urban@dinerscrush.com / urban123456');
  console.log('Nabby\'s: nabbys@dinerscrush.com / nabbys123456');
}

seedDatabase();
