
// Imports dependencies and set up http server
const
  express = require('express'),
  bodyParser = require('body-parser'),
  https = require('https'),
  app = express().use(bodyParser.json()); // creates express http server

// Sets server port and logs message on success
app.listen(process.env.PORT || 1337, () => console.log('webhook is listening'));

// Configs
const jwt_token = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJhcHBJZCI6ImNzLTMzOWY0MmY0LTRlMmItNWQ0ZC04YjBjLWZmM2M4NTYxY2QyNCIsInN1YiI6IjEyMzQ1NjY2In0.ALuD8MTJxKTH7LnnT5tsvH2wocHy64PTUC4AKU1PASk'
const kore_url = 'https://bots.kore.ai/chatbot/hooks/st-120802d5-dc79-515d-822c-3c3e378ad904'
const workplace_token = 'lfgierajg50498723fgfoiprejg9045jfpe48943jrt034jfg'
const workplace_access_token = 'DQVJzTWNVaVJWZAk1mcnBqWjZA5aFZAoUG16V05oemltdlhnQkhkMGlBV3UybG1SeXd5dFd2c0JncTJSZAkdadTVUSWxBTHp4d2M0ZA2hqWmIwbDBqZAHFVeHhmYW8xdVE2SUNqdjZAvY0JGMzA3NUREajdDN25GVEt5Y3NKUTRzQ19uQ0FrUWgxcmVNdTNEa1poUFZASVjJvLW4wQndMQ0Nhdzd1WWVoUnVWaS1mUFRiSnkxOFhsMUVpblhEOE1LY3FaakpzRzJJN0gybmI4NTlaRVJWdgZDZD'
const wokplace_url = 'https://graph.facebook.com/v2.6/me/messages?access_token=' + workplace_access_token

// Function to send message to kore, get response and then forward it to workplace
function getResFromKore(message, id) {

    const data = JSON.stringify({"message": {"text": message}, "from": {"id": id}, "mergeIdentity":true})
      
    const options = {
    method: 'POST',
    headers: {'Authorization': 'bearer ' + jwt_token, 'Content-Type': 'application/json'}
    }

    const req = https.request(kore_url, options, res => {
    console.log(`Kore statusCode: ${res.statusCode}`)
    
    res.on('data', d => {
        if (res.statusCode === 200){
            // Format response and for each message forward it to workplace
            for (msg of formatResponse(JSON.parse(d).text)){
                senResToWp(msg, id)
            }
        }
    })
    })

    req.on('error', error => {
    console.error(error)
    })
    
    req.write(data)
    req.end()

}

// Function to escape special charecters in regular expression 
function escapeRegExp(string) {
    return string.replace(/[.*+\-?^${}()|[\]\\]/g, '\\$&'); // $& means the whole matched string
}
// Function to replace all the matched strings with a given string unlike .replace() which only replaces the first match
function replaceAll(str, find, replace) {
    return str.replace(new RegExp(escapeRegExp(find), 'g'), replace);
}

// Function to format kore responses in workplace format
function formatResponse(message) {
    const messages = []
    console.log(message)
    // If the response is an array
    if (typeof(message) === typeof([])) {

        for (msg of message) {
            // If the message includes a quote replace them
            if (msg.includes('&quot;')) {
                msg = replaceAll(msg, '&quot;', '"')
                msg = JSON.parse(msg)
                messages.push(msg)
            } else {
                // if the message includes any default kore responses format them accordingly 
                if (msg.includes('isTemplate')) {
                    messages.push({"text": JSON.parse(msg).text})
                } else {
                    messages.push({"text": msg})
                }
            }
        } 

    } else {
        // If the message is just a string instead of a array
        if (message.includes('&quot;')) {
            message = replaceAll(message, '&quot;', '"')
            message = JSON.parse(message)
            messages.push(message)
        } else {
            if (message.includes('isTemplate')) {
                messages.push({"text": JSON.parse(message).text})
            } else {
                messages.push({"text": message})
            }
        }
    }
    return messages
}

// Function to send the kore response to workplace
function senResToWp(message, id) {

    const data = JSON.stringify({ "recipient": {"id": id}, "message": message})
      
    const options = {
    method: 'POST',
    headers: {'Content-Type': 'application/json'}
    }
    
    const req = https.request(wokplace_url, options, res => {
    console.log(`Workplace statusCode: ${res.statusCode}`)
    
    res.on('data', d => {
        console.log(`Workplace resp: ${d}`)
    })
    })

    req.on('error', error => {
        console.error(error)
    })
    
    req.write(data)
    req.end()
}



// Creates the endpoint for our webhook 
app.post('/middleware', (req, res) => {  
 
    let body = req.body;
    console.log('========================================================');
    console.log(body);
    console.log('========================================================');

    // Checks this is an event from a page subscription
    if (body.object === 'page') {

      // Iterates over each entry - there may be multiple if batched
      body.entry.forEach(function(entry) {
  
        // Gets the message. entry.messaging is an array, but 
        // will only ever contain one message, so we get index 0
        let webhook_event = entry.messaging[0];

        console.log('--------------------------------------------------------------');
        console.log(webhook_event);
        console.log('--------------------------------------------------------------');


        if (webhook_event.message){
            getResFromKore(webhook_event.message.text, webhook_event.sender.id)
        } else if (webhook_event.postback) {
            getResFromKore(webhook_event.postback.payload, webhook_event.sender.id)
        }

        // const message = getResFromKore(webhook_event.message.text, webhook_event.sender.id);
        // const messages = formatResponse(getResFromKore(webhook_event.message.text, webhook_event.sender.id));
        // for (msg of messages){
        //     senResToWp(msg, webhook_event.sender.id)
        // }

      });
  
      // Returns a '200 OK' response to all requests
      res.status(200).send('EVENT_RECEIVED');
    } else {
      // Returns a '404 Not Found' if event is not from a page subscription
      res.sendStatus(404);
    }
  
  });

// Adds support for GET requests to our webhook
app.get('/middleware', (req, res) => {

    // Your verify token. Should be a random string.
    let VERIFY_TOKEN = workplace_token
      
    // Parse the query params
    let mode = req.query['hub.mode'];
    let token = req.query['hub.verify_token'];
    let challenge = req.query['hub.challenge'];
      
    // Checks if a token and mode is in the query string of the request
    if (mode && token) {
    
      // Checks the mode and token sent is correct
      if (mode === 'subscribe' && token === VERIFY_TOKEN) {
        
        // Responds with the challenge token from the request
        console.log('WEBHOOK_VERIFIED');
        res.status(200).send(challenge);
      
      } else {
        // Responds with '403 Forbidden' if verify tokens do not match
        res.sendStatus(403);      
      }
    }
  });