const express = require("express");
const app = express();
const http = require("http");
const server = http.createServer(app);
const { Server } = require("socket.io");
const io = new Server(server);

const questions = [
  "Who is the most influential person in modern history?",
  "Who is the most talented musician of all time?",
  "Who is the most underrated actor/actress?",
  "Who is the most inspirational leader of the 21st century?",
  "Who is the most innovative entrepreneur of our time?",
  "Who is the most beloved fictional character?",
  "Who is the most influential scientist in history?",
  "Who is the most successful athlete of the past decade?",
  "Who is the most impactful social media influencer?",
  "Who is the most iconic fashion icon?",
];

var games = [];

function generate_game_id() {
  return Math.floor(Math.random() * 999999) + 100000;
}

function getCorrectAnswer(arr) {
  let counts = {};
  let maxCount = 0;
  let mostCommon;

  arr.forEach((num) => {
    counts[num] = (counts[num] || 0) + 1;
    if (counts[num] > maxCount) {
      maxCount = counts[num];
      mostCommon = num;
    }
  });

  return mostCommon;
}

function getGame(socket) {
  let gameRoom = null;
  const rooms = socket.rooms;
  rooms.forEach((r) => {
    if (r !== socket.id) {
      gameRoom = r;
    }
  });

  const game = games.find((game) => game.game_id === gameRoom);
  return game;
}

function validateCreator(socket) {
  const game = getGame(socket);
  const player = game.players.find(
    (player) => game.players.player_name === msg.player_name,
  );
  if (player.is_creator) {
    return true;
  }
  return false;
}

app.get("/", (req, res) => {
  res.sendFile(__dirname + "/index.html");
});

io.of("/").adapter.on("create-room", (room) => {
  console.log(`room ${room} was created`);
});

io.of("/").adapter.on("join-room", (room, id) => {
  console.log(`socket ${id} has joined room ${room}`);
});

io.on("connection", (socket) => {
  console.log("a user connected");
  socket.on("disconnect", () => {
    console.log("user disconnected");
  });
  socket.on("create_game", (msg) => {
    const game_id = generate_game_id();
    games.push({
      game_id: game_id,
      players: [],
      question: questions[0],
      question_index: 0,
      answers: [],
      started: false,
      finished: false,
      question_over: false,
    });
    io.to(socket.id).emit("game_created", { game_id: game_id });
    console.log("game created " + game_id);
  });

  socket.on("join_game", (msg) => {
    //  console.log(msg);
    //console.log(games);
    const game = games.find((game) => game.game_id === msg.game_id);
    if (game == undefined) {
      io.to(socket.id).emit("error", { message: "no such game exists" });
      console.log("err");
      return;
    }
    var is_creator = false;
    const player_with_same_name = game.players.find(
      (player) => game.players.player_name === msg.player_name,
    );
    if (player_with_same_name != undefined) {
      io.to(socket.id).emit("error", {
        message: "a player with the same name is playing",
      });
      return;
    }
    if (game.players.length == 0) {
      is_creator = true;
    }
    game.players.push({
      id: socket.id,
      name: msg.player_name,
      points: 0,
      is_creator: is_creator,
    });
    socket.join(game.game_id);
    // console.log(msg.player_name + " joined " + msg.game_id);
    io.to(socket.id).emit("joined_game");
  });

  socket.on("start_game", () => {
    if (validateCreator(socket)) {
      const game = getGame(socket);
      game.started = true;
    }
  });

  socket.on("fetch_game_data", () => {
    const game = getGame(socket);
    io.to(game.game_id).emit("game_data", { game_data: game });
  });

  socket.on("submit_answer", (msg) => {
    const answer = msg.answer;
    const game = getGame(socket);
    if (game.question_over) {
      return;
    }
    game.answers.push(answer);
    if (game.answers.length == game.players.length) {
      game.question_over == true;
      io.to(game.game_id).emit("game_data", { game_data: game });
    }
  });

  socket.on("next_question", () => {
    const game = getGame(socket);
    if (validateCreator(socket)) {
      game.question_over == false;
      game.question_index += 1;
      game.question == questions[game.question_index];
      io.to(game.game_id).emit("game_data", { game_data: game });
    }
  });
});

server.listen(3000, () => {
  console.log("listening on *:3000");
});
