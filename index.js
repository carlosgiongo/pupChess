require('dotenv').config()
const puppeteer = require('puppeteer');
const readline = require('readline');
const stockfish = require("stockfish");
const engine = stockfish();

let colour_global = ''
let white_king = 4
let black_king = 4
let castles = ['K', 'Q', 'k', 'q']
let en_passant = '-'

/**
 * 
 * @param {string} fen_string 
 */
async function callStockFish(fen_string){
    engine.postMessage("uci");
    engine.postMessage("ucinewgame");
    engine.postMessage("position fen " + fen_string);
    engine.postMessage("go depth 13");
    return new Promise(resolve => {
        engine.onmessage = function(msg) {
            // only send response when it is a recommendation
            if (typeof(msg == "string") && msg.match("bestmove")) {
                resolve(msg)
            }
        }
    })
}

function askQuestion(query, first = false) {
    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
    });

    if(!first){
        rl.line = 'y'   
    }

    return new Promise(resolve => rl.question(query, ans => {
        rl.close();
        resolve(ans);
    }))
}

/**
 * @param {puppeteer.Page} page - Pagina puppeter
 * @param {string} colour - Cor do jogador
 */
async function getInitialFen(page, colour) {
    if(colour == 'w') {
        return 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1'
    } else {
        await startWaitingForMove(page)
        return await readLastMove(page, colour)
    }
}

/** 
 * @param {puppeteer.Page} page - Pagina puppeter
*/
async function startWaitingForMove(page) {
    await page.waitForXPath('/html/body/div[3]/div/vertical-move-list/div[1]/div[1]')
}

function invertArray(arr) {
    for (let i = 0; i < 4; i++) {
        let temp = arr[i];
        arr[i] = arr[7-i];
        arr[7-i] = temp;
    }
    return arr;
}

/**
 * @param {Array} matrix - Campo FEN
*/
function matrixToFEN(matrix_) {
    let matrix = matrix_.map((arr) => {return invertArray(arr)})
    matrix = invertArray(matrix)

    let FEN = '';
    for (let i = 0; i < 8; i++) {
        let emptySquares = 0;
        for (let j = 0; j < 8; j++) {
            if (matrix[i][j] === '') {
                emptySquares++;
            } else {
                if (emptySquares > 0) {
                    FEN += emptySquares;
                    emptySquares = 0;
                }
                FEN += matrix[i][j];
            }
        }
        if (emptySquares > 0) {
            FEN += emptySquares;
        }
        if (i < 7) {
            FEN += '/';
        }
    }
    return FEN + ' ' + colour_global + ' ' + (castles.length >= 2 ? castles.join('') : "-") + ' ' + en_passant + ' 0 1';
}

/**
 * @param {puppeteer.Page} page - Pagina puppeter
*/
async function getAllPiecesPositions(page){
    let white_rookie = await page.$$('.wr')
    let black_rookie = await page.$$('.br')
    
    let white_knight = await page.$$('.wn')
    let black_knight = await page.$$('.bn')

    let white_bishop = await page.$$('.wb')
    let black_bishop = await page.$$('.bb')

    let white_queen = await page.$$('.wq')
    let black_queen = await page.$$('.bq')

    let white_king = await page.$$('.wk')
    let black_king = await page.$$('.bk')

    let white_pawn = await page.$$('.wp')
    let black_pawn = await page.$$('.bp')

    let pieces = {
        'wr': white_rookie,
        'br': black_rookie,
        'wn': white_knight,
        'bn': black_knight,
        'wb': white_bishop,
        'bb': black_bishop,
        'wq': white_queen,
        'bq': black_queen,
        'wk': white_king,
        'bk': black_king,
        'wp': white_pawn,
        'bp': black_pawn
    }

    return pieces
}


/**
 * @param {puppeteer.Page} page - Pagina puppeter
*/
async function readLastMove(page){
    let fen = [
        ['', '', '', '', '', '', '', ''],
        ['', '', '', '', '', '', '', ''],
        ['', '', '', '', '', '', '', ''],
        ['', '', '', '', '', '', '', ''],
        ['', '', '', '', '', '', '', ''],
        ['', '', '', '', '', '', '', ''],
        ['', '', '', '', '', '', '', ''],
        ['', '', '', '', '', '', '', '']
    ]

    let all_pieces = await getAllPiecesPositions(page)
    let keys = Object.keys(all_pieces)
    for (let i = 0; i < keys.length; i++) {
        let key = keys[i]
        let pieces = all_pieces[key]
        for (let j = 0; j < pieces.length; j++) {
            let piece = pieces[j]
            let class_name = await piece.getProperty('className')
            class_name = await class_name.jsonValue()
            position = class_name.split('-')[1]
            fields = position.split('').map(Number)
            fen[fields[1] - 1][8 - fields[0]] = key.charAt(0) == 'w' ? key.charAt(1).toUpperCase() : key.charAt(1)
        }
    }

    return fen
}

/**
 * 
 * @param {puppeteer.Page} page - Pagina puppeter
 * @param {string} fen - Campo FEN
 * @param {string} colour - Cor do jogador
*/
async function continueTheGame(page, my_colour_ = null, first = true, fen = []) {
    let fen_ = fen
    let my_colour = my_colour_;

    if(first){
        my_colour = await askQuestion("Qual a sua cor ('b' or 'w')? ", true);
        colour_global = my_colour
        if(my_colour == 'b') {
            let init = await askQuestion("Começamos como pretas... Posso ler a primeira jogada do meu oponente?")
            if(init == 'y') {
                fen_ = await readLastMove(page, my_colour)
                fen_string = matrixToFEN(fen_)
                await callStockFish(fen_string).then(console.log)
            } else {
                process.exit()
            }
        } else {
            fen_ = await getInitialFen(page, my_colour)
            await callStockFish(fen_).then(console.log)
        }
    }

    let ans;
    do{
        ans = await askQuestion("Validar proxima jogada? ");
    } while (ans != 'y' && ans != 'exit' && ans != 'end')

    if(ans == 'y') {
        let fen_field = await readLastMove(page, my_colour, fen_)
        let fen_string = matrixToFEN(fen_field)
        await callStockFish(fen_string).then(console.log)
        await continueTheGame(page, my_colour, false, fen_field)
    } else if (ans == 'exit') {
        process.exit()
    } else {
        //end (Recomeçar o jogo)
        await continueTheGame(page, null, true, [])
    }
}

async function main() {
    const browser = await puppeteer.launch({
        headless: false,
        args: ['--start-maximized']
    });
    const page = await browser.newPage();
    await page.setViewport({
        width: 1200,
        height: 800,
        deviceScaleFactor: 1,
    });

    if(process.env.CHESS_ACCOUNT && process.env.CHESS_PASS) {
        await page.goto('https://www.chess.com/login_and_go?returnUrl=%2Fplay%2Fcomputer');
        await page.waitForSelector('#username');
        await page.type('#username', process.env.CHESS_ACCOUNT, {delay: 100});
        await page.type('#password', process.env.CHESS_PASS, {delay: 100});
        await page.click('#login', {delay: 100});
    }

    await page.goto('https://www.chess.com/play/computer'); //https://www.chess.com/play/online
    await continueTheGame(page)
}

main()