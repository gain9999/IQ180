$(function() {
  if (typeof(Storage) !== "undefined") {
    $('.usernameInput').val(localStorage.getItem("name"));
  }
  var FADE_TIME = 150; // ms
  var TYPING_TIMER_LENGTH = 400; // ms
  var COLORS = [
    '#e21400', '#91580f', '#f8a700', '#f78b00',
    '#58dc00', '#287b00', '#a8f07a', '#4ae8c4',
    '#3b88eb', '#3824aa', '#a700ff', '#d300e7'
  ];

  // Initialize varibles
  var $window = $(window);
  var $usernameInput = $('.usernameInput'); // Input for username
  var $messages = $('.messages'); // Messages area
  var $userlists = $('.userlists'); // Messages area
  var $inputMessage = $('.inputMessage'); // Input message input box

  var $loginPage = $('.login.page'); // The login page
  var $chatPage = $('.chat.page'); // The chatroom page

  // Prompt for setting a username
  var username;
  var connected = false;
  var typing = false;
  var lastTypingTime;
  var $currentInput = $usernameInput.focus();

  var socket = io();
  var startbuttonclicked = 0;

  function addParticipantsMessage (data) {
    var message = '';
    if (data.numUsers === 1) {
      message += "there's 1 online user";
    } else {
      message += "there are " + data.numUsers + " online users";
    }
    updateOnlineUsers(data);
    log(message);
  }
  function updateOnlineUsers(data){
  	$userlists.text("");
  	for (var prop in data.usernames) {
        var u = data.usernames[prop];
        if(u != username)
          var html = "<li style='color:"+getUsernameColor(u)+";'><a href='#' class='pm' id='"+u+"'>"+u+"</a></li>";
        else 
          var html = "<li style='color:"+getUsernameColor(u)+";'>"+u+"</li>";
        $userlists.prepend(html);
    }
  }
  $(document).on("click", "a", function(){ // to do for extra point private message features
    if ( $( this ).hasClass( "pm" ) ) {
      $inputMessage.val('@'+this.id+' ');
      $inputMessage.focus();
    }
  });
  $("#startbutton").click(function(){
    if(startbuttonclicked == 0){
      $( this ).css( "background-color", "green" );
      $( this ).text("ready");
      startbuttonclicked = 1;
      var message = "is now ready for the game.";
      addChatMessage({
          username: username,
          message: message,
          pmuser: null
      });      
      socket.emit('new message', message,null);
      socket.emit('ready');     
    }
    else {
      $( this ).css( "background-color", "red" );
      $( this ).text("start");      
      startbuttonclicked = 0;
      var message = "isn't ready for the game.";
      addChatMessage({
          username: username,
          message: message,
          pmuser: null
      });      
      socket.emit('new message', message,null);   
      socket.emit('ready');   
    }
  });
  // Sets the client's username
  function setUsername () {
    username = cleanInput($usernameInput.val().trim());
    localStorage.setItem("name", username);
    // If the username is valid
    if (username) {
      $loginPage.fadeOut();
      $chatPage.show();
      $loginPage.off('click');
      $currentInput = $inputMessage.focus();

      // Tell the server your username
      socket.emit('add user', username);
    }
  }

  // Sends a chat message
  function sendMessage () {
    var message = $inputMessage.val();
    if(message.charAt(0) == '@'){
      var pmuser =  message.substr(1,message.indexOf(' ')).trim();
      message = message.substr(message.indexOf(" ") + 1);
      $inputMessage.val('@'+pmuser+' ');
      addChatMessage({
          username: username,
          message: message,
          pmuser: pmuser
      });      
      socket.emit('new message', message,pmuser);
    }
    else {
      // Prevent markup from being injected into the message
      message = cleanInput(message);
      // if there is a non-empty message and a socket connection
      if (message && connected) {
        $inputMessage.val('');
        addChatMessage({
          username: username,
          message: message,
          pmuser: null
        });
        // tell server to execute 'new message' and send along one parameter
        socket.emit('new message', message,null);
      }
    }
  }

  // Log a message
  function log (message, options) {
    var $el = $('<li>').addClass('log').text(message);
    addMessageElement($el, options);
  }

  // Adds the visual chat message to the message list
  function addChatMessage (data, options) {
    // Don't fade the message in if there is an 'X was typing'
    var $typingMessages = getTypingMessages(data);
    options = options || {};
    if ($typingMessages.length !== 0) {
      options.fade = false;
      $typingMessages.remove();
    }
    if(data.pmuser != null) {
      var $usernameDiv = $('<span class="username"/>')
      .text(data.username+'->'+data.pmuser+':')
      .css('color', getUsernameColor(data.username));
    }
    else {
      var $usernameDiv = $('<span class="username"/>')
      .text(data.username+':')
      .css('color', getUsernameColor(data.username));
    }
    var $messageBodyDiv = $('<span class="messageBody">')
      .text(data.message);

    var typingClass = data.typing ? 'typing' : '';
    var $messageDiv = $('<li class="message"/>')
      .data('username', data.username)
      .addClass(typingClass)
      .append($usernameDiv, $messageBodyDiv);

    addMessageElement($messageDiv, options);
  }

  // Adds the visual chat typing message
  function addChatTyping (data) {
    data.typing = true;
    data.message = 'is typing';
    addChatMessage(data);
  }

  // Removes the visual chat typing message
  function removeChatTyping (data) {
    getTypingMessages(data).fadeOut(function () {
      $(this).remove();
    });
  }

  // Adds a message element to the messages and scrolls to the bottom
  // el - The element to add as a message
  // options.fade - If the element should fade-in (default = true)
  // options.prepend - If the element should prepend
  //   all other messages (default = false)
  function addMessageElement (el, options) {
    var $el = $(el);

    // Setup default options
    if (!options) {
      options = {};
    }
    if (typeof options.fade === 'undefined') {
      options.fade = true;
    }
    if (typeof options.prepend === 'undefined') {
      options.prepend = false;
    }

    // Apply options
    if (options.fade) {
      $el.hide().fadeIn(FADE_TIME);
    }
    if (options.prepend) {
      $messages.prepend($el);
    } else {
      $messages.append($el);
    }
    $messages[0].scrollTop = $messages[0].scrollHeight;
  }

  // Prevents input from having injected markup
  function cleanInput (input) {
    return $('<div/>').text(input).text();
  }

  // Updates the typing event
  function updateTyping () {
    if (connected) {
      if (!typing) {
        typing = true;
        socket.emit('typing');
      }
      lastTypingTime = (new Date()).getTime();

      setTimeout(function () {
        var typingTimer = (new Date()).getTime();
        var timeDiff = typingTimer - lastTypingTime;
        if (timeDiff >= TYPING_TIMER_LENGTH && typing) {
          socket.emit('stop typing');
          typing = false;
        }
      }, TYPING_TIMER_LENGTH);
    }
  }

  // Gets the 'X is typing' messages of a user
  function getTypingMessages (data) {
    return $('.typing.message').filter(function (i) {
      return $(this).data('username') === data.username;
    });
  }

  // Gets the color of a username through our hash function
  function getUsernameColor (username) {
    // Compute hash code
    var hash = 7;
    for (var i = 0; i < username.length; i++) {
       hash = username.charCodeAt(i) + (hash << 5) - hash;
    }
    // Calculate color
    var index = Math.abs(hash % COLORS.length);
    return COLORS[index];
  }

  // Keyboard events

  $window.keydown(function (event) {
    // Auto-focus the current input when a key is typed
    if (!(event.ctrlKey || event.metaKey || event.altKey)) {
      $currentInput.focus();
    }
    // When the client hits ENTER on their keyboard
    if (event.which === 13) {
      if (username) {
        sendMessage();
        socket.emit('stop typing');
        typing = false;
      } else {
        setUsername();
      }
    }
  });

  $inputMessage.on('input', function() {
    updateTyping();
  });

  // Click events

  // Focus input when clicking anywhere on login page
  $loginPage.click(function () {
    $currentInput.focus();
  });

  // Focus input when clicking on the message input's border
  $inputMessage.click(function () {
    $inputMessage.focus();
  });

  // Socket events

  // Whenever the server emits 'login', log the login message
  socket.on('login', function (data) {
    connected = true;
    // Display the welcome message
    var message = "Welcome, "+data.username;
    log(message, {
      prepend: true
    });
    addParticipantsMessage(data);
  });

  // Whenever the server emits 'new message', update the chat body
  socket.on('new message', function (data) {
    if(username == data.pmuser || data.pmuser == null) addChatMessage(data);
  });

  // Whenever the server emits 'user joined', log it in the chat body
  socket.on('user joined', function (data) {
    log(data.username + ' joined');
    addParticipantsMessage(data);
  });

  // Whenever the server emits 'user left', log it in the chat body
  socket.on('user left', function (data) {
    log(data.username + ' left');
    addParticipantsMessage(data);
    removeChatTyping(data);
  });

  // Whenever the server emits 'typing', show the typing message
  socket.on('typing', function (data) {
    addChatTyping(data);
  });

  // Whenever the server emits 'stop typing', kill the typing message
  socket.on('stop typing', function (data) {
    removeChatTyping(data);
  });

  socket.on('enternewname', function () {
    alert("This name has been used, try a new one.")
    location.reload();
  }); 
  socket.on('redirectToGame', function (data) {
    $('.pages').css( "display", "none" );
    $chatPage.fadeOut();
    if(data.continuegame != 1){
      myscore = 0;
      opponentscore = 0;
      $('#myscore').text('0');
      $('#opponentscore').text('0');     
    }
    $('#calculatedresult').val('');
    $('#answer').val('');
    $('#result').text('...');
    $('#timer').text('60');
    $('.gamepage').css( "display", "inline" );
    $('.gamepage').fadeIn();
    $('#myname').text(username);
    $('#opponentname').text(data.opponentname);
    opponentname = data.opponentname;
    startGame(null,data.value);// start game here
  });    
  socket.on('redirectToChat', function () {
    $('.gamepage').css( "display", "none" );
    $('.gamepage').fadeOut();    
    $('.pages').css( "display", "inline" );
    $chatPage.fadeIn();
    $( '#startbutton' ).css( "background-color", "red" );
    $( '#startbutton' ).text("start");      
    startbuttonclicked = 0;    
  });      
  function sendToPeer(mode,value) { // send to opponent
     socket.emit('sendToPeer',mode, value);
  }  
  socket.on('sendToPeerGame', function (data) { // recieve from server
    startGame(data.mode,data.value);
  });  

  function startTimer() {
    if(timer > 0){
      timer = timer-0.1;
      $('#timer').text(timer.toFixed(1));
      timerfunc = setTimeout(startTimer, 100);
    }
    if(timer <= 0){
      $('#timer').text('0.0');
      if(myturn == 1) {
        myturn = 0;
        if(player == 1) {
          mytime = 0;
          sendToPeer('start2ndPlayerTurn',0); // time left 0 sec
        }
        else if(player == 2) {
          mytime = 0;
          checkWinner();       
          sendToPeer('tellPlayer1WhoWon',0);
        }        
      }
    }
  }
  function check(input){
    var str = input.replace(/[^-()\d/*+.]/g, '');
    return eval(str);
  }  
  function generateRandom(){
    var num1 = Math.floor(Math.random() * 8) + 1;
    var num2 = Math.floor(Math.random() * 8) + 1;
    var num3 = Math.floor(Math.random() * 8) + 1;
    var num4 = Math.floor(Math.random() * 8) + 1;
    var num5 = Math.floor(Math.random() * 8) + 1;
    var result = randomIntFromInterval(num1,num2,num3,num4,num5);
    return [num1,num2,num3,num4,num5,result];
  }  
  function randomIntFromInterval(one,two,three,four,five)
  {
      var ff = 0.1;
      while(ff%1 != 0){//not integer)
        var op1 = Math.floor(Math.random() * 4) + 1;
        var ot = 0;
        if (op1==1) {ot=one+two;}
        else if (op1==2){ot=one-two;}
        else if (op1==3){ot=one*two;}
        else {ot=one/two;}
        //console.log(ot);
        var op2 = Math.floor(Math.random() * 4) + 1;
        var tt = 0;
        if (op2==1) {tt=ot+three;}
        else if (op2==2){tt=ot-three;}
        else if (op2==3){tt=ot*three;}
        else {tt=ot/three;}
        //console.log(tt);
        var op3 = Math.floor(Math.random() * 4) + 1;
        var tf = 0;
        if (op3==1) {tf=tt+four;}
        else if (op3==2){tf=tt-four;}
        else if (op3==3){tf=tt*four;}
        else {tf=tt/four;}
        //console.log(tf);
        var op4 = Math.floor(Math.random() * 4) + 1;
        
        if (op3==1) {ff=tf+four;}
        else if (op3==2){ff=tf-four;}
        else if (op3==3){ff=tf*four;}
        else {ff=tf/four;}
        //console.log(ff);
      }
      return ff;
  }    

  var player = 0;
  var randomStart = null;
  var generateDigit = [];
  var genresult;
  var timer,mytime,enemytime;
  var timerfunc;
  var opponenttimerfunc;
  var opponentname;
  var myscore = 0, opponentscore = 0, myturn = 0;
  function startGame(mode,value){
    if(mode == null) { // initailize game page
      randomStart = value 
      sendToPeer('getFirstPlayer',randomStart);
      $('.playorexit').hide();
      $('#continue').text("Continue");  
    }     
    else if(mode == "getFirstPlayer"){
      if(randomStart > value) { 
        //alert("I'm the first Player!");
        player = 1;
        generateDigit = generateRandom();
        sendToPeer('sendRamdomDigit',generateDigit); 
        alert("Press enter to begin the game.");
        $('#answer').focus();
        for(i=0;i<5;i++){
            $('#num'+(i+1)).text(generateDigit[i]);      
        }
        genresult = generateDigit[5];
        $('#result').text(genresult);
        $('#turn').text(username);
        timer = 60.0;
        startTimer();
        sendToPeer('startTimer',1);
        /*opponenttimerfunc = setTimeout(function() { 
          sendToPeer('start2ndPlayerTurn',0); // time left 0 sec
          mytime = 0;
        }, 64000);*/
        myturn = 1;
      }
      else {
        //alert("I'm the second Player!");
        player = 2;
      }
    } 
    else if(mode == "sendRamdomDigit"){
      generateDigit = value;
      for(i=0;i<5;i++){
        $('#num'+(i+1)).text("x"); //generateDigit[i]       
      }
      genresult = generateDigit[5];
    } 
    else if(mode == "startTimer"){
      $('#turn').text(opponentname+"'s");
      timer = 60.0;
      startTimer(); 
      myturn = 0;         
    }
    else if(mode == "stopTimer"){
      clearTimeout(timerfunc);      
    }    
    else if(mode == "start2ndPlayerTurn") {
      $('#turn').text(username+"'s");
      alert("Press enter to begin the game.");
      $('#answer').focus();
      for(i=0;i<5;i++){
        $('#num'+(i+1)).text(generateDigit[i]);  
      }  
      $('#result').text(genresult);
      clearTimeout(timerfunc);
      timer = 60.0;
      startTimer(); 
      myturn = 1;
      sendToPeer('startTimer',1);
      enemytime = value;
      /*opponenttimerfunc = setTimeout(function() { 
          sendToPeer('tellPlayer1WhoWon',0);
          mytime = 0;
          checkWinner();
      }, 64000);    */  
    }
    else if(mode == "tellPlayer1WhoWon"){
      enemytime = value;
      checkWinner();     
    }
  }
  $('#answer').keypress(function (e) { // submit answer
    if (e.which == 13 && myturn == 1) {
      var ansinput = $('#answer').val();
      var missingdigit;
      for(i=0;i<5;i++){ // check whether the answer use all 5 digits
        if(ansinput.indexOf(generateDigit[i]) == -1) {
          missingdigit = 1;
          break;
        }
        else {
          var countdigit = 0;
          var anscount = ansinput.count(generateDigit[i].toString());
          for(j=0;j<5;j++){
            if(generateDigit[i] == generateDigit[j]) countdigit++;
          }
          if(countdigit != anscount){
            missingdigit = 1;
            break;
          }
        }
      }
      if(missingdigit != 1) {     
        $('#calculatedresult').val(check(ansinput));
        if(check(ansinput) == genresult) {     
          sendToPeer('stopTimer',1);
          clearTimeout(timerfunc);
          //clearTimeout(opponenttimerfunc);
          mytime = timer
          $('#status').text("Correct !");
          if(player == 1){
            sendToPeer('start2ndPlayerTurn',mytime); // send time left to 2nd player too.
          }
          else if(player == 2){
            sendToPeer('tellPlayer1WhoWon',mytime);
            checkWinner();
          }
        } else $('#status').text("Incorrect !");
      } else $('#status').text("You have to use all the digits !");
      return false;   
    }
  });
  function checkWinner(){
          if(mytime == enemytime){
            alert("Your time "+(60-mytime).toFixed(1)+"s\n"
            +"Enemy's time "+(60-enemytime).toFixed(1)+"s\n"
            +"+++ Draw +++");
          }
          else if(mytime > enemytime){
            alert("Your time "+(60-mytime).toFixed(1)+"s\n"
            +"Enemy's time "+(60-enemytime).toFixed(1)+"s\n"
            +"+++ You won +++");
            myscore++;
            $('#myscore').text(myscore);            
          }
          else {
            alert("Your time "+(60-mytime).toFixed(1)+"s\n"
            +"Enemy's time "+(60-enemytime).toFixed(1)+"s\n"
            +"+++ You lose +++");  
            opponentscore++;
            $('#opponentscore').text(opponentscore);                     
          }   
          $('.playorexit').show(); 
  }
  $('.myButton').click(function() {
    if(myturn == 1) {
      var operation = this.text;
      if(operation == 'x') operation = '*';
      $('#answer').val($('#answer').val()+operation);
      $('#status').text("");
    }
  });
  $('.number').click(function() {
    if(myturn == 1) {
      if ($( this ).hasClass( "numberclicked" ) ) { 
        var ansinput = $('#answer').val();
        ansinput = ansinput.replace(this.text, '');
        $('#answer').val(ansinput);
      }     
      else {
        $('#answer').val($('#answer').val()+this.text);
      } 
      $( this ).toggleClass( "number numberclicked" );
      $('#answer').focus();
      $('#status').text("");
    }
  }); 
  String.prototype.count=function(s1) { 
      return (this.length - this.replace(new RegExp(s1,"g"), '').length) / s1.length;
  }  
  var anslength = 0,previousdigit;
  $('#answer').on('input', function() { // prevent user from typing other number that not on the list
      $('#status').text("");
      var ansinput = $('#answer').val();
      var lastword = ansinput[ansinput.length - 1];
      if(!isNaN(lastword)) lastword = lastword*1; // convert string to int
      if(lastword != "(" && lastword != ")" && lastword != " " && lastword != "+" && lastword != "-" && lastword != "*" && lastword != "/" || lastword == "0"){
        if($.inArray(lastword, generateDigit) == -1 || lastword == "0"){ // not found
          ansinput = ansinput.slice(0,-1);
          $('#answer').val(ansinput);
        }
        else {
          var countdigit = 0;
          var anscount = ansinput.count(lastword.toString());
          for(i=0;i<5;i++){
            if(generateDigit[i] == lastword) countdigit++;
          }
          if(anscount > countdigit){
            ansinput = ansinput.slice(0,-1);
            $('#answer').val(ansinput);
          }
          else{ //disable the digit button that user type
            if(ansinput.length > anslength) $(".number:contains("+lastword+")").first().toggleClass( "number numberclicked" );
            else $(".numberclicked:contains("+previousdigit+")").first().toggleClass( "number numberclicked" );
          }
        }
        previousdigit = lastword;
      }
      else {
          if(ansinput.length < anslength) {
            var countdigit = 0;
            var anscount = ansinput.count(previousdigit.toString());
            for(i=0;i<5;i++){
              if(generateDigit[i] == lastword) countdigit++;
            }
            if(anscount-countdigit == 1 || anscount==countdigit){
              $(".numberclicked:contains("+previousdigit+")").first().toggleClass( "number numberclicked" );
               previousdigit = lastword;
            }
          }
      }
      if(ansinput.length == 0){
        $(".numberclicked").toggleClass( "number numberclicked" );
      }      
      anslength = ansinput.length;
  });    
  $('#answer').bind("paste",function(e) {
    e.preventDefault();
  });
  $('.playorexit').hide();
  $('#continue').click(function() { 
    socket.emit('continueNextGame',player);
    $('#continue').text("Waiting...");  
  });
  $('#quit').click(function() {
    $('.gamepage').css( "display", "none" );
    $('.gamepage').fadeOut();    
    $('.pages').css( "display", "inline" );
    $chatPage.fadeIn();
    $( '#startbutton' ).css( "background-color", "red" );
    $( '#startbutton' ).text("start");      
    startbuttonclicked = 0;
    myscore = 0;
    opponentscore = 0;
    player = 0;
    randomStart = null;
    generateDigit = [];
    socket.emit('quitgame');
  });
});