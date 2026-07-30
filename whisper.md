
import fs from "fs";
import Groq from "groq-sdk";

const groq = new Groq();
async function main() {
  const transcription = await groq.audio.transcriptions.create({
    file: fs.createReadStream("audio.m4a"),
    model: "whisper-large-v3",
    temperature: 0,
    response_format: "verbose_json",
  });
  console.log(transcription.text);
}
