const axios = require('axios');

const CREDENTIALS = {
    username: "Kami522",
    password: "Kami526"
};

const BASE_URL = "http://51.89.99.105/NumberPanel";
const OTP_URL = "http://51.89.99.105/NumberPanel/client/res/data_smscdr.php?fdate1=2025-12-11%2000:00:00&fdate2=2025-12-11%2023:59:59&frange=&fnum=&fcli=&fgdate=&fgmonth=&fgrange=&fgnumber=&fgcli=&fg=0&sesskey=Q05RRkJQUEJCUg&sEcho=2&iColumns=7&sColumns=%2C%2C%2C%2C%2C%2C&iDisplayStart=0&iDisplayLength=-1&mDataProp_0=0&sSearch_0=&bRegex_0=false&bSearchable_0=true&bSortable_0=true&mDataProp_1=1&sSearch_1=&bRegex_1=false&bSearchable_1=true&bSortable_1=true&mDataProp_2=2&sSearch_2=&bRegex_2=false&bSearchable_2=true&bSortable_2=true&mDataProp_3=3&sSearch_3=&bRegex_3=false&bSearchable_3=true&bSortable_3=true&mDataProp_4=4&sSearch_4=&bRegex_4=false&bSearchable_4=true&bSortable_4=true&mDataProp_5=5&sSearch_5=&bRegex_5=false&bSearchable_5=true&bSortable_5=true&mDataProp_6=6&sSearch_6=&bRegex_6=false&bSearchable_6=true&bSortable_6=true&sSearch=&bRegex=false&iSortCol_0=0&sSortDir_0=desc&iSortingCols=1&_=1765460983523";

const HEADERS = {
    "User-Agent": "Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Mobile Safari/537.36",
    "X-Requested-With": "XMLHttpRequest",
    "Referer": `${BASE_URL}/client/SMSCDRStats`,
    "Origin": "http://51.89.99.105"
};

let cachedCookie = "PHPSESSID=jd6baa99k47e8bkv1o17c9c91a";
let failedOnce = false;

async function performLogin() {
    try {
        const session = axios.create({ 
            withCredentials: true, 
            headers: HEADERS,
            timeout: 8000
        });

        const loginPage = await session.get(`${BASE_URL}/login`);
        
        let tempCookie = "";
        if (loginPage.headers['set-cookie']) {
            const c = loginPage.headers['set-cookie'].find(x => x.includes('PHPSESSID'));
            if (c) tempCookie = c.split(';')[0];
        }

        const match = loginPage.data.match(/What is (\d+) \+ (\d+) = \?/);
        if (!match) throw new Error("Captcha Not Found");
        
        const answer = parseInt(match[1]) + parseInt(match[2]);

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

        if (loginResp.headers['set-cookie']) {
            const newC = loginResp.headers['set-cookie'].find(x => x.includes('PHPSESSID'));
            if (newC) {
                cachedCookie = newC.split(';')[0];
                return cachedCookie;
            }
        }
        
        if (tempCookie) {
            cachedCookie = tempCookie;
            return cachedCookie;
        }

        throw new Error("Login failed");

    } catch (e) {
        throw e;
    }
}

module.exports = async (req, res) => {
    try {
        let response = await axios.get(OTP_URL, {
            headers: { ...HEADERS, "Cookie": cachedCookie },
            validateStatus: () => true,
            timeout: 5000
        });

        const isHtml = typeof response.data === 'string' && 
                      (response.data.includes('<html') || 
                       response.data.includes('login') || 
                       response.data.includes('Direct Script'));

        if (isHtml) {
            if (failedOnce) {
                await performLogin();
                failedOnce = false;

                response = await axios.get(OTP_URL, {
                    headers: { ...HEADERS, "Cookie": cachedCookie },
                    validateStatus: () => true,
                    timeout: 5000
                });
            } else {
                failedOnce = true;
                return res.status(response.status).send(response.data);
            }
        } else {
            failedOnce = false;
        }

        if (typeof response.data === 'object') {
            return res.status(200).json(response.data);
        } else {
            return res.status(response.status).send(response.data);
        }

    } catch (error) {
        return res.status(500).json({
            error: "Server Error",
            details: error.message
        });
    }
};
