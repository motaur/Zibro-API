//npm i -g nodemon; start CLI: nodemon app

//imports
const Joi = require('joi');         // input validation  ---> npm i joi
const log = require('./logger');    // export logger module
const express = require('express'); //npm i express
const { Pool } = require('pg');
//const bodyParser = require('body-parser');  //npm i body-parser

//============= DB ===============//
const pool = new Pool(
{
    user: 'postgres',
    host: 'localhost',
    database: 'Zibro',
    password: '123',
    port: 5432,
});
 
//============= SERVER ===============//
const port = process.env.PORT || 3000;
const app = express();
//Here we are configuring express to use body-parser as middle-ware.
app.use(express.json());
/*app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());*/

// Listen to port 3000
app.listen(port, () => log(`Dev app listening on port ${port}!`) );

//============= VARIABLES ===============//
const events = [
    {id: 1, name: "birthday", location: "Tel-Aviv", date: "29-01-2019" , organizerId: 1},
    {id: 2, name: "Wedding", location: "Tel-Aviv", date: "30-01-2019" , organizerId: 345},
    {id: 3, name: "Concert", location: "Tel-Aviv", date: "21-01-2019" , organizerId: 7567},
]

//============= CONTROLLERS ===============//
app.get('/', (req, res) =>
{
    log('called main')
    res.send(`Dev app listening on port ${port}!`);
});

app.get('/api/events', async (req, res) =>
{
    log('called get events')
    const { rows } = await pool.query(`SELECT * FROM events;`)
    res.send(rows);
});

app.get('/api/eventsbyorganizer/:id/',  async (req, res) =>
{    
    log('called get events by organizer id')
    
    const { rows } = await pool.query(`SELECT * FROM events WHERE organizerid = '${req.params.id}'`)

    if (rows.length == 0) return res.status(404).send("event wasn't found");

    res.send(rows);
});

app.get('/api/eventsbystatus/:statusid/', async (req, res) =>
{    
    log('called get events by status id')
    
    const { rows } = await pool.query(`SELECT * FROM events WHERE status = ${req.params.statusid};`);

    if (rows.length == 0) return res.status(404).send("event wasn't found");

    res.send(rows);
});

app.get('/api/events/:id/',  async (req, res) =>
{    
    log('called get event by id')

    let data = [];
    
    const { rows: event } = await pool.query(`SELECT * FROM events WHERE id = ${req.params.id}`)
    //const event = events.find(event => event.id === parseInt(req.params.id));
    if (event.length == 0) return res.status(404).send("event wasn't found");  

    const { rows: images } = await pool.query(`SELECT id, title, status, link FROM imagesforevents WHERE eventid = ${req.params.id}`)

    data.push(event)
    data.push(images)

    res.send(data) 
}); 

app.post('/api/events/', (req, res) =>
{
    log('called post event')

    const { error } = validateEvent(req.body);

    if (error) return res.status(400).send(error.details[0].message)

    try
    {
        const body = pool.query(`INSERT INTO events (title, organizerid, date)
        VALUES (            
            '${req.body.title}',
            '${req.body.organizerid}', 
            '${req.body.date}'
            )`)  
        
        return res.status(201).json(body) 
    }
    catch(error)
    {
        return res.status(201).json('error') 
    }
         

});

app.put('/api/events/:id', (req, res) =>
{
    log('called put event by id')

    const event = events.find(event => event.id === parseInt(req.params.id));

    if (!event) return res.status(404).send("event wasn't found");

    const { error } = validateEvent(req.body);

    if (error) return res.status(400).send(error.details[0].message);  
    
    event.name = req.body.name;
    event.location = req.body.location;
    event.date = req.body.date;
    event.organizerId = req.body.organizerId;

    res.send(event);

});

function validateEvent(event)
{
    const schema = 
    {        
        title: Joi.string().min(3).required(),
        description: Joi.string().required(),
        organizerid: Joi.string().required(), 
        datedescription: Joi.string().required(), 
        locationname: Joi.string().required(),
        type:  Joi.number().integer().required(), 
        //status:  Joi.integer().required(),   //auto as NSY
        locx: Joi.number().required(),
        locy: Joi.number().required(),
        price: Joi.number().required(), 
        date: Joi.allow()  //TODO timestamp
    };

    return Joi.validate(event, schema);
}

app.delete('/api/events/:id', (req, res) =>
{
    log('called delete event by id')
    const event = events.find(event => event.id === parseInt(req.params.id));

    if (!event) return res.status(404).send("event wasn't found");

    const index = events.indexOf(event);
    events.splice(index, 1);

    res.send(event);
});
