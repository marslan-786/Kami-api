const axios = require('axios');

const CREDENTIALS = {
    username: "Kami522",
    password: "Kami526"
};

const BASE_URL = "http://51.89.99.105/NumberPanel";
const OTP_URL = "http://51.89.99.105/NumberPanel/client/res/data_smscdr.php?fdate1=2025-12-11%2000:00:00&fdate2=2025-12-11%2023:59:59&frange=&fnum=&fcli=&fgdate=&fgmonth=&fgrange=&fgnumber=&fgcli=&fg=0&sesskey=Q05RRkJQUEJCUQ==&sEcho=2&iColumns=7&sColumns=%2C%2C%2C%2C%2C%2C&iDisplayStart=0&iDisplayLength=-1&mDataProp_0=0&sSearch_0=&bRegex_0=false&bSearchable_0=true&bSortable_0=true&mDataProp_1=1&sSearch_1=&bRegex_1=false&bSearchable_1=true&bSortable_1=true&mDataProp_2=2&sSearch_2=&bRegex_2=false&bSearchable_2=true&bSortable_2=true&mDataProp_3=3&sSearch_3=&bRegex_3=false&bSearchable_3=true&bSortable_3=true&mDataProp_4=4&sSearch_4=&bRegex_4=false&bSearchable_4=true&bSortable_4=true&mDataProp_5=5&sSearch_5=&bRegex_5=false&bSearchable_5=true&bSortable_5=true&mDataProp_6=6&sSearch_6=&bRegex_6=false&bSearchable_6=true&bSortable_6=true&sSearch=&bRegex=false&iSortCol_0=0&sSortDir_0=desc&iSortingCols=1&_=1765460983523";

const HEADERS = {
    "User-Agent": "Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Mobile Safari/537.36",
    "X-Requested-With": "XMLHttpRequest",
    "Referer": `${BASE_URL}/client/SMSCDRStats`,
    "Origin": "http://51.89.99.105"
};

// گلوبل کوکی (تاکہ بار بار لاگ ان نہ کرنا پڑے)
let cachedCookie = null;

async function performLogin() {
    try {
        console.log("🔄 Performing Login...");
        const session = axios.create({
            withCredentials: true,
            headers: { ...HEADERS, "Upgrade-Insecure-Requests": "1" },
            validateStatus: () => true // کسی بھی سٹیٹس کوڈ پر ایرر نہ دے
        });

        // 1. لاگ ان پیج گیٹ کریں
        const loginPage = await session.get(`${BASE_URL}/login`);
        
        let initialCookie = "";
        if (loginPage.headers['set-cookie']) {
            const tempCookies = loginPage.headers['set-cookie'];
            const phpSession = tempCookies.find(c => c.startsWith('PHPSESSID'));
            if (phpSession) initialCookie = phpSession.split(';')[0];
        }

        // کیپچا ڈھونڈیں
        const match = loginPage.data.match(/What is (\d+) \+ (\d+) = \?/);
        if (!match) {
            // اگر کیپچا نہیں ملا تو پیج کا ایچ ٹی ایم ایل واپس بھیج دیں تاکہ پتہ چلے کیا مسئلہ ہے
            throw { custom: true, msg: "Captcha Not Found", data: loginPage.data };
        }

        const answer = parseInt(match[1]) + parseInt(match[2]);

        const params = new URLSearchParams();
        params.append('username', CREDENTIALS.username);
        params.append('password', CREDENTIALS.password);
        params.append('capt', answer);

        // 2. سائن ان کریں
        const loginResp = await session.post(`${BASE_URL}/signin`, params, {
            headers: {
                "Content-Type": "application/x-www-form-urlencoded",
                "Referer": `${BASE_URL}/login`,
                "Cookie": initialCookie
            },
            maxRedirects: 0,
            validateStatus: () => true
        });

        // کوکی سیٹ کریں
        const newCookies = loginResp.headers['set-cookie'];
        if (newCookies) {
            const newPhpSession = newCookies.find(c => c.startsWith('PHPSESSID'));
            if (newPhpSession) {
                cachedCookie = newPhpSession.split(';')[0];
                return cachedCookie;
            }
        }

        if (initialCookie) {
            cachedCookie = initialCookie;
            return cachedCookie;
        }

        throw { custom: true, msg: "Login Failed - No Cookie", data: loginResp.data };

    } catch (e) {
        if (e.custom) throw e;
        throw { custom: true, msg: "Login Network Error", data: e.message };
    }
}

module.exports = async (req, res) => {
    try {
        // 1. اگر کوکی نہیں ہے تو لاگ ان کریں
        if (!cachedCookie) {
            await performLogin();
        }

        // 2. ڈیٹا لانے کی کوشش کریں
        let response = await axios.get(OTP_URL, {
            headers: { ...HEADERS, "Cookie": cachedCookie },
            validateStatus: () => true // 503 یا 404 پر کریش نہ ہو، ڈیٹا دکھائے
        });

        // 3. چیک کریں کہ رسپانس JSON ہے یا HTML (لاگ ان ایکسپائر)
        const contentType = response.headers['content-type'];
        const isHtml = typeof response.data === 'string' && (response.data.includes('<html') || response.data.includes('login'));

        if (isHtml || response.status === 403 || response.status === 401) {
            console.log("⚠️ Session Invalid. Re-logging...");
            
            // صرف ایک بار دوبارہ لاگ ان کریں
            await performLogin();
            
            // دوبارہ ریکویسٹ بھیجیں
            response = await axios.get(OTP_URL, {
                headers: { ...HEADERS, "Cookie": cachedCookie },
                validateStatus: () => true
            });
        }

        // 4. اب جو بھی سرور نے دیا ہے، وہی یوزر کو دکھا دیں
        // اگر JSON ہے تو JSON جائے گا، اگر HTML ایرر ہے تو وہ جائے گا
        res.status(response.status).send(response.data);

    } catch (error) {
        // اگر ہمارا کوڈ کریش ہو جائے یا Login فنکشن کوئی کچرا واپس کرے
        if (error.custom) {
            // اگر لاگ ان کے دوران ایچ ٹی ایم ایل ملا تھا تو وہی دکھائیں
            return res.status(500).send(error.data || error.msg);
        }
        res.status(500).send(error.response ? error.response.data : error.message);
    }
};
