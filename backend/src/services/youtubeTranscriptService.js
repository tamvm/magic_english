import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';
import os from 'os';

class YouTubeTranscriptService {
  constructor() {
    this.outputDir = path.join(os.tmpdir(), 'magic-english-transcripts');
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

  isYouTubeUrl(url) {
    try {
      const urlObj = new URL(url);
      return urlObj.hostname === 'www.youtube.com' ||
             urlObj.hostname === 'youtube.com' ||
             urlObj.hostname === 'youtu.be' ||
             urlObj.hostname === 'm.youtube.com';
    } catch {
      return false;
    }
  }

  async checkYouTubeDL() {
    return new Promise((resolve) => {
      const check = spawn('python3', ['-m', 'yt_dlp', '--version']);

      check.on('close', (code) => {
        resolve(code === 0);
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
        // Clean up any existing subtitle files for this video
        this.cleanupSubtitleFiles(videoId);

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
      throw new Error(`Failed to get YouTube transcript: ${error.message}`);
    }
  }

  cleanupSubtitleFiles(videoId) {
    try {
      const files = fs.readdirSync(this.outputDir);
      const subtitleFiles = files.filter(file =>
        file.includes('.vtt') && (file.includes(videoId) || file.includes('.en.vtt'))
      );

      subtitleFiles.forEach(file => {
        const filePath = path.join(this.outputDir, file);
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
        }
      });
    } catch (error) {
      console.warn('Failed to cleanup subtitle files:', error.message);
    }
  }

  async findAndProcessSubtitles(videoId) {
    const files = fs.readdirSync(this.outputDir);
    const subtitleFiles = files.filter(file =>
      file.includes('.en.vtt') ||
      file.includes('.en-US.vtt') ||
      (file.includes('.vtt') && !file.includes('.live_chat.'))
    );

    if (subtitleFiles.length === 0) {
      throw new Error('No subtitle files found. The video may not have English subtitles available.');
    }

    console.log(`Found subtitle files: ${subtitleFiles.join(', ')}`);

    const subtitleFile = subtitleFiles[0];
    const subtitlePath = path.join(this.outputDir, subtitleFile);

    const transcript = this.parseVTT(subtitlePath);

    // Clean up the subtitle file after processing
    try {
      fs.unlinkSync(subtitlePath);
    } catch (error) {
      console.warn('Failed to cleanup subtitle file:', error.message);
    }

    return transcript;
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
      formatted += `${entry.text} `;
    }

    return formatted.trim();
  }

  async extractVideoInfo(videoUrl) {
    try {
      const videoId = this.extractVideoId(videoUrl);
      if (!videoId) {
        throw new Error('Invalid YouTube URL');
      }

      return new Promise((resolve, reject) => {
        const ytDlp = spawn('python3', [
          '-m', 'yt_dlp',
          '--dump-json',
          '--no-download',
          videoUrl
        ]);

        let stdout = '';
        let stderr = '';

        ytDlp.stdout.on('data', (data) => {
          stdout += data.toString();
        });

        ytDlp.stderr.on('data', (data) => {
          stderr += data.toString();
        });

        ytDlp.on('close', (code) => {
          if (code === 0) {
            try {
              const videoInfo = JSON.parse(stdout);
              resolve({
                title: videoInfo.title,
                description: videoInfo.description,
                duration: videoInfo.duration,
                uploader: videoInfo.uploader,
                upload_date: videoInfo.upload_date,
                view_count: videoInfo.view_count,
                like_count: videoInfo.like_count,
                channel: videoInfo.channel,
                tags: videoInfo.tags
              });
            } catch (parseError) {
              reject(new Error('Failed to parse video information'));
            }
          } else {
            reject(new Error(`Failed to extract video info: ${stderr}`));
          }
        });
      });
    } catch (error) {
      throw new Error(`Failed to get video info: ${error.message}`);
    }
  }

  async processYouTubeUrl(url) {
    if (!this.isYouTubeUrl(url)) {
      throw new Error('URL is not a valid YouTube URL');
    }

    try {
      // Get video info and transcript in parallel
      const [videoInfo, transcript] = await Promise.all([
        this.extractVideoInfo(url),
        this.getTranscript(url)
      ]);

      const content = this.formatTranscript(transcript);

      if (!content || content.length < 100) {
        throw new Error('Transcript is too short or unavailable. The video may not have English subtitles.');
      }

      return {
        success: true,
        content,
        title: videoInfo.title,
        excerpt: content.substring(0, 200) + '...',
        url,
        videoInfo: {
          ...videoInfo,
          transcript_length: content.length,
          transcript_entries: transcript.length
        }
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }
}

export const youtubeTranscriptService = new YouTubeTranscriptService();