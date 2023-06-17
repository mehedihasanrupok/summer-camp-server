const express = require('express');
const app = express();
const cors = require('cors');
require('dotenv').config();
const port = process.env.PORT || 5000;
const stripe = require('stripe')(process.env.PAYMENT_SECRET_KEY);


//middleware
app.use(cors());
app.use(express.json());


const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const { default: Stripe } = require('stripe');
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
    const cartCollection = client.db("rootAcademy").collection("carts");
    const paymentCollection = client.db("rootAcademy").collection("payments");
    const enrolledClassCollection = client.db("rootAcademy").collection("enrolled");

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

    app.post('/carts', async (req, res) => {
      const item = req.body;
      const result = await cartCollection.insertOne(item);
      res.send(result);
  });

  app.get('/carts', async (req, res) => {
    const email = req.query.email;
    if (!email) {
      res.send([]);
    }
    const query = { email: email };
    const result = await cartCollection.find(query).toArray();
    res.send(result);
  });

  app.delete('/carts/:id', async (req, res) => {
    const id = req.params.id;
    const query = { _id: new ObjectId(id) };
    const result = await cartCollection.deleteOne(query);
    res.send(result);
});

app.post('/create-payment-intent', async (req, res) => {
	const { price } = req.body;
	const amount = parseInt(price * 100);
	const paymentIntent = await stripe.paymentIntents.create({
		amount: amount,
		currency: 'usd',
		payment_method_types: ['card']
	});
	res.send({
		clientSecret: paymentIntent.client_secret
	});
});

app.post('/payments', async (req, res) => {
	const payment = req.body;
	const insertResult = await paymentCollection.insertOne(payment);

	const classIds = payment.classIds.map(id => new ObjectId(id));
	const filter1 = { _id: { $in: classIds }, availableSeats: { $gt: 0 } };
	const updateDoc1 = { $inc: { availableSeats: -1, enrollCount: 1 } };
	const updateClassResult = await classCollection.updateMany(filter1, updateDoc1);

	const instructorIds = payment.instructorIds.map(id => new ObjectId(id));
	for (const instructorId of instructorIds) {
		const filter = { _id: instructorId };
		const updateDoc = { $inc: { enrollCount: 1 } };
		const options = { upsert: true };
		const result = await usersCollection.updateOne(filter, updateDoc, options);
	}

	const cartItemIds = payment.cartItems.map(id => new ObjectId(id));
	const query = { _id: { $in: cartItemIds } };
	const deleteResult = await cartCollection.deleteMany(query);

	const enrolledClasses = [];
	for (let i = 0; i < payment.classIds.length; i++) {
		const classIdObj = new ObjectId(payment.classIds[i]);
		const query = { _id: classIdObj };
		const classInfo = await classCollection.findOne(query);

		if (classInfo) {
			enrolledClasses.push({
				email: payment.email,
				classId: classInfo._id,
				image: classInfo.image,
				className: classInfo.className,
				instructorName: classInfo.instructorName,
				instructorEmail: classInfo.instructorEmail,
				price: classInfo.price,
				date: payment.date,
				transactionId: payment.transactionId,
				status: 'paid'
			});
		}
	}
	const insertEnrolledResult = await enrolledClassCollection.insertMany(enrolledClasses);

	res.send({ insertResult, updateClassResult, deleteResult, insertEnrolledResult });
});
  

app.get('/enrolledClasses', async (req, res) => {
	const email = req.query.email;
	if (!email) {
		res.send([]);
	}
	const query = { email: email };
	const result = await enrolledClassCollection.find(query).toArray();
	res.send(result);
});

app.get('/instructors/popular', async (req, res) => {
  const query = { enrollCount: { $exists: true } };
  const sort = { enrollCount: -1 };
  const result = await usersCollection.find(query).sort(sort).limit(6).toArray();
  res.send(result);
});

app.get('/classes/popular', async (req, res) => {
  const query = { enrollCount: { $exists: true } };
  const sort = { enrollCount: -1 };
  const result = await classCollection.find(query).sort(sort).limit(6).toArray();
  res.send(result);
});

//sk_test_51NJwlrA5xsC96HiQjaeDDrXIBhEl1SZoQmeJcDTYNmhBTtTpj8F4UL3JqrpmL5oylv2cD0you3PVSO7qMUCy27JC00xM4Eo6mF

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