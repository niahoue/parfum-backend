
import app  from './App.js'
import connectDB from './config/db.js';


const PORT = process.env.PORT || 5000;

connectDB();




app.listen(
  PORT,
  console.log(`Serveur en cours d'exécution sur le port ${PORT} en mode ${process.env.NODE_ENV}`)
);