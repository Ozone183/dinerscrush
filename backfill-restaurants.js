import { initializeApp } from 'firebase/app';
import { getFirestore, collection, doc, getDocs, query, setDoc, where } from 'firebase/firestore';

// Use the SAME Firebase config from your existing seed file
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

const restaurantsToBackfill = [
  {
    email: "metro@dinerscrush.com",
    name: "Metro Grill & Bar",
    phone: "(815) 577-8191",
    cuisine: "Bar & Grill • American",
    address: "2019 Essington Rd, Joliet, IL 60435",
    description:
      "Metro Grill & Bar serving appetizers, salads, wraps, panini, tacos, sandwiches, burgers, broasted chicken, pasta, comfort food, and entrees."
  },
  {
    email: "michaels@dinerscrush.com",
    name: "Michael's Pizza",
    phone: "(815) 436-0707",
    cuisine: "Pizza • Italian • Sandwiches",
    address: "2405 Essington Rd, Joliet, IL 60435",
    description:
      "Family-owned Michael's Pizza serving specialty pizzas, stuffed pizzas, sandwiches, pastas, wings, salads, appetizers, and kids meals."
  },
  {
    email: "nabbys@dinerscrush.com",
    name: "Nabby's Restaurant & Catering",
    phone: "(815) 436-7502",
    cuisine: "American • Breakfast • Catering",
    address: "14802 Michigan St, Plainfield, IL 60544",
    description:
      "Family-owned restaurant serving breakfast, lunch, and catering. Known for hearty breakfasts, sandwiches, and catering."
  }
];

async function backfillRestaurants() {
  console.log('🔧 Backfilling restaurants collection...\n');

  for (const restaurant of restaurantsToBackfill) {
    try {
      const usersSnap = await getDocs(
        query(collection(db, 'users'), where('email', '==', restaurant.email))
      );

      if (usersSnap.empty) {
        console.log(`❌ No user found for ${restaurant.name} (${restaurant.email})`);
        continue;
      }

      const userDoc = usersSnap.docs[0];
      const userId = userDoc.id;

      await setDoc(
        doc(db, 'restaurants', userId),
        {
          name: restaurant.name,
          restaurantName: restaurant.name,
          phone: restaurant.phone,
          address: restaurant.address,
          cuisine: restaurant.cuisine,
          description: restaurant.description,

          ownerId: userId,
          ownerUid: userId,
          userId: userId,
          authUid: userId,
          restaurantId: userId,
          restaurantUserId: userId,

          isActive: true,
          createdAt: new Date(),
          updatedAt: new Date()
        },
        { merge: true }
      );

      console.log(`✅ Backfilled restaurants/${userId} for ${restaurant.name}`);
    } catch (error) {
      console.error(`❌ Failed for ${restaurant.name}:`, error.message);
    }
  }

  console.log('\n🎉 Restaurant backfill complete.');
}

backfillRestaurants();

