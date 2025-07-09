// inspect-database.js - See what's actually in your MongoDB
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });
const mongoose = require('mongoose');

async function inspectDatabase() {
  try {
    console.log('🔍 Inspecting MongoDB database...');
    
    // Debug environment
    console.log('🔑 MONGODB_URI:', process.env.MONGODB_URI ? '✅ Found' : '❌ Missing');
    
    if (!process.env.MONGODB_URI) {
      console.error('❌ MONGODB_URI not found in .env file');
      process.exit(1);
    }
    
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB');

    const db = mongoose.connection.db;
    
    // List all databases
    console.log('\n📋 All databases:');
    const admin = db.admin();
    const databases = await admin.listDatabases();
    databases.databases.forEach(database => {
      console.log(`   - ${database.name} (${database.sizeOnDisk} bytes)`);
    });

    // Check if nepal-auth database exists
    const nepalAuthDb = databases.databases.find(db => db.name === 'nepal-auth');
    if (nepalAuthDb) {
      console.log('\n🎯 Found nepal-auth database!');
      
      // List collections in nepal-auth
      const collections = await db.listCollections().toArray();
      console.log('\n📂 Collections in nepal-auth:');
      collections.forEach(collection => {
        console.log(`   - ${collection.name}`);
      });

      // Check users collection specifically
      const usersCollection = db.collection('users');
      
      // List indexes
      console.log('\n📋 Indexes in users collection:');
      try {
        const indexes = await usersCollection.indexes();
        indexes.forEach(index => {
          console.log(`   - ${JSON.stringify(index.key)} (${index.name})`);
        });
      } catch (error) {
        console.log('   No users collection found or no indexes');
      }

      // Count documents
      try {
        const userCount = await usersCollection.countDocuments();
        console.log(`\n👥 Users in collection: ${userCount}`);
        
        if (userCount > 0) {
          console.log('\n📄 Sample user documents:');
          const sampleUsers = await usersCollection.find({}).limit(3).toArray();
          sampleUsers.forEach((user, index) => {
            console.log(`   ${index + 1}. ${JSON.stringify(user, null, 2)}`);
          });
        }
      } catch (error) {
        console.log('   Could not count users');
      }

    } else {
      console.log('\n❌ nepal-auth database not found');
    }

  } catch (error) {
    console.error('❌ Inspection failed:', error.message);
  } finally {
    await mongoose.connection.close();
    console.log('\n🔌 Database connection closed');
    process.exit(0);
  }
}

// Run the inspection
inspectDatabase();