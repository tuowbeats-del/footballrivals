const { PrismaClient } = require('@prisma/client');

// Single shared PrismaClient for the whole server (one connection pool).
const prisma = new PrismaClient();

module.exports = prisma;
