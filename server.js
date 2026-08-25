/* eslint-disable no-undef */
import 'dotenv/config.js';
import express from 'express';
import cors from 'cors';
import { v2 as cloudinary } from 'cloudinary';
import multer from 'multer';
import streamifier from 'streamifier';
import OpenAI from "openai";
import path from 'path'
import { fileURLToPath } from "url";
import fs from "fs/promises";


const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(express.json());
app.use(cors());

// Configure Cloudinary with secure URLs and credentials
cloudinary.config({
  secure: true,
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// Configure multer for file upload
const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

// Uploads a buffer to Cloudinary with auto-captioning, resolving once the
// stream callback fires so callers can safely `await` it.
const uploadImageWithCaptioning = (buffer) => {
  return new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      { detection: 'captioning' },
      (error, result) => {
        if (error) {
          return reject(error);
        }
        resolve(result);
      }
    );

    streamifier.createReadStream(buffer).pipe(uploadStream);
  });
};

// Define a POST endpoint to handle image upload
app.post('/api/caption', upload.single('image'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'Image file is required' });
  }

  try {
    const result = await uploadImageWithCaptioning(req.file.buffer);

    const caption = result.info?.detection?.captioning?.data?.caption;
    if (!caption) {
      console.error('Cloudinary response missing captioning data:', result.info?.detection);
      return res.status(502).json({ error: 'Cloudinary did not return an image caption' });
    }

    const story = await generateBlog(caption);
    res.json({
      public_id: result.public_id,
      caption,
      story,
    });
  } catch (error) {
    console.error('Error processing image upload:', error);
    res.status(500).json({ error: error.message ?? 'Failed to process image upload' });
  }
});

app.post("/api/generate-audio", async (req, res) => {
  if (typeof req.body.text !== "string" || !req.body.text.trim()) {
    return res.status(400).json({ error: "text is required" });
  }

  try {
    const mp3 = await openai.audio.speech.create({
      model: "tts-1",
      voice: "alloy",
      input: req.body.text,
    });
    const buffer = Buffer.from(await mp3.arrayBuffer());
    const filePath = path.resolve(__dirname, "public", "speech.mp3");
    await fs.writeFile(filePath, buffer);
    res.json({ audioUrl: `/speech.mp3` });
  } catch (error) {
    console.error("Error generating audio:", error);
    res.status(500).json({ error: "Error generating audio" });
  }
});

const generateBlog = async(caption) => {

  const message = {
    role: "user",
    content: `create an 300 world blog post to be used as part of a marketing campaign from a business-- the blog must focused on the vertical industry of that image based on the following caption of the image: ${caption}. This blog is not for the business but for the person interested in the vetical industry of the image`
  }

  /**
   * Call the OpenAI SDK and get a response
   */
  try {
    const response = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: [message], // pass the new message and the previous messages
    });
    console.log('open ai response', response.choices[0].message);
    return response.choices[0].message;
  } catch (error) {
    console.error(error);
    return `error: Internal Server Error`;
  }
};

app.use(express.static(path.resolve(__dirname, "public")));

const PORT = 6000;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
