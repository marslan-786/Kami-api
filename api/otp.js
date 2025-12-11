const axios = require('axios');

const RAILWAY_API_URL = "https://web-production-b717.up.railway.app/api";

module.exports = async (req, res) => {
    const { type } = req.query;

    if (!type || (type !== 'number' && type !== 'sms')) {
        return res.status(400).json({ error: "Invalid type. Use ?type=number or ?type=sms" });
    }

    try {
        const response = await axios.get(`${RAILWAY_API_URL}?type=${type}`, {
            headers: {
                "User-Agent": "Mozilla/5.0 (Vercel-Proxy)"
            }
        });

        return res.status(200).json(response.data);

    } catch (error) {
        return res.status(500).json({
            error: "Railway Server Error",
            details: error.message
        });
    }
};
