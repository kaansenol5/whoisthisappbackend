const express = require("express");
const app = express();
const http = require("http");
const server = http.createServer(app);
const { Server } = require("socket.io");
const io = new Server(server);

const debug = true;

function log(msg) {
  if (debug) {
    console.log(msg);
  }
}

const questions = [
  "Who is the most influential person in modern history?",
  "Who is the most talented musician of all time?",
  "Who is the most underrated actor/actress?",
];
app.get("/", (req, res) => {
  res.sendFile(__dirname + "/index.html");
});

app.get("/games", (req, res) => {
  res.send(games);
});

io.of("/").adapter.on("create-room", (room) => {
  // console.log(`room ${room} was created`);
});

io.of("/").adapter.on("join-room", (room, id) => {
  console.log(`socket ${id} has joined room ${room}`);
});

/* Game
{
  game_id: game_id,
  room_id: room
  players: [],
  question: questions[0],
  question_index: 0,
  answers: [],
  started: false,
  finished: false,
  question_over: false,
  last_correct_answer: -1,
}
Player
{
id: socket.id,
name: player_name,
points: 0,
is_creator: Bool,
answer: -1,
}

*/
var games = [];
function getGame(id) {
  // find a game in games by game id or room id
  for (game of games) {
    if (game.game_id == id) {
      log("fetched game " + id + " by game_id");
      return game;
    }
  }
  log("invalid game id search");
}

function getPlayer(game_id, playerid) {
  // get player in a game by name or id.
  const game = getGame(game_id);
  for (player of game.players) {
    if (player.id == playerid) {
      log("fetched player " + player + " by id");

      return player;
    }
    if (player.name == playerid) {
      log("fetched player " + player + " by name");

      return player;
    }
  }
}

function createGame() {
  var id = Math.floor(Math.random() * 999999) + 100000;
  if (debug) {
    id = 1;
  }
  games.push({
    game_id: id,
    players: [],
    question: questions[0],
    question_index: 0,
    answers: [],
    started: false,
    finished: false,
    question_over: false,
    last_correct_answer: -1,
  });
  log("game created, id: " + id);
  return id;
}

function getGameIdByPlayerId(socket) {
  let gameRoom = null;
  const rooms = socket.rooms;
  rooms.forEach((r) => {
    if (r !== socket.id) {
      gameRoom = r;
    }
  });
  return gameRoom;
}

function validateCreator(gameid, player_id) {
  const game = getGame(gameid);
  const player = getPlayer(gameid, player_id);
  log(player);
  if (player.is_creator) {
    log(player.name + "is creator.");
    return true;
  }
  log(player.name + "is not creator.");
  return false;
}

function addPlayerToGame(game_id, player_name, player_id) {
  const game = getGame(game_id);
  if (game == undefined) {
    log("player attempted to join invalid game id");
    return "Please check your game id";
  }
  if (player_name == undefined) {
    return "Invalid player name";
  }
  if (game.started) {
    return "This game has already started";
  }
  var is_creator = false;
  if (game.players.length == 0) {
    log("game creator joined");
    is_creator = true;
  } else {
    if (getPlayer(game_id, player_name) != undefined) {
      log("player with same name exists");
      return "A player with the same name is already in game";
    }
  }
  game.players.push({
    id: player_id,
    name: player_name,
    points: 0,
    is_creator: is_creator,
    answer: -1,
  });
  log("added player" + player_name + " to game " + game.game_id);
  return 0;
}

function removePlayer(gameid, playerId) {
  const game = getGame(gameid);
  log("attempt to remove " + playerId);
  // log(game.players);
  for (player of game.players) {
    if (player.name == playerId || player.id == playerId) {
      const index = game.players.indexOf(player);
      game.players.splice(index, 1);
      return player.id;
    }
  }
  log("invalid removePlayer");
  return 1;
}

function addAnswer(game_id, player_id, answer) {
  const game = getGame(game_id);
  const player = getPlayer(game_id, player_id);
  if (game.question_over || player.answer != -1 || !game.started) {
    return 1;
  }
  player.answer = answer;
  game.answers.push(answer);
  if (game.answers.length == game.players.length) {
    game.question_over = true;
    log("question over");
    game.last_correct_answer = getCorrectAnswer(game.answers);
    game.answers = [];
    log("correct answer " + game.last_correct_answer);
    givePoints(game);
    if (game.question_index == questions.length - 1) {
      game.finished = true;
      destroyGame(game.game_id);
    }
  }
  return 0;
}

function getCorrectAnswer(arr) {
  const counts = new Map();

  // Count each integer's occurrences
  for (const num of arr) {
    if (counts.has(num)) {
      counts.set(num, counts.get(num) + 1);
    } else {
      counts.set(num, 1);
    }
  }

  let maxCount = 0;
  let mostOccurring = -2; // Default to -2 if no number occurs more than once

  // Find the integer with the highest count
  counts.forEach((count, num) => {
    if (count > maxCount) {
      maxCount = count;
      mostOccurring = num;
    }
  });

  // Return -2 if no number occurs more than once
  return maxCount === 1 ? -2 : mostOccurring;
}

function givePoints(game) {
  game.players.forEach((player) => {
    if (player.answer == game.last_correct_answer) {
      player.points++;
    }
  });
}

function destroyGame(gameId) {
  const game = getGame(gameId);
  for (player of game.players) {
    const socket = io.sockets.sockets.get(player.id);
    socket.emit("game_over");
    sendGameData(gameId, socket.id);
    socket.leave(game.game_id);
  }
  const index = games.indexOf(game);
  games.splice(index, 1);
  log("game_id: " + gameId + " has been destroyed");
}

function sendError(socket, message) {
  log("emitting error to " + socket.id + " message: " + message);
  io.to(socket.id).emit("error", { message: message });
}

function sendGameData(id, to) {
  const game = getGame(id);

  if (to == 0) {
    to = game.game_id;
  }
  io.to(to).emit("game_data", { game_data: game });
}

io.on("connection", (socket) => {
  log("a user connected");
  socket.on("disconnect", () => {
    log("a user disconnected");
  });
  socket.on("create_game", () => {
    const id = createGame();
    io.to(socket.id).emit("game_created", { game_id: id });
  });
  socket.on("join_game", (msg) => {
    const code = addPlayerToGame(msg.game_id, msg.player_name, socket.id);
    if (code != 0) {
      sendError(socket, code);
    } else {
      socket.join(msg.game_id);
      io.to(socket.id).emit("joined_game");
    }
  });
  socket.on("fetch_state", () => {
    sendGameData(getGameIdByPlayerId(socket), socket.id);
  });
  socket.on("start_game", () => {
    const gameId = getGameIdByPlayerId(socket);
    if (validateCreator(gameId, socket.id)) {
      const game = getGame(gameId);
      game.started = true;
      sendGameData(game.game_id, 0);
    } else {
      sendError(socket, "You are not admin");
    }
  });
  socket.on("remove_player", (msg) => {
    const game_id = getGameIdByPlayerId(socket);
    if (validateCreator(game_id, socket.id)) {
      log("removeplayer recieved and validated");
      const removed_player_id = removePlayer(game_id, msg.player);
      if (removed_player_id != 1) {
        sendGameData(game_id, 0);
        const socket = io.sockets.sockets.get(removed_player_id);
        if (socket) {
          log("removed " + socket.id + " from room " + game_id);
          socket.leave(game_id);
        } else {
          log("could not remove player from room");
        }
      }
    } else {
      sendError(socket, "You are not admin");
    }
  });
  socket.on("submit_answer", (msg) => {
    const status = addAnswer(
      getGameIdByPlayerId(socket),
      socket.id,
      msg.answer,
    );
    if (status == 1) {
      sendError(socket, "Failed to submit your answer");
    }
    sendGameData(getGameIdByPlayerId(socket), socket.id);
  });
  socket.on("next_question", () => {
    const game_id = getGameIdByPlayerId(socket);
    const game = getGame(game_id);
    if (game.finished) {
      sendError(socket, "This game has ended");
      return;
    }
    if (validateCreator(game_id, socket.id)) {
      game.question_over = false;
      game.question_index += 1;
      game.question = questions[game.question_index];
      for (p of game.players) {
        p.answer = -1;
      }
    } else {
      sendError(socket, "You are not admin");
    }
    sendGameData(game_id, 0);
  });
});

server.listen(3000, () => {
  console.log("listening on *:3000");
});
