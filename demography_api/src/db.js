const mysql = require('mysql2/promise');

const pool = mysql.createPool({
  host: process.env.DB_HOST || 'db',
  port: Number(process.env.DB_PORT) || 3306,
  user: process.env.DB_USER || 'census_app',
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME || 'census_demographics',
  waitForConnections: true,
  connectionLimit: 10,
});

/**
 * Runs `handler(conn)` on ONE connection checked out of the pool for the
 * duration of the call, with @current_user_id set on that connection
 * first. Required because the my_* views and the ownership triggers in
 * mysql/triggers/ownership_trigger.sql both read @current_user_id as
 * session state -- a plain pool.query() can silently land on a
 * different pooled connection than the one that set it.
 */
async function withUserConnection(userId, handler) {
  const conn = await pool.getConnection();
  try {
    await conn.query('SET @current_user_id = ?', [userId]);
    return await handler(conn);
  } finally {
    conn.release();
  }
}

module.exports = { pool, withUserConnection };
