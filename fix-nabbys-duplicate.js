import { initializeApp } from 'firebase/app';
import {
  getFirestore,
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  where,
  setDoc,
  deleteDoc
} from 'firebase/firestore';

// USE THE SAME FIREBASE CONFIG FROM YOUR WORKING SEED FILE
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

const TARGET_EMAIL = 'nabbys@dinerscrush.com';

const CORRECT_NABBYS_DATA = {
  name: "Nabby's Restaurant & Catering",
  restaurantName: "Nabby's Restaurant & Catering",
  phone: "(815) 436-7502",
  address: "14802 Michigan St, Plainfield, IL 60544",
  cuisine: "American • Breakfast • Catering",
  description:
    "Family-owned restaurant serving breakfast, lunch, and catering. Known for hearty breakfasts, sandwiches, and catering.",
  isActive: true
};

const normalize = (value) => (value || '').toString().trim().toLowerCase();

async function countMenuDocsForRestaurantId(restaurantId) {
  const legacySnap = await getDocs(
    query(collection(db, 'menu'), where('restaurantId', '==', restaurantId))
  );

  const menuItemsSnap = await getDocs(
    query(collection(db, 'menuItems'), where('restaurantId', '==', restaurantId))
  );

  return {
    legacyCount: legacySnap.size,
    menuItemsCount: menuItemsSnap.size,
    total: legacySnap.size + menuItemsSnap.size
  };
}

async function fixNabbysDuplicate() {
  console.log('\n🔎 Looking for Nabby’s user...');

  const usersSnap = await getDocs(
    query(collection(db, 'users'), where('email', '==', TARGET_EMAIL))
  );

  if (usersSnap.empty) {
    throw new Error(`No user found with email ${TARGET_EMAIL}`);
  }

  const nabbysUserDoc = usersSnap.docs[0];
  const nabbysUid = nabbysUserDoc.id;
  const nabbysUserData = nabbysUserDoc.data();

  console.log(`✅ Found Nabby’s user UID: ${nabbysUid}`);

  console.log('\n🔎 Looking for Nabby’s restaurant docs...');
  const restaurantsSnap = await getDocs(collection(db, 'restaurants'));

  const candidates = restaurantsSnap.docs.filter((restaurantDoc) => {
    const data = restaurantDoc.data();
    const name = normalize(data.name || data.restaurantName);
    return (
      restaurantDoc.id === nabbysUid ||
      name.includes('nabby')
    );
  });

  if (candidates.length === 0) {
    console.log('⚠️ No Nabby’s restaurant docs found. Creating one at the user UID...');
    await setDoc(
      doc(db, 'restaurants', nabbysUid),
      {
        ...CORRECT_NABBYS_DATA,
        ownerId: nabbysUid,
        ownerUid: nabbysUid,
        userId: nabbysUid,
        authUid: nabbysUid,
        restaurantId: nabbysUid,
        restaurantUserId: nabbysUid,
        createdAt: new Date(),
        updatedAt: new Date()
      },
      { merge: true }
    );

    await setDoc(
      doc(db, 'users', nabbysUid),
      {
        ...nabbysUserData,
        name: CORRECT_NABBYS_DATA.name,
        phone: CORRECT_NABBYS_DATA.phone,
        address: CORRECT_NABBYS_DATA.address,
        cuisine: CORRECT_NABBYS_DATA.cuisine,
        description: CORRECT_NABBYS_DATA.description,
        restaurantId: nabbysUid,
        updatedAt: new Date()
      },
      { merge: true }
    );

    console.log('✅ Created clean Nabby’s restaurant doc.');
    return;
  }

  console.log(`✅ Found ${candidates.length} Nabby’s restaurant doc(s)`);

  const scoredCandidates = [];
  for (const candidate of candidates) {
    const counts = await countMenuDocsForRestaurantId(candidate.id);
    scoredCandidates.push({
      id: candidate.id,
      data: candidate.data(),
      ...counts
    });
  }

  scoredCandidates.sort((a, b) => b.total - a.total);

  const primary = scoredCandidates[0];
  const duplicates = scoredCandidates.slice(1);

  console.log('\n📌 Keeping this Nabby’s doc as primary:');
  console.log(`   Doc ID: ${primary.id}`);
  console.log(`   Legacy menu count: ${primary.legacyCount}`);
  console.log(`   menuItems count: ${primary.menuItemsCount}`);
  console.log(`   Total menu docs: ${primary.total}`);

  // Patch USERS doc
  await setDoc(
    doc(db, 'users', nabbysUid),
    {
      ...nabbysUserData,
      name: CORRECT_NABBYS_DATA.name,
      phone: CORRECT_NABBYS_DATA.phone,
      address: CORRECT_NABBYS_DATA.address,
      cuisine: CORRECT_NABBYS_DATA.cuisine,
      description: CORRECT_NABBYS_DATA.description,
      restaurantId: primary.id,
      updatedAt: new Date()
    },
    { merge: true }
  );

  // Patch PRIMARY RESTAURANTS doc
  const primaryRef = doc(db, 'restaurants', primary.id);
  const primarySnap = await getDoc(primaryRef);
  const primaryData = primarySnap.exists() ? primarySnap.data() : {};

  await setDoc(
    primaryRef,
    {
      ...primaryData,
      ...CORRECT_NABBYS_DATA,
      ownerId: nabbysUid,
      ownerUid: nabbysUid,
      userId: nabbysUid,
      authUid: nabbysUid,
      restaurantId: nabbysUid,
      restaurantUserId: nabbysUid,
      updatedAt: new Date()
    },
    { merge: true }
  );

  console.log('✅ Patched primary Nabby’s restaurant doc with correct address/phone.');

  // Backup + delete duplicate restaurant docs
  for (const dup of duplicates) {
    console.log(`\n🗂 Backing up duplicate doc ${dup.id}...`);

    await setDoc(doc(db, 'restaurants_backup', dup.id), {
      ...dup.data,
      originalRestaurantDocId: dup.id,
      backupReason: "duplicate_nabbys_cleanup",
      keptRestaurantDocId: primary.id,
      backedUpAt: new Date()
    });

    console.log(`🗑 Deleting duplicate restaurants/${dup.id} ...`);
    await deleteDoc(doc(db, 'restaurants', dup.id));
  }

  console.log('\n🎉 Nabby’s duplicate fix complete.');
  console.log(`✅ Active Nabby’s restaurant doc: restaurants/${primary.id}`);
  console.log(`✅ Nabby’s user doc patched: users/${nabbysUid}`);
  if (duplicates.length > 0) {
    console.log(`✅ ${duplicates.length} duplicate restaurant doc(s) backed up to restaurants_backup and removed from restaurants`);
  } else {
    console.log('✅ No duplicate restaurant docs needed removal');
  }
}

fixNabbysDuplicate().catch((error) => {
  console.error('\n❌ Failed to fix Nabby’s:', error.message);
});

