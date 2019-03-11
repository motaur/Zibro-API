//npm i -g nodemon; start CLI: nodemon app

//imports
const Joi = require('joi');         // input validation  ---> npm i joi
const log = require('./logger');    // export logger module
const express = require('express'); //npm i express
const { Pool } = require('pg');
const bodyParser = require('body-parser');  //npm i body-parser

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
//app.use(express.json());
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());

// Listen to port 3000
app.listen(port, () => log(`Dev app listening on port ${port}!`) );

//============= CONTROLLERS ===============//
app.get('/', (req, res) =>
{
    log('called main')
    res.json(`Dev app listening on port ${port}!`);
});

app.get('/api/events', async (req, res) =>
{
    log('called get events')
    const { rows: events } = await pool.query(`SELECT * FROM events;`)
    const { rows: images } = await pool.query(`SELECT * FROM imagesForEvents;`)
    
    events.forEach(e=>e.images = images.filter(i=> i.eventid === e.id));

    res.json(events);
});

app.get('/api/eventsByOrganizer/:id/',  async (req, res) =>
{    
    log('called get events by organizer id')

    const { rows: events } = await pool.query(`SELECT * FROM events WHERE organizerId = '${req.params.id}'`)

    if (events.length == 0) return res.status(404).json("no events were found");

    const { rows: images } = await pool.query(`SELECT * FROM imagesForEvents;`)

    events.forEach(e=> e.images = images.filter(i=> i.eventid === e.id));

    res.json(events);
});

app.get('/api/eventsByStatus/:id/', async (req, res) =>
{    
    log('called get events by status id')
    
    const { rows } = await pool.query(`SELECT * FROM events WHERE status = ${req.params.id};`);

    if (rows.length == 0) return res.status(404).json("event wasn't found");

    const { rows: images } = await pool.query(`SELECT * FROM imagesForEvents;`)

    events.forEach(e=> e.images = images.filter(i=> i.eventid === e.id));

    res.json(events);
});

app.get('/api/events/:id/',  async (req, res) =>
{    
    log('called get event by id')

    let event = new Object();    
    
    const { rows: properties } = await pool.query(`SELECT * FROM events WHERE id = ${req.params.id}`)
    //const event = events.find(event => event.id === parseInt(req.params.id));
    if (properties.length == 0) return res.status(404).json("event wasn't found");  

    const { rows: images } = await pool.query(`SELECT id, title, status, link FROM imagesforevents WHERE eventid = ${req.params.id}`)

    event.meta = properties
    event.images = images

    res.json(event) 
}); 

app.post('/api/events/', async (req, res) =>
{
    log('called post event')

    const { error } = validatePostEvent(req.body);

    if (error) return res.status(400).json(error.details[0].message)

    try
    {        
        const body = await pool.query(`INSERT INTO events 
        (
            title, 
            organizerid, 
            date
        )
        VALUES 
        (            
            '${req.body.title}',
            '${req.body.organizerid}', 
            '${req.body.date}'
        );
        SELECT * FROM events WHERE id = (SELECT MAX(id) FROM events)`)        
        
        res.status(201).json(body[1].rows[0])
    }
    catch(error)
    {
        res.status(201).json(error) 
    }       

});

app.put('/api/events/:id', async (req, res) =>
{
    log('called put event by id')

    const { error } = validatePutEvent(req.body);

    if (error) return res.status(400).json(error.details[0].message);  
       
    let query = `UPDATE events SET 
        title = coalesce(${undefinedToNull(req.body.title)}, title),
        type = coalesce(${undefinedToNull(req.body.type)}, type),
        datedescription = coalesce(${undefinedToNull(req.body.datedescription)}, datedescription),
        locationname = coalesce(${undefinedToNull(req.body.locationname)}, locationname),
        status = coalesce(${undefinedToNull(req.body.status)}, status),
        price = coalesce(${undefinedToNull(req.body.price)}, price),
        likes = coalesce(${undefinedToNull(req.body.like)}, likes),
        locx = coalesce(${undefinedToNull(req.body.locx)}, locx),
        locy = coalesce(${undefinedToNull(req.body.locy)}, locy),
        date = coalesce(${undefinedToNull(req.body.date)}, date)
                           
    WHERE id = ${req.params.id};
    SELECT * FROM events WHERE id = ${req.params.id};`
   /*
   
        
   */
    try
    { 
        const body = await pool.query(query)
        
        res.status(201).json(body[1].rows[0])
    }
    catch(error)
    {
        res.status(201).json(error) 
    }
});

function undefinedToNull(value)
{
    if (typeof value === "undefined")
        return null   
    else if (typeof value === "string")   
        return `'` + value + `'`
    else
        return value     
}

function validatePutEvent(event)
{
    //every field is optional
    const schema = 
    {   
        title: Joi.string().min(3).allow(),     // max letters?
        date: Joi.date().allow(), //time stamp format?
        description: Joi.string().allow(),      // max letters?
        datedescription: Joi.string().allow(), // max letters?
        locationname: Joi.string().allow(), // max letters?
        type:  Joi.number().integer().min(1).allow(), // from 1 to ?
        status:  Joi.number().integer().min(1).allow(),   // from 1 to ?
        likes: Joi.number().integer().min(0).allow(), // from 0 to infinity
        locx: Joi.number().allow(),
        locy: Joi.number().allow(),
        price: Joi.number().min(0).allow() // from 0 to infinity
    };

    return Joi.validate(event, schema);
}

function validatePostEvent(event)
{
    const schema = 
    {        
        title: Joi.string().min(3).required(),
        organizerid: Joi.string().required(),
        date: Joi.date().required(),

        description: Joi.string().allow(),
        datedescription: Joi.string().allow(), 
        locationname: Joi.string().allow(),
        type:  Joi.number().integer().allow(), 
        status:  Joi.integer().allow(),   //auto as 1 - NSY
        locx: Joi.number().allow(),
        locy: Joi.number().allow(),
        price: Joi.number().allow(), 
        
    };

    return Joi.validate(event, schema);
}

/*
app.delete('/api/events/:id', (req, res) =>
{
    log('called delete event by id')
    const event = events.find(event => event.id === parseInt(req.params.id));

    if (!event) return res.status(404).json("event wasn't found");

    const index = events.indexOf(event);
    events.splice(index, 1);

    res.json(event);
});
*/