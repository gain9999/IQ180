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
    $('.gamepage').css( "display", "inline" );
    $('.gamepage').fadeIn();
    $('#myname').text(username);
    $('#opponentname').text(data.opponentname);
    startGame();// start game here
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
  function sendToPeer(data) { // send to opponent
     socket.emit('sendToPeer', data);
  }  
  socket.on('sendToPeerGame', function (data) { // recieve from server
    alert(data.value);
  });  
  function startGame(){
    //sendToPeer("hello");
  }
});