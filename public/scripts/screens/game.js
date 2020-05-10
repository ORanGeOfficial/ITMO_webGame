const playerState = {
    from: {
        row: 0,
        col: 0
    },
    to: {
        row: 0,
        col: 0
    },
    color: 'r',
    moved: false,
    sum: 0,
    dices: []
};
const title = document.querySelector('main.game>h2');
const dicesContainer = document.querySelector('div.dices');
const field = document.querySelector('div.field');
let turnHandler;
fillField();
function onDices(event) {
    event.preventDefault();
    playerState.dices = roll();
}
function clearDiceEvent() {
    dicesContainer.removeEventListener('click', onDices);
}
function roll() {
    let dices = [randNumber(), randNumber()];
    dicesContainer.textContent = `${dices[0]} ${dices[1]}`;
    clearDiceEvent();
    return dices;
}
function randNumber() {
    let rand = 1 + Math.random() * 6;
    return Math.floor(rand);
}
function diceEvent() {
    dicesContainer.addEventListener('click', onDices);
}
function defaultDices() {
    playerState.dices = [];
    dicesContainer.textContent = 'ROLL';
}
function cellsEvents() {
    for (let i = 0; i < 30; i++) {
        for (let j = 0; j < 30; j++) {
            document.getElementsByClassName(`r${i}c${j}`)[0].addEventListener('click', onCell);
        }
    }
}
function clearCellsEvents() {
    for (let i = 0; i < 30; i++) {
        for (let j = 0; j < 30; j++) {
            document.getElementsByClassName(`r${i}c${j}`)[0].removeEventListener('click', onCell);
        }
    }
}
function onCell(event) {
    event.preventDefault();
    if (playerState.dices.length === 0)
        return;
    const cell = event.target;
    const cellColorClass = cell.classList[2];
    const cellCoordinates = cell.classList[1];
    const cellRow = Number(cellCoordinates.match(/\d+/g)[0]);
    const cellCol = Number(cellCoordinates.match(/\d+/g)[1]);
    if (cell.classList.contains('number'))
        return;
    if (cellColorClass === 'blue__cell' || cellColorClass === 'red__cell')
        return;
    if (!playerState.moved && (cellColorClass === 'default__cell' || cellColorClass === 'free__cell')) {
        playerState.from.row = cellRow;
        playerState.from.col = cellCol;
        playerState.moved = true;
        console.log('from moved', playerState.moved);
        console.log('from', playerState.from, playerState.to);
        return;
    }
    if (cellColorClass === 'default__cell' || cellColorClass === 'free__cell' && playerState.moved) {
        playerState.to.row = cellRow;
        playerState.to.col = cellCol;
        playerState.moved = false;
        console.log('to moved', playerState.moved);
        console.log('to', playerState.from, playerState.to);
        turnHandler && turnHandler(playerState);
    }
}
function renderCell(row, col, type) {
    console.log(type);
    const cell = document.getElementsByClassName(`r${row}c${col}`)[0];
    cell.classList.remove(cell.classList[2]);
    cell.classList.add(`${type}`);
}
function renderField(field) {
    for (let i = 0; i < 30; i++) {
        for (let j = 0; j < 30; j++) {
            if (field[i][j] !== 'default__cell')
                renderCell(i, j, field[i][j]);
        }
    }
}
function fillField() {
    let elem;
    for (let i = 0; i < 31; i++) {
        elem = document.createElement('div');
        elem.className = 'number';
        if (i < 30)
            elem.textContent = `${i + 1}`;
        field.appendChild(elem);
    }
    for (let i = 0; i < 30; i++) {
        for (let j = 0; j < 31; j++) {
            if (j === 30) {
                elem = document.createElement('div');
                elem.className = 'number';
                elem.textContent = `${i + 1}`;
                field.appendChild(elem);
                continue;
            }
            elem = document.createElement('div');
            elem.className = `cell r${i}c${j} default__cell`;
            field.appendChild(elem);
        }
    }
}
function update(myTurn, field, color) {
    renderField(field);
    playerState.color = color;
    if (myTurn) {
        title.textContent = 'Ваш ход';
        dicesContainer.hidden = false;
        defaultDices();
        diceEvent();
        cellsEvents();
        return;
    }
    title.textContent = 'Ход противника';
    dicesContainer.hidden = true;
    clearCellsEvents();
}
function setTurnHandler(handler) {
    turnHandler = handler;
}
export { update, setTurnHandler, };
//# sourceMappingURL=game.js.map