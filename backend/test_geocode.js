const axios = require('axios');

async function getDistance(lat1, lon1, lat2, lon2) {
    const url = `http://router.project-osrm.org/route/v1/driving/${lon1},${lat1};${lon2},${lat2}?overview=false`;
    try {
        const response = await axios.get(url);
        if (response.data.routes && response.data.routes.length > 0) {
            return response.data.routes[0].distance / 1000; // in km
        }
    } catch (e) {
        console.error("OSRM Error:", e.message);
    }
    return null;
}

async function run() {
    // origin
    const lat1 = '-23.7168022';
    const lon1 = '-46.5691653';
    
    // some dest in sbc center (approx)
    const lat2 = '-23.6966';
    const lon2 = '-46.5448';
    
    const dist = await getDistance(lat1, lon1, lat2, lon2);
    console.log("Distance:", dist, "km");
}
run();
