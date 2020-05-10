import WebSocket from 'ws';
import { onError } from './on-error.js';

import type {
	AnyClientMessage,
	AnyServerMessage,
	GameStartedMessage,
	GameAbortedMessage,
	PlayerState
} from '../../common/messages.js';

/**
 * Класс игры
 * 
 * Запускает игровую сессию.
 */
class Game
{
	/**
	 * Количество игроков в сессии
	 */
	static readonly PLAYERS_IN_SESSION = 2;
	
	/**
	 * Игровая сессия
	 */
	private _session: WebSocket[];
	/**
	 * Информация о ходах игроков
	 */
	private _playersState!: WeakMap<WebSocket, number>;
	/**
	 * Игровое поле
	 */
	private _gameField!: Array<Array<string>>;
	/**
	 * Текущий ход
	 */
	private _currentMove!: WebSocket;
	/**
	 * @param session Сессия игры, содержащая перечень соединений с игроками
	 */
	constructor( session: WebSocket[] )
	{
		this._session = session;
		
		this._sendStartMessage()
			.then(
				() =>
				{
					this._listenMessages();
				}
			)
			.catch( onError );
	}
	
	/**
	 * Уничтожает данные игровой сессии
	 */
	destroy(): void
	{
		// Можно вызвать только один раз
		this.destroy = () => {};
		
		for ( const player of this._session )
		{
			if (
				( player.readyState !== WebSocket.CLOSED )
				&& ( player.readyState !== WebSocket.CLOSING )
			)
			{
				const message: GameAbortedMessage = {
					type: 'gameAborted',
				};
				
				this._sendMessage( player, message )
					.catch( onError );
				player.close();
			}
		}
		
		// Обнуляем ссылки
		this._session = null as unknown as Game['_session'];
		this._playersState = null as unknown as Game['_playersState'];
	}
	
	/**
	 * Отправляет сообщение о начале игры
	 */
	private _sendStartMessage(): Promise<void[]>
	{
		this._gameField = [];
		this._gameField = Game._generateField(this._gameField);
		this._playersState = new WeakMap();
		this._currentMove = this._session[0];
		this._playersState = new WeakMap<WebSocket, number>();
		const data: GameStartedMessage = {
			type: 'gameStarted',
			myTurn: true,
			field: this._gameField,
			color: 'r',
			sum: 0
		};
		const promises: Promise<void>[] = [];
		
		for ( const player of this._session )
		{
			promises.push( this._sendMessage( player, data ) );
			this._playersState.set(player, data.sum);
			data.myTurn = false;
			data.color = 'b';
		}
		
		return Promise.all( promises );
	}
	
	/**
	 * Отправляет сообщение игроку
	 * 
	 * @param player Игрок
	 * @param message Сообщение
	 */
	private _sendMessage( player: WebSocket, message: AnyServerMessage ): Promise<void>
	{
		return new Promise(
			( resolve, reject ) =>
			{
				player.send(
					JSON.stringify( message ),
					( error ) =>
					{
						if ( error )
						{
							reject();
							
							return;
						}
						
						resolve();
					}
				)
			},
		);
	}
	
	/**
	 * Добавляет слушателя сообщений от игроков
	 */
	private _listenMessages(): void
	{
		for ( const player of this._session )
		{
			player.on(
				'message',
				( data ) =>
				{
					const message = this._parseMessage( data );
					
					this._processMessage( player, message );
				},
			);
			
			player.on( 'close', () => this.destroy() );
		}
	}
	
	/**
	 * Разбирает полученное сообщение
	 * 
	 * @param data Полученное сообщение
	 */
	private _parseMessage( data: unknown ): AnyClientMessage
	{
		if ( typeof data !== 'string' )
		{
			return {
				type: 'incorrectRequest',
				message: 'Wrong data type',
			};
		}
		
		try
		{
			return JSON.parse( data );
		}
		catch ( error )
		{
			return {
				type: 'incorrectRequest',
				message: 'Can\'t parse JSON data: ' + error,
			};
		}
	}
	
	/**
	 * Выполняет действие, соответствующее полученному сообщению
	 * 
	 * @param player Игрок, от которого поступило сообщение
	 * @param message Сообщение
	 */
	private _processMessage( player: WebSocket, message: AnyClientMessage ): void
	{
		switch ( message.type )
		{
			case 'playerMove':
				this._onPlayerMove( player, message.move );
				break;
			
			case 'repeatGame':
				this._sendStartMessage()
					.catch( onError );
				break;
			
			case 'incorrectRequest':
				this._sendMessage( player, message )
					.catch( onError );
				break;
			
			case 'incorrectResponse':
				console.error( 'Incorrect response: ', message.message );
				break;
			
			default:
				this._sendMessage(
					player,
					{
						type: 'incorrectRequest',
						message: `Unknown message type: "${(message as AnyClientMessage).type}"`,
					},
				)
					.catch( onError );
				break;
		}
	}
	
	/**
	 * Обрабатывает ход игрока
	 * 
	 * @param currentPlayer Игрок, от которого поступило сообщение
	 * @param currentPlayerMove Состояние игрока в этот ход
	 */
	private _onPlayerMove( currentPlayer: WebSocket, currentPlayerMove:  PlayerState): void
	{
		if ( this._currentMove !== currentPlayer )
		{
			this._sendMessage(
				currentPlayer,
				{
					type: 'incorrectRequest',
					message: 'Not your turn',
				},
			)
				.catch( onError );
			return;
		}

		/**
		 * Начало игры (сумма равна нулю)
		 */
		if ( currentPlayerMove.sum === 0 )
		{
			/**
			 * Если текущий игрок ходит первый
			 */
			if(Game._isFieldEmpty(this._gameField))
			{
				if(!Game._checkFirstMove(this._gameField, currentPlayerMove.from.row, currentPlayerMove.from.col, currentPlayerMove.to.row, currentPlayerMove.to.col, currentPlayerMove.dices )){
					this._sendMessage(
						currentPlayer,
						{
							type: 'incorrectRequest',
							message: 'wrong move',
						},
					)
						.catch( onError );
					return;
				}
				else{
					this._gameField = Game._fillField(currentPlayerMove.color, this._gameField, currentPlayerMove.from.row, currentPlayerMove.from.col, currentPlayerMove.to.row, currentPlayerMove.to.col);
				}
			}
			/**
			 * Иначе если не первый
			 */
			else 
			{
				let from: Array<number> = [];
				//Если противник еще не ходил
				if(Game._isCornerEmpty(this._gameField))
					from = Game._findFirstMove(this._gameField);
				else
					//Если делаем последующие ходы
					from = Game._findCurrentMove(this._gameField, currentPlayerMove.color);
				if(!Game._checkMove(from, this._gameField, currentPlayerMove.from.row, currentPlayerMove.from.col, currentPlayerMove.to.row, currentPlayerMove.to.col, currentPlayerMove.dices, currentPlayerMove.color)){
					this._sendMessage(
						currentPlayer,
						{
							type: 'incorrectRequest',
							message: 'wrong move',
						},
					)
						.catch( onError );
					return;
				}
				else{
					this._gameField = Game._fillField(currentPlayerMove.color, this._gameField, currentPlayerMove.from.row, currentPlayerMove.from.col, currentPlayerMove.to.row, currentPlayerMove.to.col);
				}
			}
			
		}

		this._playersState.set(currentPlayer, this._playersState.get(currentPlayer)! + currentPlayerMove.dices[0] + currentPlayerMove.dices[1]);
		let winFlag: number = 0;
		let player2: WebSocket = currentPlayer;
		for ( const player of this._session )
		{
			if(player !== currentPlayer)
				player2 = player;
			 winFlag |= Number(Game._checkWin( this._playersState.get(player)! ));
		}
		
		this._currentMove = player2;
		if(!winFlag){
			this._sendMessage(
				player2,
				{
					type: 'changePlayer',
					myTurn: true,
					field: this._gameField,
					color: currentPlayerMove.color === 'r' ? 'b' : 'r'
				},
			)
				.catch( onError );
			this._sendMessage(
				currentPlayer,
				{
					type: 'changePlayer',
					myTurn: false, 
					field: this._gameField,
					color: currentPlayerMove.color
				},
			)
				.catch( onError );

			return;
		}
		for ( const player of this._session )
		{
			this._sendMessage(
				player,
				{
					type: 'gameResult',
					win: Game._checkWin( this._playersState.get(player)! ),
				},
			)
				.catch( onError );
		}
	}

	/**
	 * Функция, проверяющая последующие ходы, после первого
	 * @param from с какого угла начинал игрок, координаты угла
	 * @param gameField игровое поле
	 * @param rowFrom с какого ряда ходит игрок
	 * @param colFrom с какого столбца ходит игрок
	 * @param rowTo на какой ряд ходит игрок
	 * @param colTo на какой столбец ходит игрок
	 * @param dices кубики
	 * @param color цвет игрока
	 * @private
	 */
	private static _checkMove( from: Array<number>, gameField: Array<Array<string>>, rowFrom: number, colFrom: number, rowTo: number, colTo: number, dices: Array<number>, color: string): boolean
	{
		let freeCells: Array<Array<number>> = [];
		//Если противник делает первый ход
		if(gameField[from[0]][from[1]] === 'default__cell'){
			if(rowFrom !== from[0] || colFrom !== from[1])
				return false;
			return this._makeMove(gameField, from, rowFrom, colFrom, rowTo, colTo, dices);
		}
		else{
			freeCells = this._findFreeCells(gameField, color);
			if(this._checkTo(freeCells, rowFrom, colFrom)){
				return this._makeMove(gameField, from, rowFrom, colFrom, rowTo, colTo, dices);
			}
		}
		return false;
	}

	/**
	 * Поиск ряда и столбца с которых начинал игрок (для не первых ходов)
	 * @param gameField игровое поле
	 * @param color цвет
	 */
	private static _findCurrentMove(gameField: Array<Array<string>>, color: string): Array<number>
	{
		let field: Array<Array<string>> = gameField;
		let from: Array<number> = [];
		let type: string = color === 'r' ? 'red__cell' : 'blue__cell';
		if(field[0][0] === type)
			from = [0, 0];
		if(field[0][29] === type)
			from = [0, 29];
		if(field[29][0] === type)
			from = [29, 0];
		if(field[29][29] === type)
			from = [29, 29];
		return from;
	}

	/**
	 * Функция, проверяющая, сделал ли свой первый ход противоположный игрок
	 * @param gameField игровое поле
	 */
	private static _isCornerEmpty(gameField: Array<Array<string>>): boolean
	{
		let field: Array<Array<string>> = gameField;
		let type: string = 'default__cell';
		if(field[0][0] !== type)
			return field[29][29] === type;
		if(field[0][29] !== type)
			return field[29][0] === type;
		if(field[29][0] !== type)
			return field[0][29] === type;
		if(field[29][29] !== type)
			return field[0][0] === type;
		return false;
	}

	/**
	 * Функция хода
	 * @param gameField игровое поле
	 * @param from с какого угла начинал игрок
	 * @param rowFrom с какого ряда ходит
	 * @param colFrom с какого столбца ходит
	 * @param rowTo на какой ряд ходит
	 * @param colTo на какой столбец ходит
	 * @param dices кубики
	 */
	private static _makeMove(gameField: Array<Array<string>>, from: Array<number>, rowFrom: number, colFrom: number, rowTo: number, colTo: number, dices: Array<number>): boolean
	{
		let field: Array<Array<string>> = gameField;
		let primeNumbersArray: Array<Array<number>> = [];
		let possibleMoves: Array<Array<number>> = [];
		primeNumbersArray = this._factorization(dices[0] + dices[1]);
		if(from[0] === 0){
			if(from[1] === 0)
				possibleMoves = this._showMoves(primeNumbersArray, '+', '+', rowFrom, colFrom);
			else
				possibleMoves = this._showMoves(primeNumbersArray, '+', '-', rowFrom, colFrom);
		}
		if(from[0] === 29){
			if(from[1] === 0)
				possibleMoves = this._showMoves(primeNumbersArray, '-', '+', rowFrom, colFrom);
			else
				possibleMoves = this._showMoves(primeNumbersArray, '-', '-', rowFrom, colFrom);
		}
		return this._checkTo(possibleMoves, rowTo, colTo) && this._areCellsEmpty(field, rowFrom, colFrom, rowTo, colTo);
	}

	/**
	 * Поиск свободных клеток вокруг одной клетки
	 * @param gameField игровое поле
	 * @param row ряд клетки
	 * @param col столбец клетки
	 */
	private static _cellFree(gameField: Array<Array<string>>, row: number, col: number): Array<Array<number>>
	{
		let field: Array<Array<string>> = gameField;
		let resultArray: Array<Array<number>> = [];
		if(row !== 0){
			if(field[row - 1][col] === 'default__cell')
				resultArray.push([row - 1, col]);
		}
		if(col !== 0){
			if(field[row][col - 1] === 'default__cell')
				resultArray.push([row, col - 1]);
		}
		if(field[row + 1]){
			if(field[row + 1][col] === 'default__cell')
				resultArray.push([row + 1, col]);
		}
		if(field[row][col + 1]){
			if(field[row][col + 1] === 'default__cell')
				resultArray.push([row, col + 1]);
		}
		
		return resultArray;
	}

	/**
	 * Поиск свободных клеток вокруг существующей территории
	 * @param gameField игровое поле
	 * @param color цвет клеток
	 */
	private static _findFreeCells( gameField: Array<Array<string>>, color: string ): Array<Array<number>>
	{
		let field: Array<Array<string>> = gameField;
		let freeCells: Array<Array<number>> = [];
		let cellColor: string = '';
		cellColor = color === 'r' ? 'red__cell' : 'blue__cell';
		for(let i = 0; i < 30; i++){
			for(let j = 0; j < 30; j++){
				if(field[i][j] === cellColor){
					freeCells = freeCells.concat(this._cellFree(field, i, j));
				}
					
			}
		}
		return freeCells;
	}

	/**
	 * Функция, заполняющая поле клетками определенного цвета
	 * @param color цвет
	 * @param gameField игровое поле
	 * @param rowFrom с какого ряда начинает игрок
	 * @param colFrom с какого столбца начинает игрок
	 * @param rowTo на какой ряд ходит игрок
	 * @param colTo на какой столбец ходит игрок
	 */
	private static _fillField( color: string, gameField: Array<Array<string>>, rowFrom: number, colFrom: number, rowTo: number, colTo: number ): Array<Array<string>>
	{
		let field: Array<Array<string>> = gameField;
		let type: string = '';
		type = color === 'r' ? 'red__cell' : 'blue__cell';
		let rowF: number = rowFrom < rowTo ? rowFrom : rowTo;
		let colF: number = colFrom < colTo ? colFrom : colTo;
		let rowT: number = rowF === rowTo ? rowFrom : rowTo;
		let colT: number = colF === colTo ? colFrom : colTo;
		for(let i = rowF; i <= rowT; i++){
			for(let j = colF; j <= colT; j++){
				field[i][j] = `${type}`;
			}
		}
		return field;
	}
	
	/**
	 * Функция подбора пар множителей, возвращает массив вида [ [1,0], [0,1] ]
	 * @param n число, которое нужно разложить на множители
	 */
	private static _factorization( n: number ): Array<Array<number>>
	{
		let numbers: Array<Array<number>> = [];
		for(let i = 1; i <= n; i++){
			if(n % i === 0){
				numbers[i - 1] = [];
				numbers[i - 1][0] = i - 1;
				numbers[i - 1][1] = (n / i) - 1;
			}
		}
		return numbers.filter((item)=>{ return item !== null; });
	}

	/**
	 * Функция, вычисляющая свободные ходы
	 * @param primeNumbers массив пар множителей суммы на кубиках
	 * @param firstSign знак сложения или вычитания
	 * @param secondSign знак сложения или вычитания
	 * @param row ряд, с которого ходит игрок
	 * @param col столбец, с которого ходит игрок
	 */
	private static _showMoves( primeNumbers: Array<Array<number>>, firstSign: string, secondSign: string, row: number, col: number ): Array<Array<number>>
	{
		let moves: Array<Array<number>> = [];
		let i: number = 0;
		for(let item of primeNumbers) {
			moves[i] = [];
			if (firstSign === '+')
				moves[i][0] = item[0] + row;
			else
				moves[i][0] = row - item[0];

			if (secondSign === '+')
				moves[i][1] = item[1] + col;
			else
				moves[i][1] = col - item[1];
			
			i++;
		}
		return moves.filter((item)=>{ return item !== null });
	}

	/**
	 * Функция, которая проверяет соответствие координат массиву возможных ходов
	 * @param moves массив полученных возможных ходов
	 * @param row ряд, куда нажал пользователь
	 * @param col столбец, куда нажал пользователь
	 */
	private static _checkTo( moves: Array<Array<number>>, row: number, col: number ): boolean
	{
		let flag: boolean = false;
		for(let item of moves){
			if(item[0] === row && item[1] === col)
				flag = true;
		}
		return flag;
	}

	/**
	 * Функция проверки правильности первого хода
	 * @param field игровое поле
	 * @param rowFrom с какого ряда
	 * @param colFrom с какого столбца
	 * @param rowTo по какой ряд
	 * @param colTo по какой столбец
	 * @param dices кубики
	 */
	private static _checkFirstMove( field: Array<Array<string>>, rowFrom: number, colFrom: number, rowTo: number, colTo: number, dices: Array<number>): boolean
	{
		if(rowFrom > 0 && rowFrom < 29)
			return false;
		if(colFrom > 0 && colFrom < 29)
			return false;
		return this._makeMove(field, [rowFrom, colFrom], rowFrom, colFrom, rowTo, colTo, dices);
	}

	/**
	 * Функция проверки участка на пустоту
	 * @param field игровое поле
	 * @param rowFrom с какого ряда
	 * @param colFrom с какого столбца
	 * @param rowTo по какой ряд
	 * @param colTo по какой столбец
	 */
	private static _areCellsEmpty( field: Array<Array<string>>, rowFrom: number, colFrom: number, rowTo: number, colTo: number ): boolean
	{
		let rowF: number = rowFrom < rowTo ? rowFrom : rowTo;
		let colF: number = colFrom < colTo ? colFrom : colTo;
		let rowT: number = rowF === rowTo ? rowFrom : rowTo;
		let colT: number = colF === colTo ? colFrom : colTo;
		for(let i = rowF; i <= rowT; i++){
			for(let j = colF; j <= colT; j++){
				if(field[i][j] !== 'default__cell')
					return false;
			}
		}
		return true;
	}

	/**
	 * Функция, которая находит противоположный угол для противника
	 * @param field поле
	 */
	private static _findFirstMove( field: Array<Array<string>> ): Array<number>
	{
		let from: Array<number> = [];
		let type: string = 'default__cell';
		if(field[0][0] !== type)
			from = [29, 29];
		if(field[0][29] !== type)
			from = [29, 0];
		if(field[29][0] !== type)
			from = [0, 29];
		if(field[29][29] !== type)
			from = [0, 0];
		return from;
	}

	/**
	 * Первоначальная проверка на пустоту в углах
	 * @param field игровое поле
	 */
	private static _isFieldEmpty( field: Array<Array<string>> ): boolean
	{
		let type: string = 'default__cell';
		return field[0][0] === type && field[0][29] === type && field[29][0] === type && field[29][29] === type;
		
	}

	/**
	 * Проверка на победу
	 * @param sum сумма площадей игрока
	 */
	private static _checkWin( sum: number ): boolean
	{
		return sum >= 450;
	}

	/**
	 * Функция, генерирующая пустое поле
	 * @param field игровое поле
	 */
	private static _generateField( field: Array<Array<string>> ): Array<Array<string>>
	{
		let defaultField: Array<Array<string>> = field;
		for (let i = 0; i < 30; i++) {
			defaultField.push([]);
			for(let j = 0; j < 30; j++) {
				defaultField[i].push('default__cell');
			}
		}
		return defaultField;
	}
}

export {
	Game,
};
