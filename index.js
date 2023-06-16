const express = require('express');
const app = express();
const cors = require('cors');
require('dotenv').config();
const port = process.env.PORT || 5000;


//middleware
app.use(cors());
app.use(express.json());


const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASSWORD}@cluster0.75vrxdv.mongodb.net/?retryWrites=true&w=majority`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});

async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    // await client.connect();

    const usersCollection = client.db("rootAcademy").collection("users");
    const classCollection = client.db("rootAcademy").collection("classes");

    app.post('/users', async (req, res) => {
      const user = req.body;
      const query = { email: user.email }
      const existingUser = await usersCollection.findOne(query);

      if (existingUser) {
        return res.send({ message: 'user already exists' })
      }

      const result = await usersCollection.insertOne(user);
      res.send(result);
    });

    app.get('/users', async (req, res) => {
      const result = await usersCollection.find().toArray();
      res.send(result);
    });

    app.get('/classes', async (req, res) => {
      const email = req.query.email;
      const result = await classCollection.find().toArray();
      res.send(result);
    });

    app.patch('/users/admin/:id', async (req, res) => {
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) };
      const updateDoc = {
        $set: {
          role: 'admin'
        }
      };
      const result = await usersCollection.updateOne(filter, updateDoc);
      res.send(result);
    });


    app.patch('/users/instructor/:id', async (req, res) => {
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) };
      const updateDoc = {
        $set: {
          role: 'instructor',
          enrollCount: 0
        }
      };
      const result = await usersCollection.updateOne(filter, updateDoc);
      res.send(result);
    });

    app.get('/users/admin/:email', async (req, res) => {
      const email = req.params.email;
      const query = { email: email };
      const user = await usersCollection.findOne(query);
      const result = { admin: user?.role === 'admin' };
      res.send(result);
    });
    app.get('/users/instructor/:email', async (req, res) => {
      const email = req.params.email;
      const query = { email: email };
      const user = await usersCollection.findOne(query);
      const result = { instructor: user?.role === 'instructor' };
      res.send(result);
    });

    app.post('/classes', async (req, res) => {
      const document = req.body;
      const query = { email: document.instructorEmail };
      const instructorInfo = await usersCollection.findOne(query);
      const instructorId = instructorInfo._id;

      const classData = { ...document, instructorId };
      const result = await classCollection.insertOne(classData);
      res.send(result);
    });

    app.patch('/classes/approved/:id', async (req, res) => {
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) };
      const document = req.body;
      const updateDoc = {
        $set: {
          status: document.status,
          enrollCount: 0
        }
      };
      const result = await classCollection.updateOne(filter, updateDoc);
      res.send(result);
    });
    app.patch('/classes/denied/:id', async (req, res) => {
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) };
      const document = req.body;
      const updateDoc = {
        $set: {
          status: document.status
        }
      };
      const result = await classCollection.updateOne(filter, updateDoc);
      res.send(result);
    });

    app.patch('/classes/feedback/:id', async (req, res) => {
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) };
      const document = req.body;
      const updateDoc = {
        $set: {
          feedback: document.feedback
        }
      };
      const result = await classCollection.updateOne(filter, updateDoc);
      res.send(result);
    });

    app.get('/instructors', async (req, res) => {
      const query = { role: 'instructor' };
      const result = await usersCollection.find(query).toArray();
      res.send(result);
    });

    app.get('/classes/approved', async (req, res) => {
      const query = { status: 'approved' };
      const result = await classCollection.find(query).toArray();
      res.send(result);
    });

    // Send a ping to confirm a successful connection
    await client.db("admin").command({ ping: 1 });
    console.log("Pinged your deployment. You successfully connected to MongoDB!");
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);



app.get('/', (req, res) => {
  res.send('The Root Academy')
})

app.listen(port, () => {
  console.log(`The Root on port ${port}`);
})