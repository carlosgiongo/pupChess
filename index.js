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
        return translateToFenString(await readLastMove(page, colour), colour)
    }
}

/**
 * @param {puppeteer.Page} page - Pagina puppeter
 * @param {string} colour - Cor do jogador
 */ 
async function readLastMove(page, colour) {
    let fen_field = colour == 'white' ? WHITE_FEN_START_FIELD : BLACK_FEN_START_FIELD
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
    let url = `https://www.chessdb.cn/cdb.php?action=querybest&board=${fen}&json=true`

    let dados = await axios.get(url)
    console.log(dados.data)
}

main()