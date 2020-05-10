import { PlayerState, Color } from '../../common/messages'

/**
 * Состояние игрока в текущий ход
 */
const playerState: PlayerState = {
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
}

/**
 * Заголовок экрана
 */
const title = document.querySelector( 'main.game>h2' ) as HTMLHeadingElement;

/**
 * Игральные кости
 */
const dicesContainer = document.querySelector('div.dices') as HTMLElement;

/**
 * Игровое поле
 */
const field = document.querySelector('div.field') as HTMLElement;


/**
 * Обработчик хода игрока
 */
type TurnHandler = ( move: PlayerState ) => void;

/**
 * Обработчик хода игрока
 */
let turnHandler: TurnHandler;

/**
 * Заполнение поля свободными клетками
 */
fillField();


/**
 * Событие для кубиков
 * @param event
 */
function onDices( event: Event ): void
{
	event.preventDefault();
	playerState.dices = roll();
}

function clearDiceEvent(): void
{
	dicesContainer.removeEventListener('click', onDices);
}

/**
 * Генерация массива чисел кубиков
 */
function roll(): Array<number>
{
	let dices: Array<number> = [randNumber(), randNumber()];
	dicesContainer.textContent = `${dices[0]} ${dices[1]}`;
	clearDiceEvent();
	return dices;
}

/**
 * Генерация рандомного числа
 */
function randNumber(): number
{
	let rand: number = 1 + Math.random() * 6;
	return Math.floor(rand);
}

/**
 * Функция, навешивающая обработчик события на кубики
 */
function diceEvent(): void
{
	dicesContainer.addEventListener('click', onDices);
}

function defaultDices(): void
{
	playerState.dices = [];
	dicesContainer.textContent = 'ROLL';
}

/**
 * Функция, навешивающая обработчик события на клетки
 */
function cellsEvents(): void
{
	for(let i = 0; i < 30; i++){
		for(let j = 0; j < 30; j++){
			document.getElementsByClassName(`r${i}c${j}`)[0].addEventListener('click', onCell);
		}
	}
}

function clearCellsEvents(): void
{
	for(let i = 0; i < 30; i++){
		for(let j = 0; j < 30; j++){
			document.getElementsByClassName(`r${i}c${j}`)[0].removeEventListener('click', onCell);
		}
	}
}

/**
 * Событие на клетке
 * @param event
 */
function onCell( event: Event ): void
{
	event.preventDefault();
	if(playerState.dices.length === 0) return;
	const cell = event.target as HTMLElement;
	const cellColorClass = cell.classList[2] as string;
	const cellCoordinates = cell.classList[1] as string;
	const cellRow = Number(cellCoordinates.match(/\d+/g)![0]) as number;
	const cellCol = Number(cellCoordinates.match(/\d+/g)![1]) as number;
	if(cell.classList.contains('number')) return;
	if(cellColorClass === 'blue__cell' || cellColorClass === 'red__cell')
			return;
	/**
	 * Первое нажатие игрока на свободную клетку
	 */
	if(!playerState.moved && (cellColorClass === 'default__cell' || cellColorClass === 'free__cell')){
		playerState.from.row = cellRow;
		playerState.from.col = cellCol;
		playerState.moved = true;
		return;
	}
	/**
	 * Когда игрок нажимает второй раз на свободную клетку
	 * (ставит блок)
	 */
	if(cellColorClass === 'default__cell' || cellColorClass === 'free__cell' && playerState.moved){
		playerState.to.row = cellRow;
		playerState.to.col = cellCol;
		playerState.moved = false;
		turnHandler && turnHandler( playerState );
	}
}

/**
 * Отображение клетки в соответствии с массивом клеток на сервере
 * @param row
 * @param col
 * @param type
 */
function renderCell( row: number, col: number, type: string )
{
	const cell = document.getElementsByClassName(`r${row}c${col}`)[0] as HTMLElement;
	cell.classList.remove(cell.classList[2]);
	cell.classList.add(`${type}`);
}

/**
 * Перерисовка поля (после хода)
 * @param field
 */
function renderField( field: Array<Array<string>> ): void
{
	for(let i = 0; i < 30; i++){
		for(let j = 0; j < 30; j++){
			if(field[i][j] !== 'default__cell')
				renderCell(i, j, field[i][j]);
		}
	}
}

/**
 * Заполнение поля (первоначальное)
 */
function fillField(): void
{
	let elem: HTMLElement;
	for(let i = 0; i < 31; i++){
		elem = document.createElement('div');
		elem.className = 'number';
		if(i < 30)
			elem.textContent = `${i + 1}`;
		field.appendChild(elem);
	}
	for(let i = 0; i < 30; i++){
		for(let j = 0; j < 31; j++){
			if(j === 30){
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

/**
 * Обновляет экран игры
 * 
 * @param myTurn Ход текущего игрока?
 * @param field Игровое поле
 * @param color Цвет клетки
 */
function update( myTurn: boolean, field: Array<Array<string>>, color: Color ): void
{
	renderField(field);
	playerState.color = color;
	if ( myTurn )
	{
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

/**
 * Устанавливает обработчик хода игрока
 * 
 * @param handler Обработчик хода игрока
 */
function setTurnHandler( handler: TurnHandler ): void
{
	turnHandler = handler;
}

export {
	update,
	setTurnHandler,
};
