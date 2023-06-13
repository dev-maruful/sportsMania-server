const express = require("express");
const cors = require("cors");
const jwt = require("jsonwebtoken");
require("dotenv").config();
const stripe = require("stripe")(`${process.env.PAYMENT_SECRET_KEY}`);
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const app = express();
const port = process.env.PORT || 5000;

// middleware
app.use(cors());
app.use(express.json());

const verifyJWT = (req, res, next) => {
  const authorization = req.headers.authorization;
  if (!authorization) {
    return res
      .status(401)
      .send({ error: true, message: "Authorization required" });
  }

  // bearer token
  const token = authorization.split(" ")[1];

  jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
    if (err) {
      return res.status(403).send({ error: true, message: "Invalid token" });
    }
    req.decoded = decoded;
    next();
  });
};

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.s92qhby.mongodb.net/?retryWrites=true&w=majority`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    // await client.connect();

    const usersCollection = client.db("sportsManiaDB").collection("users");
    const studentsClassesCollection = client
      .db("sportsManiaDB")
      .collection("studentsclasses");
    const naturesCollection = client
      .db("sportsManiaDB")
      .collection("natureActivities");
    const classesCollection = client.db("sportsManiaDB").collection("classes");
    const paymentsCollection = client
      .db("sportsManiaDB")
      .collection("payments");

    app.post("/jwt", (req, res) => {
      const user = req.body;
      const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, {
        expiresIn: "1h",
      });
      res.send({ token });
    });

    // users related APIs
    app.get("/users/instructors", async (req, res) => {
      const query = { role: "instructor" };
      const result = await usersCollection.find(query).toArray();
      res.send(result);
    });

    app.get("/users", async (req, res) => {
      const result = await usersCollection.find().toArray();
      res.send(result);
    });

    app.get("/users/:email", async (req, res) => {
      const email = req.params.email;
      const query = { email: email };
      const result = await usersCollection.findOne(query);
      res.send(result);
    });

    app.post("/users", async (req, res) => {
      const user = req.body;
      const query = { email: user.email };
      const existingUser = await usersCollection.findOne(query);

      if (existingUser) {
        return res.send({ message: "user already exists" });
      }

      const result = await usersCollection.insertOne(user);
      res.send(result);
    });

    // app.get("/users/admin/:email", async (req, res) => {
    //   const email = req.params.email;
    //   console.log(email);

    //   if (req.decoded.email !== email) {
    //     res.send({ admin: false });
    //   }

    //   const query = { email: email };
    //   const user = await usersCollection.findOne(query);
    //   const result = { admin: user?.role === "admin" };
    //   res.send(result);
    // });

    // app.get("/users/instructor/:email", async (req, res) => {
    //   const email = req.params.email;

    //   if (req.decoded.email !== email) {
    //     res.send({ instructor: false });
    //   }

    //   const query = { email: email };
    //   const user = await usersCollection.findOne(query);
    //   const result = { instructor: user?.role === "instructor" };
    //   res.send(result);
    // });

    app.patch("/users/admin/:id", async (req, res) => {
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) };
      const updateDoc = {
        $set: {
          role: "admin",
        },
      };
      const result = await usersCollection.updateOne(filter, updateDoc);
      res.send(result);
    });

    app.patch("/users/instructor/:id", async (req, res) => {
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) };
      const updateDoc = {
        $set: {
          role: "instructor",
        },
      };
      const result = await usersCollection.updateOne(filter, updateDoc);
      res.send(result);
    });

    // classes related APIs
    app.get("/classes/approvedclasses", async (req, res) => {
      const query = { status: "approved" };
      const result = await classesCollection.find(query).toArray();
      res.send(result);
    });

    app.put("/classes/approved/:name", async (req, res) => {
      const name = req.params.name;
      const { availableSeats, enrolled } = req.body;
      const filter = { className: name };
      const updateDoc = {
        $set: {
          availableSeats: availableSeats,
          enrolled: enrolled,
        },
      };
      const result = await classesCollection.updateOne(filter, updateDoc);
      res.send(result);
    });

    app.patch("/classes/approved/:id", async (req, res) => {
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) };
      const updateDoc = {
        $set: {
          status: "approved",
        },
      };
      const result = await classesCollection.updateOne(filter, updateDoc);
      res.send(result);
    });

    app.patch("/classes/denied/:id", async (req, res) => {
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) };
      const updateDoc = {
        $set: {
          status: "denied",
        },
      };
      const result = await classesCollection.updateOne(filter, updateDoc);
      res.send(result);
    });

    app.patch("/classes/feedback/:id", async (req, res) => {
      const data = req.body;
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) };
      const updateDoc = {
        $set: {
          feedback: data.feedback,
        },
      };
      const result = await classesCollection.updateOne(filter, updateDoc);
      res.send(result);
    });

    app.get("/classes", async (req, res) => {
      let query = {};

      if (req.query.email) {
        query = {
          instructorEmail: req.query.email,
        };
      }

      const result = await classesCollection
        .find(query)
        .sort({ enrolled: -1 })
        .toArray();
      res.send(result);
    });

    app.post("/classes", async (req, res) => {
      const classData = req.body;
      const query = { className: classData.className };
      const existingClass = await classesCollection.findOne(query);

      if (existingClass) {
        return res.send({ message: "Class already exists" });
      }

      const result = await classesCollection.insertOne(classData);
      res.send(result);
    });

    app.get("/classes/studentselected", async (req, res) => {
      let query = {};

      if (req.query.email) {
        query = {
          studentEmail: req.query.email,
        };
      }

      const result = await studentsClassesCollection.find(query).toArray();
      res.send(result);
    });

    app.get("/classes/enrolledclasses", async (req, res) => {
      let query = {};

      if (req.query.email) {
        query = {
          email: req.query.email,
        };
      }

      const result = await paymentsCollection
        .find(query)
        .sort({ data: -1 })
        .toArray();
      res.send(result);
    });

    app.post("/classes/studentselected", async (req, res) => {
      const classData = req.body;
      const query = {
        className: classData.className,
        studentEmail: classData.studentEmail,
      };

      const existingClass = await studentsClassesCollection.findOne(query);

      if (existingClass) {
        return res.send({ message: "Class already selected" });
      }

      const result = await studentsClassesCollection.insertOne(classData);
      res.send(result);
    });

    app.delete("/classes/studentselected/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await studentsClassesCollection.deleteOne(query);
      res.send(result);
    });

    app.get("/classes/studentselected", async (req, res) => {
      const result = await studentsClassesCollection.find().toArray();
      res.send(result);
    });

    // nature activities api
    app.get("/nature", async (req, res) => {
      const result = await naturesCollection.find().toArray();
      res.send(result);
    });

    // create payment intent
    app.post("/create-payment-intent", async (req, res) => {
      const { price } = req.body;
      const amount = parseInt(price * 100);
      const paymentIntent = await stripe.paymentIntents.create({
        amount: amount,
        currency: "usd",
        payment_method_types: ["card"],
      });

      res.send({
        clientSecret: paymentIntent.client_secret,
      });
    });

    // payment related api
    app.post("/payments", async (req, res) => {
      const payment = req.body;
      const insertResult = await paymentsCollection.insertOne(payment);

      const query = { _id: new ObjectId(payment.classId) };
      const deleteResult = await studentsClassesCollection.deleteOne(query);

      res.send({ insertResult, deleteResult });
    });

    // Send a ping to confirm a successful connection
    await client.db("admin").command({ ping: 1 });
    console.log(
      "Pinged your deployment. You successfully connected to MongoDB!"
    );
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);

app.get("/", (req, res) => {
  res.send("Sports Mania is playing!");
});

app.listen(port, () => {
  console.log(`Sports Mania listening on port: ${port}`);
});
