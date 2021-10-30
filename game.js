let showSunken = false;
let soundOn = false;
var soundInterval;
const SOUND_MISS = document.getElementById("soundMiss"); //"https://freesound.org/data/previews/479/479450_5103872-lq.mp3";
const SOUND_HIT = document.getElementById("soundHit");
const SOUND_SINK = document.getElementById("soundSink"); //https://freesound.org/data/previews/33/33637_129090-lq.mp3 (old)
const SOUND_WIN = document.getElementById("soundWin"); //https://freesound.org/data/previews/413/413204_2559515-lq.mp3
const SOUND_LOSE = document.getElementById("soundLose"); //https://freesound.org/data/previews/456/456962_6456158-lq.mp3 (old)

let BOARD_SIZE = 10; //eg. 10 = 10x10 board
const CELL_SIZE = 45;
const LETTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
const TURN_DELAY = 1; //amount of seconds it takes AI to move
const BUTTON_CLASS = "mui-btn mui-btn--raised";

let P1 = "Player 1";
const P2 = "Opponent";

const DEBUG = false;
const DEBUG_HARDCORE = false;

//log action constants
const ACTION_START = "START";
const ACTION_HIT = "HIT";
const ACTION_MISS = "MISS";
const ACTION_SINK = "HIT-SUNK";
const ACTION_NONE = "NONE";
const ACTION_WIN = "WIN";

//difficulty constants
const DIFF_EASY = "Easy"; //100% random AI guesses
const DIFF_MEDIUM = "Medium"; //random guesses until hit, then search around hit
const DIFF_HARD = "Hard"; //strategic guesses until hit, then beeline hits until sunk
const DIFF_IMPOSSIBLE = "Impossible"; //lol, all hits
let DIFFICULTY = DIFF_HARD;

//orientation constants
const ORIENTATION_HORIZONTAL = "Horizontal";
const ORIENTATION_VERTICAL = "Vertical";

//ai patterns
const PATTERN_FIND_ALL = "FINDALL"; //checkers
const PATTERN_FIND_RISK = "FINDRISK"; //find carrier hoping to find more

//display constants
const SHOW_SUNKEN_SHIPS = "Announce Sunken Ship Names";
const HIDE_SUNKEN_SHIPS = "Omit Sunken Ship Names"

let goingEvens = true;

//foundShip: { ship, rows, cols }
let foundShip = undefined; //used with MEDIUM and HARD difficulties

var eInterval; //turn timer interval

let gameOver = false;

let showMyBoard = true;
let noClicks = false;
let yourTurn = undefined;

let shipID = 1;

function Ship(name, size, player = P1) {
  this.id = shipID;
  this.name = name;
  this.size = size;
  this.player = player;

  this.anchorRow = -1;
  this.anchorCol = -1;

  this.parts = []; //ship segments (one per space)
  this.sunk = false; //true if all parts are hit
  shipID++;
}

let p1MoveCount = 0;
let p2MoveCount = 0;

let moveID = 1;

function Move(player, location, action, ship = undefined) {
  this.id = moveID;
  this.player = player;
  this.location = location;
  this.action = action;
  this.ship = ship;

  moveID++;
}

function Part(position) {
  this.position = position;
  this.hit = false;
}

function Position(row, col) {
  this.row = row;
  this.col = col;
}

let spaceID = 1;

function Space(row, col, el, ship = undefined) {
  this.id = spaceID;
  this.row = row;
  this.col = col;
  this.ship = ship;
  this.element = el;
  this.name = el.name; //eg A4

  this.p1Miss = false;
  this.p2Miss = false;
  spaceID++;
}

function Cardinals(left, right, up, down, none = false) {
  this.left = left;
  this.right = right;
  this.up = up;
  this.down = down;
  this.none = none;
}

const enemyShips = [
  new Ship("Aircraft Carrier", 5),
  new Ship("Battleship", 4),
  new Ship("Cruiser", 3),
  new Ship("Submarine", 3),
  new Ship("Destroyer", 2),
];

const playerShips = [
  new Ship("Aircraft Carrier", 5),
  new Ship("Battleship", 4),
  new Ship("Cruiser", 3),
  new Ship("Submarine", 3),
  new Ship("Destroyer", 2),
];

const spaces = [];
const spaces2d = [];
const moveLog = [];

function logMove(player, location, action, ship = undefined) {
  let newMove = new Move(player, location, action, ship);
  moveLog.push(newMove);
}

function getAllShips() {
  return playerShips.concat(enemyShips);
}

function checkShipsFit() {
  let totalSpaces = BOARD_SIZE * BOARD_SIZE;
  let shipSpaces = 0;
  let errMsg = "BOARD_SIZE too small for current set of ships!";
  for (const ship of getAllShips()) {
    if (ship.size > BOARD_SIZE) {
      console.error(errMsg);
      return false;
    }
    shipSpaces += ship.size;
    if (shipSpaces > totalSpaces) {
      console.error(errMsg);
      return false;
    }
  }

  return true;
}

function checkWin(player) {
  let ships = playerShips;
  if (player === P1) {
    ships = enemyShips;
  }

  for (const ship of ships) {
    if (!isShipSunk(ship)) {
      return false;
    }
  }

  return true;
}

function makeBoard() {
  let board = document.getElementById("board");

  for (var i = 0; i < BOARD_SIZE; i++) {
    let row = document.createElement("div");

    for (var j = 0; j < BOARD_SIZE; j++) {
      let cell = document.createElement("div");
      cell.className = "cell";
      cell.style.width = CELL_SIZE + "px";
      cell.style.height = CELL_SIZE + "px";
      let spaceName = "" + letter(i) + (j + 1);
      //cell.innerText = spaceName;
      cell.name = spaceName;
      //cell.innerText = "" + i + ", " + j;
      cell.innerText = spaceName;
      cell.xx = i;
      cell.yy = j;
      let sp = new Space(i, j, cell);
      spaces.push(sp);
      spaces2d[i][j] = sp;

      cell.onclick = function () {
        handleCellClick(this.xx, this.yy);
      }

      row.appendChild(cell);
    }

    board.appendChild(row);
  }

  var dim = "" + ((BOARD_SIZE * CELL_SIZE) + (CELL_SIZE / 2)) + "px";
  board.style.width = dim
  board.style.height = dim
}

let checkedRows = [];
let checkedCols = [];

function placeShips(ships, player = P1) {
  for (const ship of ships) {
    let found = false;

    let cards = undefined;
    let row = 0;
    let col = 0;
    while (!found) {
      row = getRandomNumberRange(0, BOARD_SIZE - 1, checkedRows);
      col = getRandomNumberRange(0, BOARD_SIZE - 1, checkedCols);

      checkedRows.push(row);
      checkedCols.push(col);

      cards = getShipCardinals(ship, row, col);
      if (cards.none === false) {
        spaces2d[row][col].ship = ship; //added .ship
        found = true;
      }
    }

    ship.anchorRow = row;
    ship.anchorCol = col;

    let checkOrder = [0, 1, 2, 3];
    shuffle(checkOrder);
    for (var i = 0; i < checkOrder.length; i++) {
      let dir;
      switch (checkOrder[i]) {
        case 0: //left
          dir = cards.left;
          break;
        case 1: //right
          dir = cards.right;
          break;
        case 2: //up
          dir = cards.up;
          break;
        case 3: //down
          dir = cards.down;
          break;
      }

      if (dir && dir.spots) {
        for (const spot of dir.spots) {
          ship.player = player;
          spot.ship = ship;
          var pos = new Position(spot.row, spot.col);
          var part = new Part(pos);
          ship.parts.push(part);
        }
        break;
      }
    }
  }
}

function getShipCardinals(ship, row, col) {
  //immediately return invalid if ship already anchored here
  let currentSpace = spaces2d[row][col];
  if (currentSpace.ship) {
    return new Cardinals(false, false, false, false, true);
  }

  var right = {
      spots: []
    },
    left = {
      spots: []
    },
    up = {
      spots: []
    },
    down = {
      spots: []
    };
  let dist, viewed = "";

  //check down
  dist = (col + (ship.size - 1));
  if (dist >= BOARD_SIZE) {
    down = undefined;
  } else {
    for (var i = 0; i < ship.size; i++) {
      let space = spaces2d[row][col + i];
      down.spots.push(space);
      viewed = viewed + "(" + space.row + ", " + space.col + ") ";
      if (space && space.ship) {
        down = undefined;
        break;
      }
    }
  }

  if (DEBUG_HARDCORE) {
    console.log(ship.name + " [Down] => " + viewed);
    viewed = "";
  }

  //check up
  dist = (col - (ship.size - 1));
  if (dist < 0) {
    up = undefined;
  } else {
    for (var i = 0; i < ship.size; i++) {
      let space = spaces2d[row][col - i];
      up.spots.push(space);
      viewed = viewed + "(" + space.row + ", " + space.col + ") ";
      if (space && space.ship) {
        up = undefined;
        break;
      }
    }
  }

  if (DEBUG_HARDCORE) {
    console.log(ship.name + " [Up] => " + viewed);
    viewed = "";
  }

  //check right
  dist = (row + (ship.size - 1));
  if (dist >= BOARD_SIZE) {
    right = undefined;
  } else {
    for (var i = 0; i < ship.size; i++) {
      let space = spaces2d[row + i][col];
      right.spots.push(space);
      viewed = viewed + "(" + space.row + ", " + space.col + ") ";
      if (space && space.ship) {
        right = undefined;
        break;
      }
    }
  }

  if (DEBUG_HARDCORE) {
    console.log(ship.name + " [Right] => " + viewed);
    viewed = "";
  }

  //check left
  dist = (row - (ship.size - 1));
  if (dist < 0) {
    left = undefined;
  } else {
    for (var i = 0; i < ship.size; i++) {
      let space = spaces2d[row - i][col];
      left.spots.push(space);
      viewed = viewed + "(" + space.row + ", " + space.col + ") ";
      if (space && space.ship) {
        left = undefined;
        break;
      }
    }
  }

  if (DEBUG_HARDCORE) {
    console.log(ship.name + " [Left] => " + viewed);
    viewed = "";
  }

  //for some reason, element.innerText/name doesn't stick
  //let spaceName = currentSpace.element.innerText;
  let spaceName = currentSpace.name;

  if (DEBUG_HARDCORE) {
    console.log("[" + ship.size + "]" + ship.name + "(" + spaceName + ")" +
      " (" + row + ", " + col + ") => [left, right, up, down] = [" +
      left + ", " + right + ", " + up + ", " + down + "]");
  }

  let ret = new Cardinals(left, right, up, down);
  if (!(left || right || up || down)) {
    ret.none = true;
  }

  return ret;
}

function playSound(audio, delay = false) {
  if (!audio || !soundOn) {
    return;
  }

  if (delay) {
    soundInterval = setInterval(function () {
      playSound(audio);
    }, 2200);
    return;
  }

  clearInterval(soundInterval);

  if (audio.paused) {
    audio.play();
  } else {
    audio.currentTime = 0;
  }
}

function letter(position) {
  let sep = "_";
  let limit = LETTERS.length;
  let input = (position < 0 ? 0 : position);
  let res = limit + 1;

  let passes = 0;
  if (input !== 0) {
    passes = Math.floor(input / limit);
    input = input % limit;
  }

  let suffix = "";

  if (passes > 0) {
    if (passes === 1) {
      //add a lowercase letter
      suffix += LETTERS[input].toLowerCase();
    } else if (passes === 2) {
      //add another UPPERCASE letter
      suffix += LETTERS[input];
    } else {
      suffix += ((passes - 2) + sep);
    }
  }

  let ret = LETTERS[input] + suffix;

  return ret;
}

function getRandomInt(min, max) {
  min = Math.ceil(min);
  max = Math.floor(max);
  let ret = Math.floor(Math.random() * (max - min + 1)) + min;
  if (DEBUG_HARDCORE) {
    console.info("min, max, result => " + min + ", " + max + ": " + ret);
  }
  return ret;
}

function getRandomNumberRange(min, max, exclusions = undefined) {
  let fEx = exclusions;
  let theEx;
  if (fEx) {
    theEx = [];

    //remove duplicates first
    fEx = [...new Set(fEx)];

    for (const e of fEx) {
      if (e < min || e > max) {
        continue;
      } //exclude numbers in exclusions that are not in range..
      theEx.push(e);
    }

    var skipLength = theEx.length || 0;
    max -= skipLength;
    theEx.sort(function (a, b) {
      return a - b
    }); //sort the array of exclusions
  }

  let r = Math.floor(Math.random() * (max - min + 1)) + min;

  if (!theEx) {
    return r;
  }

  for (const num of theEx) {
    if (r >= num) {
      //generated random number is in exclusions list, we can't have that
      r++;
    }
  }

  return r;
}

/**
 * Shuffles array in place. ES6 version
 * @param {Array} a items An array containing the items.
 */
function shuffle(a) {
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function generateRandomName() {
  //cvc(x..x)c
  let min = 5;
  let max = 8;
  let name = "";
  let vowels = "aeiou";
  let consonants = "bcdfghjklmnpqrstvwxyz";

  var length = getRandomInt(min, max);

  for (var i = 0; i < length; i++) {
    var v = true; //true for vowel, false for consonant
    if (i === 0 || i === 2 || i === length - 1) {
      v = false;
    }

    if (v) {
      add = vowels[getRandomInt(0, vowels.length - 1)];
    } else {
      add = consonants[getRandomInt(0, consonants.length - 1)];
    }

    if (i === 0) {
      add = add.toUpperCase();
    }

    name += add;
  }

  return name;
}

function LogMove(move, message, generic = false) {
  this.id = move.id;
  this.player = move.player;
  this.action = move.action;
  this.message = message;
  this.generic = generic;
}

function renderLog(oneLog = true) {
  let movesDiv = document.getElementById("moves");
  if (movesDiv.style.visibility === "hidden") {
    movesDiv.style.visibility = "visible";
  }
  let logDiv = document.getElementById("log");

  //build logs
  let logs = [];
  for (const msg of moveLog) {
    if (msg.action === ACTION_START) {
      let newMove = new LogMove(msg, msg.player + " goes first!", true);
      logs.push(newMove);
    } else if (msg.action === ACTION_NONE) {
      //generic log
    } else if (msg.action === ACTION_WIN) {
      let moveCount = (msg.player === P1 ? p1MoveCount : p2MoveCount);
      let winMove = new LogMove(msg, msg.player + " has won the game in " + moveCount + " moves!", true);
      logs.push(winMove);
    } else { //log a HIT/MISS
      let newMove = new LogMove(msg, "");
      let message = (msg.location + " - " + msg.action);
      if (msg.player === P1) {
        if (msg.ship && msg.action === ACTION_SINK && showSunken) {
          message += (" (" + msg.ship.name + ")");
        } else if (msg.ship && (DEBUG || DEBUG_HARDCORE)) {
          message += (" (" + msg.ship.name + ")");
        }
      } else if (msg.ship) {
        message += (" (" + msg.ship.name + ")");
      }
      newMove.message = message;
      logs.push(newMove);
    }
  }

  //first, clear log DOM
  while (logDiv.lastChild) {
    logDiv.removeChild(logDiv.lastChild);
  }

  //now render logs
  for (const l of logs) {
    let lineBreak = document.createElement("br");
    let span = document.createElement("span");
    let playerTag = document.createElement("span");
    let p = (l.player === P1 ? "p1" : "p2");
    playerTag.innerHTML = l.player;
    playerTag.className = p + "-tag";
    //playerTag.className += " mui--divider-right";
    span.className = "log-" + l.action;
    span.className += (" " + p);
    span.innerHTML = "&nbsp;" + l.message;
    if (!l.generic) {
      logDiv.appendChild(playerTag);
    }
    logDiv.appendChild(span);
    logDiv.appendChild(lineBreak);
  }

  logDiv.scrollTop = logDiv.scrollHeight;
}

function renderShips() {
  renderLog();
  let boardShips = enemyShips;
  let color = (DEBUG ? "orange" : "black");
  let hitCls = "cell hit";
  let p1SunkCls = "cell sunk-p1";
  let p2SunkCls = "cell sunk-p2";
  let checkBoardButtonSpan = document.getElementById("checkBoardSpan");
  let board = document.getElementById("board");

  board.className = "board";
  checkBoardButtonSpan.innerHTML = P1 + " Board";
  if (showMyBoard) {
    color = "blue";
    hitCls = "cell damage";
    boardShips = playerShips;
    board.className = "board myBoard";
    checkBoardButtonSpan.innerHTML = "Opponent Board";
  }

  //first, check for misses
  for (const space of spaces) {
    let addOn = "";
    let el = space.element;

    if (el.className.indexOf("wave") !== -1) {
      //space should pulse
      addOn = " pulse";
      el.title = "pulse";
    }

    //basic cell
    el.innerText = el.name;
    el.className = "cell";
    el.style.color = "black";

    if (showMyBoard) {
      //spots P2 fired, but missed on P1's board
      if (space.p2Miss) {
        el.className = "cell miss-p2" + addOn;
      }
    } else {
      //show spots P1 fired, but missed on P2's board
      if (space.p1Miss) {
        el.className = "cell miss" + addOn;
      }
    }
  }

  //now check for ships/damage
  for (const ship of boardShips) {
    for (const part of ship.parts) {
      let addOn = "";
      let space = spaces2d[part.position.row][part.position.col];
      let el = space.element;
      if (el.title.indexOf("pulse") !== -1) {
        addOn = " pulse";
        el.title = "";
      }
      if (part.hit) {
        el.className = hitCls + addOn;
      }

      if (ship.sunk) {
        if (ship.player === P1) {
          el.className = p1SunkCls + addOn;
        } else if (gameOver || DEBUG) {
          el.className = p2SunkCls + addOn;
        }
      }

      el.style.color = color;

      if (ship.player === P1) {
        el.innerText = el.name +
          ship.name.substr(0, 2);
      } else if (DEBUG) {
        el.innerText = el.name +
          ship.name.substr(0, 2);
      }
    }
  }
}

function getSpace(row, col) {
  for (const sp of spaces) {
    if (sp.row === row && sp.col === col) {
      return sp;
    }
  }
  return undefined;
}

function getShip(row, col, player) {
  let allShips = getAllShips();
  for (const ship of allShips) {
    if (ship.player === player) {
      continue;
    }
    for (const part of ship.parts) {
      let p = part.position;
      if (p.row === row && p.col === col) {
        return ship;
      }
    }
  }
  return undefined;
}

function getShipPart(ship, row, col) {
  for (const part of ship.parts) {
    if (part.position.row === row && part.position.col === col) {
      return part;
    }
  }
  return undefined;
}

//Checks all parts of a ship to see if it's sunk
function isShipSunk(ship) {
  for (const part of ship.parts) {
    if (!part.hit) {
      return false;
    }
  }

  return true;
}

//Returns true if space can be chosen as target
function isSpaceFree(player, space) {
  //first only select from spaces where either ship doesn't exist or
  //player hasn't tried firing into the empty space before
  let noShipNoMiss = (!(player === P1 ? space.p1Miss : space.p2Miss) &&
    (!space.ship || (space.ship && space.ship.player !== player)));

  //then filter out spaces with ships where ship has been hit
  let beenHit = (space.ship ?
    !getShipPart(space.ship, space.row, space.col).hit : true);

  return noShipNoMiss && beenHit;
}

function getShipHealth(ship) {
  var health = 0;
  for (const part of ship.parts) {
    if (!part.hit) {
      health++;
    }
  }

  return health;
}

function getShipDamage(ship) {
  var hits = 0;
  for (const part of ship.parts) {
    if (part.hit) {
      hits++;
    }
  }

  return hits;
}

function getShipOrientation(ship) {
  var firstPart = ship.parts[0];
  var sameRow = firstPart.position.row;
  var sameCol = firstPart.position.col;

  for (const part of ship.parts) {
    if (part.position.row !== sameRow) {
      return ORIENTATION_VERTICAL;
    }
    if (part.position.col !== sameCol) {
      return ORIENTATION_HORIZONTAL;
    }
  }

  return undefined; //should never get here
}

function damageShipPart(ship, part, player) {
  if (ship.player === player) { //can't damage your own ship (shouldnt happen)
    console.info(player + " clicked on " + player + "'s " + space.ship.name + ".");
    return;
  }

  let space = getSpace(part.position.row, part.position.col);

  part.hit = true;
  if (DEBUG) {
    console.info("" + ship.name + " hit!");
  }
  console.warn(player + " => " + space.name + " / HIT");
  space.element.className = "cell wave";
  playSound(SOUND_HIT);

  if (isShipSunk(ship)) {
    playSound(SOUND_SINK);
    ship.sunk = true;
    let dispName = "";
    if (ship.player === P1) {
      dispName = " (" + ship.name + ")";
    }
    console.info(ship.player + "'s ship SUNK!" + dispName);

    //reset "known" ship location, if P2 sunk P1's ship
    if (player === P2) {
      foundShip = undefined;
    }
    logMove(player, space.name, ACTION_SINK, ship);
  } else {
    logMove(player, space.name, ACTION_HIT, ship);

    //store ship location for medium/hard ai
    if (player === P2) {
      foundShip = foundShip || {
        ship
      };
      foundShip.ship = ship;
      foundShip.rows = foundShip.rows ? [...foundShip.rows, part.position.row] :
        [...[], part.position.row];
      foundShip.cols = foundShip.cols ? [...foundShip.cols, part.position.col] :
        [...[], part.position.col];
    }
  }
  nextTurn();
}

function processMiss(space, player) {
  let ignore = false;

  if (player === P1) {
    if (!space.p1Miss) { //if haven't missed here before
      space.p1Miss = true; //record a miss
    } else { //else ignore user click
      ignore = true;
    }
  } else {
    if (!space.p2Miss) {
      space.p2Miss = true;
    } else {
      ignore = true;
    }
  }

  if (ignore) {
    return;
  }

  console.log(player + " => " + space.name + " / MISS");
  space.element.className = "cell wave";
  logMove(player, space.name, ACTION_MISS);
  playSound(SOUND_MISS);
  nextTurn();
}

function handleCellClick(row, col, player = P1) {
  if (gameOver) {
    console.error("Game is over.");
    return;
  }
  if ((player === P1 && !yourTurn) || (player === P1 && noClicks)) {
    console.error("Not your turn!");
    return;
  }
  if (player === P1 && yourTurn && showMyBoard) { //dont let user click on own board
    return;
  }

  let ship = getShip(row, col, player);
  let space = getSpace(row, col);
  if (ship) { //if ship exists at space
    let part = getShipPart(ship, row, col);
    if (!part.hit) { //if ship segement isn't already hit
      damageShipPart(ship, part, player);
    } else { //else if ship part already hit, ignore click
      //ignore
    }
  } else { //else if no ship (empty space)
    processMiss(space, player) //handle player potential miss
  }
}

function startGame() {
  let choice = getRandomInt(0, 1);
  if (choice === 1 || DIFFICULTY === DIFF_IMPOSSIBLE) {
    //you go first (also always go first if IMPOSSIBLE difficulty, cause you want a CHANCE)
    yourTurn = true;
  } else {
    yourTurn = false;
  }

  showMyBoard = !yourTurn;
  noClicks = !yourTurn;

  renderShips();

  if (yourTurn) {
    console.info(P1 + " START!");
    logMove(P1, "", ACTION_START);
    renderShips();
  } else {
    console.info(P2 + " START!");
    logMove(P2, "", ACTION_START);
    enemyTurn();
  }
}

function isEven(n) {
  return n % 2 === 0;
}

function getRandomUnclickedSpace(player, pattern = undefined) {
  //first only select from spaces where either ship doesn't exist or
  //player hasn't tried firing into the empty space before
  let unclickedSpaces = spaces.filter(space =>
    (!(player === P1 ? space.p1Miss : space.p2Miss) &&
      (!space.ship || (space.ship && space.ship.player !== player))));

  //then filter out spaces with ships where ship has been hit
  unclickedSpaces = unclickedSpaces.filter(space =>
    (space.ship ?
      !getShipPart(space.ship, space.row, space.col).hit :
      true));

  let validSpaces = [];
  let strategicSpaces = [];

  if (pattern) {
    //first, filter spaces to only include spaces in pattern passed
    if (pattern === PATTERN_FIND_ALL) { //CECIL changed below from row & col is even
      if (!goingEvens) {
        validSpaces = unclickedSpaces.filter(space => (!isEven(Math.abs(space.row - space.col))));
      } else {
        validSpaces = unclickedSpaces.filter(space => (isEven(Math.abs(space.row - space.col))));
      }

    } else if (pattern === PATTERN_FIND_RISK) {
      //high risk pattern (for finding carrier mainly)
    }

    //quick check to make sure we have some spaces to look at (if pattern's all used up)
    if (validSpaces.length === 0) {
      validSpaces = unclickedSpaces;
    }

    //now check to make sure each space is a valid ship spot
    //depending on remaining ships

    //first, get remaining ship sizes
    let remainingSizes = [];
    let ships = (player === P1 ? enemyShips : playerShips);
    for (const ship of ships) {
      remainingSizes.push(ship.size);
    }
    remainingSizes = [...new Set(remainingSizes)]; //remove duplicate sizes
    remainingSizes.sort(function (a, b) {
      return a - b
    }); //sort ascending

    //now loop through all current valid spaces to see if a ship could fit
    for (const space of validSpaces) {
      var row = space.row;
      var col = space.col;

      var hPass = false; //can a ship fit horizontally?
      var vPass = false; //can a ship fit vertically?

      //loop through avail ship sizes
      for (const size of remainingSizes) {
        var horHits = 1;
        var verHits = 1;

        //hor - left
        for (var i = 1; i < size; i++) {
          if (row - i >= 0) {
            let sp = spaces2d[row - i][col];
            if (isSpaceFree(player, sp)) {
              horHits++;
            } else {
              break;
            }
          }
        }
        if (horHits >= size) {
          hPass = true;
          break;
        }

        //hor - right
        for (var i = 1; i < size; i++) {
          if (row + i < BOARD_SIZE) {
            let sp = spaces2d[row + i][col];
            if (isSpaceFree(player, sp)) {
              horHits++;
            } else {
              break;
            }
          }
        }
        if (horHits >= size) {
          hPass = true;
          break;
        }

        //ver - up
        for (var i = 1; i < size; i++) {
          if (col - i >= 0) {
            let sp = spaces2d[row][col - i];
            if (isSpaceFree(player, sp)) {
              verHits++;
            } else {
              break;
            }
          }
        }
        if (verHits >= size) {
          vPass = true;
          break;
        }

        //ver - down
        for (var i = 1; i < size; i++) {
          if (col + i < BOARD_SIZE) {
            let sp = spaces2d[row][col + i];
            if (isSpaceFree(player, sp)) {
              verHits++;
            } else {
              break;
            }
          }
        }
        if (verHits >= size) {
          vPass = true;
          break;
        }
      }

      if (hPass || vPass) {
        strategicSpaces.push(space);
      }
    }

  }

  validSpaces = strategicSpaces;

  //at this point, this should only ever be length 0 if pattern is undefined
  if (validSpaces.length === 0) {
    validSpaces = unclickedSpaces;
  }

  let pick = getRandomInt(0, validSpaces.length - 1);
  return validSpaces[pick];
}

function getRandomSpaceNearShip(player, shipData, beeline = false) {
  //loop backwards through available spots
  for (var i = shipData.rows.length - 1; i >= 0; i--) {
    let row = shipData.rows[i];
    let col = shipData.cols[i];

    //first only select from spaces where either ship doesn't exist or
    //player hasn't tried firing into the empty space before
    let unclickedSpaces = spaces.filter(space =>
      (!(player === P1 ? space.p1Miss : space.p2Miss) &&
        (!space.ship || (space.ship && space.ship.player !== player))));

    //then filter out spaces with ships where ship part has been hit
    unclickedSpaces = unclickedSpaces.filter(space =>
      (space.ship ?
        !getShipPart(space.ship, space.row, space.col).hit :
        true));

    //now filter out all the spaces that aren't within 1 cell of hit location
    //(no diagonal cells, either)
    unclickedSpaces = unclickedSpaces.filter(space =>
      ((Math.abs(space.row - row) <= 0) && (Math.abs(space.col - col) <= 1) ||
        (Math.abs(space.row - row) <= 1) && (Math.abs(space.col - col) <= 0))
    );

    if (beeline) {
      if (getShipDamage(shipData.ship) > 1) { //means ship has a definite vert or hor
        var orientation = getShipOrientation(shipData.ship);
        if (orientation === ORIENTATION_HORIZONTAL) {
          //only check left/right of ship
          unclickedSpaces = unclickedSpaces.filter(space =>
            (Math.abs(space.row - row) <= 0)
          );
        } else if (orientation === ORIENTATION_VERTICAL) {
          //only check up/down of ship
          unclickedSpaces = unclickedSpaces.filter(space =>
            (Math.abs(space.col - col) <= 0)
          );
        }
      }
    }

    if (unclickedSpaces.length <= 0) {
      if (DEBUG_HARDCORE) {
        console.info("No more spaces around this hit, moving to previous hit...");
      }
      continue;
    }

    if (DEBUG_HARDCORE) {
      console.info("Spaces near (" + row + ", " + col + ") - ", unclickedSpaces);
    }

    let pick = getRandomInt(0, unclickedSpaces.length - 1);
    return unclickedSpaces[pick];
  }
}

function getRandomShipSpace(player = P2) {
  //only from spaces where ships exist
  let unclickedSpaces = spaces.filter(space =>
    (space.ship && space.ship.player !== player));

  //then filter out spaces with ships where ship has been hit
  unclickedSpaces = unclickedSpaces.filter(space =>
    (space.ship ?
      !getShipPart(space.ship, space.row, space.col).hit :
      true));

  let pick = getRandomInt(0, unclickedSpaces.length - 1);
  return unclickedSpaces[pick];
}

function nextTurn() {
  if (yourTurn) {
    p1MoveCount++;
  } else {
    p2MoveCount++;
  }

  noClicks = true;
  renderShips();
  let p = (yourTurn ? P1 : P2);
  if (checkWin(p)) {
    let didTheyCheat = "";
    if (p === P1 && (DEBUG || DEBUG_HARDCORE)) {
      didTheyCheat = " Debug mode was on though...";
    }
    console.info(p + " has won the game!" + didTheyCheat);
    if (p === P1) {
      playSound(SOUND_WIN, true);
    } else {
      playSound(SOUND_LOSE, true);
    }
    logMove(p, "", ACTION_WIN);
    renderLog();
    gameOver = true;
    console.log("GAME OVER");
    console.log("-------------------------");
    return;
  }

  eInterval = setInterval(switchTurns, TURN_DELAY * 1000);
}

function switchTurns() {
  clearInterval(eInterval);
  yourTurn = !yourTurn;
  showMyBoard = !yourTurn;
  noClicks = !yourTurn;

  renderShips();

  if (!yourTurn) {
    enemyTurn();
  }
}

function enemyTurn() {
  eInterval = setInterval(enemyMove, TURN_DELAY * 1000);
}

function enemyMove() {
  clearInterval(eInterval);

  //enemy choose random space
  let targetSpace;

  if (DIFFICULTY === DIFF_EASY) {
    targetSpace = getRandomUnclickedSpace(P2);
  } else if (DIFFICULTY === DIFF_MEDIUM) {
    if (!foundShip) {
      targetSpace = getRandomUnclickedSpace(P2);
    } else {
      targetSpace = getRandomSpaceNearShip(P2, foundShip);
    }
  } else if (DIFFICULTY === DIFF_HARD) {
    if (!foundShip) {
      targetSpace = getRandomUnclickedSpace(P2, PATTERN_FIND_ALL);
    } else {
      targetSpace = getRandomSpaceNearShip(P2, foundShip, true);
    }
  } else if (DIFFICULTY === DIFF_IMPOSSIBLE) {
    targetSpace = getRandomShipSpace(P2);
  }

  handleCellClick(targetSpace.row, targetSpace.col, P2);
}

function initSettings() {
  //get user settings before starting game
  let checkBoardButton = document.getElementById("checkBoard");
  let checkBoardButtonSpan = document.getElementById("checkBoardSpan");
  checkBoardButton.className = BUTTON_CLASS;
  checkBoardButton.onclick = function () {
    if (!yourTurn) {
      return;
    } //can't swap boards if not your turn
    showMyBoard = !showMyBoard;

    if (showMyBoard) {
      checkBoardButtonSpan.innerHTML = P1 + " Board";
    } else {
      checkBoardButtonSpan.innerHTML = "Opponent Board";
    }

    renderShips();
  }

  let nameField = document.getElementById("name");
  let diffField = document.getElementById("difficulty");
  let boardSizeField = document.getElementById("boardSize");

  P1 = nameField.value;
  if (P1.length <= 0 || P1 === P2) {
    P1 = "Player";
  }
  DIFFICULTY = diffField.value;
  BOARD_SIZE = parseInt(boardSizeField.value, 10);

  //init 2d array
  for (var a = 0; a < BOARD_SIZE; a++) {
    spaces2d.push([undefined, undefined]);
  }

  //now remove settings fields
  let settingsDiv = document.getElementById("settings");
  settingsDiv.parentNode.removeChild(settingsDiv);

  begin();
}

function stopAllSounds() {
  for (const sound of document.getElementsByTagName("audio")) {
    sound.pause();
  }
}

function setupForm() {
  let nameField = document.getElementById("name");
  nameField.value = generateRandomName();

  let volumeField = document.getElementById("volume");

  function checkVolume() {
    volumeField.innerHTML = soundOn ? "volume_up" : "volume_off";
  }
  checkVolume();
  volumeField.onclick = function () {
    soundOn = !soundOn;
    checkVolume();
    if (!soundOn) {
      stopAllSounds();
    }
  }

  let sinkButton = document.getElementById("sinkButton");
  let sinkText = document.getElementById("sinkSpan");
  let sinkIcon = document.getElementById("sinkIcon");

  function checkSunkenButton() {
    if (showSunken) {
      sinkButton.style.backgroundColor = "#3030f161";
      sinkText.innerHTML = SHOW_SUNKEN_SHIPS;
      sinkIcon.innerHTML = "directions_boat";
    } else {
      sinkButton.style.backgroundColor = "#ff000080";
      sinkText.innerHTML = HIDE_SUNKEN_SHIPS;
      sinkIcon.innerHTML = "waves";
    }
  }
  checkSunkenButton();

  sinkButton.onclick = function () {
    showSunken = !showSunken;
    checkSunkenButton();
  }

  let newGameButton = document.getElementById("newGame");
  newGameButton.onclick = function () {
    if (newGameButton.className === "hide") {
      console.warn("OOGA");
      return;
    }
    resetGame();
  }

  let startButton = document.getElementById("start");
  startButton.onclick = initSettings;
}

function resetGame() {
  console.log("Starting new game... not really, haven't added this in, yet.");
  console.log("Just reload the page.");
}

//sets up and starts the game
function begin() {
  if (!checkShipsFit()) {
    return;
  }

  var odd = getRandomInt(0, 1);
  if (odd === 1) {
    goingEvens = false;
  }

  if (DEBUG) {
    console.log("goingEvens? " + goingEvens);
  }

  makeBoard();
  placeShips(enemyShips, P2);
  placeShips(playerShips, P1);
  startGame();
}

setupForm();
