import 'source-map-support/register'
import csv from 'csv-parser'
import fs from "fs"
import puppeteer from "puppeteer"
import YAML from "yaml"

function delay(time) {
    return new Promise(function (resolve) {
        setTimeout(resolve, time)
    });
}


const readFilePromise = (filename: string) => {
    return new Promise<any>((resolve, reject) => {
        const results = []

        fs.createReadStream(filename)
            .pipe(csv())
            .on('data', (data) => results.push(data))
            .on('end', () => {
                resolve(results)
            }).on('error', () => {
            reject("Unable to read csv")
        })
    })
}

const fetchFirstXPath = async (selector: string, page, timeout = 20000) => {
    //console.warn(`selector: ${selector}`)
    await page.waitForXPath(selector, {timeout})
    const elements = await page.$x(selector)
    return elements[0]
}

// made using XPath Generator 1.1.0

const addAlert = async (symbol: string, alertConfig: any, page) => {


    const {} = alertConfig

    //await page.waitForXPath('//*[@id="header-toolbar-symbol-search"]/div/input')


    const symbolHeaderInput = await fetchFirstXPath('//div[@id="header-toolbar-symbol-search"]', page)

    await symbolHeaderInput.click()
    await delay(500);
    const symbolInput = await fetchFirstXPath('//input[@data-role=\'search\']', page)
    await symbolInput.type(`  ${symbol}${String.fromCharCode(13)}`)
    await delay(2000);
	await page.keyboard.down('Alt');
	await page.keyboard.press('KeyW');
	await page.keyboard.up('Alt');

}


const main = async () => {

    const configFileName = process.argv[2] || "config.yml"

    if (!fs.exists) {
        console.error("Unable to find config file: ", configFileName)
    }

    console.log("Using config file: ", configFileName)

    const configString = await fs.readFileSync(configFileName, {encoding: "utf-8"})

    const config = YAML.parse(configString)

    const {alert: alertConfig} = config

    //console.log("alertConfig", alertConfig.message)

    const browser = await puppeteer.launch({
        headless: false, userDataDir: "./user_data",
        defaultViewport: null,
        args: [
            `--app=${config.tradingview.chartUrl}#signin`,
            // '--window-size=1440,670'
        ]
    })

    await delay(4000)

    const page = (await browser.pages())[0];

    const isAccessDenied = await page.evaluate(() => {
        return document.title.includes("Denied");
    });

    // const page = await browser.newPage()
    // const response = await page.goto(config.tradingview.chartUrl + "#signin")

    if (isAccessDenied) {

        console.log("You'll need to sign into TradingView in this browser (one time only)\n...after signing in, press ctrl-c to kill this script, then run it again")
        await delay(1000000)

    } else {
        await delay(3000)

		const symbolRows = await readFilePromise(config.files.input)

        for (const row of symbolRows) {

            console.log(`Adding symbol: ${row.symbol}`)
            await delay(500)
            await addAlert(row.symbol, alertConfig, page)
        }
    }

    await delay(4000)
    await browser.close()

}


main().catch(error => console.error(error))
