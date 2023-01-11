const puppeteer = require('puppeteer');
const axios = require('axios')
const fs = require("fs");
const getColors = require('get-image-colors')
const path = require('path')

const WHITE_FEN_START_FIELD = 
[
    ['r', 'n', 'b', 'q', 'k', 'b', 'n', 'r'],
    ['p', 'p', 'p', 'p', 'p', 'p', 'p', 'p'],
    [' ', ' ', ' ', ' ', ' ', ' ', ' ', ' '],
    [' ', ' ', ' ', ' ', ' ', ' ', ' ', ' '],
    [' ', ' ', ' ', ' ', ' ', ' ', ' ', ' '],
    [' ', ' ', ' ', ' ', ' ', ' ', ' ', ' '],
    ['P', 'P', 'P', 'P', 'P', 'P', 'P', 'P'],
    ['R', 'N', 'B', 'Q', 'K', 'B', 'N', 'R']
]

const BLACK_FEN_START_FIELD = 
[
    ['R', 'N', 'B', 'Q', 'K', 'B', 'N', 'R'],
    ['P', 'P', 'P', 'P', 'P', 'P', 'P', 'P'],
    [' ', ' ', ' ', ' ', ' ', ' ', ' ', ' '],
    [' ', ' ', ' ', ' ', ' ', ' ', ' ', ' '],
    [' ', ' ', ' ', ' ', ' ', ' ', ' ', ' '],
    [' ', ' ', ' ', ' ', ' ', ' ', ' ', ' '],
    ['p', 'p', 'p', 'p', 'p', 'p', 'p', 'p'],
    ['r', 'n', 'b', 'q', 'k', 'b', 'n', 'r']
]

let current_player = 'w'
let castles = ['K', 'Q', 'k', 'q']
let en_passant = '-'

function delay(time) {
    return new Promise(function(resolve) { 
        setTimeout(resolve, time)
    });
}

/**
 * @param {puppeteer.Page} page - Pagina puppeter
 */
async function whoIam(page) {
    //Delay de load da pagina
    await page.waitForXPath('/html/body/div[3]/div/div[2]/button')

    //Clique no botão de escolher adversário
    await(await page.$x('/html/body/div[3]/div/div[2]/button'))[0].click()

    //Delay de load da pagina
    await page.waitForXPath('/html/body/div[3]/div/section/div/div[1]/div[3]/input')

    //Clique no boão para escolher cor aleatoriamente e iniciar partida
    await(await page.$x('/html/body/div[3]/div/section/div/div[1]/div[3]/input'))[0].click()
    await(await page.$x('/html/body/div[3]/div/div[2]/button'))[0].click()

    await delay(1300)

    await page.screenshot({
        path: 'rainha.png',
        clip: {
            width: 73,
            height: 73,
            x: 311,
            y: 577
        }
    });

    let colors = (await getColors(path.join(__dirname, 'rainha.png'))).map(color => color.hex())
    fs.unlinkSync(path.join(__dirname, 'rainha.png'))
    return colors[0] == '#4f4e4d' ? 'black' : 'white'
}

/**
 * @param {puppeteer.Page} page - Pagina puppeter
 * @param {string} colour - Cor do jogador
 */
async function getInitialFen(page, colour) {
    if(colour == 'white') {
        return 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1'
    } else {
        await startWaitingForMove(page)
        return await readLastMove(page, colour)
    }
}

/**
 * @param {puppeteer.Page} page - Pagina puppeter
 * @param {string} colour - Cor do jogador
 */ 
async function readLastMove(page, colour, fen_field_origin = null) {
    let fen_field = fen_field_origin != null ? fen_field_origin : colour == 'white' ? WHITE_FEN_START_FIELD : BLACK_FEN_START_FIELD
    console.log(fen_field)
    
    await page.waitForSelector('.highlight')
    
    let highlighted_fields = await page.$$('.highlight')
    let positions = []

    for (let i = 0; i < highlighted_fields.length; i++) {
        let field = highlighted_fields[i]
        let field_class = await (await field.getProperty('className')).jsonValue()
        positions.push(field_class.split('-')[1])
    }

    if(colour == 'black') {
        fen_field[parseInt(positions[0].split('')[1]) - 1][8 - parseInt(positions[0].split('')[0])] = fen_field[parseInt(positions[1].split('')[1]) - 1][8 - parseInt(positions[1].split('')[0])]
        fen_field[parseInt(positions[1].split('')[1]) - 1][8 - parseInt(positions[1].split('')[0])] = ' '
    } else {
        fen_field[8 - parseInt(positions[0].split('')[0])][parseInt(positions[0].split('')[1]) - 1] = fen_field[8 - parseInt(positions[1].split('')[0])][parseInt(positions[1].split('')[1]) - 1]
        fen_field[8 - parseInt(positions[1].split('')[0])][parseInt(positions[1].split('')[1]) - 1] = ' '
    }

    return fen_field
}

/** 
 * @param {puppeteer.Page} page - Pagina puppeter
*/
async function startWaitingForMove(page) {
    await page.waitForXPath('/html/body/div[3]/div/vertical-move-list/div[1]/div[1]')
    current_player = 'b'
}


/**
 * @param {Array} fen_field - Campo FEN
 * @param {string} colour - Cor do jogador
*/
async function translateToFenString(fen_field, colour) {
    let fen_string = ''

    for (let i = 0; i < fen_field.length; i++) {
        let line = fen_field[i]
        let empty_space = 0
        for (let j = 0; j < line.length; j++) {
            if(line[j] == ' ') {
                empty_space++
            } else {
                if(empty_space > 0) {
                    fen_string += empty_space
                    empty_space = 0
                }
                fen_string += line[j]
            }
        }
        if(empty_space > 0) {
            fen_string += empty_space
        }
        if(i < fen_field.length - 1) {
            fen_string += '/'
        }
    }

    let final_fen = `${colour == 'black' ? fen_string.replace(/./g, c => c === c.toUpperCase() ? c.toLowerCase() : c.toUpperCase()) : fen_string} ${current_player} ${castles.join('')} - 0 1`
    return final_fen
}


async function waitForMyMove(page, colour) {
    if(colour == 'black'){
        await page.waitForSelector('.white.node.selected')
        return
    } else {
        await page.waitForSelector('.black.node.selected')
        return
    }
}

/**
 * 
 * @param {puppeteer.Page} page - Pagina puppeter
 * @param {string} fen - Campo FEN
 * @param {string} colour - Cor do jogador
*/
async function continueTheGame(page, fen_, my_colour) {
    let fen = fen_

    await waitForMyMove(page, my_colour)
    console.log('Jogada do adversário...')
    fen = await readLastMove(page, my_colour, fen)
    console.log("NOVO CAMPO FEN:", fen)
    let fen_string = await translateToFenString(fen, my_colour)
    let url = `https://www.chessdb.cn/cdb.php?action=querybest&board=${fen_string}&json=true`
    console.log("Nova url:", url)
    let dados = await axios.get(url)
    console.log(dados.data)

    //continueTheGame(page, fen, my_colour)
}

function transformLetterInNumber(letter, colour){
    switch (letter) {
        case 'a':
            return colour == 'black' ? 7 : 0
            break;
        case 'b':
            return colour == 'black' ? 6 : 1
            break;
        case 'c':
            return colour == 'black' ? 5 : 2
            break;
        case 'd':
            return colour == 'black' ? 4 : 3
            break;
        case 'e':
            return colour == 'black' ? 3 : 4
            break;
        case 'f':
            return colour == 'black' ? 2 : 5
            break;
        case 'g':
            return colour == 'black' ? 1 : 6
            break;
        case 'h':
            return colour == 'black' ? 0 : 7
            break;
        default:
            break;
    }
}


/**
 * 
 * @param {string} move 
 * @param {string} colour 
 * @param {puppeteer.Page} page 
 * @param {Array} fen
 */
async function makeTheMove(move, colour, page, fen){
    let move_splited = move.split("")
    let move_column_1 = transformLetterInNumber(move_splited[0], colour)
    let move_column_2 = transformLetterInNumber(move_splited[2], colour)
    let move_row_1 = colour == 'black' ? parseInt(move_splited[1]) - 1 : 8 - parseInt(move_splited[1]) 
    let move_row_2 = colour == 'black' ? parseInt(move_splited[3]) - 1 : 8 - parseInt(move_splited[3]) 

    fen[move_row_2][move_column_2] = fen[move_row_1][move_column_1]
    fen[move_row_1][move_column_1] = ' '

    let order = move_column_1 + 2 + '' + move_splited[1]
    let class_to_find = '.square-'+order
    await (await page.$$(class_to_find))[0].click()

    let new_move = '.square-' + (move_column_2 + 2 + '' + move_splited[3])
    await (await page.$$(new_move))[0].click()

    return fen
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
    await page.waitForXPath('/html/body/div[26]/div[2]/div/div/button')
    await (await page.$x('/html/body/div[26]/div[2]/div/div/button'))[0].click()

    let my_colour = await whoIam(page)
    let fen = await getInitialFen(page, my_colour)
    let fen_string = await translateToFenString(fen, my_colour)
    let url = `https://www.chessdb.cn/cdb.php?action=querybest&board=${fen_string}&json=true`

    let dados = await axios.get(url)
    console.log(dados.data)
    
    fen = await makeTheMove(dados.data.move || null, my_colour, page, fen)
    await continueTheGame(page, fen, my_colour)
}

main()