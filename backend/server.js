const express = require("express");
const mysql = require("mysql2/promise");
const cors = require("cors");
const app = express();

app.use(cors());
app.use(express.json());

const db = mysql.createPool({
  host: "localhost",
  user: "root",
  password: "",
  database: "kopisrecords",
  port: 3306,
});

// GET ALL STOCK
app.get("/api/stock", async (req, res) => {
  try {
    const [rows] = await db.query("SELECT * FROM stock");
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// UPDATE SPECIFIC PRODUCT 
app.put("/api/stock/:id", async (req, res) => {
  const { id } = req.params;

  const {
    title,
    artist,
    price,
    genre,
    cover_image,
    description,
    medium,
    variant,
    released,
    barcode,
    stock
  } = req.body;

  try {
    const [result] = await db.query(
      `UPDATE stock SET 
        title = ?, 
        artist = ?, 
        price = ?, 
        genre = ?, 
        cover_image = ?, 
        description = ?, 
        medium = ?, 
        variant = ?, 
        released = ?, 
        barcode = ?, 
        stock = ?
      WHERE id = ?`,
      [
        title,
        artist,
        price,
        genre,
        cover_image,
        description,
        medium,
        variant,
        released,
        barcode,
        stock,
        id
      ]
    );

    res.json({ message: "Product updated successfully", result });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// CREATE NEW PRODUCT
app.post("/api/stock", async (req, res) => {
  const {
    title,
    artist,
    price,
    genre,
    cover_image,
    description,
    medium,
    variant,
    released,
    barcode,
    stock
  } = req.body;

  try {
    const [result] = await db.query(
      `INSERT INTO stock 
      (title, artist, price, genre, cover_image, description, medium, variant, released, barcode, stock)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        title,
        artist,
        price,
        genre,
        cover_image,
        description,
        medium,
        variant,
        released,
        barcode,
        stock
      ]
    );

    res.json({
      message: "Product created successfully",
      productId: result.insertId
    });

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE SPECIFIC PRODUCT
// DELETE PRODUCT BY ID
app.delete("/api/stock/:id", async (req, res) => {
  const { id } = req.params;

  try {
    const [result] = await db.query(
      "DELETE FROM stock WHERE id = ?",
      [id]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: "Product not found" });
    }

    res.json({ message: "Product deleted successfully" });

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.listen(3001, () => {
  console.log("API running on http://localhost:3001");
});

