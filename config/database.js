require('dotenv').config();

module.exports = {
  development: {
    username: process.env.DB_USER     || 'root',
    password: process.env.DB_PASSWORD || null,
    database: process.env.DB_NAME     || 'partywall',
    host:     process.env.DB_HOST     || '127.0.0.1',
    port:     parseInt(process.env.DB_PORT) || 3306,
    dialect:  'mysql',
    logging:  false,
  },
  production: {
    username: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    host:     process.env.DB_HOST,
    port:     parseInt(process.env.DB_PORT) || 3306,
    dialect:  'mysql',
    logging:  false,
    pool: { max: 10, min: 0, acquire: 30000, idle: 10000 },
  },
};
