import { openDatabase, enablePromise, SQLiteDatabase } from 'react-native-sqlite-storage';

enablePromise(true);

const databaseName = "ContinuityCalcDB.db";
const databaseVersion = "1.0";
const databaseDisplayName = "Calculadora de Continuidad Database";
const databaseSize = 200000;

export const getDBConnection = async (): Promise<SQLiteDatabase> => {
  return openDatabase({
    name: databaseName,
    location: 'default',
  });
};

export const createTable = async (db: SQLiteDatabase) => {
  const query = `
    CREATE TABLE IF NOT EXISTS history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      calculation_type TEXT NOT NULL,
      inputs TEXT NOT NULL,
      result TEXT NOT NULL,
      timestamp REAL NOT NULL
    );
  `;
  await db.executeSql(query);
};

export const saveCalculation = async (
  db: SQLiteDatabase,
  calculation_type: string,
  inputs: string,
  result: string
) => {
  const query = `
    INSERT INTO history (calculation_type, inputs, result, timestamp)
    VALUES (?, ?, ?, ?);
  `;
  const values = [calculation_type, inputs, result, Date.now()];
  await db.executeSql(query, values);
};

export const getHistory = async (db: SQLiteDatabase) => {
  const query = `SELECT * FROM history ORDER BY timestamp DESC;`;
  const [result] = await db.executeSql(query);
  const historyItems: any[] = [];
  for (let i = 0; i < result.rows.length; i++) {
    historyItems.push(result.rows.item(i));
  }
  return historyItems;
};

// Versión corregida:
export const deleteHistory = async (
  db: SQLiteDatabase, 
  id: number, 
  calculationType?: string  // Nuevo parámetro opcional
): Promise<void> => {
  if (id === -1) {
    if (calculationType) {
      // Eliminar solo los registros de un tipo específico
      await db.executeSql('DELETE FROM history WHERE calculation_type LIKE ?;', [`${calculationType}%`]);
    } else {
      // Eliminar todo el historial (para compatibilidad hacia atrás)
      await db.executeSql('DELETE FROM history;');
    }
  } else {
    // Eliminar un elemento específico
    await db.executeSql('DELETE FROM history WHERE id = ?;', [id]);
  }
};

// ===================== FAVORITES (NUEVO) =====================

export type Favorite = {
  id?: number;
  route: string;   // e.g. 'ContinuidadCalc'
  label: string;   // e.g. 'Calculadora de Continuidad'
  created_at?: number;
};

/**
 * Crea la tabla de favoritos sin alterar la lógica existente.
 * - route es UNIQUE para evitar duplicados.
 */
export const createFavoritesTable = async (db: SQLiteDatabase) => {
  // Tabla
  await db.executeSql(`
    CREATE TABLE IF NOT EXISTS favorites (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      route TEXT NOT NULL UNIQUE,
      label TEXT NOT NULL,
      created_at REAL NOT NULL
    );
  `);

  // Índice por route para lookups O(1)
  await db.executeSql(`
    CREATE UNIQUE INDEX IF NOT EXISTS idx_favorites_route ON favorites(route);
  `);
};

/**
 * Agrega (o reemplaza) un favorito.
 */
export const addFavorite = async (db: SQLiteDatabase, fav: Favorite) => {
  await createFavoritesTable(db); // Garantiza existencia sin tocar historia
  await db.executeSql(
    `INSERT OR REPLACE INTO favorites (route, label, created_at) VALUES (?, ?, ?);`,
    [fav.route, fav.label, fav.created_at ?? Date.now()]
  );
};

/**
 * Elimina un favorito por route.
 */
export const removeFavorite = async (db: SQLiteDatabase, route: string) => {
  await createFavoritesTable(db);
  await db.executeSql(`DELETE FROM favorites WHERE route = ?;`, [route]);
};

/**
 * ¿Existe como favorito?
 */
export const isFavorite = async (db: SQLiteDatabase, route: string): Promise<boolean> => {
  await createFavoritesTable(db);
  const [res] = await db.executeSql(`SELECT 1 FROM favorites WHERE route = ? LIMIT 1;`, [route]);
  return res.rows.length > 0;
};

/**
 * Lista completa de favoritos (más recientes primero).
 */
export const getFavorites = async (db: SQLiteDatabase): Promise<Favorite[]> => {
  await createFavoritesTable(db);
  const [res] = await db.executeSql(
    `SELECT id, route, label, created_at FROM favorites ORDER BY created_at DESC;`
  );
  const out: Favorite[] = [];
  for (let i = 0; i < res.rows.length; i++) {
    out.push(res.rows.item(i));
  }
  return out;
};