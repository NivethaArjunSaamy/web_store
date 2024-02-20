const express = require("express");
const path = require("path");
const mysql = require("mysql2");
const { Client } = require("@elastic/elasticsearch");
const { log } = require("console");
const app = express();

// Connect to Elasticsearch
const esClient = new Client({
  node: "http://elasticsearch:9201", // Use service name defined in Docker Compose
});

// Connect to MySQL database
const db = mysql.createConnection({
  host: "sql6.freesqldatabase.com",
  user: "sql6685236",
  password: "T9UU5SgmDh",
  database: "sql6685236",
});

db.connect((err) => {
  if (err) {
    console.error("Error connecting to MySQL:", err);
  } else {
    console.log("Connected to MySQL database");
    // query="select * from"
  }
});

// Routes
app.get("/home", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "category.html"));
});

app.get("/category/data", (req, res) => {
  db.query("SELECT * FROM category", (err, results) => {
    if (err) {
      console.error("Error executing query:", err);
      res.status(500).json({ error: "Internal Server Error" });
      return;
    }
    res.json(results);
  });
});

app.get("/category", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "product.html"));
});

app.get("/category/category_name", (req, res) => {
  var category_id = req.query.category_id;
  const page = parseInt(req.query.page, 10) || 1;
  const limit = 10;
  var startIndex = (page - 1) * limit;
  var endIndex = page * limit;

  db.query(
    "SELECT * FROM product WHERE category_id = ? ORDER BY product_id",
    [category_id],
    (err, data) => {
      var results = {};
      if (err) {
        console.error("Error executing query:", err);
        res.status(500).json({ error: "Internal Server Error" });
        return;
      }
      if (endIndex >= data.length) {
        endIndex = data.length;
      }
      if (endIndex <= data.length) {
        if (startIndex > 0) results.prev = page - 1;
        if (endIndex < data.length) results.next = page + 1;
      }
      results.len = Math.ceil(data.length / 10);
      results.results = data.slice(startIndex, endIndex);
      res.json(results);
    }
  );
});

app.get("/all-products", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "all-products.html"));
});

app.get("/all-products/data", (req, res) => {
  try {
    const page = parseInt(req.query.page, 10) || 1;
    var startIndex = (page - 1) * 10;
    var endIndex = page * 10;

    db.query("SELECT * FROM product", (err, data) => {
      var results = {};
      if (err) {
        console.error("Error executing query:", err);
        res.status(500).json({ error: "Internal Server Error" });
        return;
      }
      if (endIndex >= data.length) {
        endIndex = data.length;
      }
      if (endIndex <= data.length) {
        if (startIndex >= 0) results.prev = page - 1;
        if (endIndex < data.length) results.next = page + 1;
      }
      const uniqueCategories = [
        ...new Set(data.map((data) => data.category_id)),
      ];
      results.uniqueCategories = uniqueCategories;
      results.len = Math.ceil(data.length / 10);
      results.results = data.slice(startIndex, endIndex);
      res.json(results);
    });
  } catch (err) {
    console.error("Error in /all-products route:", err);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

app.get("/results", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "search.html"));
});

app.get("/results/data", async (req, res) => {
  var query = req.query.query;
  
  var down = ["under", "below", "less", "within", "down", "lesser", "in", "@"];
  var up = ["over", "above", "greater", "up"];
  var extra = [
    ",",
    ".",
    "/",
    ":",
    "[",
    "]",
    "rs",
    "Rs",
    "amt",
    "Amt",
    "+",
    "than",
  ];

  var string = query.split(" ");
  var cur, sort;

  extra.forEach((val) => {
    if (query.includes(val)) {
      query = query.replace(val, "");
    }
  });

  string.forEach((val) => {
    if (down.includes(val)) {
      cur = val;
      sort = "lte";
      return;
    } else if (up.includes(val)) {
      cur = val;
      sort = "gte";
      return;
    }
  });

  if (cur) {
    var [data, price] = query.split(cur);
    var value = parseFloat(price);
  } else {
    var data = query;
    var value = 10000000;
    sort = "lte";
  }
  console.log(query, value);
  try {
    let body = await esClient.search({
      index: "e_commerce",
      body: {
        query: {
          bool: {
            must: [
              {
                exists: {
                  field: "discounted_price",
                },
              },
              {
                range: {
                  discounted_price: {
                    [sort]: value,
                  },
                },
              },
            ],
            should: [
              {
                multi_match: {
                  query: query,
                  fields: ["brand", "product_name", "category_name"],
                  // fuzziness: "AUTO",
                },
              },
            ],
            minimum_should_match: 1,
          },
        },

        _source: [
          "product_id",
          "product_name",
          "category_id",
          "category_name",
          "brand",
          "MRP",
          "discounted_price",
        ],
      },
    });

    if (body && body.hits) {
      let data = body.hits.hits;
      const results = data.map((hit) => hit._source);
      res.json(results);
    } else {
      console.error("Invalid Elasticsearch response:", body);
      res.status(500).send("Invalid Elasticsearch response");
    }
  } catch (error) {
    console.error(error);
    res.status(500).send("Internal Server Error");
  }
});

// Start server
const PORT = 8080;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
