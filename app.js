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
    //heroku temporary
    user: 'fbvqfgdqjobjgg',
    host: 'ec2-54-247-85-251.eu-west-1.compute.amazonaws.com',
    database: 'dd5egnonjqfvh3',
    password: 'b334d1e4c73a44c4009ef22aec8b9b540651512e37cba3d028af869f2d45e67a',
    port: 5432

    //local
    /*user: 'postgres',
    host: 'localhost',
    database: 'Zibro',
    password: '123',
    port: 5432*/
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
    
    res.sendFile('doc/index.html', {root: __dirname })    
    //res.json(`Dev app listening on port ${port}!`);
});

app.get('/api/events/', async (req, res) =>
{
    log('called get events')

    try
    {
        const { rows: events } = await pool.query(`SELECT * FROM events;`)
        const { rows: images } = await pool.query(`SELECT * FROM imagesForEvents;`)

        events.forEach(e=>e.images = images.filter(i=> i.eventid === e.id))

        res.json(events);
    }
    catch(error)
    {
        res.json(error);
    }   
});

app.get('/api/eventsByOrganizer/:id/',  async (req, res) =>
{    
    log('called get events by organizer id')

    try
    {
        const { rows: events } = await pool.query(`SELECT * FROM events WHERE organizerId = '${req.params.id}'`)

        if (events.length == 0) return res.status(404).json("no events were found")

        const { rows: images } = await pool.query(`SELECT * FROM imagesForEvents;`)

        events.forEach(e=> e.images = images.filter(i=> i.eventid === e.id))

        res.json(events)
    }
    catch(error)
    {
        res.json(error)
    }
    
});

app.get('/api/eventsByStatus/:id/', async (req, res) =>
{    
    log('called get events by status id')
    
    try
    {
        const { rows: events } = await pool.query(`SELECT * FROM events WHERE status = ${req.params.id};`);

        if (events.length == 0) return res.status(404).json("event wasn't found")

        const { rows: images } = await pool.query(`SELECT * FROM imagesForEvents;`)

        events.forEach(e=> e.images = images.filter(i=> i.eventid === e.id))

        res.json(events)
    }
    catch(error)
    {
        res.json(error)
    }
        
});

app.get('/api/events/:id/',  async (req, res) =>
{    
    log('called get event by id')

    let event = new Object();    
    
    try
    {
        const { rows: properties } = await pool.query(`SELECT * FROM events WHERE id = ${req.params.id}`)
       
        if (properties.length == 0) return res.status(404).json("Event with id " + req.params.id + " was removed or not created.");  

        const { rows: images } = await pool.query(`SELECT id, title, status, link FROM imagesforevents WHERE eventid = ${req.params.id}`)

        event.meta = properties
        event.images = images

        res.json(event) 
    }
    catch(error)
    {
        res.json(error) 
    }
    
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
        res.json(error) 
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
        status:  Joi.number().integer().allow(),   //auto as 1 - NSY
        locx: Joi.number().allow(),
        locy: Joi.number().allow(),
        price: Joi.number().allow(), 
        
    };

    return Joi.validate(event, schema);
}


app.delete('/api/events/:id', async (req, res) =>
{
    log('called delete event by id')

    try
    {
        const { rows: event } = await pool.query(`SELECT * FROM events WHERE id = ${req.params.id}`)

        if (event.length == 0) return res.status(404).json("no events were found")        

        await pool.query(`DELETE FROM events WHERE id = ${req.params.id}`)
        await pool.query(`DELETE FROM imagesforevents WHERE eventid = ${req.params.id}`)

        res.json("event with id " + event[0].id + " has been removed")
    }
    catch(error)
    {
        res.json(error)
    }
});

//=============images group================
app.get('/api/images/', async (req, res) =>
{
    log('called get images')

    try
    {        
        const { rows: images } = await pool.query(`SELECT * FROM imagesForEvents;`)       

        res.json(images);
    }
    catch(error)
    {
        res.json(error);
    }   
});


app.post('/api/images/', async (req, res) =>
{
    log('called post image')

    const { error } = validatePostImage(req.body);
    
    if (error) return res.status(400).json(error.details[0].message)     

    try
    {    
        //check if event exist
        const { rows: event } = await pool.query(`SELECT * FROM events WHERE id = ${req.body.eventid}`)

        if (event.length == 0) return res.status(404).json("no events were found with id " + req.body.eventid)
        
        const body = await pool.query(`INSERT INTO imagesforevents 
        (
            title, 
            link, 
            eventid,
            status
        )
        VALUES 
        (            
            '${req.body.title}',
            '${req.body.link}', 
             ${req.body.eventid},
             ${req.body.status}
             
        );
        SELECT * FROM imagesforevents WHERE id = (SELECT MAX(id) FROM imagesforevents)`)        
        
        res.status(201).json(body[1].rows[0])
    }
    catch(error)
    {
        res.json(error) 
    }       

});

function validatePostImage(event)
{
    const schema = 
    {        
        title: Joi.string().required(), 
        eventid: Joi.number().integer().required(),
        link: Joi.string().uri().required(),
        status: Joi.number().integer().required()       
    };

    return Joi.validate(event, schema);
}

app.delete('/api/images/:id', async (req, res) =>
{
    log('called delete image by id')

    try
    {
        const { rows: image } = await pool.query(`SELECT * FROM imagesforevents WHERE id = ${req.params.id}`)

        if (image.length == 0) return res.status(404).json("no images were found")      
        await pool.query(`DELETE FROM imagesforevents WHERE id = ${req.params.id}`)

       res.json("image with id " + image[0].id + " for event id " + image[0].eventid + " has been removed")
    }
    catch(error)
    {
        res.json(error)
    }
});

