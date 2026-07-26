require('dotenv').config();
const { calculateShippingQuote } = require('./uberService');

async function run() {
    console.log("Cotando frete para: 09810-200 (Assunção, igual origem)");
    let res = await calculateShippingQuote("09810-200");
    console.log(res);

    console.log("\nCotando frete para: 09720010 (Centro)");
    res = await calculateShippingQuote("09720010");
    console.log(res);
}

run();
