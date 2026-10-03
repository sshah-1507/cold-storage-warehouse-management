require('dotenv').config();
const postgres = require('@prisma/orm-postgres/runtime').default || require('@prisma/orm-postgres/runtime');
const { Pool } = require('pg');
const contractJson = require('../prisma/contract.json');

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL environment variable is required');
}

// Prisma Client instance
const db = postgres({
  contractJson,
  url: process.env.DATABASE_URL,
});

// Direct PostgreSQL Pool for connect-pg-simple session store and raw maintenance if needed
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

module.exports = {
  db,
  pool,
};
