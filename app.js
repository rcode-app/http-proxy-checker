const TIMEOUT_DURATION = 3000;
const { MAX_DURATION, THREADS, TARGET_URL } = require("./config");
const fs = require("fs");
const request = require("request").defaults({ timeout: MAX_DURATION });
const async = require("async");
global.index = 0;

if(!fs.existsSync("./logs/")) fs.mkdirSync("./logs/");

let good_list = "", bad_list = "";

async function try_proxy(proxy) {
    return new Promise((resolve, reject) => {
        
        if(!proxy.startsWith("http")) proxy = `http://${proxy}`;
        let time_start = Date.now();
        
        const timeoutId = setTimeout(() => {
            reject(new Error('Request timed-out'));
        }, MAX_DURATION);
                
        request.get(TARGET_URL, { proxy }, (error, response, body) => {
            clearTimeout(timeoutId);
            const request_duration = parseInt(Date.now() - time_start);
            
            if(!error && response?.statusCode == 200) {
                return resolve(request_duration);
            } else {
                if(error) return reject(error);
                if(response.statusCode && response.statusCode !== 200) {
                    return reject(new Error("Bad response status. StatusCode: "+response.statusCode));
                }
                return reject(new Error("Unknown error"));
            }
            
        })
    })
}

function loadProxies() {
    const lines = fs.readFileSync("./proxies.txt", "utf-8").split(/\r?\n/).filter(Boolean).map(el => {
        return `http://${el}`;
    });

    console.log("[loadProxies()] Загружено прокси: "+lines.length);
    return lines;
}

async function check_proxy(proxy) {
    const clearly_proxy = proxy.replace(`http://`, "");
    console.log(`[ID #${global.index}] ${clearly_proxy} => Try proxy...`);
    
    return new Promise(async (resolve) => {
        try {
            const duration = await try_proxy(proxy);
            console.log(`[ID #${global.index}] ${clearly_proxy} => Request ended. Duration ${duration} ms.`)
            good_list += `${proxy.replace("http://", "")}\n`
            global.index++;
            return resolve();
        } catch (error) {
            global.index++;
            console.log(`[ID #${global.index}] ${clearly_proxy} => Request error: ${error.message || error}`);
            bad_list += `${proxy.replace("http://", "")}\n`
            return resolve()
        }
    })
}

(async () => {
    const proxies_list = loadProxies();
    await async.mapLimit(proxies_list, THREADS, check_proxy);
    console.log("Process done!");

    fs.writeFileSync("./logs/proxies_good.txt", good_list);
    fs.writeFileSync("./logs/proxies_bad.txt", bad_list);
})();

