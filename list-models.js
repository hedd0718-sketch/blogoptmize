const axios = require('axios');
require('dotenv').config({ path: 'c:/Users/ymink/.antigravity/블로그최적화/.env' });

async function listModels() {
    try {
        const res = await axios.get(`https://generativelanguage.googleapis.com/v1beta/models?key=${process.env.GEMINI_API_KEY}`);
        const models = res.data.models;
        console.log("=== AVAILABLE MODELS ===");
        models.forEach(m => {
            if (m.name.includes("gemini")) console.log(m.name);
        });
        console.log("========================");
    } catch (e) {
        console.error(e.response ? e.response.data : e.message);
    }
}

listModels();
