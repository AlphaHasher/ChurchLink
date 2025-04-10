// Switch to SSBC_DB database
db = db.getSiblingDB('SSBC_DB');

// Drop all indexes on events collection
db.events.dropIndexes();

// Create new index on ministry field
db.events.createIndex({ ministry: 1 }, { unique: true, name: "unique_ministry_index" });
