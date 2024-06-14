const io = require("socket.io-client");
const readline = require("readline");

// replace 'http://localhost:3000' with your server's address
const socket = io("http://localhost:3000");
var ingame = false;
var game = {};
// handle connection
socket.on("connect", () => {
  console.log("connected to server");
});

socket.on("game_created", (msg) => {
  console.log("game created " + msg.game_id);
});

// handle messages from the server
socket.on("joined_game", () => {
  console.log("joined");
  ingame = true;
});

socket.on("error", (msg) => {
  console.log(msg.message);
});

socket.on("game_data", (msg) => {
  console.log(msg.game_data);
  game = msg.game_data;
});

// handle disconnection
socket.on("disconnect", () => {
  console.log("disconnected from server");
});

// example of sending a message to the server

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

const askQuestion = (query) => {
  return new Promise((resolve) => rl.question(query, resolve));
};

function getState() {
  socket.emit("fetch_state");
}

function createGame() {
  socket.emit("create_game");
}

function joinGame(id, name) {
  socket.emit("join_game", { game_id: id, player_name: name });
}
function startGame() {
  socket.emit("start_game");
}
function removePlayer(player) {
  socket.emit("remove_player", { player: player });
}
function submitAnswer(answer) {
  socket.emit("submit_answer", { answer: answer });
}
function nextQuestion() {
  socket.emit("next_question");
}

const shell = async () => {
  while (true) {
    const input = await askQuestion("# ");
    const arr = input.split(" ");
    switch (arr[0]) {
      case "join":
        joinGame(arr[1], arr[2]);
        break;
      case "create":
        createGame();
        break;
      case "startgame":
        startGame();
        break;
      case "removeplayer":
        removePlayer(arr[1]);
        break;
      case "submitanswer":
        submitAnswer(arr[1]);
        break;
      case "nextquestion":
        nextQuestion();
        break;
      case "update":
        getState();
        break;
      case "state":
        if (ingame) {
          console.log(game);
          break;
        }
        console.log("not in game");
        break;
      default:
        console.log("no such command");
    }
  }
};

shell();
