#!/usr/bin/env node

import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';

class YouTubeTranscriptExtractor {
  constructor() {
    this.outputDir = path.join(process.cwd(), 'transcripts');
    this.ensureOutputDir();
  }

  ensureOutputDir() {
    if (!fs.existsSync(this.outputDir)) {
      fs.mkdirSync(this.outputDir, { recursive: true });
    }
  }

  extractVideoId(url) {
    const regex = /(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/;
    const match = url.match(regex);
    return match ? match[1] : null;
  }

  async checkYouTubeDL() {
    return new Promise((resolve, reject) => {
      console.log('Checking for yt-dlp...');
      const check = spawn('python3', ['-m', 'yt_dlp', '--version']);

      check.on('close', (code) => {
        if (code === 0) {
          console.log('yt-dlp found!');
          resolve(true);
        } else {
          console.log('yt-dlp not found.');
          resolve(false);
        }
      });

      check.on('error', () => {
        resolve(false);
      });
    });
  }

  async installYouTubeDL() {
    return new Promise((resolve, reject) => {
      console.log('Installing yt-dlp via pip...');
      const install = spawn('pip3', ['install', 'yt-dlp']);

      install.stdout.on('data', (data) => {
        console.log(data.toString());
      });

      install.stderr.on('data', (data) => {
        console.error(data.toString());
      });

      install.on('close', (code) => {
        if (code === 0) {
          console.log('yt-dlp installed successfully!');
          resolve();
        } else {
          reject(new Error('Failed to install yt-dlp'));
        }
      });

      install.on('error', (error) => {
        reject(new Error(`Failed to install yt-dlp: ${error.message}`));
      });
    });
  }

  async getTranscript(videoUrl) {
    try {
      const hasYtDlp = await this.checkYouTubeDL();
      if (!hasYtDlp) {
        await this.installYouTubeDL();
      }

      const videoId = this.extractVideoId(videoUrl);
      if (!videoId) {
        throw new Error('Invalid YouTube URL');
      }

      console.log(`Extracting transcript for video ID: ${videoId}`);

      return new Promise((resolve, reject) => {
        const ytDlp = spawn('python3', [
          '-m', 'yt_dlp',
          '--write-auto-sub',
          '--write-sub',
          '--sub-lang', 'en',
          '--sub-format', 'vtt',
          '--skip-download',
          '--output', path.join(this.outputDir, '%(title)s.%(ext)s'),
          videoUrl
        ]);

        let stdout = '';
        let stderr = '';

        ytDlp.stdout.on('data', (data) => {
          stdout += data.toString();
          console.log(data.toString());
        });

        ytDlp.stderr.on('data', (data) => {
          stderr += data.toString();
          console.error(data.toString());
        });

        ytDlp.on('close', (code) => {
          if (code === 0) {
            console.log('Subtitle extraction completed!');
            this.findAndProcessSubtitles(videoId)
              .then(resolve)
              .catch(reject);
          } else {
            reject(new Error(`yt-dlp failed with code ${code}: ${stderr}`));
          }
        });
      });
    } catch (error) {
      throw new Error(`Failed to get transcript: ${error.message}`);
    }
  }

  async findAndProcessSubtitles(videoId) {
    const files = fs.readdirSync(this.outputDir);
    const subtitleFiles = files.filter(file =>
      file.includes('.en.vtt') ||
      file.includes('.en-US.vtt') ||
      file.includes('.vtt')
    );

    if (subtitleFiles.length === 0) {
      throw new Error('No subtitle files found');
    }

    console.log(`Found subtitle files: ${subtitleFiles.join(', ')}`);

    const subtitleFile = subtitleFiles[0];
    const subtitlePath = path.join(this.outputDir, subtitleFile);

    return this.parseVTT(subtitlePath);
  }

  parseVTT(filePath) {
    const content = fs.readFileSync(filePath, 'utf8');
    const lines = content.split('\n');

    const transcript = [];
    let currentEntry = null;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();

      // Skip empty lines and VTT headers
      if (!line || line === 'WEBVTT' || line.startsWith('Kind:') || line.startsWith('Language:')) {
        continue;
      }

      // Check if line contains timestamp
      if (line.includes('-->')) {
        const [start, end] = line.split(' --> ');
        currentEntry = {
          start: this.parseTimestamp(start),
          end: this.parseTimestamp(end),
          text: ''
        };
      } else if (currentEntry && line) {
        // Remove HTML tags and clean up text
        const cleanText = line.replace(/<[^>]*>/g, '').trim();
        if (cleanText) {
          currentEntry.text += (currentEntry.text ? ' ' : '') + cleanText;
        }

        // If next line is timestamp or empty, save current entry
        if (i + 1 >= lines.length || lines[i + 1].includes('-->') || !lines[i + 1].trim()) {
          if (currentEntry.text) {
            transcript.push(currentEntry);
          }
          currentEntry = null;
        }
      }
    }

    return transcript;
  }

  parseTimestamp(timestamp) {
    const parts = timestamp.split(':');
    const seconds = parts.pop().split(',')[0];
    const minutes = parts.pop() || '0';
    const hours = parts.pop() || '0';

    return parseInt(hours) * 3600 + parseInt(minutes) * 60 + parseFloat(seconds);
  }

  formatTranscript(transcript) {
    let formatted = '';

    for (const entry of transcript) {
      const startTime = this.formatTime(entry.start);
      formatted += `[${startTime}] ${entry.text}\n`;
    }

    return formatted;
  }

  formatTime(seconds) {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);

    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${minutes}:${secs.toString().padStart(2, '0')}`;
  }

  async saveTranscript(transcript, videoUrl) {
    const videoId = this.extractVideoId(videoUrl);
    const formatted = this.formatTranscript(transcript);
    const outputPath = path.join(this.outputDir, `${videoId}_transcript.txt`);

    fs.writeFileSync(outputPath, formatted);
    console.log(`Transcript saved to: ${outputPath}`);

    return outputPath;
  }
}

async function main() {
  const args = process.argv.slice(2);

  if (args.length === 0) {
    console.log('Usage: node get-youtube-transcript.js <youtube-url>');
    console.log('Example: node get-youtube-transcript.js https://www.youtube.com/watch?v=RRKwmeyIc24');
    process.exit(1);
  }

  const videoUrl = args[0];
  const extractor = new YouTubeTranscriptExtractor();

  try {
    console.log(`Getting transcript for: ${videoUrl}`);
    const transcript = await extractor.getTranscript(videoUrl);
    const outputPath = await extractor.saveTranscript(transcript, videoUrl);

    console.log('\n=== TRANSCRIPT PREVIEW ===');
    console.log(extractor.formatTranscript(transcript).slice(0, 500) + '...');
    console.log(`\nFull transcript saved to: ${outputPath}`);

  } catch (error) {
    console.error(`Error: ${error.message}`);
    process.exit(1);
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}

export default YouTubeTranscriptExtractor;