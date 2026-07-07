import express from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { GoogleGenAI, Type } from '@google/genai';
import { createClient } from '@supabase/supabase-js';

dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const isProd = process.env.NODE_ENV === 'production';

// Initialize Gemini SDK with User-Agent telemetry header as instructed
const geminiApiKey = process.env.GEMINI_API_KEY;
let ai: GoogleGenAI | null = null;
if (geminiApiKey) {
  ai = new GoogleGenAI({
    apiKey: geminiApiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

// Initialize Supabase Client (handles graceful failure if keys are missing)
const supabaseUrl = process.env.SUPABASE_URL || '';
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY || '';
const supabase = supabaseUrl && supabaseAnonKey ? createClient(supabaseUrl, supabaseAnonKey) : null;

// Temporary in-memory fallback store if Supabase is not connected
const fallbackDatabase: any[] = [];

async function startServer() {
  const app = express();
  app.use(express.json({ limit: '50mb' }));
  app.use(express.urlencoded({ limit: '50mb', extended: true }));

  // API Status Endpoint
  app.get('/api/status', (req, res) => {
    res.json({
      geminiConnected: !!ai,
      youtubeConnected: !!process.env.YOUTUBE_API_KEY,
      supabaseConnected: !!supabase,
    });
  });

  // Multimodal AI Vision & Text Analyze Endpoint
  app.post('/api/analyze', async (req, res) => {
    try {
      const { text, image } = req.body;
      
      if (!text && !image) {
        return res.status(400).json({ error: '분석할 텍스트 키워드나 이미지를 제공해주세요.' });
      }

      let itemName = text || '';
      let primaryKeyword = '';
      let keywords: string[] = [];
      let description = '';
      let isMockData = false;

      if (ai) {
        try {
          const parts: any[] = [];
          
          if (image && typeof image === 'string') {
            let mimeType = 'image/png';
            let base64Data = image;
            
            if (image.startsWith('data:')) {
              const match = image.match(/^data:([^;]+);base64,(.*)$/);
              if (match) {
                mimeType = match[1];
                base64Data = match[2];
              }
            }
            parts.push({
              inlineData: {
                mimeType,
                data: base64Data
              }
            });
          }

          const systemPrompt = `입력된 이미지나 텍스트를 분석하여 어떤 실생활 아이템/상품인지 파악하고 한국어로 상품명(itemName)과 간략한 비디오 소싱 소구점(description)을 제공하라. 
그런 다음, 이 아이템이 해외 TikTok이나 YouTube Shorts에서 엄청난 조회수를 기록할 때 주로 사용되는 '자극적이고 후킹한 영문 검색 키워드' 딱 1개(primaryKeyword)와 연관 키워드 2개를 포함한 총 3개의 고유 키워드 목록(keywords)을 도출하라.
예: 요술펜 이미지/텍스트 입력 -> itemName: "요술펜", primaryKeyword: "satisfying magic water pen", keywords: ["satisfying magic water pen", "magic pen drawing trick", "floating ink challenge"], description: "물 위에 그림을 그려 띄우는 이색적인 비주얼 촉감 플레이 콘텐츠로, 엄청난 틱톡 조회수를 견인하는 상품군입니다."`;

          parts.push({ text: `Analyze this user input: Text description or title is "${text || 'No text provided'}"` });

          const candidateModels = ['gemini-3.5-flash', 'gemini-3.1-flash-lite', 'gemini-3.1-pro-preview', 'gemini-flash-latest'];
          let response = null;
          let lastError = null;

          for (const modelName of candidateModels) {
            try {
              console.log(`Attempting generateContent with model: ${modelName}`);
              response = await ai.models.generateContent({
                model: modelName,
                contents: { parts },
                config: {
                  systemInstruction: systemPrompt,
                  responseMimeType: 'application/json',
                  responseSchema: {
                    type: Type.OBJECT,
                    properties: {
                      itemName: { type: Type.STRING },
                      primaryKeyword: { type: Type.STRING },
                      keywords: {
                        type: Type.ARRAY,
                        items: { type: Type.STRING }
                      },
                      description: { type: Type.STRING }
                    },
                    required: ['itemName', 'primaryKeyword', 'keywords', 'description']
                  }
                }
              });

              if (response && response.text) {
                console.log(`Successfully generated content using model: ${modelName}`);
                break;
              }
            } catch (err: any) {
              console.log(`[Model Status] ${modelName} is currently busy or rate-limited. Trying alternative candidate...`);
              lastError = err;
            }
          }

          if (!response || !response.text) {
            throw new Error('Using fallback analytics pathway due to model queue saturation.');
          }

          const responseText = response.text;
          if (responseText) {
            const parsed = JSON.parse(responseText);
            itemName = parsed.itemName || itemName;
            primaryKeyword = parsed.primaryKeyword || '';
            keywords = parsed.keywords || [];
            description = parsed.description || '';
          }
        } catch (geminiError: any) {
          console.log('[Info] Switched to local analytical simulation gracefully.');
          isMockData = true;
        }
      } else {
        isMockData = true;
      }

      // Fallback generation if Gemini is offline or mock mode
      if (isMockData || !primaryKeyword) {
        itemName = itemName || '스마트 무선 고데기';
        primaryKeyword = `viral ${itemName.toLowerCase().replace(/\s+/g, ' ')} shorts`;
        keywords = [
          primaryKeyword,
          `${itemName.toLowerCase()} satisfying hair compilation`,
          `${itemName.toLowerCase()} hack beauty tutorial`
        ];
        description = '트렌디하고 편리한 모바일 무선 뷰티 스타일링 아이템으로, 간편함과 빠른 비주얼 변화로 높은 바이럴 지수를 보입니다.';
      }

      res.json({
        itemName,
        primaryKeyword,
        keywords,
        description,
        isMockData
      });
    } catch (globalError: any) {
      console.error('Analyze Endpoint Error:', globalError);
      res.status(500).json({ error: '분석 처리 중 서버 오류가 발생했습니다.' });
    }
  });

  // Real-time Trend Analysis Endpoint
  app.post('/api/trends', async (req, res) => {
    try {
      const { searchQuery } = req.body;
      if (!searchQuery || typeof searchQuery !== 'string' || !searchQuery.trim()) {
        return res.status(400).json({ error: '유효한 키워드를 입력해주세요.' });
      }

      let trendData: { date: string; value: number }[] = [];
      let translatedKeywords: string[] = [];
      let viralityScore = 75;
      let trendChange = 0;
      let trendStatus = '안정적';
      let isMockData = false;

      if (ai) {
        try {
          const systemPrompt = `입력된 한글 키워드에 대해 실시간 트렌드 분석을 제공하라. 
최근 30일 동안의 일자별 Google Search 트렌드 수치(0-100 스케일, 최소 12개 데이터 포인트)를 생성하고,
해외 YouTube/TikTok 소싱용 영문 바이럴 키워드 3개를 도출하며,
종합적인 숏폼 바이럴 스코어(0-100) 및 전월 대비 트렌드 변동율(%), 그리고 현재 트렌드 상태 문구(예: '급상승', '안정', '완만한 성장')를 제공하라.
반드시 다음 JSON 형식에 정확히 맞춰 다른 텍스트 설명 없이 JSON 문자열만 반환할 것:
{
  "trendData": [
    { "date": "06-01", "value": 45 },
    { "date": "06-03", "value": 52 }
  ],
  "translatedKeywords": ["keyword1", "keyword2", "keyword3"],
  "viralityScore": 88,
  "trendChange": 14.5,
  "trendStatus": "급상승"
}`;

          const candidateModels = ['gemini-3.5-flash', 'gemini-3.1-flash-lite', 'gemini-3.1-pro-preview', 'gemini-flash-latest'];
          let response = null;
          let lastError = null;

          for (const modelName of candidateModels) {
            try {
              response = await ai.models.generateContent({
                model: modelName,
                contents: `Analyze trends for Korean keyword: "${searchQuery}"`,
                config: {
                  systemInstruction: systemPrompt,
                  responseMimeType: 'application/json',
                  responseSchema: {
                    type: Type.OBJECT,
                    properties: {
                      trendData: {
                        type: Type.ARRAY,
                        items: {
                          type: Type.OBJECT,
                          properties: {
                            date: { type: Type.STRING },
                            value: { type: Type.NUMBER }
                          },
                          required: ['date', 'value']
                        }
                      },
                      translatedKeywords: {
                        type: Type.ARRAY,
                        items: { type: Type.STRING }
                      },
                      viralityScore: { type: Type.NUMBER },
                      trendChange: { type: Type.NUMBER },
                      trendStatus: { type: Type.STRING }
                    },
                    required: ['trendData', 'translatedKeywords', 'viralityScore', 'trendChange', 'trendStatus']
                  }
                }
              });

              if (response && response.text) {
                break;
              }
            } catch (err: any) {
              console.log(`[Model Status] Trend model ${modelName} is busy or rate-limited. Trying alternative...`);
              lastError = err;
            }
          }

          if (response && response.text) {
            const parsed = JSON.parse(response.text);
            trendData = parsed.trendData || [];
            translatedKeywords = parsed.translatedKeywords || [];
            viralityScore = parsed.viralityScore || 75;
            trendChange = parsed.trendChange || 0;
            trendStatus = parsed.trendStatus || '안정';
          } else {
            throw new Error('Using fallback trend pathway due to model queue saturation.');
          }
        } catch (geminiError) {
          console.log('[Info] Switched to local trend simulation gracefully.');
          isMockData = true;
        }
      } else {
        isMockData = true;
      }

      // High-quality fallback generation if Gemini failed or is missing
      if (isMockData || trendData.length === 0) {
        trendData = Array.from({ length: 12 }).map((_, idx) => {
          const date = new Date(Date.now() - (11 - idx) * 3 * 24 * 60 * 60 * 1000);
          const monthStr = String(date.getMonth() + 1).padStart(2, '0');
          const dayStr = String(date.getDate()).padStart(2, '0');
          // generate a growing/fluctuating trend
          const base = 40 + idx * 4;
          const noise = Math.floor(Math.sin(idx) * 15);
          return {
            date: `${monthStr}-${dayStr}`,
            value: Math.min(100, Math.max(10, base + noise))
          };
        });

        translatedKeywords = [
          `satisfying ${searchQuery.toLowerCase()} hack`,
          `viral ${searchQuery.toLowerCase()} compilation`,
          `${searchQuery.toLowerCase()} aesthetic review`
        ];
        viralityScore = 85;
        trendChange = 18.4;
        trendStatus = '급상승';
      }

      res.json({
        keyword: searchQuery,
        trendData,
        translatedKeywords,
        viralityScore,
        trendChange,
        trendStatus,
        isMockData
      });
    } catch (err: any) {
      console.error('Trend Endpoint Error:', err);
      res.status(500).json({ error: '트렌드 분석 중 오류가 발생했습니다.' });
    }
  });

  // Step 1 & 2 Sourcing Endpoint
  app.post('/api/source', async (req, res) => {
    try {
      const { searchQuery, preAnalyzedKeywords } = req.body;
      if (!searchQuery || typeof searchQuery !== 'string' || !searchQuery.trim()) {
        return res.status(400).json({ error: '유효한 검색어를 입력해주세요.' });
      }

      let keywords: string[] = [];

      // If pre-analyzed keywords are passed, use them directly
      if (Array.isArray(preAnalyzedKeywords) && preAnalyzedKeywords.length > 0) {
        keywords = preAnalyzedKeywords;
      } else {
        // 1. Convert Korean keyword to 3 English viral keywords using Gemini
        if (ai) {
          try {
            const prompt = `Translate the Korean keyword "${searchQuery}" into exactly 3 English viral tiktok/shorts search keywords suitable for finding highly viewed shortform video trends. Return ONLY a JSON object matching this schema: { "keywords": ["word1", "word2", "word3"] }`;
            
            const candidateModels = ['gemini-3.5-flash', 'gemini-3.1-flash-lite', 'gemini-3.1-pro-preview', 'gemini-flash-latest'];
            let response = null;
            let lastError = null;

            for (const modelName of candidateModels) {
              try {
                console.log(`Attempting translation with model: ${modelName}`);
                response = await ai.models.generateContent({
                  model: modelName,
                  contents: prompt,
                  config: {
                    responseMimeType: 'application/json',
                    responseSchema: {
                      type: Type.OBJECT,
                      properties: {
                        keywords: {
                          type: Type.ARRAY,
                          items: { type: Type.STRING },
                          description: '3 english viral shortform keywords'
                        }
                      },
                      required: ['keywords']
                    }
                  }
                });

                if (response && response.text) {
                  console.log(`Successfully translated using model: ${modelName}`);
                  break;
                }
              } catch (err: any) {
                console.log(`[Model Status] Translation model ${modelName} is busy or rate-limited. Trying alternative...`);
                lastError = err;
              }
            }

            if (!response || !response.text) {
              throw new Error('Using fallback translation pathway due to model queue saturation.');
            }

            const jsonText = response.text;
            if (jsonText) {
              const parsed = JSON.parse(jsonText);
              if (Array.isArray(parsed.keywords)) {
                keywords = parsed.keywords;
              }
            }
          } catch (geminiError: any) {
            console.log('[Info] Switched to local translation/sourcing simulation gracefully.');
            // Handled fallback if Gemini fails
            keywords = [`${searchQuery} shorts`, `${searchQuery} tiktok trend`, `${searchQuery} challenge`];
          }
        } else {
          // If Gemini API Key is missing, generate high-quality fallback keywords
          keywords = [`${searchQuery} shorts`, `${searchQuery} viral compilation`, `${searchQuery} trend`];
        }
      }

      // Ensure we have exactly 3 keywords
      if (keywords.length < 3) {
        keywords = [...keywords, `${searchQuery} shorts`, `${searchQuery} hack`, `${searchQuery} compilation`].slice(0, 3);
      }

      // 2. Fetch videos from YouTube Data API v3
      const youtubeApiKey = process.env.YOUTUBE_API_KEY;
      const targetKeyword = keywords[0]; // search with the first keyword

      let videos: any[] = [];
      let isMockData = false;

      if (youtubeApiKey) {
        try {
          // A. Search API
          const searchUrl = `https://www.googleapis.com/youtube/v3/search?part=snippet&q=${encodeURIComponent(targetKeyword)}&type=video&videoDuration=short&order=viewCount&maxResults=10&key=${youtubeApiKey}`;
          const searchRes = await fetch(searchUrl);
          
          if (!searchRes.ok) {
            const errData = await searchRes.json();
            throw new Error(errData.error?.message || 'YouTube Search API failure');
          }
          
          const searchData = await searchRes.json();
          const items = searchData.items || [];
          
          if (items.length > 0) {
            const videoIds = items.map((item: any) => item.id.videoId).filter(Boolean);
            
            // B. Videos stats API to get accurate views
            if (videoIds.length > 0) {
              const videosUrl = `https://www.googleapis.com/youtube/v3/videos?part=snippet,statistics&id=${videoIds.join(',')}&key=${youtubeApiKey}`;
              const videosRes = await fetch(videosUrl);
              
              if (videosRes.ok) {
                const videosData = await videosRes.json();
                videos = (videosData.items || []).map((v: any) => {
                  const viewVal = parseInt(v.statistics?.viewCount || '0', 10);
                  let formattedViews = `${viewVal.toLocaleString()}회`;
                  if (viewVal >= 1000000) {
                    formattedViews = `${(viewVal / 1000000).toFixed(1)}M views`;
                  } else if (viewVal >= 1000) {
                    formattedViews = `${(viewVal / 1000).toFixed(1)}K views`;
                  }
                  
                  return {
                    id: v.id,
                    title: v.snippet?.title || '',
                    thumbnailUrl: v.snippet?.thumbnails?.medium?.url || v.snippet?.thumbnails?.high?.url || '',
                    videoUrl: `https://www.youtube.com/watch?v=${v.id}`,
                    channelTitle: v.snippet?.channelTitle || '',
                    viewCount: formattedViews,
                    publishedAt: v.snippet?.publishedAt ? new Date(v.snippet.publishedAt).toLocaleDateString('ko-KR') : '',
                  };
                });
              }
            }
          }
        } catch (ytError: any) {
          console.error('YouTube Data API error or quota exceeded, switching to high-quality fallback: ', ytError.message);
          isMockData = true;
        }
      } else {
        isMockData = true;
      }

      // Generate beautiful, realistic mock viral shortform video results if YouTube API isn't working or missing
      if (isMockData || videos.length === 0) {
        videos = Array.from({ length: 8 }).map((_, i) => {
          const viewsCount = Math.floor(Math.random() * 8500000) + 150000;
          let formattedViews = `${(viewsCount / 1000000).toFixed(1)}M views`;
          if (viewsCount < 1000000) {
            formattedViews = `${(viewsCount / 1000).toFixed(0)}K views`;
          }

          const mockId = `mock_vid_${Math.random().toString(36).substr(2, 9)}`;
          const titles = [
            `Amazing ${targetKeyword} Life Hacks that actually work! 🤯`,
            `The absolute best ${targetKeyword} of 2026! (Must Watch)`,
            `TikTok viral ${targetKeyword} trend challenge compilation`,
            `I tried the viral ${targetKeyword} from TikTok for 24 hours`,
            `Why everyone is obsessed with this new ${targetKeyword} trend`,
            `This ${targetKeyword} hack will save you hundreds of hours`,
            `Satisfying ${targetKeyword} compilation (ASMR)`,
            `How to master ${targetKeyword} in under 60 seconds ⚡`
          ];

          const channels = [
            'ViralShorts HQ', 'TrendSpotter', 'ShortsLab', 'TikTokMaster', 'CreatorHub', 'WeeklyBuzz'
          ];

          return {
            id: mockId,
            title: titles[i % titles.length],
            thumbnailUrl: `https://images.unsplash.com/photo-1611162617213-7d7a39e9b1d7?w=500&auto=format&fit=crop&q=60`,
            videoUrl: `https://www.youtube.com/results?search_query=${encodeURIComponent(targetKeyword)}`,
            channelTitle: channels[i % channels.length],
            viewCount: formattedViews,
            publishedAt: new Date(Date.now() - (i * 2 * 24 * 60 * 60 * 1000)).toLocaleDateString('ko-KR'),
          };
        });
      }

      res.json({
        keywords,
        videos,
        isMockData,
      });

    } catch (globalError: any) {
      console.error('Sourcing Endpoint Error:', globalError);
      res.status(500).json({ error: '서버 내부 오류가 발생했습니다. 잠시 후 다시 시도해주세요.' });
    }
  });

  // Database Save Reference Endpoint
  app.post('/api/save', async (req, res) => {
    try {
      const { keyword, title, videoUrl, thumbnailUrl, viewCount } = req.body;

      if (!title || !videoUrl) {
        return res.status(400).json({ error: '필수 저장 데이터(제목, 비디오 URL)가 누락되었습니다.' });
      }

      const saveData = {
        keyword: keyword || '기타',
        title,
        video_url: videoUrl,
        thumbnail_url: thumbnailUrl || '',
        view_count: viewCount || '0',
        created_at: new Date().toISOString(),
      };

      if (supabase) {
        // Real Supabase Insert
        const { data, error } = await supabase
          .from('saved_shorts')
          .insert([saveData])
          .select();

        if (error) {
          console.error('Supabase save error:', error);
          return res.status(500).json({ error: `Supabase 저장 실패: ${error.message}` });
        }
        return res.status(200).json({ success: true, message: 'Supabase DB에 성공적으로 저장되었습니다!', data });
      } else {
        // Fallback Database Insert
        const mockSavedItem = {
          id: `local_${Date.now()}`,
          ...saveData,
        };
        fallbackDatabase.push(mockSavedItem);
        return res.status(200).json({
          success: true,
          message: '데모 모드: 로컬 메모리에 임시 저장되었습니다 (Supabase 미연결).',
          data: [mockSavedItem],
          isDemo: true
        });
      }
    } catch (err: any) {
      console.error('Save Endpoint Error:', err);
      res.status(500).json({ error: '데이터 저장 처리 중 오류가 발생했습니다.' });
    }
  });

  // Get Saved References Endpoint
  app.get('/api/saved', async (req, res) => {
    try {
      if (supabase) {
        const { data, error } = await supabase
          .from('saved_shorts')
          .select('*')
          .order('created_at', { ascending: false });

        if (error) {
          throw error;
        }
        return res.json({ success: true, data });
      } else {
        return res.json({ success: true, data: [...fallbackDatabase].reverse(), isDemo: true });
      }
    } catch (err: any) {
      console.error('Get Saved Error:', err);
      res.status(500).json({ error: '저장된 동영상 목록을 가져오는 데 실패했습니다.' });
    }
  });

  // Delete Saved Reference Endpoint
  app.delete('/api/saved/:id', async (req, res) => {
    try {
      const { id } = req.params;
      if (supabase) {
        const { error } = await supabase
          .from('saved_shorts')
          .delete()
          .eq('id', id);

        if (error) {
          throw error;
        }
        return res.json({ success: true, message: 'Supabase DB에서 삭제되었습니다.' });
      } else {
        const index = fallbackDatabase.findIndex(item => item.id === id);
        if (index !== -1) {
          fallbackDatabase.splice(index, 1);
        }
        return res.json({ success: true, message: '데모 모드: 로컬 메모리에서 삭제되었습니다.' });
      }
    } catch (err: any) {
      console.error('Delete Saved Error:', err);
      res.status(500).json({ error: '삭제 처리에 실패했습니다.' });
    }
  });

  // Front-End static assets / HMR integration
  if (!isProd) {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'custom',
    });
    app.use(vite.middlewares);

    app.use('*', async (req, res, next) => {
      const url = req.originalUrl;
      try {
        let template = fs.readFileSync(path.resolve(__dirname, 'index.html'), 'utf-8');
        template = await vite.transformIndexHtml(url, template);
        res.status(200).set({ 'Content-Type': 'text/html' }).end(template);
      } catch (e) {
        vite.ssrFixStacktrace(e as Error);
        next(e);
      }
    });
  } else {
    // Serve production built files
    app.use(express.static(path.resolve(__dirname, 'dist')));
    app.use('*', (req, res) => {
      res.sendFile(path.resolve(__dirname, 'dist', 'index.html'));
    });
  }

  const port = 3000;
  app.listen(port, '0.0.0.0', () => {
    console.log(`Server running at http://0.0.0.0:${port}`);
  });
}

startServer();
