import app from "./app.js";

const host = process.env.HOST || "0.0.0.0";
const port = Number(process.env.PORT || 8000);

app.listen(port, host, () => {
  console.log(`GoBeauté Inventory disponível em http://${host}:${port}`);
});
