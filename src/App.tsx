import React, { useState, useRef, useEffect } from "react";
import { 
  Upload, Languages, Scan, ChevronRight, Loader2, 
  Info, Eye, EyeOff, Menu, X, Key, RotateCcw, Clock, History, Trash2,
  Sparkles, Sun, Moon, Maximize, Minimize
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

interface BoundingBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface Bubble {
  bubble_id: number;
  bounding_box: BoundingBox;
  original_text: string;
  translated_text: string;
  confidence_score: number;
}

interface MangaResult {
  total_bubbles: number;
  scene_context: string;
  bubbles: Bubble[];
  timestamp: number;
  id: string;
  imagePreview?: string;
}

export default function App() {
  const [images, setImages] = useState<string[]>([]);
  const [results, setResults] = useState<(MangaResult | null)[]>([]);
  const [activeIndex, setActiveIndex] = useState(0);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isProcessingAll, setIsProcessingAll] = useState(false);
  const [processedCount, setProcessedCount] = useState(0);
  const [showOverlays, setShowOverlays] = useState(true);
  
  // Theme and custom states
  const [isDarkMode, setIsDarkMode] = useState(() => {
    const saved = localStorage.getItem("miomanga_theme") || localStorage.getItem("mangalens_theme");
    return saved === "dark";
  });

  const [isFullscreen, setIsFullscreen] = useState(false);

  // Fullscreen support
  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().then(() => {
        setIsFullscreen(true);
      }).catch((err) => {
        console.error("Error enabling full-screen mode:", err);
      });
    } else {
      document.exitFullscreen();
      setIsFullscreen(false);
    }
  };

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener("fullscreenchange", handleFullscreenChange);
    return () => {
      document.removeEventListener("fullscreenchange", handleFullscreenChange);
    };
  }, []);

  const [targetLanguage, setTargetLanguage] = useState(() => 
    localStorage.getItem("miomanga_lang") || localStorage.getItem("mangalens_lang") || "Vietnamese"
  );
  const [translationTone, setTranslationTone] = useState(() => 
    localStorage.getItem("miomanga_tone") || localStorage.getItem("mangalens_tone") || "standard"
  );
  const [userPrompt, setUserPrompt] = useState(() => 
    localStorage.getItem("miomanga_prompt") || localStorage.getItem("mangalens_prompt") || ""
  );
  const [customApiKey, setCustomApiKey] = useState(() => 
    localStorage.getItem("miomanga_api_key") || localStorage.getItem("mangalens_api_key") || ""
  );
  const [pronounSettings, setPronounSettings] = useState(() => 
    localStorage.getItem("miomanga_pronouns") || localStorage.getItem("mangalens_pronouns") || ""
  );

  const [hoveredBubble, setHoveredBubble] = useState<number | null>(null);
  const [selectedBubble, setSelectedBubble] = useState<Bubble | null>(null);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [history, setHistory] = useState<MangaResult[]>([]);
  const [progress, setProgress] = useState(0);
  const [copyStatus, setCopyStatus] = useState<string | null>(null);
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);

  // Dynamic style constants for Light/Dark brutalist theme
  const cPageBg = isDarkMode ? "bg-[#171714] text-[#E4E3E0]" : "bg-[#F0F0ED] text-[#141414]";
  const cText = isDarkMode ? "text-[#E4E3E0]" : "text-[#141414]";
  const cBorder = isDarkMode ? "border-[#E4E3E0]" : "border-[#141414]";
  const cBorder2 = isDarkMode ? "border-2 border-[#E4E3E0]" : "border-2 border-[#141414]";
  const cBorderB = isDarkMode ? "border-b border-[#E4E3E0]" : "border-b border-[#141414]";
  const cBorderL = isDarkMode ? "border-l border-[#E4E3E0]" : "border-l border-[#141414]";
  const cBorderR = isDarkMode ? "border-r border-[#E4E3E0]" : "border-r border-[#141414]";
  const cBorderT = isDarkMode ? "border-t border-[#E4E3E0]" : "border-t border-[#141414]";
  const cBorderT2 = isDarkMode ? "border-t-2 border-[#E4E3E0]" : "border-t-2 border-[#141414]";
  const cDivide = isDarkMode ? "divide-[#E4E3E0]" : "divide-[#141414]";
  const cSelection = isDarkMode ? "selection:bg-[#E4E3E0] selection:text-[#171714]" : "selection:bg-[#141414] selection:text-[#E4E3E0]";
  const cCanvasBg = isDarkMode ? "bg-[#282824]" : "bg-[#DEDDD9]";
  const cCardBg = isDarkMode ? "bg-[#22221F] text-[#E4E3E0]" : "bg-white text-[#141414]";
  const cInputBg = isDarkMode ? "bg-[#22221F] text-[#E4E3E0] border-[#E4E3E0]" : "bg-white text-[#141414] border-[#141414]";
  const cPrimaryBtnBg = isDarkMode ? "bg-[#E4E3E0]" : "bg-[#141414]";
  const cPrimaryBtnText = isDarkMode ? "text-[#171714]" : "text-[#E4E3E0]";
  const cPrimaryBtn = `${cPrimaryBtnBg} ${cPrimaryBtnText}`;
  const cPanelBg = isDarkMode ? "bg-[#171714]" : "bg-[#F0F0ED]";
  const cHeaderBg = isDarkMode ? "bg-[#171714] text-[#E4E3E0]" : "bg-[#F0F0ED] text-[#141414]";
  const cBtnHover = isDarkMode ? "hover:bg-[#E4E3E0] hover:text-[#171714]" : "hover:bg-black hover:text-white";
  const cOppText = isDarkMode ? "text-[#141414]" : "text-[#E4E3E0]";
  const cResultSidebar = isDarkMode ? "bg-[#171714]" : "bg-[#F0F0ED]";

  // Progress simulation
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isProcessing && !isProcessingAll) {
      setProgress(10);
      interval = setInterval(() => {
        setProgress((prev) => (prev < 90 ? prev + Math.random() * 15 : prev));
      }, 800);
    } else if (isProcessingAll) {
      // For processing all, progress is based on count
      const baseProgress = (processedCount / images.length) * 100;
      setProgress(baseProgress);
    } else {
      setProgress(0);
    }
    return () => clearInterval(interval);
  }, [isProcessing, isProcessingAll, processedCount, images.length]);

  // Persist settings
  useEffect(() => {
    localStorage.setItem("miomanga_theme", isDarkMode ? "dark" : "light");
  }, [isDarkMode]);

  useEffect(() => {
    localStorage.setItem("miomanga_lang", targetLanguage);
  }, [targetLanguage]);

  useEffect(() => {
    localStorage.setItem("miomanga_tone", translationTone);
  }, [translationTone]);

  useEffect(() => {
    localStorage.setItem("miomanga_prompt", userPrompt);
  }, [userPrompt]);

  useEffect(() => {
    localStorage.setItem("miomanga_api_key", customApiKey);
  }, [customApiKey]);

  useEffect(() => {
    localStorage.setItem("miomanga_pronouns", pronounSettings);
  }, [pronounSettings]);

  // Load history
  useEffect(() => {
    const saved = localStorage.getItem("miomanga_history") || localStorage.getItem("mangalens_history");
    if (saved) {
      try {
        setHistory(JSON.parse(saved));
      } catch (e) {
        console.error("Lỗi khi đọc lịch sử", e);
      }
    }
  }, []);

  const saveToHistory = (newResult: MangaResult) => {
    const updated = [newResult, ...history].slice(0, 15);
    setHistory(updated);
    localStorage.setItem("miomanga_history", JSON.stringify(updated));
  };

  const deleteHistoryItem = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const updated = history.filter(item => item.id !== id);
    setHistory(updated);
    localStorage.setItem("miomanga_history", JSON.stringify(updated));
  };

  const clearHistory = () => {
    setHistory([]);
    localStorage.removeItem("miomanga_history");
    localStorage.removeItem("mangalens_history");
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopyStatus("Đã sao chép!");
    setTimeout(() => setCopyStatus(null), 2000);
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      const fileArray = Array.from(files).slice(0, 10) as File[];
      
      try {
        const loadPromises = fileArray.map(file => {
          return new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (event) => resolve(event.target?.result as string);
            reader.onerror = (error) => reject(error);
            reader.readAsDataURL(file);
          });
        });

        const newImages = await Promise.all(loadPromises);
        setImages(newImages);
        setResults(new Array(newImages.length).fill(null));
        setActiveIndex(0);
        setHoveredBubble(null);
        setSelectedBubble(null);
      } catch (error) {
        console.error("Lỗi khi tải ảnh:", error);
        alert("Có lỗi xảy ra khi tải một số ảnh. Vui lòng thử lại.");
      }
    }
  };

  const resetCanvas = () => {
    setImages([]);
    setResults([]);
    setActiveIndex(0);
    setHoveredBubble(null);
    setSelectedBubble(null);
  };

  const processImage = async (index: number = activeIndex) => {
    const targetImage = images[index];
    if (!targetImage) return null;
    
    // If not in "process all" mode, we set the global isProcessing
    if (!isProcessingAll) setIsProcessing(true);
    
    try {
      const response = await fetch("/api/translate-manga", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          image: targetImage, 
          targetLanguage, 
          userPrompt, 
          customApiKey, 
          pronounSettings,
          translationTone
        }),
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        if (data.error === "QUOTA_EXCEEDED") {
          alert("Hạn mức dịch thuật miễn phí đã hết! Bạn có thể sử dụng mã API riêng của mình trong phần Cài đặt để tiếp tục không giới hạn.");
          setIsSettingsOpen(true);
        } else {
          alert(`Lỗi trang ${index + 1}: ` + (data.message || data.error));
        }
        return null;
      }

      const newResult: MangaResult = {
        ...data,
        id: Math.random().toString(36).substr(2, 9),
        timestamp: Date.now(),
        imagePreview: targetImage
      };
      
      return newResult;
    } catch (error) {
      console.error(`Xử lý trang ${index + 1} thất bại:`, error);
      alert(`Không thể kết nối với máy chủ dịch thuật cho trang ${index + 1}.`);
      return null;
    } finally {
      if (!isProcessingAll) setIsProcessing(false);
    }
  };

  const handleSingleProcess = async () => {
    const result = await processImage();
    if (result) {
      const newResults = [...results];
      newResults[activeIndex] = result;
      setResults(newResults);
      saveToHistory(result);
    }
  };

  const processAllImages = async () => {
    if (images.length === 0 || isProcessing || isProcessingAll) return;
    
    setIsProcessingAll(true);
    setIsProcessing(true);
    setProcessedCount(0);
    
    const newResults = [...results];
    
    for (let i = 0; i < images.length; i++) {
      // Only process if not already processed OR if user wants to refresh (we'll do all for "Translate All")
      // But let's skip already processed ones if we want to be efficient? 
      // Most users expect "Translate All" to fill in the blanks or redo everything.
      // Let's redo everything for simplicity/consistency as standard "Batch" behavior.
      
      setActiveIndex(i); // Move focus as we process
      const result = await processImage(i);
      
      if (result) {
        newResults[i] = result;
        setResults([...newResults]); // Update UI incrementally
        saveToHistory(result);
      } else {
        // If one fails and it's a quota error, we might want to stop
        // For now, let's just continue
      }
      setProcessedCount(i + 1);
    }
    
    setIsProcessingAll(false);
    setIsProcessing(false);
    setProgress(0);
  };

  const currentImage = images[activeIndex];
  const currentResult = results[activeIndex];

  return (
    <div className={`min-h-screen ${cPageBg} ${cSelection} font-sans flex flex-col h-screen overflow-hidden`}>
      
      {/* Settings Overlay */}
      <AnimatePresence>
        {isSettingsOpen && (
          <>
            <motion.div 
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => setIsSettingsOpen(false)}
              className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[100]"
            />
            <motion.div 
              initial={{ x: "-100%" }} animate={{ x: 0 }} exit={{ x: "-100%" }}
              className={`fixed inset-y-0 left-0 w-full max-w-sm ${cPanelBg} ${cBorderR} z-[101] shadow-2xl flex flex-col`}
            >
              <div className="p-4 md:p-6 border-b border-[#141414] flex justify-between items-center bg-[#141414] text-[#E4E3E0]">
                <h2 className="font-bold text-sm uppercase tracking-tight">Cấu hình bản dịch</h2>
                <button onClick={() => setIsSettingsOpen(false)} className="hover:rotate-90 transition-transform"><X size={20}/></button>
              </div>

              <div className="flex-1 overflow-y-auto p-6 space-y-8">
                {/* Language Selection */}
                <div className="space-y-4">
                  <div className="flex items-center gap-2">
                    <Languages size={16} className="text-blue-600" />
                    <span className="text-xs font-bold uppercase">Dịch sang ngôn ngữ</span>
                  </div>
                  <div className={`relative ${cBorder2} ${cInputBg}`}>
                    <select 
                      value={targetLanguage}
                      onChange={(e) => setTargetLanguage(e.target.value)}
                      className="w-full p-3 text-xs font-bold bg-transparent outline-none appearance-none cursor-pointer"
                    >
                      <option value="Vietnamese" className={isDarkMode ? "bg-[#22221F]" : ""}>Tiếng Việt (VIE)</option>
                      <option value="English" className={isDarkMode ? "bg-[#22221F]" : ""}>Tiếng Anh (ENG)</option>
                      <option value="French" className={isDarkMode ? "bg-[#22221F]" : ""}>Tiếng Pháp (FRA)</option>
                      <option value="Spanish" className={isDarkMode ? "bg-[#22221F]" : ""}>Tiếng Tây Ban Nha (ESP)</option>
                      <option value="Japanese" className={isDarkMode ? "bg-[#22221F]" : ""}>Tiếng Nhật (JPN)</option>
                    </select>
                    <ChevronRight size={14} className="absolute right-3 top-1/2 -translate-y-1/2 rotate-90 pointer-events-none" />
                  </div>
                </div>

                {/* Tone of Translation Selection */}
                <div className="space-y-4">
                  <div className="flex items-center gap-2">
                    <Sparkles size={16} className="text-purple-600" />
                    <span className="text-xs font-bold uppercase">Giọng điệu dịch thuật</span>
                  </div>
                  <div className={`relative ${cBorder2} ${cInputBg}`}>
                    <select 
                      value={translationTone}
                      onChange={(e) => setTranslationTone(e.target.value)}
                      className="w-full p-3 text-xs font-bold bg-transparent outline-none appearance-none cursor-pointer"
                    >
                      <option value="standard" className={isDarkMode ? "bg-[#22221F]" : ""}>Mặc định (Tự nhiên)</option>
                      <option value="cute" className={isDarkMode ? "bg-[#22221F]" : ""}>Đáng yêu / Cute (Trẻ trung, ngọt ngào)</option>
                      <option value="formal" className={isDarkMode ? "bg-[#22221F]" : ""}>Trang trọng / Lịch sự (Nghiêm túc)</option>
                      <option value="humorous" className={isDarkMode ? "bg-[#22221F]" : ""}>Hài hước / Lầy lội (Bắt trend)</option>
                      <option value="hentai" className={isDarkMode ? "bg-[#22221F]" : ""}>🔞 Hentai / Gợi cảm (18+, nồng nhiệt, khêu gợi)</option>
                    </select>
                    <ChevronRight size={14} className="absolute right-3 top-1/2 -translate-y-1/2 rotate-90 pointer-events-none" />
                  </div>
                  {translationTone === "hentai" && (
                    <p className="text-[9px] text-[#FF007F] font-bold italic leading-tight animate-pulse">
                      * Chế độ 18+: Dịch thoát ý quyến rũ, nũng nịu nồng nhiệt, đầy khiêu khích và gợi cảm, rất thích hợp cho doujinshi/manga người lớn.
                    </p>
                  )}
                </div>

                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Key size={16} className="text-orange-600" />
                      <span className="text-xs font-bold uppercase">Mã API Gemini</span>
                    </div>
                    <a 
                      href="https://aistudio.google.com/app/apikey" 
                      target="_blank" 
                      rel="noreferrer"
                      className="text-[10px] font-black text-blue-600 hover:underline flex items-center gap-1"
                    >
                      LẤY MÃ MIỄN PHÍ <Scan size={10} />
                    </a>
                  </div>
                  <input 
                    type="password" 
                    value={customApiKey}
                    onChange={(e) => setCustomApiKey(e.target.value)}
                    placeholder="Dán mã API cá nhân (Dùng hạn mức riêng)..."
                    className={`w-full p-3 text-xs outline-none focus:bg-orange-50/10 transition-colors ${cBorder2} ${cInputBg}`}
                  />
                  <p className="text-[9px] opacity-50 italic leading-tight">
                    * Nếu hạn mức mặc định đã hết, hãy tạo API Key riêng tại Google AI Studio để tiếp tục sử dụng miễn phí.
                  </p>
                </div>

                <div className="space-y-4">
                  <div className="flex items-center gap-2">
                    <Clock size={16} className="text-purple-600" />
                    <span className="text-xs font-bold uppercase">Xưng hô nhất quán</span>
                  </div>
                  <textarea 
                    value={pronounSettings}
                    onChange={(e) => setPronounSettings(e.target.value)}
                    placeholder="Ví dụ: Nhân vật chính nam (A) gọi nữ (B) là 'em', B gọi A là 'anh'. C là kẻ địch gọi A là 'ngươi'..."
                    className={`w-full h-24 p-3 text-xs outline-none focus:bg-purple-50/10 transition-colors resize-none ${cBorder2} ${cInputBg}`}
                  />
                  <p className="text-[9px] opacity-50 italic">
                    * Giúp AI giữ cách xưng hô ổn định giữa các trang truyện.
                  </p>
                </div>

                <div className="space-y-4">
                  <div className="flex items-center gap-2">
                    <Info size={16} />
                    <span className="text-xs font-bold uppercase">Bối cảnh truyện (Gợi ý cho AI)</span>
                  </div>
                  <textarea 
                    value={userPrompt}
                    onChange={(e) => setUserPrompt(e.target.value)}
                    placeholder="Ví dụ: Nhân vật là kiếm sĩ, văn phong cổ trang..."
                    className={`w-full h-32 p-3 text-xs outline-none focus:bg-blue-50/10 transition-colors resize-none ${cBorder2} ${cInputBg}`}
                  />
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* History Overlay */}
      <AnimatePresence>
        {showHistory && (
          <>
            <motion.div 
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => setShowHistory(false)}
              className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[100]"
            />
            <motion.div 
              initial={{ x: "100%" }} animate={{ x: 0 }} exit={{ x: "100%" }}
              className={`fixed inset-y-0 right-0 w-full max-w-sm ${cPanelBg} ${cBorderL} z-[101] shadow-2xl flex flex-col`}
            >
              <div className="p-4 md:p-6 border-b border-[#141414] flex justify-between items-center bg-[#141414] text-[#E4E3E0]">
                <h2 className="font-bold text-sm uppercase tracking-tight">Lịch sử bản dịch</h2>
                <div className="flex items-center gap-2">
                  {history.length > 0 && (
                    <button 
                      onClick={clearHistory}
                      className="p-2 hover:bg-red-500 transition-colors text-red-500 hover:text-white"
                      title="Xoá tất cả"
                    >
                      <Trash2 size={16} />
                    </button>
                  )}
                  <button onClick={() => setShowHistory(false)}><X size={20}/></button>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto p-4 space-y-3">
                {history.length > 0 ? history.map((item) => (
                  <div 
                    key={item.id}
                    onClick={() => {
                      setImages([item.imagePreview || ""]);
                      setResults([item]);
                      setActiveIndex(0);
                      setShowHistory(false);
                    }}
                    className={`border-2 p-3 cursor-pointer transition-all group relative ${cBorder} ${cCardBg} hover:bg-[#141414] hover:text-white dark:hover:bg-white dark:hover:text-black`}
                  >
                    <div className="flex justify-between items-start mb-2">
                      <span className="text-[10px] font-mono opacity-50">
                        {new Date(item.timestamp).toLocaleString("vi-VN")}
                      </span>
                      <button 
                        onClick={(e) => deleteHistoryItem(item.id, e)}
                        className="text-red-500 opacity-0 group-hover:opacity-100 transition-opacity p-1"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                    <p className="text-xs font-bold truncate uppercase">{item.scene_context || "Truyện không tên"}</p>
                    <div className="mt-2 text-[10px] opacity-40 font-bold italic">
                      {item.total_bubbles} ô thoại được dịch
                    </div>
                  </div>
                )) : (
                  <div className={`h-full flex flex-col items-center justify-center opacity-30 ${cText}`}>
                    <History size={40} strokeWidth={1} />
                    <p className="mt-4 text-xs font-bold uppercase tracking-widest">Chưa có dữ liệu</p>
                  </div>
                )}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Header */}
      <header className={`${cBorderB} p-2 md:p-4 ${cPageBg} flex justify-between items-center shrink-0 z-50`}>
        <div className="flex items-center gap-2">
          <button 
            onClick={() => setIsSettingsOpen(true)}
            className={`p-2 border-2 ${cBorder} ${cBtnHover} transition-all`}
            title="Cấu hình"
          >
            <Menu size={18} />
          </button>
          
          <div className="flex items-center gap-2 ml-2">
            <div className={`relative w-8.5 h-8.5 rounded-full border-2 ${cBorder} flex items-center justify-center font-black tracking-tighter text-[11px] shadow-md overflow-hidden bg-gradient-to-tr from-[#3B82F6] via-[#EC4899] to-[#F59E0B] text-white`}>
              <span className="italic relative z-10 select-none">MIO</span>
              <div className="absolute inset-0 bg-black/10 mix-blend-overlay" />
            </div>
            <h1 className="font-black uppercase tracking-tighter text-xs md:text-sm">MioManga</h1>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Sáng / Tối Button */}
          <button 
            onClick={() => setIsDarkMode(!isDarkMode)}
            className={`p-2 border-2 ${cBorder} ${cBtnHover} transition-all`}
            title={isDarkMode ? "Chế độ Sáng" : "Chế độ Tối"}
          >
            {isDarkMode ? <Sun size={18} /> : <Moon size={18} />}
          </button>

          {/* Toàn màn hình Button */}
          <button 
            onClick={toggleFullscreen}
            className={`p-2 border-2 ${cBorder} ${cBtnHover} transition-all`}
            title={isFullscreen ? "Thu nhỏ" : "Toàn màn hình"}
          >
            {isFullscreen ? <Minimize size={18} /> : <Maximize size={18} />}
          </button>

          <button 
            onClick={() => setShowHistory(true)}
            className={`p-2 border-2 ${cBorder} ${cBtnHover} transition-all`}
            title="Xem lịch sử"
          >
            <Clock size={18} />
          </button>

          <button 
            onClick={() => fileInputRef.current?.click()}
            className={`flex items-center gap-1.5 px-4 py-2 text-[10px] md:text-xs font-black uppercase hover:opacity-90 active:scale-95 transition-all ${cPrimaryBtn}`}
          >
            {currentImage ? <RotateCcw size={14} /> : <Upload size={14} />}
            <span>{currentImage ? "Đổi bộ ảnh" : "Tải bộ ảnh lên (Tối đa 10)"}</span>
          </button>
          <input type="file" ref={fileInputRef} onChange={handleImageUpload} className="hidden" accept="image/*" multiple />
        </div>
      </header>

      {/* Main Container */}
      <main className="flex-1 flex flex-col lg:flex-row overflow-hidden relative">
        
        {/* Workspace Canvas */}
        <section className={`flex-1 ${cCanvasBg} border-b lg:border-b-0 lg:${cBorderR} ${cBorderB} relative flex flex-col shadow-inner min-h-0 lg:shrink h-full overflow-hidden`}>
          
          {/* Viewing Area */}
          <div className={`flex-1 relative flex items-center justify-center p-2 md:p-6 min-h-0 ${cCanvasBg}`}>
            {!currentImage ? (
              <div className="text-center space-y-6">
                <div 
                  className={`w-32 h-32 md:w-48 md:h-48 border-4 border-dashed rounded-xl mx-auto flex items-center justify-center cursor-pointer transition-colors ${isDarkMode ? "border-[#E4E3E0]/20 hover:border-[#E4E3E0]/40" : "border-[#141414]/20 hover:border-[#141414]/40"}`}
                  onClick={() => fileInputRef.current?.click()}
                >
                  <Upload size={48} strokeWidth={1} className="opacity-20" />
                </div>
                <p className="text-[10px] md:text-xs font-black uppercase tracking-[0.3em] opacity-30">Chọn tối đa 10 ảnh để bắt đầu</p>
              </div>
            ) : (
              <div className={`relative shadow-2xl ${cBorder2} ${cCardBg} overflow-hidden flex items-center justify-center`}>
                <div className="relative inline-block max-w-full max-h-full p-0">
                  <img 
                    ref={imageRef} 
                    src={currentImage} 
                    alt="Manga Preview" 
                    className="max-w-full max-h-[calc(100vh-280px)] lg:max-h-[calc(100vh-180px)] block object-contain" 
                  />
                  
                  {/* Overlays */}
                  {currentResult && showOverlays && currentResult.bubbles.map((bubble) => (
                    <div 
                      key={bubble.bubble_id}
                      className={`absolute border-2 transition-all duration-300 cursor-pointer ${
                        hoveredBubble === bubble.bubble_id || selectedBubble?.bubble_id === bubble.bubble_id
                          ? "border-blue-500 bg-blue-500/10 z-20 shadow-[0_0_20px_rgba(59,130,246,0.3)]" 
                          : isDarkMode ? "border-white/10 bg-white/2" : "border-[#141414]/20 bg-black/2"
                      }`}
                      style={{
                        left: `${bubble.bounding_box.x / 10}%`,
                        top: `${bubble.bounding_box.y / 10}%`,
                        width: `${bubble.bounding_box.width / 10}%`,
                        height: `${bubble.bounding_box.height / 10}%`,
                      }}
                      onMouseEnter={() => setHoveredBubble(bubble.bubble_id)}
                      onMouseLeave={() => setHoveredBubble(null)}
                      onClick={() => setSelectedBubble(bubble)}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* Bubble Details Modal */}
            <AnimatePresence>
              {selectedBubble && (
                <motion.div 
                  initial={{ opacity: 0, scale: 0.9, y: 10 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.9, y: 10 }}
                  className={`absolute z-[100] bottom-4 left-4 right-4 md:left-auto md:right-4 md:w-80 border-2 shadow-2xl p-4 flex flex-col gap-3 ${cBorder} ${cCardBg}`}
                >
                  <div className="flex justify-between items-center bg-[#141414] text-white -m-4 mb-0 p-3">
                    <span className="text-[10px] font-black italic">CHI TIẾT Ô THOẠI #{selectedBubble.bubble_id}</span>
                    <button onClick={() => setSelectedBubble(null)} className="hover:scale-110 transition-transform"><X size={16} /></button>
                  </div>
                  <div className="space-y-4 pt-2">
                    <div className="space-y-1">
                      <span className="text-[9px] font-black uppercase opacity-40">Nguyên văn:</span>
                      <p className={`text-[11px] p-2 italic leading-relaxed ${isDarkMode ? "bg-white/5" : "bg-black/5"}`}>{selectedBubble.original_text}</p>
                    </div>
                    <div className="space-y-1">
                      <span className="text-[9px] font-black uppercase text-blue-500">Bản dịch:</span>
                      <div className="relative">
                        <p className="text-xs font-black p-2 border-2 border-dashed border-blue-500 leading-tight pr-10">{selectedBubble.translated_text}</p>
                        <button 
                          onClick={() => copyToClipboard(selectedBubble.translated_text)}
                          className="absolute right-2 top-1/2 -translate-y-1/2 p-2 hover:bg-blue-50/10 transition-colors text-blue-500"
                          title="Sao chép"
                        >
                          {copyStatus ? <span className="text-[8px] font-black absolute -top-8 right-0 bg-blue-600 text-white p-1 whitespace-nowrap">{copyStatus}</span> : null}
                          <Scan size={14} />
                        </button>
                      </div>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
          
          {/* Dedicated Controls Toolbar */}
          {currentImage && (
            <div className={`${cPanelBg} ${cBorderT2} p-3 md:p-4 z-40`}>
              <div className="max-w-2xl mx-auto flex flex-col gap-2">
                {/* Progress Bar */}
                {isProcessing && (
                  <div className={`h-1.5 w-full overflow-hidden rounded-full ${isDarkMode ? "bg-[#E4E3E0]/10" : "bg-[#141414]/10"}`}>
                    <motion.div 
                      className="h-full bg-blue-600"
                      initial={{ width: 0 }}
                      animate={{ width: `${progress}%` }}
                    />
                  </div>
                )}
                
                <div className="flex items-center gap-2">
                  {/* Image Actions */}
                  <div className={`flex items-center border-2 rounded-sm overflow-hidden h-10 md:h-12 ${cBorder} ${cCardBg}`}>
                    <button 
                      onClick={() => setShowOverlays(!showOverlays)} 
                      className={`px-4 h-full transition-colors ${showOverlays ? 'bg-[#141414] text-white dark:bg-[#E4E3E0] dark:text-[#171714]' : 'hover:bg-[#141414]/10 dark:hover:bg-white/10'}`}
                      title={showOverlays ? "Ẩn bản dịch" : "Hiện bản dịch"}
                    >
                      {showOverlays ? <Eye size={18} /> : <EyeOff size={18} />}
                    </button>
                    <button 
                      onClick={resetCanvas}
                      className={`px-4 h-full hover:bg-red-500 hover:text-white transition-colors border-l-2 ${cBorder}`}
                      title="Xóa bộ ảnh"
                    >
                      <Trash2 size={18} />
                    </button>
                  </div>

                  {/* Navigation */}
                  {images.length > 1 && (
                    <div className={`flex-1 flex items-center justify-between px-2 h-10 md:h-12 border-2 rounded-sm ${cBorder} ${cCardBg}`}>
                      <button 
                        disabled={activeIndex === 0 || isProcessing}
                        onClick={() => setActiveIndex(prev => prev - 1)}
                        className={`p-2 disabled:opacity-20 transition-all transform active:scale-95 ${cBtnHover}`}
                      >
                        <ChevronRight size={18} className="rotate-180" />
                      </button>
                      <div className="flex flex-col items-center">
                        <span className="text-[10px] md:text-xs font-black uppercase tracking-widest">
                          Trang {activeIndex + 1} / {images.length}
                        </span>
                      </div>
                      <button 
                        disabled={activeIndex === images.length - 1 || isProcessing}
                        onClick={() => setActiveIndex(prev => prev + 1)}
                        className={`p-2 disabled:opacity-20 transition-all transform active:scale-95 ${cBtnHover}`}
                      >
                        <ChevronRight size={18} />
                      </button>
                    </div>
                  )}

                  {/* Main Action Group */}
                  <div className="flex items-center gap-1 flex-1 md:flex-none">
                    <button 
                      onClick={handleSingleProcess}
                      disabled={isProcessing}
                      className={`flex-1 h-10 md:h-12 px-4 text-[10px] font-black uppercase flex items-center justify-center gap-2 hover:opacity-90 transition-all active:scale-95 disabled:opacity-50 ${cPrimaryBtn}`}
                    >
                      {isProcessing && !isProcessingAll ? <Loader2 size={14} className="animate-spin" /> : <Languages size={14} />}
                      <span>{currentResult ? "Dịch lại" : "Dịch trang"}</span>
                    </button>

                    {images.length > 1 && (
                      <button 
                        onClick={processAllImages}
                        disabled={isProcessing}
                        className="flex-1 h-10 md:h-12 px-4 bg-blue-600 text-white text-[10px] font-black uppercase flex items-center justify-center gap-2 hover:opacity-90 transition-all active:scale-95 disabled:opacity-50 border-l border-white/20"
                      >
                        {isProcessingAll ? <Loader2 size={14} className="animate-spin" /> : <Scan size={14} />}
                        <span>Dịch tất cả</span>
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {isProcessing && (
             <div className="absolute inset-0 bg-white/10 dark:bg-black/10 backdrop-blur-[1px] z-30 pointer-events-none" />
          )}
        </section>

        {/* Results Sidebar */}
        <aside className={`w-full lg:w-[450px] ${cResultSidebar} ${cBorderL} flex flex-col h-[30vh] lg:h-auto overflow-hidden shrink-0`}>
          <div className="bg-black text-[#F0F0ED] p-4 flex justify-between items-center shrink-0">
            <h2 className="text-[10px] font-black uppercase tracking-widest flex items-center gap-2">
              <Clock size={12} /> Dữ liệu đã trích xuất
            </h2>
            {currentResult && <div className="text-[10px] font-mono font-bold">{currentResult.total_bubbles} Ô THOẠI</div>}
          </div>

          <div className={`flex-1 overflow-y-auto divide-y-2 ${cDivide}`}>
            {currentResult ? (
              <>
                <div className={`p-4 border-b-2 ${cBorder} ${isDarkMode ? "bg-blue-950/20" : "bg-blue-50"}`}>
                   <h4 className="text-[9px] uppercase font-bold opacity-40 mb-1">Cảnh truyện:</h4>
                  <p className="text-[12px] font-black leading-tight italic">"{currentResult.scene_context || "Không có bối cảnh chi tiết."}"</p>
                </div>

                {currentResult.bubbles.map((bubble) => (
                  <div 
                    key={bubble.bubble_id}
                    className={`p-6 transition-all cursor-pointer ${
                      hoveredBubble === bubble.bubble_id || selectedBubble?.bubble_id === bubble.bubble_id 
                        ? `${isDarkMode ? "bg-white/5" : "bg-white"} border-l-[10px] border-blue-600 pl-4` 
                        : "hover:bg-white/10"
                    }`}
                    onMouseEnter={() => setHoveredBubble(bubble.bubble_id)}
                    onMouseLeave={() => setHoveredBubble(null)}
                    onClick={() => setSelectedBubble(bubble)}
                  >
                    <div className="flex justify-between items-center mb-5">
                      <span className="text-[10px] font-black px-2 py-1 bg-black text-white rounded-sm italic">PHÂN ĐOẠN #{bubble.bubble_id}</span>
                      <span className="text-[10px] uppercase font-bold opacity-30 italic">Hòa hợp: {Math.round(bubble.confidence_score * 100)}%</span>
                    </div>

                    <div className="space-y-5">
                      <div className="space-y-1.5 grayscale opacity-40 hover:grayscale-0 hover:opacity-100 transition-all cursor-default">
                         <h5 className="text-[9px] font-black uppercase tracking-tighter">Văn bản gốc JPN/ENG:</h5>
                         <p className={`text-[11px] leading-relaxed font-medium p-2 border-l ${cBorder} ${isDarkMode ? "bg-white/5" : "bg-black/5"}`}>
                          {bubble.original_text}
                        </p>
                      </div>
                      <div className="space-y-1.5">
                        <h5 className="text-[9px] font-black uppercase tracking-tighter text-blue-600">Bản dịch yêu cầu ({targetLanguage}):</h5>
                        <p className={`text-sm font-black leading-snug tracking-tight ${cText}`}>
                          {bubble.translated_text}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </>
            ) : (
              <div className="h-full flex flex-col items-center justify-center p-12 opacity-10 space-y-4">
                <Languages size={80} strokeWidth={0.5} />
                <div className="text-center">
                  <p className="text-xs font-black uppercase tracking-widest">Sẵn sàng phiên dịch</p>
                  <p className="text-[10px] mt-2 italic">Tải ảnh lên và nhấn "Dịch ngay" để bắt đầu</p>
                </div>
              </div>
            )}
          </div>

          {/* Footer */}
          <footer className="p-3 bg-black text-[#F0F0ED] flex justify-between items-center text-[9px] font-bold uppercase shrink-0">
            <div className="flex items-center gap-2">
              <div className={`w-2 h-2 rounded-full ${isProcessing ? 'bg-blue-400 animate-pulse' : 'bg-green-500'}`} />
              <span className="opacity-60">{isProcessing ? 'Đang thực thi thuật toán...' : 'Máy chủ sẵn sàng'}</span>
            </div>
            <span className="opacity-40 italic">{new Date().toLocaleTimeString("vi-VN")}</span>
          </footer>
        </aside>

      </main>
    </div>
  );
}
