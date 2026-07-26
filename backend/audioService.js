const fs = require('fs');
const os = require('os');
const path = require('path');
const OpenAI = require('openai');

const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY
});

async function transcribeAudio(mediaData, mimetype) {
    let tempFilePath = null;
    try {
        // WhatsApp audio notes usually come as audio/ogg
        let extension = 'ogg';
        if (mimetype.includes('mp4')) extension = 'mp4';
        else if (mimetype.includes('mpeg')) extension = 'mp3';
        else if (mimetype.includes('wav')) extension = 'wav';

        // Create a unique temporary file path
        const fileName = `audio_${Date.now()}_${Math.floor(Math.random() * 10000)}.${extension}`;
        tempFilePath = path.join(os.tmpdir(), fileName);

        // Save base64 data to the temporary file
        const buffer = Buffer.from(mediaData, 'base64');
        fs.writeFileSync(tempFilePath, buffer);

        // Send to OpenAI Whisper
        const transcription = await openai.audio.transcriptions.create({
            file: fs.createReadStream(tempFilePath),
            model: "whisper-1",
            language: "pt", // Força o português para evitar alucinações em inglês
        });

        return transcription.text;
    } catch (error) {
        console.error("❌ Erro ao transcrever áudio na OpenAI (Whisper):", error);
        return null;
    } finally {
        // Clean up the temporary file
        if (tempFilePath && fs.existsSync(tempFilePath)) {
            try {
                fs.unlinkSync(tempFilePath);
            } catch (err) {
                console.error(`⚠️ Falha ao excluir arquivo temporário de áudio: ${tempFilePath}`, err);
            }
        }
    }
}

module.exports = { transcribeAudio };
