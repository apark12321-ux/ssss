import React, { useState, useEffect } from 'react';
import { supabase } from './lib/supabase';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid
} from 'recharts';
import {
  Search,
  Bookmark,
  Sparkles,
  ExternalLink,
  CheckCircle,
  Clock,
  Eye,
  Trash2,
  X,
  Database,
  Tv,
  ArrowRight,
  RefreshCw,
  Copy,
  Info,
  AlertTriangle,
  Image,
  Upload
} from 'lucide-react';

// Mandated Data Models
interface VideoResult {
  id: string;
  title: string;
  thumbnailUrl: string;
  videoUrl: string;
  channelTitle: string;
  viewCount: string;
  publishedAt: string;
}

interface SavedVideo {
  id: string;
  keyword: string;
  title: string;
  video_url: string;
  thumbnail_url: string;
  view_count: string;
  created_at: string;
}

interface ApiStatus {
  geminiConnected: boolean;
  youtubeConnected: boolean;
  supabaseConnected: boolean;
}

interface Toast {
  id: string;
  message: string;
  type: 'success' | 'error' | 'info';
}

export default function App() {
  // Application State
  const [searchQuery, setSearchQuery] = useState('');
  const [uploadedImage, setUploadedImage] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [keywords, setKeywords] = useState<string[]>([]);
  const [videos, setVideos] = useState<VideoResult[]>([]);
  const [isMockData, setIsMockData] = useState(false);
  
  // AI vision & analysis states
  const [viralityDescription, setViralityDescription] = useState<string | null>(null);
  const [identifiedItemName, setIdentifiedItemName] = useState<string | null>(null);
  
  // Real-time Trend states
  const [trendData, setTrendData] = useState<{ date: string; value: number }[]>([]);
  const [trendChange, setTrendChange] = useState<number | null>(null);
  const [trendStatus, setTrendStatus] = useState<string | null>(null);
  const [viralityScore, setViralityScore] = useState<number | null>(null);

  // Saved references state
  const [savedVideos, setSavedVideos] = useState<SavedVideo[]>([]);
  const [isSavedDrawerOpen, setIsSavedDrawerOpen] = useState(false);
  
  // Server connection status state
  const [apiStatus, setApiStatus] = useState<ApiStatus>({
    geminiConnected: false,
    youtubeConnected: false,
    supabaseConnected: false,
  });

  // Image Upload Handlers
  const handleImageUpload = (file: File) => {
    if (!file.type.startsWith('image/')) {
      showToast('이미지 파일만 업로드할 수 있습니다.', 'error');
      return;
    }
    const reader = new FileReader();
    reader.onload = (e) => {
      setUploadedImage(e.target?.result as string);
      showToast('이미지가 업로드되었습니다. 분석할 준비 완료!', 'success');
    };
    reader.readAsDataURL(file);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const files = e.dataTransfer.files;
    if (files && files.length > 0) {
      handleImageUpload(files[0]);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      handleImageUpload(files[0]);
    }
  };

  // Toast State
  const [toasts, setToasts] = useState<Toast[]>([]);

  // Toast trigger function
  const showToast = (message: string, type: 'success' | 'error' | 'info' = 'success') => {
    const id = Math.random().toString(36).substr(2, 9);
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4000);
  };

  // Fetch API connection status and Saved References on load
  useEffect(() => {
    fetchApiStatus();
    fetchSavedVideos();
  }, []);

  const fetchApiStatus = async () => {
    try {
      const res = await fetch('/api/status');
      if (res.ok) {
        const data = await res.json();
        setApiStatus(data);
      }
    } catch (err) {
      console.error('Failed to fetch API status:', err);
    }
  };

  const fetchSavedVideos = async () => {
    try {
      const res = await fetch('/api/saved');
      if (res.ok) {
        const data = await res.json();
        setSavedVideos(data.data || []);
      }
    } catch (err) {
      console.error('Failed to fetch saved videos:', err);
    }
  };

  // Main Sourcing Action (Gemini Multimodal Analysis + YouTube Sourcing)
  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim() && !uploadedImage) {
      showToast('검색어를 입력하거나 이미지를 업로드해주세요.', 'error');
      return;
    }

    setIsLoading(true);
    setError(null);
    setKeywords([]);
    setVideos([]);
    setViralityDescription(null);
    setIdentifiedItemName(null);

    try {
      // Step 1: AI Multimodal Analysis
      showToast('Gemini AI가 업로드된 리소스와 텍스트를 분석 중입니다...', 'info');
      
      const analyzeRes = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: searchQuery,
          image: uploadedImage
        })
      });

      if (!analyzeRes.ok) {
        const errData = await analyzeRes.json();
        throw new Error(errData.error || 'AI 분석 진행 중 오류가 발생했습니다.');
      }

      const analyzeData = await analyzeRes.json();
      const extractedItemName = analyzeData.itemName;
      const extractedKeywords = analyzeData.keywords || [];
      
      setIdentifiedItemName(extractedItemName);
      setKeywords(extractedKeywords);
      setViralityDescription(analyzeData.description);

      // Fetch Trend Analysis Data in parallel or sequentially
      try {
        const trendRes = await fetch('/api/trends', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ searchQuery: extractedItemName })
        });
        if (trendRes.ok) {
          const trendDataJson = await trendRes.json();
          setTrendData(trendDataJson.trendData || []);
          setTrendChange(trendDataJson.trendChange || 0);
          setTrendStatus(trendDataJson.trendStatus || '안정');
          setViralityScore(trendDataJson.viralityScore || 75);
        }
      } catch (trendErr) {
        console.error('Failed to load trend analysis data:', trendErr);
      }

      // Step 2: Global Video Sourcing based on primary analyzed keyword
      showToast(`AI 분석 완료! '${extractedKeywords[0] || extractedItemName}' 키워드로 숏폼 트래킹을 시작합니다.`, 'info');

      const sourceRes = await fetch('/api/source', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          searchQuery: extractedItemName,
          preAnalyzedKeywords: extractedKeywords
        }),
      });

      if (!sourceRes.ok) {
        const errData = await sourceRes.json();
        throw new Error(errData.error || '유튜브 동영상 소싱 중 오류가 발생했습니다.');
      }

      const sourceData = await sourceRes.json();
      setVideos(sourceData.videos || []);
      setIsMockData(sourceData.isMockData || false);
      
      if (sourceData.isMockData) {
        showToast('데모 모드: 유튜브 시뮬레이션 데이터 소싱이 성공적으로 마쳤습니다.', 'success');
      } else {
        showToast(`'${extractedKeywords[0]}' 키워드 최상위 숏폼 비디오 발굴에 성공했습니다!`, 'success');
      }
    } catch (err: any) {
      console.error('Sourcing Pipeline Error:', err);
      setError(err.message || '소싱 과정에서 오류가 발생했습니다.');
      showToast(err.message || '소싱 실패', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  // Save Reference Action
  const handleSaveVideo = async (video: VideoResult) => {
    try {
      const res = await fetch('/api/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          keyword: keywords[0] || searchQuery,
          title: video.title,
          videoUrl: video.videoUrl,
          thumbnailUrl: video.thumbnailUrl,
          viewCount: video.viewCount,
        }),
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || '저장에 실패했습니다.');
      }

      const data = await res.json();
      showToast(data.message || '성공적으로 저장되었습니다!', 'success');
      
      // Refresh saved videos list
      fetchSavedVideos();
    } catch (err: any) {
      console.error('Save error:', err);
      showToast(err.message || '레퍼런스 저장 중 오류가 발생했습니다.', 'error');
    }
  };

  // Delete/Unsave Reference Action
  const handleDeleteSaved = async (id: string) => {
    try {
      const res = await fetch(`/api/saved/${id}`, {
        method: 'DELETE',
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || '삭제에 실패했습니다.');
      }

      const data = await res.json();
      showToast(data.message || '삭제되었습니다.', 'success');
      fetchSavedVideos();
    } catch (err: any) {
      console.error('Delete error:', err);
      showToast(err.message || '레퍼런스 삭제 중 오류가 발생했습니다.', 'error');
    }
  };

  // Helper to check if a video is already saved
  const isVideoSaved = (videoUrl: string) => {
    return savedVideos.some((v) => v.video_url === videoUrl);
  };

  // Quick Sourcing Export Options (Markdown copy)
  const handleExportMarkdown = () => {
    if (savedVideos.length === 0) {
      showToast('저장된 레퍼런스가 없습니다.', 'info');
      return;
    }

    const mdContent = savedVideos
      .map((v, i) => `${i + 1}. **${v.title}**\n   - 키워드: ${v.keyword}\n   - 조회수: ${v.view_count}\n   - 링크: ${v.video_url}`)
      .join('\n\n');

    navigator.clipboard.writeText(mdContent);
    showToast('마크다운 요약본이 클립보드에 복사되었습니다!', 'success');
  };

  return (
    <div id="app-container" className="min-h-screen bg-slate-950 text-slate-100 font-sans selection:bg-emerald-500/30 selection:text-emerald-300 relative overflow-hidden">
      
      {/* Decorative Cosmic Ambient Glows */}
      <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] rounded-full bg-emerald-500/5 blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[60%] h-[60%] rounded-full bg-blue-500/5 blur-[150px] pointer-events-none" />
      <div className="absolute top-[40%] left-[50%] -translate-x-1/2 w-[40%] h-[40%] rounded-full bg-indigo-500/5 blur-[120px] pointer-events-none" />

      {/* Toast Popups */}
      <div id="toast-layer" className="fixed top-6 right-6 z-50 flex flex-col gap-3 max-w-sm w-full">
        {toasts.map((t) => (
          <div
            key={t.id}
            id={`toast-${t.id}`}
            className={`p-4 rounded-xl border flex items-start gap-3 shadow-2xl animate-fade-in transition-all duration-300 ${
              t.type === 'success'
                ? 'bg-slate-900/95 border-emerald-500/40 text-emerald-300 shadow-emerald-950/20'
                : t.type === 'error'
                ? 'bg-slate-900/95 border-rose-500/40 text-rose-300 shadow-rose-950/20'
                : 'bg-slate-900/95 border-blue-500/40 text-blue-300 shadow-blue-950/20'
            }`}
          >
            <div className="flex-1 text-sm font-medium leading-relaxed">{t.message}</div>
            <button
              onClick={() => setToasts((prev) => prev.filter((toast) => toast.id !== t.id))}
              className="text-slate-400 hover:text-slate-200 transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        ))}
      </div>

      {/* Hero Header Area */}
      <header id="app-header" className="border-b border-slate-900 bg-slate-950/60 backdrop-blur-md sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-20 flex items-center justify-between">
          
          {/* Logo Brand Title */}
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-gradient-to-br from-emerald-500/20 to-teal-500/10 rounded-xl border border-emerald-500/30 text-emerald-400 shadow-inner">
              <Sparkles className="w-5 h-5 animate-pulse" />
            </div>
            <div>
              <h1 className="text-base sm:text-lg font-bold tracking-tight text-white flex items-center gap-2 font-display">
                VIRA<span className="text-emerald-400">SHORT</span>
              </h1>
              <p className="text-[10px] text-slate-400 tracking-wider font-mono font-medium uppercase">Shortform Sourcing Platform</p>
            </div>
          </div>

          {/* Quick status controls */}
          <div className="flex items-center gap-3 sm:gap-4">
            
            {/* Real API connections status */}
            <div className="hidden lg:flex items-center gap-3 text-xs bg-slate-900/80 border border-slate-800/80 rounded-xl py-1.5 px-3">
              <span className="text-slate-500 font-semibold font-mono">CONNECTIONS:</span>
              <div className="flex items-center gap-1.5">
                <span className={`w-1.5 h-1.5 rounded-full ${apiStatus.geminiConnected ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'}`} />
                <span className={`font-mono ${apiStatus.geminiConnected ? 'text-slate-300' : 'text-slate-500'}`}>Gemini</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className={`w-1.5 h-1.5 rounded-full ${apiStatus.youtubeConnected ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'}`} />
                <span className={`font-mono ${apiStatus.youtubeConnected ? 'text-slate-300' : 'text-slate-500'}`}>YouTube API</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className={`w-1.5 h-1.5 rounded-full ${apiStatus.supabaseConnected ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'}`} />
                <span className={`font-mono ${apiStatus.supabaseConnected ? 'text-slate-300' : 'text-slate-500'}`}>Supabase</span>
              </div>
            </div>

            {/* Saved references drawer trigger */}
            <button
              id="drawer-toggle-btn"
              onClick={() => setIsSavedDrawerOpen(true)}
              className="relative flex items-center gap-2 bg-slate-900 hover:bg-slate-800 text-white font-semibold py-2 px-3.5 sm:px-4 rounded-xl border border-slate-800 hover:border-slate-700 transition-all cursor-pointer text-xs sm:text-sm"
            >
              <Bookmark className="w-4 h-4 text-emerald-400" />
              <span>내 보관함</span>
              {savedVideos.length > 0 ? (
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-emerald-500 text-[10px] font-bold text-slate-950">
                  {savedVideos.length}
                </span>
              ) : (
                <span className="text-[10px] bg-slate-800 px-1.5 py-0.5 rounded text-slate-400">Empty</span>
              )}
            </button>

          </div>
        </div>
      </header>

      {/* Main Dashboard Panel */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 relative z-10">
        
        {/* Top Info Warning Alert when Keys are absent */}
        {(!apiStatus.youtubeConnected || !apiStatus.supabaseConnected) && (
          <div className="mb-10 p-5 rounded-2xl border border-amber-500/20 bg-slate-900/60 backdrop-blur-md text-amber-300 text-xs sm:text-sm flex items-start gap-3.5 shadow-xl animate-fade-in">
            <div className="p-2 bg-amber-500/10 rounded-xl border border-amber-500/30 text-amber-400 shrink-0 mt-0.5">
              <Info className="w-4 h-4" />
            </div>
            <div className="leading-relaxed">
              <strong className="text-white font-semibold">💡 데모 및 가상 시뮬레이터 활성화 중</strong> 
              <p className="mt-1 text-slate-400 text-xs sm:text-sm leading-relaxed">
                현재 YouTube API 키 또는 Supabase 데이터베이스 연결이 비활성화 상태입니다. 앱은 즉각적인 피드백을 제공하도록 설계되었으며, 
                소싱 버튼 클릭 시 <span className="text-emerald-400 font-medium">Gemini AI가 자동 번역한 실시간 키워드</span>와 이를 반영한 초정밀 데모용 바이럴 숏폼 데이터를 생성하여 100% 작동합니다.
              </p>
              <div className="mt-3 flex items-center gap-2 flex-wrap text-[11px] text-slate-500">
                <span className="bg-slate-950 border border-slate-800 px-2 py-0.5 rounded font-mono">YOUTUBE_API_KEY</span>
                <span>및</span>
                <span className="bg-slate-950 border border-slate-800 px-2 py-0.5 rounded font-mono">SUPABASE_URL</span>
                <span>을 추가하면 실시간 채널 트래킹과 클라우드 영구 저장이 가능해집니다.</span>
              </div>
            </div>
          </div>
        )}

        {/* Input & Search Form Section */}
        <section id="search-section" className="mb-12 text-center max-w-3xl mx-auto relative">
          
          {/* Subtle Accent Glow */}
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-48 h-12 bg-emerald-500/10 blur-2xl rounded-full pointer-events-none" />

          <div className="inline-flex items-center gap-2 px-3 py-1 bg-emerald-500/10 border border-emerald-500/20 rounded-full text-emerald-400 text-xs font-mono font-semibold uppercase tracking-wider mb-5">
            <Sparkles className="w-3.5 h-3.5 animate-spin" />
            AI-POWERED AUTOMATION ENGINE
          </div>

          <h2 className="text-3xl sm:text-5xl font-extrabold text-white tracking-tight mb-4 font-display">
            글로벌 바이럴 숏폼 <span className="bg-gradient-to-r from-emerald-400 to-teal-400 bg-clip-text text-transparent">자동 소싱</span>
          </h2>
          
          <p className="text-slate-400 text-xs sm:text-sm mb-10 max-w-xl mx-auto leading-relaxed">
            실생활 상품의 이미지를 올리거나 한글 키워드를 입력하세요. Gemini LLM이 해외 TikTok/Shorts 마켓 타겟 바이럴 영어 키워드를 정밀 도출한 후, 실시간 최상위 숏폼 조회를 완료합니다.
          </p>

          <div 
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            className={`relative p-6 sm:p-8 rounded-3xl border-2 border-dashed transition-all duration-300 bg-slate-900/60 backdrop-blur-md ${
              isDragging ? 'border-emerald-500 bg-emerald-500/5 scale-[1.01]' : 'border-slate-800'
            }`}
          >
            {isDragging && (
              <div className="absolute inset-0 bg-slate-950/80 rounded-3xl flex flex-col items-center justify-center gap-3 z-50 animate-fade-in pointer-events-none">
                <Upload className="w-12 h-12 text-emerald-400 animate-bounce" />
                <p className="text-sm font-bold text-slate-200">여기에 이미지를 놓으면 자동 분석이 시작됩니다</p>
              </div>
            )}

            <form onSubmit={handleSearch} className="relative flex flex-col md:flex-row items-stretch md:items-center p-2 bg-slate-950 rounded-2xl border border-slate-800 focus-within:border-emerald-500/40 shadow-2xl transition-all gap-2">
              <div className="flex-1 flex items-center px-3 py-1">
                <Search className="w-5 h-5 text-slate-500 mr-3 shrink-0" />
                <input
                  id="search-input"
                  type="text"
                  placeholder="한국어 유행 키워드를 입력하거나 이미지를 우측에 올려주세요 (예: 요술펜, 모공팩)"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  disabled={isLoading}
                  className="w-full bg-transparent text-slate-100 placeholder-slate-500 focus:outline-none text-xs sm:text-sm py-2"
                />
              </div>

              <div className="flex items-center gap-2 px-2">
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleFileChange}
                  disabled={isLoading}
                  id="image-picker"
                  className="hidden"
                />
                <label
                  htmlFor="image-picker"
                  className="p-3 bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-emerald-400 rounded-xl border border-slate-800 cursor-pointer flex items-center justify-center gap-1.5 transition-all text-xs font-semibold shrink-0"
                >
                  <Image className="w-4 h-4" />
                  <span className="hidden sm:inline">이미지 추가</span>
                </label>
              </div>

              <button
                id="submit-btn"
                type="submit"
                disabled={isLoading}
                className="bg-emerald-500 hover:bg-emerald-400 disabled:bg-slate-800 disabled:text-slate-600 disabled:cursor-not-allowed text-slate-950 font-bold px-6 py-3 rounded-xl flex items-center justify-center gap-2 transition-all text-xs sm:text-sm shrink-0 cursor-pointer shadow-lg shadow-emerald-500/10 hover:shadow-emerald-500/20 active:scale-95"
              >
                {isLoading ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>소싱 중...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4" />
                    <span>소싱 가동</span>
                  </>
                )}
              </button>
            </form>

            {/* Uploaded Image Preview Box inside the drag zone */}
            {uploadedImage && (
              <div className="mt-4 flex items-center gap-3.5 bg-slate-950/50 p-3 rounded-xl border border-slate-800/80 max-w-sm mx-auto text-left animate-fade-in">
                <div className="w-10 h-10 rounded-lg overflow-hidden border border-slate-700 shrink-0">
                  <img src={uploadedImage} alt="Uploaded source" className="w-full h-full object-cover" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold text-slate-200 truncate">업로드된 이미지 리소스</p>
                  <p className="text-[10px] text-emerald-400">Gemini AI 멀티모달 분석 대기 중</p>
                </div>
                <button
                  type="button"
                  onClick={() => setUploadedImage(null)}
                  className="p-1.5 bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-rose-400 rounded-lg border border-slate-800 transition-all cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            )}
          </div>
        </section>

        {/* Visual Workflow Steps (Pipeline Tracker) */}
        <section className="mb-12 max-w-5xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-4 text-left">
          
          <div className={`p-5 rounded-2xl border transition-all duration-300 bg-slate-900/40 backdrop-blur-sm ${
            isLoading ? 'border-emerald-500/20 bg-emerald-500/[0.01]' : searchQuery ? 'border-slate-800' : 'border-slate-900 opacity-60'
          }`}>
            <div className="flex items-center gap-3 mb-2">
              <span className={`w-6 h-6 rounded-lg text-xs font-mono font-bold flex items-center justify-center ${
                isLoading ? 'bg-emerald-500 text-slate-950' : 'bg-slate-800 text-slate-400'
              }`}>01</span>
              <h4 className="text-xs font-bold text-slate-200 tracking-wide font-display">트렌드 분석 & 키워드 매칭</h4>
            </div>
            <p className="text-[11px] text-slate-400 leading-relaxed">
              입력받은 한글 검색어를 기반으로 타겟 트렌드를 확인하고 틱톡/쇼츠 마켓 바이어 성향을 매핑합니다.
            </p>
          </div>

          <div className={`p-5 rounded-2xl border transition-all duration-300 bg-slate-900/40 backdrop-blur-sm ${
            isLoading ? 'border-emerald-500/20 bg-emerald-500/[0.01]' : keywords.length > 0 ? 'border-emerald-500/30 bg-emerald-500/[0.02]' : 'border-slate-900 opacity-60'
          }`}>
            <div className="flex items-center gap-3 mb-2">
              <span className={`w-6 h-6 rounded-lg text-xs font-mono font-bold flex items-center justify-center ${
                keywords.length > 0 ? 'bg-emerald-500 text-slate-950 animate-pulse' : 'bg-slate-800 text-slate-400'
              }`}>02</span>
              <h4 className="text-xs font-bold text-slate-200 tracking-wide font-display">Gemini AI 키워드 자동 치환</h4>
            </div>
            <p className="text-[11px] text-slate-400 leading-relaxed">
              해외 숏폼 바이럴에 최적화된 영문 연관 키워드 3종으로 고속 다차원 확장을 진행합니다.
            </p>
          </div>

          <div className={`p-5 rounded-2xl border transition-all duration-300 bg-slate-900/40 backdrop-blur-sm ${
            isLoading ? 'border-emerald-500/20 bg-emerald-500/[0.01]' : videos.length > 0 ? 'border-emerald-500/30 bg-emerald-500/[0.02]' : 'border-slate-900 opacity-60'
          }`}>
            <div className="flex items-center gap-3 mb-2">
              <span className={`w-6 h-6 rounded-lg text-xs font-mono font-bold flex items-center justify-center ${
                videos.length > 0 ? 'bg-emerald-500 text-slate-950' : 'bg-slate-800 text-slate-400'
              }`}>03</span>
              <h4 className="text-xs font-bold text-slate-200 tracking-wide font-display">초정밀 바이럴 비디오 추출</h4>
            </div>
            <p className="text-[11px] text-slate-400 leading-relaxed">
              조회수 가중 필터를 거친 고성과 레퍼런스를 실시간 추천 리스트에 노출하고 저장 대기합니다.
            </p>
          </div>

        </section>

        {/* Error Notification Alert */}
        {error && (
          <div className="mb-10 max-w-3xl mx-auto p-4 rounded-xl border border-rose-500/20 bg-rose-950/20 text-rose-300 flex items-center gap-3 text-sm animate-fade-in">
            <AlertTriangle className="w-5 h-5 text-rose-400 shrink-0" />
            <div>{error}</div>
          </div>
        )}

        {/* AI Vision & Keyword Analysis Result Banner */}
        {identifiedItemName && (
          <section className="mb-10 max-w-5xl mx-auto bg-gradient-to-br from-emerald-500/[0.03] to-indigo-500/[0.03] border border-emerald-500/20 rounded-2xl p-6 backdrop-blur-md relative overflow-hidden animate-fade-in shadow-xl">
            <div className="absolute top-[-20%] left-[-10%] w-[30%] h-[50%] rounded-full bg-emerald-500/10 blur-[80px] pointer-events-none" />
            
            <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
              <div className="flex-1 space-y-2.5">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 px-2.5 py-0.5 rounded-full font-mono font-bold uppercase tracking-wider">
                    AI VISION REPORT
                  </span>
                  {uploadedImage && (
                    <span className="text-[10px] bg-indigo-500/20 text-indigo-400 border border-indigo-500/30 px-2.5 py-0.5 rounded-full font-mono font-bold uppercase tracking-wider">
                      MULTIMODAL ANALYSIS
                    </span>
                  )}
                </div>
                
                <h3 className="text-xl sm:text-2xl font-extrabold text-white font-display">
                  분석 상품명: <span className="text-emerald-400">{identifiedItemName}</span>
                </h3>
                
                {viralityDescription && (
                  <p className="text-xs sm:text-sm text-slate-300 leading-relaxed max-w-3xl">
                    {viralityDescription}
                  </p>
                )}
              </div>
              
              {uploadedImage && (
                <div className="relative w-20 h-28 sm:w-24 sm:h-36 rounded-xl overflow-hidden border border-slate-700 shadow-md shrink-0 self-center">
                  <img src={uploadedImage} alt="Analyzed target" className="w-full h-full object-cover" />
                  <div className="absolute inset-0 bg-slate-950/20" />
                </div>
              )}
            </div>
          </section>
        )}

        {/* Category 1: Real-time Search Trend Analysis (Recharts) */}
        {(trendData.length > 0 || isLoading) && (
          <section className="mb-10 max-w-5xl mx-auto bg-slate-900/40 rounded-2xl p-6 border border-slate-800/80 backdrop-blur-md relative overflow-hidden animate-fade-in">
            <div className="absolute top-0 left-0 w-32 h-32 bg-indigo-500/5 blur-3xl rounded-full" />
            
            <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 mb-6 pb-4 border-b border-slate-800/60">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                  <span className="text-[10px] font-bold text-emerald-400 font-mono tracking-wider uppercase">
                    CATEGORY 1: REAL-TIME SEARCH TREND
                  </span>
                </div>
                <h3 className="text-lg font-bold text-slate-100">
                  실시간 구글 검색 트렌드 분석 & 숏폼 바이럴 지수
                </h3>
              </div>
              
              {trendStatus && (
                <div className="flex items-center gap-2">
                  <span className="text-xs text-slate-400">트렌드 강도:</span>
                  <span className={`px-2.5 py-1 rounded-lg text-xs font-bold border ${
                    trendStatus === '급상승' 
                      ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' 
                      : 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20'
                  }`}>
                    {trendStatus}
                  </span>
                </div>
              )}
            </div>

            {isLoading ? (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="md:col-span-2 h-[220px] bg-slate-950/40 border border-slate-800 rounded-xl animate-pulse" />
                <div className="h-[220px] bg-slate-950/40 border border-slate-800 rounded-xl animate-pulse" />
              </div>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* 30-Day Chronological Trend Graph */}
                <div className="lg:col-span-2 bg-slate-950/40 border border-slate-800/80 rounded-xl p-4 flex flex-col justify-between">
                  <div className="flex justify-between items-center mb-4">
                    <p className="text-xs font-bold text-slate-400">최근 30일 검색량 변화 추이 (Google Index)</p>
                    <span className="text-[10px] bg-slate-800 text-slate-400 px-2 py-0.5 rounded font-mono">30-day index scale</span>
                  </div>
                  
                  <div className="w-full h-[180px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={trendData} margin={{ top: 10, right: 10, left: -25, bottom: 0 }}>
                        <defs>
                          <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#10b981" stopOpacity={0.3}/>
                            <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                        <XAxis dataKey="date" stroke="#64748b" fontSize={10} tickLine={false} />
                        <YAxis stroke="#64748b" fontSize={10} tickLine={false} domain={[0, 100]} />
                        <Tooltip 
                          contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '8px', fontSize: '12px' }}
                          labelStyle={{ color: '#94a3b8', fontWeight: 'bold' }}
                        />
                        <Area type="monotone" dataKey="value" stroke="#10b981" strokeWidth={2} fillOpacity={1} fill="url(#colorValue)" />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                {/* Score and Change Card */}
                <div className="flex flex-col gap-4">
                  {/* Virality Score */}
                  <div className="bg-slate-950/40 border border-slate-800/80 rounded-xl p-4 flex flex-col justify-between flex-1">
                    <div>
                      <p className="text-xs font-bold text-slate-400 mb-2">글로벌 숏폼 바이럴 지수 (V-Score)</p>
                      <div className="flex items-baseline gap-2">
                        <span className="text-3xl font-extrabold text-emerald-400 font-display">{viralityScore || 75}</span>
                        <span className="text-xs text-slate-500">/ 100점</span>
                      </div>
                    </div>
                    
                    <div className="mt-4 pt-4 border-t border-slate-800/60">
                      <div className="flex justify-between text-xs text-slate-400 mb-1">
                        <span>숏폼 전파력</span>
                        <span className="text-emerald-400 font-semibold">Very High</span>
                      </div>
                      <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden">
                        <div className="bg-emerald-500 h-full rounded-full" style={{ width: `${viralityScore || 75}%` }} />
                      </div>
                    </div>
                  </div>

                  {/* Trend Shift Percent */}
                  <div className="bg-slate-950/40 border border-slate-800/80 rounded-xl p-4 flex flex-col justify-between flex-1">
                    <div>
                      <p className="text-xs font-bold text-slate-400 mb-2">전월 대비 검색 트렌드 변동율</p>
                      <div className="flex items-baseline gap-1.5">
                        <span className={`text-3xl font-extrabold font-display ${trendChange && trendChange >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                          {trendChange && trendChange >= 0 ? `+${trendChange}%` : `${trendChange}%`}
                        </span>
                        <span className="text-xs text-slate-500">MoM growth</span>
                      </div>
                    </div>
                    
                    <p className="text-[11px] text-slate-400 mt-2">
                      해외 틱톡과 쇼츠 해시태그 생성 추이를 추적 분석하여 산출한 글로벌 소싱 모멘텀 비율입니다.
                    </p>
                  </div>
                </div>
              </div>
            )}
          </section>
        )}

        {/* AI Translation Results (3 expanded English Keywords) */}
        {(keywords.length > 0 || isLoading) && (
          <section id="keywords-section" className="mb-10 max-w-5xl mx-auto bg-slate-900/30 rounded-2xl p-6 border border-slate-800/80 backdrop-blur-md relative overflow-hidden">
            
            <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-500/5 blur-xl rounded-full" />
            
            <div className="flex items-center gap-2 mb-4">
              <Sparkles className="w-4 h-4 text-emerald-400" />
              <h3 className="text-xs font-bold tracking-wider text-slate-300 uppercase font-mono">
                GEMINI AI GLOBAL EXPANSION KEYWORDS
              </h3>
            </div>
            
            {isLoading ? (
              <div className="flex flex-wrap gap-3">
                <div className="h-10 w-32 bg-slate-900 rounded-xl animate-pulse border border-slate-800" />
                <div className="h-10 w-44 bg-slate-900 rounded-xl animate-pulse border border-slate-800" />
                <div className="h-10 w-36 bg-slate-900 rounded-xl animate-pulse border border-slate-800" />
              </div>
            ) : (
              <div className="flex flex-col gap-3">
                <div className="flex flex-wrap gap-2.5">
                  {keywords.map((kw, idx) => (
                    <span
                      key={idx}
                      className={`text-xs py-2.5 px-4 rounded-xl border font-mono font-semibold flex items-center gap-2 transition-all ${
                        idx === 0
                          ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300 shadow-md shadow-emerald-950/40 scale-[1.02]'
                          : 'bg-slate-900/80 border-slate-800 text-slate-400 hover:text-slate-300'
                      }`}
                    >
                      <span className={`text-[9px] px-1.5 py-0.5 rounded font-mono font-bold ${
                        idx === 0 ? 'bg-emerald-500/20 text-emerald-400' : 'bg-slate-950 text-slate-500'
                      }`}>
                        {idx === 0 ? '대표 소싱 타겟' : `연관 키워드 ${idx + 1}`}
                      </span>
                      {kw}
                    </span>
                  ))}
                </div>
                <p className="text-xs text-slate-500 mt-2 flex items-center gap-1.5">
                  <Info className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                  첫 번째 대표 매칭 키워드인 <strong className="text-emerald-400 font-bold font-mono">"{keywords[0]}"</strong>(으)로 숏폼 동영상 실시간 검색을 완료했습니다.
                </p>
              </div>
            )}
          </section>
        )}

        {/* Video Grid Sourcing Section */}
        <section id="video-sourcing-grid">
          
          {/* Section title & demo marker */}
          {(videos.length > 0 || isLoading) && (
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 pb-4 border-b border-slate-900">
              <div>
                <h3 className="text-lg font-bold text-white flex items-center gap-2 font-display">
                  <span>추천 바이럴 레퍼런스 발굴 리스트</span>
                  {isMockData && !isLoading && (
                    <span className="text-[10px] bg-amber-500/15 text-amber-400 border border-amber-500/30 px-2.5 py-0.5 rounded-full font-mono font-bold tracking-wide uppercase">
                      DEMO SIMULATION DATA
                    </span>
                  )}
                </h3>
                <p className="text-xs text-slate-400 mt-1">글로벌 틱톡 및 유튜브 쇼츠 기반 최고 성과 크리에이티브 분석</p>
              </div>
              
              {!isLoading && (
                <div className="text-xs text-slate-500 font-medium">
                  총 <span className="text-emerald-400 font-bold">{videos.length}</span>개의 하이 퍼포먼스 숏폼이 추출되었습니다.
                </div>
              )}
            </div>
          )}

          {/* Loading Skeletons */}
          {isLoading && (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
              {Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-md">
                  <div className="aspect-[9/16] bg-slate-800/60 animate-pulse w-full relative" />
                  <div className="p-4 space-y-3">
                    <div className="h-4 bg-slate-800 rounded animate-pulse w-3/4" />
                    <div className="h-3 bg-slate-800 rounded animate-pulse w-1/2" />
                    <div className="flex gap-2 pt-2">
                      <div className="h-8 bg-slate-800 rounded-lg animate-pulse flex-1" />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Actual Sourced Videos */}
          {!isLoading && videos.length > 0 && (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
              {videos.map((vid) => {
                const saved = isVideoSaved(vid.videoUrl);
                return (
                  <div
                    key={vid.id}
                    id={`vid-card-${vid.id}`}
                    className="group bg-slate-900/40 border border-slate-900 hover:border-slate-800/80 rounded-2xl overflow-hidden shadow-lg hover:shadow-xl transition-all duration-300 flex flex-col hover:-translate-y-1 backdrop-blur-sm"
                  >
                    
                    {/* Thumbnail Card with view tag & link */}
                    <div className="aspect-[9/16] bg-slate-950 relative overflow-hidden shrink-0">
                      <img
                        src={vid.thumbnailUrl}
                        alt={vid.title}
                        loading="lazy"
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500 brightness-[0.88] group-hover:brightness-100"
                      />
                      
                      {/* Gradient overlay for contrast */}
                      <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-transparent to-slate-950/30 opacity-60 pointer-events-none" />

                      {/* Video source badge / view count tag */}
                      <div className="absolute top-3 left-3 bg-slate-950/80 backdrop-blur-md border border-slate-800 py-1 px-2.5 rounded-lg text-[11px] font-bold text-emerald-400 flex items-center gap-1 shadow-md font-mono">
                        <Eye className="w-3 h-3 text-emerald-400 animate-pulse" />
                        <span>{vid.viewCount}</span>
                      </div>

                      {/* Open Video URL */}
                      <a
                        href={vid.videoUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="absolute bottom-3 right-3 bg-slate-950/80 backdrop-blur-md hover:bg-emerald-500 hover:text-slate-950 text-white p-2.5 rounded-lg border border-slate-800 hover:border-emerald-500 transition-all shadow-md group/link flex items-center justify-center"
                        title="동영상 새 창에서 보기"
                      >
                        <ExternalLink className="w-4 h-4" />
                      </a>

                      <div className="absolute bottom-3 left-3 text-[10px] text-slate-400 bg-slate-950/60 px-2 py-0.5 rounded border border-slate-900 font-mono">
                        {vid.publishedAt}
                      </div>
                    </div>

                    {/* Metadata & Actions */}
                    <div className="p-4 flex flex-col flex-1 justify-between gap-3">
                      <div>
                        <span className="text-[10px] text-slate-500 font-bold block tracking-wider uppercase mb-1 font-mono">
                          {vid.channelTitle}
                        </span>
                        <h4 className="text-xs sm:text-sm font-semibold text-white leading-snug line-clamp-2 group-hover:text-emerald-400 transition-colors">
                          {vid.title}
                        </h4>
                      </div>

                      <div className="pt-2 border-t border-slate-900">
                        <button
                          onClick={() => handleSaveVideo(vid)}
                          disabled={saved}
                          className={`w-full py-2.5 px-3 rounded-xl border text-xs font-semibold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                            saved
                              ? 'bg-emerald-950/20 border-emerald-500/20 text-emerald-400 cursor-default'
                              : 'bg-slate-850 hover:bg-slate-800 border-slate-800 hover:border-slate-700 text-white'
                          }`}
                        >
                          {saved ? (
                            <>
                              <CheckCircle className="w-3.5 h-3.5 text-emerald-400" />
                              <span>레퍼런스 보관함 보관 완료</span>
                            </>
                          ) : (
                            <>
                              <Bookmark className="w-3.5 h-3.5" />
                              <span>레퍼런스 보관</span>
                            </>
                          )}
                        </button>
                      </div>
                    </div>

                  </div>
                );
              })}
            </div>
          )}

          {/* Empty Sourcing Dashboard Placeholder */}
          {videos.length === 0 && !isLoading && (
            <section className="text-center py-20 bg-slate-900/10 border border-dashed border-slate-800/80 rounded-3xl p-8 max-w-4xl mx-auto backdrop-blur-sm animate-fade-in">
              <div className="p-4 bg-slate-900 border border-slate-800 rounded-2xl w-16 h-16 flex items-center justify-center mx-auto mb-4 text-slate-400 shadow-lg">
                <Tv className="w-8 h-8" />
              </div>
              <h3 className="text-lg font-bold text-slate-200 mb-1 font-display">검색 및 소싱 대기 중</h3>
              <p className="text-xs sm:text-sm text-slate-500 max-w-sm mx-auto mb-6 leading-relaxed">
                위 검색창에 한글 트렌드 소싱 키워드를 적어넣으면, Gemini가 해외 바이럴 소싱 영어 구문으로 변경한 다음 고매출 바이럴 크리에이티브를 찾아줍니다.
              </p>
              
              <div className="flex flex-wrap justify-center gap-2 max-w-md mx-auto">
                <button
                  onClick={() => {
                    setSearchQuery('무선 고데기');
                    showToast('"무선 고데기"를 자동 대입했습니다. 검색 버튼을 눌러주세요!', 'info');
                  }}
                  className="bg-slate-900 hover:bg-slate-850 border border-slate-800 text-slate-400 text-xs py-2 px-3 rounded-xl hover:text-white transition-all cursor-pointer font-medium hover:border-slate-700"
                >
                  💡 무선 고데기
                </button>
                <button
                  onClick={() => {
                    setSearchQuery('요술펜');
                    showToast('"요술펜"을 자동 대입했습니다. 검색 버튼을 눌러주세요!', 'info');
                  }}
                  className="bg-slate-900 hover:bg-slate-850 border border-slate-800 text-slate-400 text-xs py-2 px-3 rounded-xl hover:text-white transition-all cursor-pointer font-medium hover:border-slate-700"
                >
                  💡 요술펜
                </button>
                <button
                  onClick={() => {
                    setSearchQuery('스마트 마사지기');
                    showToast('"스마트 마사지기"를 자동 대입했습니다. 검색 버튼을 눌러주세요!', 'info');
                  }}
                  className="bg-slate-900 hover:bg-slate-850 border border-slate-800 text-slate-400 text-xs py-2 px-3 rounded-xl hover:text-white transition-all cursor-pointer font-medium hover:border-slate-700"
                >
                  💡 스마트 마사지기
                </button>
              </div>
            </section>
          )}

        </section>

      </main>

      {/* Slide-out Drawer Panel for Saved References */}
      <div
        id="saved-drawer-overlay"
        className={`fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 transition-opacity duration-300 ${
          isSavedDrawerOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
        }`}
        onClick={() => setIsSavedDrawerOpen(false)}
      >
        <div
          id="saved-drawer-content"
          className={`absolute right-0 top-0 bottom-0 max-w-lg w-full bg-slate-900 border-l border-slate-800 p-6 flex flex-col justify-between shadow-2xl transition-transform duration-300 transform ${
            isSavedDrawerOpen ? 'translate-x-0' : 'translate-x-full'
          }`}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Drawer Header */}
          <div className="flex items-center justify-between pb-4 border-b border-slate-800 shrink-0">
            <div className="flex items-center gap-2">
              <Bookmark className="w-5 h-5 text-emerald-400" />
              <h3 className="font-bold text-white text-base sm:text-lg font-display">보관 중인 레퍼런스</h3>
              <span className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 text-xs font-mono font-bold px-2 py-0.5 rounded-full">
                {savedVideos.length}
              </span>
            </div>
            <button
              id="drawer-close-btn"
              onClick={() => setIsSavedDrawerOpen(false)}
              className="text-slate-400 hover:text-slate-200 transition-colors p-1 bg-slate-800/50 rounded-lg border border-slate-800 cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Quick Action controls */}
          {savedVideos.length > 0 && (
            <div className="py-3.5 flex items-center justify-between shrink-0 gap-2 border-b border-slate-800/50">
              <span className="text-slate-400 text-xs">아이디어 마크다운 수집:</span>
              <button
                onClick={handleExportMarkdown}
                className="text-xs bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold px-3 py-2 rounded-xl flex items-center gap-1.5 transition-all cursor-pointer"
              >
                <Copy className="w-3.5 h-3.5" />
                <span>마크다운 일괄 복사</span>
              </button>
            </div>
          )}

          {/* Saved Video list */}
          <div className="flex-1 overflow-y-auto py-4 space-y-4 pr-1">
            {savedVideos.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center p-4">
                <Bookmark className="w-12 h-12 text-slate-600 mb-3" />
                <h4 className="text-slate-400 font-bold text-sm mb-1">보관된 영상이 없습니다</h4>
                <p className="text-xs text-slate-500 max-w-xs">
                  대시보드에서 숏폼 비디오 소싱 후 '레퍼런스 저장' 버튼을 누르면 이 공간에 실시간으로 보관됩니다.
                </p>
              </div>
            ) : (
              savedVideos.map((item) => (
                <div
                  key={item.id}
                  id={`saved-item-${item.id}`}
                  className="p-3 bg-slate-950/60 border border-slate-800/80 hover:border-slate-700 rounded-xl flex gap-3 transition-colors group"
                >
                  <div className="w-16 h-28 rounded-lg overflow-hidden shrink-0 bg-slate-900 border border-slate-800 relative">
                    <img src={item.thumbnail_url} alt={item.title} className="w-full h-full object-cover" />
                    <div className="absolute inset-0 bg-slate-950/40" />
                  </div>
                  
                  <div className="flex-1 flex flex-col justify-between min-w-0">
                    <div>
                      <div className="flex items-center justify-between gap-2 mb-1">
                        <span className="text-[10px] bg-slate-850 text-slate-300 font-semibold px-2 py-0.5 rounded-md truncate max-w-[120px] font-mono">
                          {item.keyword}
                        </span>
                        <span className="text-[10px] text-slate-400 font-semibold shrink-0 flex items-center gap-0.5 font-mono">
                          <Eye className="w-3 h-3 text-emerald-400" />
                          {item.view_count}
                        </span>
                      </div>
                      
                      <h4 className="text-xs font-semibold text-white leading-snug line-clamp-2 group-hover:text-emerald-400 transition-colors">
                        {item.title}
                      </h4>
                    </div>

                    <div className="flex items-center gap-2 pt-2 border-t border-slate-800/60">
                      <a
                        href={item.video_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[11px] text-slate-300 hover:text-white flex items-center gap-1 hover:underline truncate"
                      >
                        <ExternalLink className="w-3 h-3 text-emerald-400" />
                        <span>영상 열기</span>
                      </a>
                      <span className="text-slate-800 text-xs">|</span>
                      <button
                        onClick={() => handleDeleteSaved(item.id)}
                        className="text-[11px] text-rose-400 hover:text-rose-300 flex items-center gap-1 cursor-pointer ml-auto"
                      >
                        <Trash2 className="w-3 h-3" />
                        <span>삭제</span>
                      </button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Drawer Footer with persistence note */}
          <div className="pt-4 border-t border-slate-800 shrink-0 bg-slate-900">
            <div className="text-[10px] text-slate-500 leading-relaxed text-center">
              {!supabase ? (
                <span className="text-amber-500 font-semibold font-mono">⚠️ DEMO PREVIEW PERSISTENCE MODE</span>
              ) : (
                <span className="text-emerald-400 font-semibold font-mono">🛡️ SUPABASE CLOUD SYNC ACTIVE</span>
              )}
              <p className="mt-1">© 2026 Global Viral Sourcing. All rights reserved.</p>
            </div>
          </div>

        </div>
      </div>

    </div>
  );
}
