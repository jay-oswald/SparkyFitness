const express = require('express');
const app = express();
const PORT = process.env.SPARKY_FITNESS_SERVER_PORT || 3010;

app.get('/test', (req, res) => {
  res.send('Minimal test route is working!');
});

app.listen(PORT, () => {
  console.log(`Minimal server listening on port ${PORT}`);
});