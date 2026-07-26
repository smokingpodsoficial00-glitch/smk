const axios = require('axios');
const clientId = "Qw7Ji7zp9_R5tJ9wIdXasmFprkCPj71Y";
const clientSecret = "ZWwmgQQvM8CXsOeQo7t90qTvzXjHQO0Eg8GgEECN";

async function testScope(scopeName) {
    try {
        const response = await axios.post('https://login.uber.com/oauth/v2/token', new URLSearchParams({
            client_id: clientId,
            client_secret: clientSecret,
            grant_type: 'client_credentials',
            scope: scopeName
        }), {
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
        });
        console.log(`✅ Success with scope: '${scopeName}'. Token length: ${response.data.access_token.length}`);
        return true;
    } catch (error) {
        console.log(`❌ Failed with scope: '${scopeName}'. Error: ${error.response?.data?.error_description || error.message}`);
        return false;
    }
}

async function run() {
    const scopes = ['delivery', 'eats.deliveries', 'direct', ''];
    for (const s of scopes) {
        const success = await testScope(s);
        if (success) break;
    }
}
run();
