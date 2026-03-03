const express = require('express');
const fs = require('fs');
const path = require('path');
const hbs = require('hbs');
const MySQL = require('./utilsMySQL');

const app = express();
const port = 3000;

// Detectar si estem al Proxmox (si és pm2)
const isProxmox = !!process.env.PM2_HOME;

// Iniciar connexió MySQL
const db = new MySQL();
if (!isProxmox) {
  db.init({
    host: '127.0.0.1',
    port: 3306,
    user: 'root',
    password: 'P@ssw0rd',
    database: 'sakila'
  });
} else {
  db.init({
    host: '127.0.0.1',
    port: 3306,
    user: 'super',
    password: '1234',
    database: 'sakila'
  });
}

// Static files - ONLY ONCE
app.use(express.static('public'))
app.use(express.urlencoded({ extended: true }))

// Disable cache
app.use((req, res, next) => {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  res.setHeader('Surrogate-Control', 'no-store');
  next();
});

// Handlebars
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'hbs');

// Registrar "Helpers .hbs" aquí
hbs.registerHelper('eq', (a, b) => a == b);
hbs.registerHelper('gt', (a, b) => a > b);

// Partials de Handlebars
hbs.registerPartials(path.join(__dirname, 'views', 'partials'));

// Route
app.get('/', async (req, res) => {
  try {
    const moviesRows = await db.query(`
      SELECT f.title as nom, f.release_year as any, GROUP_CONCAT(a.first_name, ' ', a.last_name SEPARATOR ', ') as actors
      FROM film f
      JOIN film_actor fa ON f.film_id = fa.film_id
      JOIN actor a ON fa.actor_id = a.actor_id
      GROUP BY f.film_id LIMIT 5`);
    const categoriesRows = await db.query('SELECT name as nom FROM category LIMIT 5');
    
    // Transformar les dades a JSON (per les plantilles .hbs)
    // Cal informar de les columnes i els seus tipus
    const moviesJson = db.table_to_json(moviesRows, { 
      nom: 'string', 
      any: 'number', 
      actors: 'string' 
    });
    const categoriesJson = db.table_to_json(categoriesRows, { 
      nom: 'string' 
    });

    // Llegir l'arxiu .json amb dades comunes per a totes les pàgines
    const commonData = JSON.parse(
      fs.readFileSync(path.join(__dirname, 'data', 'common.json'), 'utf8')
    );

    // Construir l'objecte de dades per a la plantilla
    const data = {
      movies: moviesJson,
      categories: categoriesJson,
      common: commonData
    };

    // Renderitzar la plantilla amb les dades
    res.render('index', data);
  } catch (err) {
    console.error(err);
    res.status(500).send('Error consultant la base de dades');
  }
});

app.get('/movies', async (req, res) => {
  try {

    // Obtenir les dades de la base de dades
    const moviesRows = await db.query(`
      SELECT f.title, f.description, f.release_year, GROUP_CONCAT(a.first_name, ' ', a.last_name SEPARATOR ', ') AS actors
      FROM film f
      LEFT JOIN film_actor fa ON f.film_id = fa.film_id
      LEFT JOIN actor a ON fa.actor_id = a.actor_id
      GROUP BY f.film_id
      LIMIT 15`);

    // Transformar les dades a JSON (per les plantilles .hbs)
    const moviesJson = db.table_to_json(moviesRows, {
      title: 'string',
      description: 'string',
      release_year: 'number',
      actors: 'string'
    });

    // Llegir l'arxiu .json amb dades comunes per a totes les pàgines
    const commonData = JSON.parse(
      fs.readFileSync(path.join(__dirname, 'data', 'common.json'), 'utf8')
    );

    // Construir l'objecte de dades per a la plantilla
    const data = {
      movies: moviesJson,
      common: commonData
    };

    // Renderitzar la plantilla amb les dades
    res.render('movies', data);
  } catch (err) {
    console.error(err);
    res.status(500).send('Error consultant la base de dades');
  }
});

app.get('/customers', async (req, res) => {
  try {

    // Obtenir les dades de la base de dades
    const customerRows = await db.query(`
      SELECT c.first_name, c.last_name, c.email, GROUP_CONCAT(f.title SEPARATOR ' || ') as lloguers
      FROM customer c
      LEFT JOIN rental r ON c.customer_id = r.customer_id
      LEFT JOIN inventory i ON r.inventory_id = i.inventory_id
      LEFT JOIN film f ON i.film_id = f.film_id
      GROUP BY c.customer_id
      LIMIT 25`);

    // Transformar les dades a JSON (per les plantilles .hbs)
    const customersJson = db.table_to_json(customerRows, {
      first_name: 'string',
      last_name: 'string',
      email: 'string',
      lloguers: 'string'
    });

    // Llegir l'arxiu .json amb dades comunes per a totes les pàgines
    const commonData = JSON.parse(
      fs.readFileSync(path.join(__dirname, 'data', 'common.json'), 'utf8')
    );

    // Construir l'objecte de dades per a la plantilla
    const data = {
      customers: customersJson,
      common: commonData
    };

    // Renderitzar la plantilla amb les dades
    res.render('customers', data);
  } catch (err) {
    console.error(err);
    res.status(500).send('Error consultant la base de dades');
  }
});

// Start server
const httpServer = app.listen(port, () => {
  console.log(`http://localhost:${port}`);
  console.log(`http://localhost:${port}/movies`);
  console.log(`http://localhost:${port}/customers`);
});

// Graceful shutdown
process.on('SIGINT', async () => {
  await db.end();
  httpServer.close();
  process.exit(0);
});