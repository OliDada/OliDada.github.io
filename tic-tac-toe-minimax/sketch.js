let board = [
    ["", "", ""],
    ["", "", ""],
    ["", "", ""],
];

let player1 = "X";
let player2 = "O";

let currentPlayer = player1;

let mode = "pvp"; // or "pvc" for player vs computer

let xOrO; // dropdown for player to choose X or O in player vs computer mode
let humanSymbol = "X"; // default human symbol
let computerSymbol = "O"; // default computer symbol

function setup() {
  // create canvas and attach to the HTML holder so CSS centers it
  let cnv = createCanvas(300, 300);
  cnv.parent('canvasHolder');

  // wire HTML controls (use plain DOM to avoid p5.dom timing issues)
  const btnPVP = document.getElementById('pvp');
  const btnPVC = document.getElementById('pvc');
  const btnReset = document.getElementById('reset');
  const selXorO = document.getElementById('xOrO');

  if (btnPVP) btnPVP.addEventListener('click', () => gameMode('pvp'));
  if (btnPVC) btnPVC.addEventListener('click', () => gameMode('pvc'));
  if (btnReset) btnReset.addEventListener('click', () => gameMode(mode));

  // keep a reference to the HTML select and hide it initially
  xOrO = selXorO;
  if (xOrO) {
    xOrO.value = xOrO.value || humanSymbol;
    xOrO.style.display = 'none';
    xOrO.addEventListener('change', () => {
      humanSymbol = xOrO.value;
      computerSymbol = humanSymbol === 'X' ? 'O' : 'X';
      gameMode(mode);
    });
  }

  // start default mode
  gameMode(mode);
}

function draw() {
  background(240);
  let w = width / 3;
  let h = height / 3;

  // draw grid
  stroke(0);
  strokeWeight(2);
  for (let i = 1; i < 3; i++) {
    line(i * w, 0, i * w, height);
    line(0, i * h, width, i * h);
	//outside border
	line(0, 0, width, 0);
	line(0, 0, 0, height);	
	line(width, 0, width, height);
	line(0, height, width, height);
  }

  // draw marks
  strokeWeight(4);
  for (let i = 0; i < 3; i++) {
    for (let j = 0; j < 3; j++) {
      const x = j * w + w / 2;
      const y = i * h + h / 2;
      const spot = board[i][j];
      if (spot === 'X') {
        stroke(50);
        line(x - 30, y - 30, x + 30, y + 30);
        line(x + 30, y - 30, x - 30, y + 30);
      } else if (spot === 'O') {
        noFill();
        stroke(50);
        ellipse(x, y, 60, 60);
      }
    }
  }

  // winner / draw handling
  let winner = winnerFor(board);
  if (winner != null) {
    noLoop();
    noStroke();
    fill(0);
    textSize(36);
    textAlign(CENTER, CENTER);
    text(winner + ' Wins!', width / 2, height / 2);
    return;
  }

  let isDraw = true;
  for (let r = 0; r < 3; r++) {
    for (let c = 0; c < 3; c++) {
      if (board[r][c] === '') { isDraw = false; break; }
    }
    if (!isDraw) break;
  }
  if (isDraw) {
    noLoop();
    noStroke();
    fill(0);
    textSize(32);
    textAlign(CENTER, CENTER);
    text('Draw', width / 2, height / 2);
    return;
  }
}

function mousePressed() {
    let w = width / 3;
    let h = height / 3;
    let j = floor(mouseX / w);
    let i = floor(mouseY / h);
    if (i >= 0 && i < 3 && j >= 0 && j < 3 && board[i][j] === "") {
        // In PVC mode only allow the human to play on their turn
        if (mode === "pvc" && currentPlayer !== humanSymbol) return;

        board[i][j] = currentPlayer;
        currentPlayer = currentPlayer === "X" ? "O" : "X";

        // if vs computer and it's the computer's turn, let it play
        if (mode === "pvc" && currentPlayer === computerSymbol) {
            computerMove();
        }
    }
}

// helper to show/hide/set style for either p5.Element or native DOM element
function showElem(el) {
  if (!el) return;
  if (typeof el.style === 'function') { // p5.Element
    el.style('display', 'block');
  } else if (el.style) {
    el.style.display = 'block';
  } else if (typeof el.show === 'function') {
    el.show();
  }
}
function hideElem(el) {
  if (!el) return;
  if (typeof el.style === 'function') {
    el.style('display', 'none');
  } else if (el.style) {
    el.style.display = 'none';
  } else if (typeof el.hide === 'function') {
    el.hide();
  }
}
function setZIndex(el, z) {
  if (!el) return;
  if (typeof el.style === 'function') {
    el.style('z-index', z);
  } else if (el.style) {
    el.style.zIndex = z;
  }
}

function gameMode(modeParam) {
    mode = modeParam === "pvc" ? "pvc" : "pvp";
    board = [
        ["", "", ""],
        ["", "", ""],
        ["", "", ""],
    ];
    currentPlayer = "X";
    loop();

    console.log('gameMode ->', mode);

    if (typeof xOrO === 'undefined' || xOrO === null) {
        console.log('xOrO not created yet');
        return;
    }

    if (mode === "pvc") {
        // ensure selector reflects current value and is visible
        humanSymbol = (xOrO.value && typeof xOrO.value === 'function') ? xOrO.value() : xOrO.value || "X";
        computerSymbol = humanSymbol === "X" ? "O" : "X";

        showElem(xOrO);
        setZIndex(xOrO, '9999');

        // if computer should play first
        if (computerSymbol === "X" && typeof computerMove === "function") {
            setTimeout(() => computerMove(), 50);
        }
    } else {
        // hide selector
        hideElem(xOrO);
    }
}

function winnerFor(bd) {
	// check rows
	for (let i = 0; i < 3; i++) {
		if (bd[i][0] === bd[i][1] && bd[i][1] === bd[i][2] && bd[i][0] !== "") {
			return bd[i][0];
		}
	}
	// check columns
	for (let j = 0; j < 3; j++) {
		if (bd[0][j] === bd[1][j] && bd[1][j] === bd[2][j] && bd[0][j] !== "") {
			return bd[0][j];
		}
	}
	// check diagonals
	if (bd[0][0] === bd[1][1] && bd[1][1] === bd[2][2] && bd[0][0] !== "") {
		return bd[0][0];
	}
	if (bd[0][2] === bd[1][1] && bd[1][1] === bd[2][0] && bd[0][2] !== "") {
		return bd[0][2];
	}
	return null;
}

function computerMove() {
	let bestScore = -Infinity;
	let move = null;
	for (let i = 0; i < 3; i++) {
		for (let j = 0; j < 3; j++) {
			if (board[i][j] === "") {
				board[i][j] = computerSymbol;
				let score = minimax(board, false);
				board[i][j] = "";
				if (score > bestScore) {
					bestScore = score;
					move = { i, j };
				}
			}
		}
	}
	if (move) {
		board[move.i][move.j] = computerSymbol;
		currentPlayer = humanSymbol;
	}
}

function minimax(bd, isMaximizing) {
	let winner = winnerFor(bd);
	if (winner === computerSymbol) return 10;
	if (winner === humanSymbol) return -10;

	let movesLeft = false;
	for (let i = 0; i < 3; i++) {
		for (let j = 0; j < 3; j++) {
			if (bd[i][j] === "") {
				movesLeft = true;
				break;
			}
		}
		if (movesLeft) break;
	}
	if (!movesLeft) return 0;

	if (isMaximizing) {
		let bestScore = -Infinity;
		for (let i = 0; i < 3; i++) {
			for (let j = 0; j < 3; j++) {
				if (bd[i][j] === "") {
					bd[i][j] = computerSymbol;
					let score = minimax(bd, false);
					bd[i][j] = "";
					bestScore = max(score, bestScore);
				}
			}
		}
		return bestScore;
	} else {
		let bestScore = Infinity;
		for (let i = 0; i < 3; i++) {
			for (let j = 0; j < 3; j++) {
				if (bd[i][j] === "") {
					bd[i][j] = humanSymbol;
					let score = minimax(bd, true);
					bd[i][j] = "";
					bestScore = min(score, bestScore);
				}
			}
		}
		return bestScore;
	}
}