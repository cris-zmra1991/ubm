// src/lib/db.ts
import mysql from 'mysql2/promise';

// Lee la configuración de la base de datos desde variables de entorno
// Proporciona valores por defecto si las variables de entorno no están configuradas
const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'ubm_db',
  port: parseInt(process.env.DB_PORT || '3306', 10), // Puerto por defecto de MySQL es 3306
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
};

let pool: mysql.Pool;

try {
  pool = mysql.createPool(dbConfig);
  console.log("MySQL Connection Pool created successfully using config:", {
    host: dbConfig.host,
    user: dbConfig.user,
    database: dbConfig.database,
    port: dbConfig.port
  });

  // Opcional: Probar la conexión al iniciar
  // pool.getConnection()
  //   .then(connection => {
  //     console.log('Successfully connected to the database.');
  //     connection.release();
  //   })
  //   .catch(err => {
  //     console.error('Error connecting to the database:', err);
  //     // Considerar salir de la aplicación o manejar el error de forma adecuada si la conexión es crítica al inicio
  //   });

} catch (error) {
  console.error('Failed to create MySQL Connection Pool:', error);
  // Manejar el error de creación del pool, quizás la aplicación no pueda continuar.
  // En un entorno de producción, esto debería ser monitoreado y alertado.
  // process.exit(1); // Ejemplo drástico: salir si no se puede crear el pool.
}


// Exporta el pool para que pueda ser usado en las Server Actions
// Asegúrate de que `pool` esté definido antes de exportarlo, incluso si la conexión falla.
// El try/catch arriba maneja la creación del pool. Si falla, `pool` podría ser undefined.
// Las actions necesitarán manejar la posibilidad de que `pool` no esté disponible.
export { pool };
