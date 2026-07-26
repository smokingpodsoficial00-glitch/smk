const axios = require('axios');

const clientId = "Qw7Jl7zp9_R5tJ9wIdXasmFprkCPj7IY";
const clientSecret = "FpedRSf7U94xgxKaNog_3qeA-nTGONM";
const ORIGIN_ADDRESS = "Rua Alexandra Lunardi Fanani, 57 - Assunção, São Bernardo do Campo - SP, 09810-200";

async function getUberToken() {
    try {
        const response = await axios.post('https://login.uber.com/oauth/v2/token', new URLSearchParams({
            client_id: clientId,
            client_secret: clientSecret,
            grant_type: 'client_credentials',
            scope: 'delivery'
        }), {
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
        });
        return response.data.access_token;
    } catch (error) {
        console.error('Error token:', error.response?.data || error.message);
        return null;
    }
}

async function testQuote(dropoff) {
    const token = await getUberToken();
    try {
        const response = await axios.post('https://api.uber.com/v1/deliveries/quote', {
            pickup_address: ORIGIN_ADDRESS,
            dropoff_address: dropoff
        }, {
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });
        console.log(`Quote for "${dropoff}":`, response.data.fee / 100, `Distance:`, response.data.distance);
    } catch (error) {
        console.error(`Error quoting "${dropoff}":`, error.response?.data?.message || error.message);
    }
}

async function run() {
    console.log("Testing raw CEP (09810-200)...");
    await testQuote("09810-200");
    console.log("\nTesting raw CEP without dash (09810200)...");
    await testQuote("09810200");
    console.log("\nTesting full address identical to origin...");
    await testQuote(ORIGIN_ADDRESS);
}

run();
