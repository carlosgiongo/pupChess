const puppeteer = require('puppeteer');
const axios = require('axios')
const readline = require('readline');

let castles = ['K', 'Q', 'k', 'q']
let en_passant = '-'

function askQuestion(query) {
    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
    });

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


/**
 * @param {Array} fen_field - Campo FEN
 * @param {string} colour - Cor do jogador
*/
async function translateToFenString(fen_field, colour) {
    let correct_field = fen_field[0][1]
    let fen_string = ''
    for (let i = 0; i < correct_field.length; i++) {
        let piece = correct_field[i]
        if(piece == '') {
            fen_string += '1'
        } else {
            fen_string += piece
        }
    } 

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
 * @param {string} colour - Cor do jogador
*/
async function readLastMove(page, colour){
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
async function continueTheGame(page, my_colour, first = true, fen = []) {
    let fen_ = fen

    if(first){
        if(my_colour == 'b') {
            let init = await askQuestion("Começamos como pretas... Posso ler a primeira jogada do meu oponente?")
            if(init == 'y') {
                fen_ = await readLastMove(page, my_colour)
                fen_string = await translateToFenString(fen_, my_colour)
                console.log(fen_)
                let url = `https://www.chessdb.cn/cdb.php?action=querybest&board=${fen_string}&json=true`
                console.log(url)
                let dados = await axios.get(url)
                console.log("Melhor jogada:", dados.data)
            } else {
                process.exit()
            }
        } else {
            fen_ = await getInitialFen(page, my_colour)
            let url = `https://www.chessdb.cn/cdb.php?action=querybest&board=${fen_}&json=true`
            let dados = await axios.get(url)
            console.log("Melhor jogada:", dados.data)
        }
    }

    const ans = await askQuestion("Validar proxima jogada? ");
    if(ans == 'y') {
        let fen_field = await readLastMove(page, my_colour, fen_)
        let fen_string = await translateToFenString(fen_field, my_colour)
        let url = `https://www.chessdb.cn/cdb.php?action=querybest&board=${fen_string}&json=true`
        console.log("Validando formação:", url)
        let dados = await axios.get(url)
        console.log("Melhor jogada:", dados.data)
        await continueTheGame(page, my_colour, false, fen_field)
    } else {
        process.exit()
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

    await page.goto('https://www.chess.com/play/computer');
    let my_colour = await askQuestion("Qual a sua cor ('b' or 'w')? ");
    await continueTheGame(page, my_colour)
}

main()