const axios = require('axios');

// --- 1. SETTINGS ---
const CREDENTIALS = {
    username: "Kami522",
    password: "Kami526"
};

// 👇 اپنی تازہ ترین کوکی یہاں ڈال دیں تاکہ بوٹ کو پہلی بار لاگ ان نہ کرنا پڑے
let cachedCookie = "PHPSESSID=jd6baa99k47e8bkv1o17c9c91a"; 

const BASE_URL = "http://51.89.99.105/NumberPanel";
const OTP_URL = "http://51.89.99.105/NumberPanel/client/res/data_smscdr.php?fdate1=2025-12-11%2000:00:00&fdate2=2025-12-11%2023:59:59&frange=&fnum=&fcli=&fgdate=&fgmonth=&fgrange=&fgnumber=&fgcli=&fg=0&sesskey=Q05RRkJQUEJCUQ==&sEcho=2&iColumns=7&sColumns=%2C%2C%2C%2C%2C%2C&iDisplayStart=0&iDisplayLength=-1&mDataProp_0=0&sSearch_0=&bRegex_0=false&bSearchable_0=true&bSortable_0=true&mDataProp_1=1&sSearch_1=&bRegex_1=false&bSearchable_1=true&bSortable_1=true&mDataProp_2=2&sSearch_2=&bRegex_2=false&bSearchable_2=true&bSortable_2=true&mDataProp_3=3&sSearch_3=&bRegex_3=false&bSearchable_3=true&bSortable_3=true&mDataProp_4=4&sSearch_4=&bRegex_4=false&bSearchable_4=true&bSortable_4=true&mDataProp_5=5&sSearch_5=&bRegex_5=false&bSearchable_5=true&bSortable_5=true&mDataProp_6=6&sSearch_6=&bRegex_6=false&bSearchable_6=true&bSortable_6=true&sSearch=&bRegex=false&iSortCol_0=0&sSortDir_0=desc&iSortingCols=1&_=1765460983523";

const HEADERS = {
    "User-Agent": "Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Mobile Safari/537.36",
    "X-Requested-With": "XMLHttpRequest",
    "Referer": `${BASE_URL}/client/SMSCDRStats`,
    "Origin": "http://51.89.99.105"
};

// --- 2. LOGIN LOGIC ---
async function performLogin() {
    console.log("🔄 System: Performing New Login...");
    try {
        const session = axios.create({ 
            withCredentials: true, 
            headers: HEADERS,
            timeout: 8000 // 8 سیکنڈ کا ٹائم آؤٹ تاکہ ورسل کریش نہ ہو
        });

        // Step A: Get Page
        const loginPage = await session.get(`${BASE_URL}/login`);
        
        // کوکی پکڑیں
        let tempCookie = "";
        if (loginPage.headers['set-cookie']) {
            const c = loginPage.headers['set-cookie'].find(x => x.includes('PHPSESSID'));
            if (c) tempCookie = c.split(';')[0];
        }

        // کیپچا حل کریں
        const match = loginPage.data.match(/What is (\d+) \+ (\d+) = \?/);
        if (!match) throw new Error("Captcha Not Found in HTML");
        
        const answer = parseInt(match[1]) + parseInt(match[2]);

        // Step B: Post Data
        const params = new URLSearchParams();
        params.append('username', CREDENTIALS.username);
        params.append('password', CREDENTIALS.password);
        params.append('capt', answer);

        const loginResp = await session.post(`${BASE_URL}/signin`, params, {
            headers: {
                "Content-Type": "application/x-www-form-urlencoded",
                "Cookie": tempCookie
            },
            maxRedirects: 0,
            validateStatus: () => true
        });

        // نئی کوکی محفوظ کریں
        if (loginResp.headers['set-cookie']) {
            const newC = loginResp.headers['set-cookie'].find(x => x.includes('PHPSESSID'));
            if (newC) {
                cachedCookie = newC.split(';')[0];
                console.log("✅ Login Success! New Cookie: " + cachedCookie);
                return cachedCookie;
            }
        }
        
        // اگر نئی نہیں ملی تو پرانی واپس کریں
        if (tempCookie) {
            cachedCookie = tempCookie;
            return cachedCookie;
        }

        throw new Error("Login failed to retrieve cookie");

    } catch (e) {
        console.error("Login Error: " + e.message);
        throw e; // ایرر واپس پھینکیں تاکہ مین فنکشن کو پتہ چلے
    }
}

// --- 3. MAIN HANDLER ---
module.exports = async (req, res) => {
    try {
        // [Step 1] سب سے پہلے موجودہ کوکی کے ساتھ ٹرائی کریں
        console.log("📡 Attempt 1: Fetching Data with Cached Cookie...");
        
        let response = await axios.get(OTP_URL, {
            headers: { ...HEADERS, "Cookie": cachedCookie },
            validateStatus: () => true, // کریش نہ ہو، چاہے 500 یا 404 آئے
            timeout: 5000
        });

        // [Step 2] چیک کریں کہ کیا لاگ ان کی ضرورت ہے؟
        // اگر رسپانس HTML ہے اور اس میں 'login' یا 'Direct Script' لکھا ہے
        const isLoginNeeded = typeof response.data === 'string' && 
                             (response.data.includes('<html') || 
                              response.data.includes('login') || 
                              response.data.includes('Direct Script'));

        if (isLoginNeeded) {
            console.log("⚠️ Session Expired. Triggering Re-login...");
            
            // نیا لاگ ان کریں
            await performLogin();

            // [Step 3] نئی کوکی کے ساتھ دوبارہ ٹرائی کریں
            console.log("📡 Attempt 2: Fetching Data with NEW Cookie...");
            response = await axios.get(OTP_URL, {
                headers: { ...HEADERS, "Cookie": cachedCookie },
                validateStatus: () => true,
                timeout: 5000
            });
        }

        // [Step 4] فائنل رزلٹ دکھائیں (چاہے ایرر ہو یا ڈیٹا)
        if (typeof response.data === 'object') {
            // اگر JSON ہے تو JSON بھیجیں
            return res.status(200).json(response.data);
        } else {
            // اگر HTML یا ایرر ٹیکسٹ ہے تو وہ بھیجیں
            return res.status(response.status).send(response.data);
        }

    } catch (error) {
        // اگر کوئی بہت ہی برا ایرر آ جائے (جیسے ٹائم آؤٹ)
        return res.status(500).json({
            error: "Internal Server Error",
            details: error.message,
            stack: error.response ? error.response.data : "No response from target"
        });
    }
};
