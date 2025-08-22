// MongoDB initialization script for production
// This script creates the application database and user

db = db.getSiblingDB('checkmate');

// Create application user with readWrite permissions
db.createUser({
  user: 'checkmate_app',
  pwd: process.env.MONGO_APP_PASSWORD || 'checkmate_password',
  roles: [
    {
      role: 'readWrite',
      db: 'checkmate'
    }
  ]
});

// Create indexes for better performance
db.createCollection('monitors');
db.monitors.createIndex({ userId: 1, isActive: 1 });
db.monitors.createIndex({ teamId: 1 });
db.monitors.createIndex({ createdAt: -1 });

db.createCollection('checks');
db.checks.createIndex({ monitorId: 1, createdAt: -1 });
db.checks.createIndex({ teamId: 1 });
db.checks.createIndex({ status: 1 });
db.checks.createIndex({ expiry: 1 }, { expireAfterSeconds: 0 });

db.createCollection('users');
db.users.createIndex({ email: 1 }, { unique: true });
db.users.createIndex({ teamId: 1 });

db.createCollection('notifications');
db.notifications.createIndex({ userId: 1 });
db.notifications.createIndex({ teamId: 1 });

print('Checkmate database initialized successfully');