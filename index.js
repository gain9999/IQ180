// Setup basic express server
var express = require('express');
var app = express();
var server = require('http').createServer(app);
var io = require('socket.io')(server);
var port = process.env.PORT || 3000;

server.listen(port, function () {
  console.log('Server listening at port %d', port);
});

// Routing
app.use(express.static(__dirname + '/'));

// Chatroom

// usernames which are currently connected to the chat
var usernames = {};
var readyID = [];
var opponent = {};
var numUsers = 0;
var continueGame = {};

// send Local IP Adddress to website
require('dns').lookup(require('os').hostname(), function (err, add, fam) {
  var request = require('request');
  request.post({
    headers: {'content-type' : 'application/x-www-form-urlencoded'},
    url:     'http://www.gogain.xyz/index.php',
    body:    "ip="+add+":"+port
  }, function(error, response, body){
    console.log(body);
  });
  console.log('Updated IP at gogain.xyz: '+add+":"+port);
})


io.on('connection', function (socket) {
  var addedUser = false;

  // when the client emits 'new message', this listens and executes
  socket.on('new message', function (data,pmuser) {
    // we tell the client to execute 'new message'
    socket.broadcast.emit('new message', {
      username: socket.username,
      message: data,
      pmuser: pmuser
    });
    console.log(socket.username+": "+data);
  });

  // when the client emits 'add user', this listens and executes
  socket.on('add user', function (username) {
    if (username in usernames) { // check existed username
      socket.emit('enternewname');      
    }
    else {
      // we store the username in the socket session for this client
      socket.username = username;
      // add the client's username to the global list
      usernames[username] = username;
      ++numUsers;
      addedUser = true;
      socket.emit('login', {
        username: socket.username,
        numUsers: numUsers,
        usernames: usernames
      });
      // echo globally (all clients) that a person has connected
      socket.broadcast.emit('user joined', {
        username: socket.username,
        numUsers: numUsers,
        usernames: usernames
      });   
      console.log(socket.username+" join the server.");   
    }
  });

  // when the client emits 'typing', we broadcast it to others
  socket.on('typing', function () {
    socket.broadcast.emit('typing', {
      username: socket.username
    });
  });

  // when the client emits 'stop typing', we broadcast it to others
  socket.on('stop typing', function () {
    socket.broadcast.emit('stop typing', {
      username: socket.username
    });
  });

  // when the user disconnects.. perform this
  socket.on('disconnect', function () {
    if(readyID.indexOf(socket) > -1){ // press again
      for (var i = 0; i < readyID.length; i++) {
        if(opponent[readyID[i].id] == socket.id) {  
          readyID[i].emit('redirectToChat'); 
          var index = readyID.indexOf(readyID[i]); // remove opponent socket in array
          readyID.splice(index, 1);
          break;
        }
      }      
      var index = readyID.indexOf(socket);
      readyID.splice(index, 1);
      delete opponent[opponent[socket.id]];
      delete opponent[socket.id];
      console.log("========= User Ready List =========");
      for (var i = 0; i < readyID.length; i++) {
            console.log(readyID[i].username);
      }
      console.log("========= User Opponent List =========");
      for (var key in opponent) {
          console.log("Socket ID: "+opponent[key]);
      }      
    }
    console.log(socket.username+" leave the server."); 
    // remove the username from global usernames list
    if (addedUser) {
      delete usernames[socket.username];
      --numUsers;

      // echo globally that this client has left
      socket.broadcast.emit('user left', {
        username: socket.username,
        numUsers: numUsers,
        usernames: usernames
      });
    }
  });

  // when the client emits 'ready', change state of client to be ready
  socket.on('ready', function () {
    if(readyID.indexOf(socket) > -1){ // press again
      var index = readyID.indexOf(socket);
      readyID.splice(index, 1);
      delete opponent[socket.id];
      console.log(socket.username+"change status to be unready."); 
    }
    else { // press start
      console.log(socket.username+"change status to be ready."); 
      for (var i = 0; i < readyID.length; i++) {
        if(opponent[readyID[i].id] == null) {
          opponent[socket.id] = readyID[i].id;
          opponent[readyID[i].id] = socket.id;
          readyID[i].emit('redirectToGame',{
            opponentname: socket.username,
            value: Math.random()
          }); // socket
          socket.emit('redirectToGame',{
            opponentname: readyID[i].username,
            value: Math.random()
          }); // socket
          socket.broadcast.emit('new message', {
            username: socket.username,
            message: 'start the game with '+readyID[i].username,
            pmuser: null
          });
          console.log("--> "+socket.username+" start game with "+readyID[i].username);     
          break;
        }
      }     
      readyID.push(socket); 
    }
    console.log("========= User Ready List =========");
    for (var i = 0; i < readyID.length; i++) {
          console.log(readyID[i].username);
    }
    console.log("========= User Opponent List =========");
    for (var key in opponent) {
          console.log("  Socket ID: "+opponent[key]);
    }         
  });  
  socket.on('sendToPeer', function (mode,value) {
      for (var i = 0; i < readyID.length; i++) {
        if(readyID[i].id == opponent[socket.id]) {
          readyID[i].emit('sendToPeerGame', {
            mode: mode,
            value: value
          });
          console.log(socket.username+"->"+readyID[i].username+": "+mode+" | "+value);     
          break;
        }
      }  
  });
  // ------------------------------------------------------------------------
  var randomfirstplayer = 1; // change this to 0 for a) 2nd player start first
  // ------------------------------------------------------------------------
  socket.on('continueNextGame', function (player) {
    continueGame[socket.id] = 1;
    if(continueGame[opponent[socket.id]] == 1) {
      var a,b;
      if(randomfirstplayer == 1){
          a = Math.random();
          b = Math.random();
          console.log("--> Random first player...");     
      }
      else {
        if(player == 1) {
          a = 0;
          b = 1;  
          console.log("--> "+socket.username+" switches to be second player.");        
        }else if(player == 2){
          a = 1;
          b = 0; 
          console.log("--> "+socket.username+" switches to be first player.");   
        }
      }      
      for (var i = 0; i < readyID.length; i++) {
        if(readyID[i].id == opponent[socket.id]) {
          readyID[i].emit('redirectToGame',{ // opponent
            opponentname: socket.username,
            value: b,
            continuegame: 1
          });
          socket.emit('redirectToGame',{ // myself
            opponentname: readyID[i].username,
            value: a,
            continuegame: 1
          });
          console.log("--> "+socket.username+" continue game with "+readyID[i].username);   
          continueGame[socket.id] = 0; 
          continueGame[opponent[socket.id]] = 0;
          break;
        }
      }         
    }
  }); 
  socket.on('quitgame', function () {
      for (var i = 0; i < readyID.length; i++) {
        if(opponent[readyID[i].id] == socket.id) {  
          console.log("--> "+socket.username+" exit from game with "+readyID[i].username); 
          readyID[i].emit('redirectToChat'); 
          var index = readyID.indexOf(readyID[i]); // remove opponent socket in array
          readyID.splice(index, 1);       
          break;
        }
      }
      var index = readyID.indexOf(socket);
      readyID.splice(index, 1);
      delete opponent[opponent[socket.id]];
      delete opponent[socket.id];
  }); 
});