import React, { useState, useRef, useEffect } from "react";
import { 
  Upload, Languages, Scan, ChevronRight, Loader2, 
  Info, Eye, EyeOff, Menu, X, Key, RotateCcw, Clock, History, Trash2,
  Sparkles, Sun, Moon, Maximize, Minimize, Folder, FolderPlus, Plus, AlertTriangle,
  Download, BookOpen, FileText, Check, Image as ImageIcon
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
  custom_font_size?: number;
  custom_offset?: number;
}

interface MangaProject {
  id: string;
  name: string;
  description?: string;
  timestamp: number;
}

interface MangaResult {
  total_bubbles: number;
  scene_context: string;
  bubbles: Bubble[];
  timestamp: number;
  id: string;
  imagePreview?: string;
  projectId?: string;
}

interface ParsedScriptBubble {
  id: string;
  page?: string;
  original?: string;
  translated?: string;
  location?: string;
  confidence?: string;
}

interface ParsedScriptPage {
  pageNumber: string;
  context: string;
  bubbles: ParsedScriptBubble[];
}

interface ParsedScript {
  title: string;
  description?: string;
  targetLang?: string;
  pages: ParsedScriptPage[];
  rawText: string;
}

export default function App() {
  // Manga Projects States
  const [projects, setProjects] = useState<MangaProject[]>(() => {
    const saved = localStorage.getItem("miomanga_projects");
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed;
        }
      } catch (e) {
        console.error("Lỗi đọc projects từ localStorage", e);
      }
    }
    return [
      {
        id: "default",
        name: "Dự án Mặc định",
        description: "Nơi lưu trữ chung khi chưa phân loại",
        timestamp: Date.now()
      }
    ];
  });

  const [currentProjectId, setCurrentProjectId] = useState<string>(() => {
    return localStorage.getItem("miomanga_current_project_id") || "default";
  });

  const [filterProjectId, setFilterProjectId] = useState<string>("all");
  const [newProjectName, setNewProjectName] = useState("");
  const [newProjectDesc, setNewProjectDesc] = useState("");
  const [isCreatingProject, setIsCreatingProject] = useState(false);

  // Custom Confirm Dialog State
  const [confirmDialog, setConfirmDialog] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
  }>({
    isOpen: false,
    title: "",
    message: "",
    onConfirm: () => {}
  });

  // Script Viewer States
  const [scriptDialog, setScriptDialog] = useState<{
    isOpen: boolean;
    parsed: ParsedScript | null;
  }>({
    isOpen: false,
    parsed: null
  });
  const [scriptViewPageIdx, setScriptViewPageIdx] = useState<number>(0);

  const triggerConfirm = (title: string, message: string, onConfirm: () => void) => {
    setConfirmDialog({
      isOpen: true,
      title,
      message,
      onConfirm: () => {
        onConfirm();
        setConfirmDialog(p => ({ ...p, isOpen: false }));
      }
    });
  };

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
  const [editingText, setEditingText] = useState("");
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [history, setHistory] = useState<MangaResult[]>([]);
  const [progress, setProgress] = useState(0);
  const [copyStatus, setCopyStatus] = useState<string | null>(null);

  // Custom Image Export configuration settings
  const [exportSettingsOpen, setExportSettingsOpen] = useState(false);
  const [exportFontFamily, setExportFontFamily] = useState(() => 
    localStorage.getItem("miomanga_export_font") || '"Inter", "Helvetica Neue", Arial, sans-serif'
  );
  const [exportFontSizeScale, setExportFontSizeScale] = useState(() => {
    const saved = localStorage.getItem("miomanga_export_font_size_scale");
    return saved ? parseInt(saved, 10) : 100;
  });
  const [exportDrawBorders, setExportDrawBorders] = useState<boolean>(() => {
    const saved = localStorage.getItem("miomanga_export_draw_borders");
    return saved === "true"; // default is false (borderless)
  });
  const [exportBubbleShape, setExportBubbleShape] = useState<string>(() => 
    localStorage.getItem("miomanga_export_bubble_shape") || "ellipse"
  );
  const [exportBubbleOffset, setExportBubbleOffset] = useState<number>(() => {
    const saved = localStorage.getItem("miomanga_export_bubble_offset");
    return saved ? parseInt(saved, 10) : 5; // default +5px to clear text perfectly without leakage
  });
  const [exportBorderWidth, setExportBorderWidth] = useState<number>(() => {
    const saved = localStorage.getItem("miomanga_export_border_width");
    return saved ? parseFloat(saved) : 2; // default 2px stroke to draw fresh outline
  });
  const [uploadedFonts, setUploadedFonts] = useState<string[]>(() => {
    const saved = localStorage.getItem("miomanga_uploaded_fonts");
    try {
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const [editingFontSizeScaleCustom, setEditingFontSizeScaleCustom] = useState<number>(100);
  const [editingOffsetCustom, setEditingOffsetCustom] = useState<number>(5);

  // Translation AbortController Ref
  const abortControllerRef = useRef<AbortController | null>(null);
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const fontFileInputRef = useRef<HTMLInputElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);

  const handleFontFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    const file = files[0];
    
    // derive clean font family name
    const cleanName = file.name.substring(0, file.name.lastIndexOf('.')).replace(/[^a-zA-Z0-9\s-_]/g, "").trim() || "UploadedFont";
    
    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const result = event.target?.result as ArrayBuffer;
        if (!result) return;
        
        const fontFace = new FontFace(cleanName, result);
        const loadedFace = await fontFace.load();
        (document as any).fonts.add(loadedFace);
        
        // Update custom uploaded fonts state
        setUploadedFonts(prev => {
          if (prev.includes(cleanName)) return prev;
          return [...prev, cleanName];
        });
        
        // Set uploaded font as current chosen export font family
        setExportFontFamily(`"${cleanName}", sans-serif`);
        alert(`Đã tải và nạp phông chữ thành công: "${cleanName}"`);
      } catch (err) {
        console.error("Lỗi nạp file font:", err);
        alert("Có lỗi xảy ra khi nạp file phông chữ. Vui lòng chọn file .ttf, .otf hoặc .woff chuẩn.");
      }
    };
    reader.readAsArrayBuffer(file);
  };

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

  useEffect(() => {
    localStorage.setItem("miomanga_projects", JSON.stringify(projects));
  }, [projects]);

  useEffect(() => {
    localStorage.setItem("miomanga_current_project_id", currentProjectId);
  }, [currentProjectId]);

  // Synchronize export image font family and scale settings
  useEffect(() => {
    localStorage.setItem("miomanga_export_font", exportFontFamily);
  }, [exportFontFamily]);

  useEffect(() => {
    localStorage.setItem("miomanga_export_font_size_scale", exportFontSizeScale.toString());
  }, [exportFontSizeScale]);

  useEffect(() => {
    localStorage.setItem("miomanga_export_draw_borders", exportDrawBorders.toString());
  }, [exportDrawBorders]);

  useEffect(() => {
    localStorage.setItem("miomanga_export_bubble_shape", exportBubbleShape);
  }, [exportBubbleShape]);

  useEffect(() => {
    localStorage.setItem("miomanga_export_bubble_offset", exportBubbleOffset.toString());
  }, [exportBubbleOffset]);

  useEffect(() => {
    localStorage.setItem("miomanga_export_border_width", exportBorderWidth.toString());
  }, [exportBorderWidth]);

  useEffect(() => {
    localStorage.setItem("miomanga_uploaded_fonts", JSON.stringify(uploadedFonts));
  }, [uploadedFonts]);

  // Synchronize editing text when bubble selection changes
  useEffect(() => {
    if (selectedBubble) {
      setEditingText(selectedBubble.translated_text);
      setEditingFontSizeScaleCustom(selectedBubble.custom_font_size || 100);
      setEditingOffsetCustom(selectedBubble.custom_offset !== undefined ? selectedBubble.custom_offset : exportBubbleOffset);
    } else {
      setEditingText("");
      setEditingFontSizeScaleCustom(100);
      setEditingOffsetCustom(5);
    }
  }, [selectedBubble]);

  // Load history
  useEffect(() => {
    const saved = localStorage.getItem("miomanga_history") || localStorage.getItem("mangalens_history");
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          // Normalize existing old records to the general project if they don't have one
          const normalized = parsed.map((item: any) => ({
            ...item,
            projectId: item.projectId || "default"
          }));
          setHistory(normalized);
        }
      } catch (e) {
        console.error("Lỗi khi đọc lịch sử", e);
      }
    }
  }, []);

  const saveToHistory = (newResult: MangaResult) => {
    // Tag the record under the currently selected manga project
    const resultWithProject = {
      ...newResult,
      projectId: currentProjectId || "default"
    };
    // Upgrade database capacity from 15 elements to 100 elements!
    const updated = [resultWithProject, ...history].slice(0, 100);
    setHistory(updated);
    localStorage.setItem("miomanga_history", JSON.stringify(updated));
  };

  const deleteHistoryItem = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const item = history.find(i => i.id === id);
    const sceneLabel = item?.scene_context ? `"${item.scene_context}"` : "bản dịch này";
    
    triggerConfirm(
      "XÓA BẢN DỊCH KHỎI LỊCH SỬ",
      `Bạn có chắc chắn muốn xóa khỏi lịch sử bản dịch của ${sceneLabel}? Hành động này sẽ không thể khôi phục lại.`,
      () => {
        const updated = history.filter(item => item.id !== id);
        setHistory(updated);
        localStorage.setItem("miomanga_history", JSON.stringify(updated));
      }
    );
  };

  const clearHistory = () => {
    triggerConfirm(
      "XÓA TOÀN BỘ LỊCH SỬ",
      "Bạn có chắc chắn muốn xóa toàn bộ lịch sử bản dịch? Hành động này sẽ xóa vĩnh viễn dữ liệu thuộc mọi dự án và không thể khôi phục.",
      () => {
        setHistory([]);
        localStorage.removeItem("miomanga_history");
        localStorage.removeItem("mangalens_history");
      }
    );
  };

  const createNewProject = () => {
    if (!newProjectName.trim()) return;
    const newProj: MangaProject = {
      id: "project_" + Math.random().toString(36).substr(2, 9),
      name: newProjectName.trim(),
      description: newProjectDesc.trim(),
      timestamp: Date.now()
    };
    setProjects(prev => [...prev, newProj]);
    setCurrentProjectId(newProj.id);
    setNewProjectName("");
    setNewProjectDesc("");
    setIsCreatingProject(false);
  };

  const deleteProject = (projectId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (projectId === "default") return;

    const projName = projects.find(p => p.id === projectId)?.name || "";
    triggerConfirm(
      "XÁC NHẬN XÓA DỰ ÁN",
      `Bạn có chắc chắn muốn xóa dự án "${projName}"? Toàn bộ các bản dịch trong lịch sử thuộc dự án này sẽ được tự động chuyển về "Dự án Mặc định" để phân loại lại.`,
      () => {
        setProjects(prev => prev.filter(p => p.id !== projectId));
        const updatedHistory = history.map(item => {
          if ((item.projectId || "default") === projectId) {
            return { ...item, projectId: "default" };
          }
          return item;
        });
        setHistory(updatedHistory);
        localStorage.setItem("miomanga_history", JSON.stringify(updatedHistory));
        if (currentProjectId === projectId) {
          setCurrentProjectId("default");
        }
      }
    );
  };

  const [isExportingImage, setIsExportingImage] = useState(false);

  const updateBubbleTranslation = (pageResultId: string, bubbleId: number, updatedText: string, customFontSize?: number, customOffset?: number) => {
    // 1. Update results state
    const updatedResults = results.map(res => {
      if (res && res.id === pageResultId) {
        return {
          ...res,
          bubbles: res.bubbles.map(b => b.bubble_id === bubbleId ? { ...b, translated_text: updatedText, custom_font_size: customFontSize, custom_offset: customOffset } : b)
        };
      }
      return res;
    });
    setResults(updatedResults);

    // 2. Update history state
    const updatedHistory = history.map(item => {
      if (item.id === pageResultId) {
        return {
          ...item,
          bubbles: item.bubbles.map(b => b.bubble_id === bubbleId ? { ...b, translated_text: updatedText, custom_font_size: customFontSize, custom_offset: customOffset } : b)
        };
      }
      return item;
    });
    setHistory(updatedHistory);
    localStorage.setItem("miomanga_history", JSON.stringify(updatedHistory));

    // 3. Update active selectedBubble if it is the one being edited
    if (selectedBubble && selectedBubble.bubble_id === bubbleId) {
      setSelectedBubble(prev => prev ? { ...prev, translated_text: updatedText, custom_font_size: customFontSize, custom_offset: customOffset } : null);
    }
  };

  const exportTranslatedPageImage = (result: MangaResult, imageSrc: string, pageIndex: number) => {
    if (isExportingImage) return;
    setIsExportingImage(true);
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.src = imageSrc;
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        setIsExportingImage(false);
        return;
      }

      // 1. Draw base manga page
      ctx.drawImage(img, 0, 0);

      // 2. Clear old text and draw translated text inside bubbles
      result.bubbles.forEach(bubble => {
        const x = (bubble.bounding_box.x / 1000) * img.naturalWidth;
        const y = (bubble.bounding_box.y / 1000) * img.naturalHeight;
        const w = (bubble.bounding_box.width / 1000) * img.naturalWidth;
        const h = (bubble.bounding_box.height / 1000) * img.naturalHeight;

        // 2a. Draw the white masking background based on selected shape
        ctx.fillStyle = "#FFFFFF";
        ctx.beginPath();
        const pad = bubble.custom_offset !== undefined ? bubble.custom_offset : exportBubbleOffset; // expand or shrink
        
        if (exportBubbleShape === "ellipse") {
          const cx = x + w / 2;
          const cy = y + h / 2;
          const rx = Math.max(2, w / 2 + pad);
          const ry = Math.max(2, h / 2 + pad);
          ctx.ellipse(cx, cy, rx, ry, 0, 0, 2 * Math.PI);
        } else if (exportBubbleShape === "roundrect") {
          const nx = x - pad;
          const ny = y - pad;
          const nw = Math.max(1, w + 2 * pad);
          const nh = Math.max(1, h + 2 * pad);
          const r = Math.max(0, Math.min(nw, nh, 12));
          const anyCtx = ctx as any;
          if (anyCtx.roundRect) {
            anyCtx.roundRect(nx, ny, nw, nh, r);
          } else {
            ctx.rect(nx, ny, nw, nh);
          }
        } else {
          // simple rectangle
          const nx = x - pad;
          const ny = y - pad;
          const nw = Math.max(1, w + 2 * pad);
          const nh = Math.max(1, h + 2 * pad);
          ctx.rect(nx, ny, nw, nh);
        }
        ctx.fill();

        // 2b. Redraw bubble borders with custom width to prevent "eating" original manga borders
        if (exportDrawBorders && exportBorderWidth > 0) {
          ctx.strokeStyle = "#000000";
          ctx.lineWidth = exportBorderWidth;
          ctx.stroke();
        }

        // Draw translated text centered
        ctx.fillStyle = "#000000";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";

        const textStr = (bubble.translated_text || "").trim();
        
        const drawWrappedText = (text: string, tx: number, ty: number, tw: number, th: number) => {
          if (!text) return;
          const words = text.split(/\s+/);
          
          // Use dynamic padding inside the bubble so text does not stick to physical borders
          // Leave about 12% horizontal and 12% vertical padding
          const paddingX = Math.max(8, Math.round(tw * 0.12));
          const paddingY = Math.max(8, Math.round(th * 0.12));
          const maxW = tw - paddingX * 2;
          const maxH = th - paddingY * 2;
          
          // Guide starting bounds for font search - apply scale multiplier
          const bubbleMultiplier = (bubble.custom_font_size || 100) / 100;
          const scaleMultiplier = (exportFontSizeScale / 100) * bubbleMultiplier;
          
          // Minimum legible font relative to image height:
          const minFontSize = Math.max(6, Math.round(img.naturalHeight * 0.007 * scaleMultiplier)); 
          // Maximum realistic font scale relative to bubble dimension/image
          const maxImageFont = Math.max(12, Math.round(img.naturalHeight * 0.024 * scaleMultiplier)); 
          const maxBubbleFont = Math.min(Math.round(th * 0.45 * scaleMultiplier), Math.round(tw * 0.45 * scaleMultiplier));
          const maxFontSize = Math.max(minFontSize + 4, Math.min(maxImageFont, maxBubbleFont));

          let fontSizeToUse = maxFontSize;
          let finalLines: string[] = [];
          const lineSpacing = 1.25;

          // Search downwards from max font size to min font size to find the first layout that fits
          for (let fs = maxFontSize; fs >= minFontSize; fs--) {
            ctx.font = `bold ${fs}px ${exportFontFamily}`;
            let testLines: string[] = [];
            let currentLine = "";
            let wordTooWide = false;

            for (let i = 0; i < words.length; i++) {
              const word = words[i];
              const testLine = currentLine ? `${currentLine} ${word}` : word;
              const testWidth = ctx.measureText(testLine).width;

              if (testWidth > maxW) {
                // If current line already has content, wrap the current word to a new line
                if (currentLine) {
                  testLines.push(currentLine);
                  currentLine = word;
                  // If the single word itself is wider than maxW, keep track to reduce font
                  if (ctx.measureText(word).width > maxW) {
                    wordTooWide = true;
                  }
                } else {
                  // Single word is already wider than maxW
                  testLines.push(word);
                  currentLine = "";
                  wordTooWide = true;
                }
              } else {
                currentLine = testLine;
              }
            }
            if (currentLine) {
              testLines.push(currentLine);
            }

            const totalHeight = testLines.length * (fs * lineSpacing);
            
            // If the layout fits within the safe bounds, we accept it is appropriate!
            if (totalHeight <= maxH && !wordTooWide) {
              fontSizeToUse = fs;
              finalLines = testLines;
              break;
            }

            // Fallback at the smallest allowed font size
            if (fs === minFontSize) {
              fontSizeToUse = fs;
              finalLines = testLines;
            }
          }

          if (finalLines.length === 0) {
            finalLines = [text];
          }

          // Use the chosen font size and font family
          ctx.font = `bold ${fontSizeToUse}px ${exportFontFamily}`;
          const totalHeight = finalLines.length * (fontSizeToUse * lineSpacing);
          
          // Draw the text blocks centered inside the bounding box
          // Center vertically: start rendering lines from (ty + th/2 - totalHeight/2) + half line height offset
          const startY = ty + (th / 2) - (totalHeight / 2) + (fontSizeToUse * 0.6);
          const drawX = tx + (tw / 2);

          finalLines.forEach((line, index) => {
            ctx.fillText(line, drawX, startY + index * (fontSizeToUse * lineSpacing));
          });
        };

        drawWrappedText(textStr, x, y, w, h);
      });

      try {
        const dataUrl = canvas.toDataURL("image/png");
        const link = document.createElement("a");
        link.download = `MioManga_Dich_Trang_${pageIndex}.png`;
        link.href = dataUrl;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      } catch (err) {
        console.error("Canvas export blocked by cross-origin security:", err);
        alert("Lỗi bảo mật CORS khi xuất ảnh từ máy chủ ảnh nguồn. Vui lòng tải lên ảnh trực tiếp từ thiết bị.");
      } finally {
        setIsExportingImage(false);
      }
    };

    img.onerror = () => {
      setIsExportingImage(false);
      alert("Không tìm thấy dữ liệu ảnh gốc để tiến hành chèn lời.");
    };
  };

  // Parser for importing and reading downloaded scripts (.txt)
  const parseMioScript = (text: string): ParsedScript => {
    const result: ParsedScript = {
      title: "Kịch bản Chưa đặt tên",
      pages: [],
      rawText: text
    };

    try {
      // Decode meta details
      const projectMatch = text.match(/KỊCH BẢN TRUYỆN TRANH - DỰ ÁN:\s*(.*)/i) || text.match(/BẢN DỊCH TRANG TRUYỆN MANGA\s*\((.*?)\)/i);
      if (projectMatch && projectMatch[1]) {
        result.title = projectMatch[1].trim();
      }

      const descMatch = text.match(/Mô tả dự án:\s*(.*)/i);
      if (descMatch && descMatch[1]) {
        result.description = descMatch[1].trim();
      }

      const langMatch = text.match(/Ngôn ngữ đích:\s*(.*)/i);
      if (langMatch && langMatch[1]) {
        result.targetLang = langMatch[1].trim();
      }

      const hasMultiplePages = text.includes("📖 TRANG SỐ");

      if (hasMultiplePages) {
        // Multi-page format
        const pageSections = text.split(/📖 TRANG SỐ/i);
        pageSections.forEach((section, idx) => {
          if (idx === 0) return; // Intro section

          const lines = section.split("\n");
          const pageNumMatch = lines[0].match(/^(\d+)/);
          const pageNum = pageNumMatch ? "Trang " + pageNumMatch[1] : `Trang ${idx}`;

          // Find scene context
          let context = "";
          const contextMatch = section.match(/🎬 Bối cảnh:\s*(.*)/i) || section.match(/bối cảnh phân cảnh:\s*(.*)/i);
          if (contextMatch && contextMatch[1]) {
            context = contextMatch[1].trim();
          }

          const bubbles: ParsedScriptBubble[] = [];
          // Split by [TRANG or [Ô THOẠI
          const bubbleSections = section.split(/\[(?:TRANG|Ô THOẠI|TRANG \d+ - Ô THOẠI)/i);
          bubbleSections.forEach((bubbleSec, bIdx) => {
            if (bIdx === 0) return;

            const bLines = bubbleSec.split("\n");
            const idMatch = bLines[0].match(/#(\d+)/) || bLines[0].match(/# (\d+)/) || bLines[0].match(/(\d+)/);
            const bId = idMatch ? idMatch[1] : `${bIdx}`;

            let original = "";
            let translated = "";
            let location = "";
            let confidence = "";

            const locMatch = bubbleSec.match(/Vị trí bong bóng:\s*(.*)/i) || bubbleSec.match(/VỊ TRÍ:\s*(.*)/i);
            if (locMatch && locMatch[1]) {
              location = locMatch[1].trim();
            }

            const confMatch = bubbleSec.match(/Điểm chính xác:\s*(.*)/i) || bubbleSec.match(/CHÍNH XÁC:\s*(.*)/i);
            if (confMatch && confMatch[1]) {
              confidence = confMatch[1].trim();
            }

            // Slice out Original text between Gốc and Dịch tags
            const origMatch = bubbleSec.match(/(?:Gốc JPN\/ENG:|GỐC \(JPN\/ENG\):)\s*\n([\s\S]*?)(?=(?:👉 Bản dịch|👉 DỊCH|⭐|----------------|$))/i);
            if (origMatch && origMatch[1]) {
              original = origMatch[1].trim();
            }

            // Slice out Translated text
            const transMatch = bubbleSec.match(/(?:Bản dịch \([^)]+\):|DỊCH \([^)]+\):)\s*\n([\s\S]*?)(?=(?:⭐|----------------|$))/i);
            if (transMatch && transMatch[1]) {
              translated = transMatch[1].trim();
            }

            bubbles.push({
              id: bId,
              page: pageNum,
              original,
              translated,
              location,
              confidence
            });
          });

          result.pages.push({
            pageNumber: pageNum,
            context,
            bubbles
          });
        });
      } else {
        // Single page format
        let context = "";
        const contextMatch = text.match(/🎬 Bối cảnh phân cảnh:\s*(.*)/i) || text.match(/🎬 Bối cảnh:\s*(.*)/i);
        if (contextMatch && contextMatch[1]) {
          context = contextMatch[1].trim();
        }

        const bubbles: ParsedScriptBubble[] = [];
        const bubbleSections = text.split(/\[Ô THOẠI/i);
        bubbleSections.forEach((bubbleSec, bIdx) => {
          if (bIdx === 0) return;

          const bLines = bubbleSec.split("\n");
          const idMatch = bLines[0].match(/#(\d+)/) || bLines[0].match(/# (\d+)/) || bLines[0].match(/(\d+)/);
          const bId = idMatch ? idMatch[1] : `${bIdx}`;

          let original = "";
          let translated = "";
          let location = "";
          let confidence = "";

          const locMatch = bubbleSec.match(/VỊ TRÍ:\s*(.*)/i) || bubbleSec.match(/Vị trí bong bóng:\s*(.*)/i);
          if (locMatch && locMatch[1]) {
            location = locMatch[1].trim();
          }

          const confMatch = bubbleSec.match(/CHÍNH XÁC:\s*(.*)/i) || bubbleSec.match(/Điểm chính xác:\s*(.*)/i);
          if (confMatch && confMatch[1]) {
            confidence = confMatch[1].trim();
          }

          const origMatch = bubbleSec.match(/GỐC \(JPN\/ENG\):\s*\n([\s\S]*?)(?=(?:👉 DỊCH|----------------|$))/i);
          if (origMatch && origMatch[1]) {
            original = origMatch[1].trim();
          }

          const transMatch = bubbleSec.match(/DỊCH \([^)]+\):\s*\n([\s\S]*?)(?=(?:⭐|----------------|$))/i);
          if (transMatch && transMatch[1]) {
            translated = transMatch[1].trim();
          }

          bubbles.push({
            id: bId,
            page: "Trang 1",
            original,
            translated,
            location,
            confidence
          });
        });

        result.pages.push({
          pageNumber: "Trang 1",
          context,
          bubbles
        });
      }

      // Final Fail-safe Fallback parser
      if (result.pages.length === 0 || result.pages.every(p => p.bubbles.length === 0)) {
        const textLines = text.split("\n").map(l => l.trim()).filter(l => l.length > 0);
        const bubbles: ParsedScriptBubble[] = [];
        
        textLines.forEach((line, idx) => {
          if (line.includes(":") && !line.startsWith("==") && !line.startsWith("--") && !line.startsWith("⏱") && !line.startsWith("🎯")) {
            const parts = line.split(":");
            bubbles.push({
              id: `${idx + 1}`,
              page: "Xem nhanh",
              original: parts[0].trim(),
              translated: parts.slice(1).join(":").trim()
            });
          }
        });

        result.pages = [{
          pageNumber: "Kịch bản thô",
          context: "Định dạng tự do hoặc thô tải từ tệp tin bên ngoài",
          bubbles: bubbles.length > 0 ? bubbles : [{
            id: "1",
            page: "Kịch bản thô",
            original: "Tệp tin thô:",
            translated: text
          }]
        }];
      }
    } catch (err) {
      console.error("Lỗi khi giải trình kịch bản:", err);
    }

    return result;
  };

  // Helper functions for downloading text scripts
  const downloadAsTxt = (filename: string, content: string) => {
    const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const exportSinglePageTxt = (result: MangaResult, indexLabel?: number | string) => {
    const languageLabel = targetLanguage;
    let text = `========================================================\n`;
    text += `   BẢN DỊCH TRANG TRUYỆN MANGA (MioManga Script)\n`;
    text += `========================================================\n\n`;
    text += `⏱ Thời gian trích xuất: ${new Date(result.timestamp).toLocaleString("vi-VN")}\n`;
    text += `🎯 Ngôn ngữ đích: ${languageLabel}\n`;
    if (indexLabel !== undefined) {
      text += `📄 Phân trang: Trang ${indexLabel}\n`;
    }
    text += `🎬 Bối cảnh phân cảnh: ${result.scene_context || "Không có bối cảnh chi tiết."}\n`;
    text += `💬 Tổng số ô thoại: ${result.total_bubbles} ô\n\n`;
    text += `--------------------------------------------------------\n`;
    text += `DANH SÁCH THOẠI CHI TIẾT (CHIA THOẠI ĐÀNG HOÀNG):\n`;
    text += `--------------------------------------------------------\n\n`;

    result.bubbles.forEach((bubble) => {
      text += `[Ô THOẠI #${bubble.bubble_id}]\n`;
      text += `🔹 VỊ TRÍ: X: ${Math.round(bubble.bounding_box.x)}%, Y: ${Math.round(bubble.bounding_box.y)}%, Rộng: ${Math.round(bubble.bounding_box.width)}%, Cao: ${Math.round(bubble.bounding_box.height)}%\n`;
      text += `🔹 GỐC (JPN/ENG):\n${bubble.original_text}\n\n`;
      text += `👉 DỊCH (${languageLabel}):\n${bubble.translated_text}\n`;
      text += `⭐ CHÍNH XÁC: ${Math.round(bubble.confidence_score * 100)}%\n`;
      text += `--------------------------------------------------------\n\n`;
    });

    text += `=== HẾT TRANG ===\n`;

    const cleanSceneContext = (result.scene_context || "Dich_MioManga")
      .replace(/[^a-zA-Z0-9_ÁÀẢÃẠÂẤẦẨẪẬĂẮẰẲẴẶÉÈẺẼẸÊẾỀỂỄỆÍÌỈĨỊÓÒỎÕỌÔỐỒỔỖỘƠỚỜỞỠỢÚÙỦŨỤƯỨỪỬỮỰÝỲỶỸÝỲỶỸỴđĐ\s-]/g, "")
      .trim()
      .replace(/\s+/g, "_")
      .slice(0, 30);

    const filename = `MioManga_Script_${cleanSceneContext || "Page"}_${result.id.slice(0, 5)}.txt`;
    downloadAsTxt(filename, text);
  };

  const exportProjectTxt = (projectId: string) => {
    const project = projects.find(p => p.id === projectId) || (projectId === "default" ? { name: "Dự án Mặc định", description: "Lưu trữ chung" } : null);
    if (!project) return;

    // Filter history items belonging to this project, sorted chronologically (oldest first)
    const projectItems = history
      .filter(item => (item.projectId || "default") === projectId)
      .sort((a, b) => a.timestamp - b.timestamp);

    if (projectItems.length === 0) {
      triggerConfirm(
        "DỰ ÁN RỖNG",
        `Dự án "${project.name}" hiện chưa có bản dịch nào được lưu trữ trong lịch sử. Vui lòng dịch tối thiểu một trang truyện thuộc dự án này để tiến hành tải về.`,
        () => {}
      );
      return;
    }

    const languageLabel = targetLanguage;
    let text = `========================================================\n`;
    text += `   KỊCH BẢN TRUYỆN TRANH - DỰ ÁN: ${project.name.toUpperCase()}\n`;
    text += `========================================================\n`;
    if ("description" in project && project.description) {
      text += `📝 Mô tả dự án: ${project.description}\n`;
    }
    text += `⏱ Thời gian tạo kịch bản: ${new Date().toLocaleString("vi-VN")}\n`;
    text += `📄 Tổng số trang đã dịch: ${projectItems.length} trang\n`;
    text += `🎯 Ngôn ngữ đích: ${languageLabel}\n`;
    text += `========================================================\n\n`;

    projectItems.forEach((item, pageIndex) => {
      text += `========================================================\n`;
      text += `📖 TRANG SỐ ${pageIndex + 1} (Thời gian dịch: ${new Date(item.timestamp).toLocaleString("vi-VN")})\n`;
      text += `🎬 Bối cảnh: ${item.scene_context || "Không rõ."}\n`;
      text += `💬 Số lượng ô thoại: ${item.total_bubbles} ô\n`;
      text += `========================================================\n\n`;

      item.bubbles.forEach((bubble) => {
        text += `[TRANG ${pageIndex + 1} - Ô THOẠI #${bubble.bubble_id}]\n`;
        text += `🔹 Vị trí bong bóng: X: ${Math.round(bubble.bounding_box.x)}%, Y: ${Math.round(bubble.bounding_box.y)}%, W: ${Math.round(bubble.bounding_box.width)}%, H: ${Math.round(bubble.bounding_box.height)}%\n`;
        text += `🔹 Gốc JPN/ENG:\n${bubble.original_text}\n\n`;
        text += `👉 Bản dịch (${languageLabel}):\n${bubble.translated_text}\n`;
        text += `⭐ Điểm chính xác: ${Math.round(bubble.confidence_score * 100)}%\n`;
        text += `--------------------------------------------------------\n\n`;
      });

      text += `\n`;
    });

    text += `========================================================\n`;
    text += `             HOÀN THÀNH KỊCH BẢN DỰ ÁN                  \n`;
    text += `========================================================\n`;

    const cleanProjName = project.name
      .replace(/[^a-zA-Z0-9_ÁÀẢÃẠÂẤẦẨẪẬĂẮẰẲẴẶÉÈẺẼẸÊẾỀỂỄỆÍÌỈĨỊÓÒỎÕỌÔỐỒỔỖỘƠỚỜỞỠỢÚÙỦŨỤƯỨỪỬỮỰÝỲỶỸÝỲỶỸỴđĐ\s-]/g, "")
      .trim()
      .replace(/\s+/g, "_")
      .slice(0, 30);

    const filename = `MioManga_KichBanDuAn_${cleanProjName || "Project"}.txt`;
    downloadAsTxt(filename, text);
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

  const cancelProcessing = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setIsProcessing(false);
    setIsProcessingAll(false);
    setProgress(0);
    setProcessedCount(0);
  };

  const processImage = async (index: number = activeIndex) => {
    const targetImage = images[index];
    if (!targetImage) return null;
    
    // If not in "process all" mode, we set the global isProcessing
    if (!isProcessingAll) setIsProcessing(true);
    
    // Ensure we have an active AbortController
    if (!abortControllerRef.current || abortControllerRef.current.signal.aborted) {
      abortControllerRef.current = new AbortController();
    }
    
    try {
      const response = await fetch("/api/translate-manga", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: abortControllerRef.current.signal,
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
    } catch (error: any) {
      if (error.name === "AbortError") {
        console.log("Tiến trình dịch thuật đã bị người dùng hủy.");
        return null;
      }
      console.error(`Xử lý trang ${index + 1} thất bại:`, error);
      alert(`Không thể kết nối với máy chủ dịch thuật cho trang ${index + 1}.`);
      return null;
    } finally {
      if (!isProcessingAll) setIsProcessing(false);
    }
  };

  const handleSingleProcess = async () => {
    abortControllerRef.current = new AbortController();
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
    
    // Create new abort controller for the batch sequence
    abortControllerRef.current = new AbortController();
    
    const newResults = [...results];
    
    for (let i = 0; i < images.length; i++) {
      if (abortControllerRef.current?.signal.aborted) {
        break;
      }
      
      setActiveIndex(i); // Move focus as we process
      const result = await processImage(i);
      
      if (abortControllerRef.current?.signal.aborted) {
        break;
      }
      
      if (result) {
        newResults[i] = result;
        setResults([...newResults]); // Update UI incrementally
        saveToHistory(result);
      }
      setProcessedCount(i + 1);
    }
    
    setIsProcessingAll(false);
    setIsProcessing(false);
    setProgress(0);
  };

  const filteredHistory = filterProjectId === "all"
    ? history
    : history.filter(item => (item.projectId || "default") === filterProjectId);

  const currentImage = images[activeIndex];
  const currentResult = results[activeIndex];

  return (
    <div className={`min-h-screen ${cPageBg} ${cSelection} font-sans flex flex-col h-screen overflow-hidden`}>
      
      {/* Export Settings Overlay */}
      <AnimatePresence>
        {exportSettingsOpen && (
          <>
            <motion.div 
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => setExportSettingsOpen(false)}
              className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[200]"
            />
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }} 
              animate={{ scale: 1, opacity: 1 }} 
              exit={{ scale: 0.95, opacity: 0 }}
              className={`fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-sm ${cCardBg} border-4 ${cBorder} p-5 z-[201] shadow-2xl rounded-sm`}
            >
              <div className="flex justify-between items-center pb-3 border-b-2 border-dashed border-gray-500/30">
                <h3 className="font-black text-xs uppercase tracking-wide flex items-center gap-2 text-emerald-600">
                  <ImageIcon size={16} /> Cấu hình tải ảnh dịch
                </h3>
                <button 
                  onClick={() => setExportSettingsOpen(false)} 
                  className="hover:rotate-90 transition-transform p-1"
                >
                  <X size={16} />
                </button>
              </div>

              <div className="py-4 space-y-4 max-h-[70vh] overflow-y-auto pr-1">
                {/* Font Choice */}
                <div className="space-y-1 bg-gray-500/5 p-2 rounded-sm border border-gray-500/10">
                  <div className="flex justify-between items-center">
                    <label className="text-[10px] font-black uppercase opacity-60">Phông chữ (Font Family):</label>
                    <button
                      type="button"
                      onClick={() => fontFileInputRef.current?.click()}
                      className="text-[9px] font-black bg-blue-600 hover:bg-blue-500 text-white px-2 py-0.5 rounded cursor-pointer transition-all active:scale-95 uppercase flex items-center gap-1"
                    >
                      <Upload size={10} /> Chọn tệp font
                    </button>
                    <input 
                      type="file"
                      ref={fontFileInputRef}
                      onChange={handleFontFileUpload}
                      accept=".ttf,.otf,.woff,.woff2"
                      className="hidden"
                    />
                  </div>
                  
                  <select 
                    value={exportFontFamily}
                    onChange={(e) => setExportFontFamily(e.target.value)}
                    className={`w-full p-2 text-xs font-black border-2 ${cBorder} ${cInputBg} rounded-sm cursor-pointer outline-none focus:ring-1 focus:ring-emerald-500`}
                  >
                    <option value='"Inter", "Helvetica Neue", Arial, sans-serif'>Inter (Hiện đại, tối giản)</option>
                    <option value='"Comic Neue", cursive, sans-serif'>Comic Neue (Chuẩn Manga / Comic)</option>
                    <option value='"JetBrains Mono", monospace'>JetBrains Mono (Tech / Mono)</option>
                    <option value='Impact, Charcoal, sans-serif'>Impact (Mạnh mẽ, dày dặn)</option>
                    <option value='Georgia, serif'>Georgia (Sang trọng, có chân)</option>
                    <option value='"Times New Roman", serif'>Times New Roman (Cổ điển)</option>
                    {uploadedFonts.map((font) => (
                      <option key={font} value={`"${font}", sans-serif`}>
                        ✨ [Font Nạp] {font}
                      </option>
                    ))}
                  </select>
                  
                  {/* Free-form Custom Font Entry */}
                  <div className="pt-1">
                    <span className="text-[9px] font-bold opacity-50 block">Hoặc nhập tên font hệ thống:</span>
                    <input 
                      type="text"
                      value={exportFontFamily}
                      onChange={(e) => setExportFontFamily(e.target.value)}
                      className={`w-full mt-1 p-2 text-xs border-2 ${cBorder} ${cInputBg} rounded-sm outline-none focus:ring-1 focus:ring-emerald-500`}
                      placeholder="vd: Arial, Comic Sans MS..."
                    />
                  </div>
                </div>

                {/* Mask Shape Configuration */}
                <div className="space-y-1.5 bg-gray-500/5 p-2 rounded-sm border border-gray-500/10">
                  <label className="text-[10px] font-black uppercase opacity-60 block">Kiểu che chữ (Bubble Shape):</label>
                  <select
                    value={exportBubbleShape}
                    onChange={(e) => setExportBubbleShape(e.target.value)}
                    className={`w-full p-2 text-xs font-black border-2 ${cBorder} ${cInputBg} rounded-sm cursor-pointer outline-none focus:ring-1 focus:ring-emerald-500`}
                  >
                     <option value="ellipse">Hình bầu dục (Tròn / Ellipse - Tốt nhất cho Manga)</option>
                     <option value="roundrect">Hình chữ nhật bo tròn (Rounded Rectangle)</option>
                     <option value="rect">Hình chữ nhật vuông (Rectangle)</option>
                  </select>
                </div>

                {/* Margin Offset Configuration */}
                <div className="space-y-1 bg-gray-500/5 p-2 rounded-sm border border-gray-500/10">
                  <div className="flex justify-between text-[10px] font-black uppercase">
                    <span className="opacity-60 font-black">Xê dịch / Bọc viền (Padding):</span>
                    <span className={exportBubbleOffset >= 0 ? "text-emerald-500 font-bold" : "text-rose-500 font-bold"}>
                      {exportBubbleOffset > 0 ? `+${exportBubbleOffset}` : exportBubbleOffset}px
                    </span>
                  </div>
                  <input 
                    type="range"
                    min="-15"
                    max="25"
                    step="1"
                    value={exportBubbleOffset}
                    onChange={(e) => setExportBubbleOffset(parseInt(e.target.value, 10))}
                    className="w-full h-1.5 bg-gray-300 dark:bg-gray-700 rounded-lg appearance-none cursor-pointer accent-emerald-600"
                  />
                  <div className="flex justify-between text-[8px] font-mono font-bold opacity-50">
                    <span>-15px (Bóp nhỏ)</span>
                    <span>0px (Chuẩn)</span>
                    <span>25px (Phủ rộng)</span>
                  </div>
                  <span className="text-[8px] italic opacity-40 block leading-tight">
                    * Tăng (+) để xoá sạch bóng chữ cũ còn thừa; giảm (-) để chừa lại viền vẽ tay của truyện.
                  </span>
                </div>

                {/* Draw Borders / Stroke Toggle */}
                <div className="space-y-2 bg-gray-500/5 p-2 rounded-sm border border-gray-500/10">
                  <div className="flex items-center gap-2">
                    <input 
                      type="checkbox"
                      id="exportDrawBorders"
                      checked={exportDrawBorders}
                      onChange={(e) => setExportDrawBorders(e.target.checked)}
                      className="w-4.5 h-4.5 border-2 rounded-sm cursor-pointer accent-emerald-600 focus:ring-0 outline-none"
                    />
                    <label htmlFor="exportDrawBorders" className="text-[10px] font-black uppercase cursor-pointer select-none opacity-80">
                      Tự động vẽ viền mới (Comic Borders)
                    </label>
                  </div>

                  {exportDrawBorders && (
                    <div className="pl-6 space-y-1">
                      <div className="flex justify-between text-[9px] font-black uppercase opacity-80">
                        <span>Độ dày nét viền:</span>
                        <span className="text-emerald-500 font-bold">{exportBorderWidth}px</span>
                      </div>
                      <input 
                        type="range"
                        min="0.5"
                        max="6"
                        step="0.5"
                        value={exportBorderWidth}
                        onChange={(e) => setExportBorderWidth(parseFloat(e.target.value))}
                        className="w-full h-1 bg-gray-300 dark:bg-gray-700 rounded-lg appearance-none cursor-pointer accent-emerald-600"
                      />
                      <span className="text-[8px] italic opacity-40 block">
                        * Vẽ nét viền mực bao quanh phần che phủ để tái tạo lại viền bong bóng sắc nét.
                      </span>
                    </div>
                  )}
                </div>

                {/* Font Size Modifier */}
                <div className="space-y-1 bg-gray-500/5 p-2 rounded-sm border border-gray-500/10">
                  <div className="flex justify-between text-[10px] font-black uppercase">
                    <span className="opacity-60 font-black">Cỡ chữ tổng thể:</span>
                    <span className="text-emerald-500 font-bold">{exportFontSizeScale}%</span>
                  </div>
                  <div className="flex items-center gap-4">
                    <input 
                      type="range"
                      min="50"
                      max="200"
                      step="5"
                      value={exportFontSizeScale}
                      onChange={(e) => setExportFontSizeScale(parseInt(e.target.value, 10))}
                      className="flex-1 h-1.5 bg-gray-300 dark:bg-gray-700 rounded-lg appearance-none cursor-pointer accent-emerald-600"
                    />
                  </div>
                  <div className="flex justify-between text-[8px] font-mono font-bold opacity-50">
                    <span>50% (Nhỏ)</span>
                    <span>100% (Chuẩn)</span>
                    <span>200% (Lớn)</span>
                  </div>
                </div>

                {/* Scale presets */}
                <div className="flex gap-1 overflow-x-auto pb-1">
                  {[75, 100, 125, 150].map((preset) => (
                    <button
                      key={preset}
                      onClick={() => setExportFontSizeScale(preset)}
                      className={`text-[9px] font-black px-2 py-1 border rounded-sm transition-all uppercase shrink-0 ${
                        exportFontSizeScale === preset 
                          ? "bg-emerald-600 text-white border-emerald-600" 
                          : `${isDarkMode ? "bg-[#282824]/40 hover:bg-[#282824]" : "bg-gray-100 hover:bg-gray-200"} border-gray-500/20`
                      }`}
                    >
                      {preset}% {preset === 100 ? "(Mặc định)" : ""}
                    </button>
                  ))}
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex gap-2 pt-3 border-t-2 border-dashed border-gray-500/30">
                <button
                  onClick={() => setExportSettingsOpen(false)}
                  className={`flex-1 py-2 text-[10px] font-black uppercase border-2 ${cBorder} text-center hover:bg-red-500 hover:text-white transition-all active:scale-95`}
                >
                  Đóng
                </button>
                <button
                  onClick={() => {
                    setExportSettingsOpen(false);
                    if (currentResult && currentImage) {
                      exportTranslatedPageImage(currentResult, currentImage, activeIndex + 1);
                    }
                  }}
                  className="flex-1 py-2 text-[10px] bg-emerald-600 text-white font-black uppercase text-center hover:bg-emerald-500 transition-all active:scale-95 shadow-md flex items-center justify-center gap-1"
                >
                  <Download size={11} /> Tải ảnh về
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

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
                {/* Manga Project Classification System */}
                <div className={`p-4 border-2 border-dashed ${cBorder} rounded-md space-y-4`}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Folder size={16} className="text-blue-500" />
                      <span className="text-xs font-black uppercase">Phân loại Dự án Manga</span>
                    </div>
                    {!isCreatingProject && (
                      <button 
                        onClick={() => setIsCreatingProject(true)}
                        className={`text-[9px] font-black px-2.5 py-1 border-2 ${cBorder} rounded-sm uppercase tracking-tighter active:scale-95 transition-all hover:bg-blue-600 hover:text-white`}
                      >
                        + Tạo mới
                      </button>
                    )}
                  </div>

                  {isCreatingProject ? (
                    <div className="space-y-3 p-3 bg-black/5 dark:bg-white/5 border border-dashed border-blue-500/50 rounded-sm">
                      <div className="space-y-1">
                        <label className="text-[9px] font-bold uppercase opacity-60">Tên dự án *</label>
                        <input 
                          type="text" 
                          value={newProjectName}
                          onChange={(e) => setNewProjectName(e.target.value)}
                          placeholder="Mio Manga Vol 1..."
                          className={`w-full p-2 text-xs outline-none focus:bg-blue-500/10 ${cBorder2} ${cInputBg}`}
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[9px] font-bold uppercase opacity-60">Mô tả ngắn</label>
                        <input 
                          type="text" 
                          value={newProjectDesc}
                          onChange={(e) => setNewProjectDesc(e.target.value)}
                          placeholder="Miêu tả tập truyện..."
                          className={`w-full p-2 text-xs outline-none focus:bg-blue-500/10 ${cBorder2} ${cInputBg}`}
                        />
                      </div>
                      <div className="flex gap-2 justify-end pt-1">
                        <button 
                          onClick={() => {
                            setIsCreatingProject(false);
                            setNewProjectName("");
                            setNewProjectDesc("");
                          }}
                          className="px-2.5 py-1 text-[9px] font-bold uppercase opacity-60 hover:opacity-100 transition-opacity"
                        >
                          Hủy
                        </button>
                        <button 
                          onClick={createNewProject}
                          disabled={!newProjectName.trim()}
                          className={`px-3 py-1 text-[9px] font-black uppercase border-2 ${cBorder} ${cPrimaryBtn} disabled:opacity-30`}
                        >
                          Tạo
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <div className="space-y-1">
                        <label className="text-[9px] font-black uppercase opacity-60 block">Dự án hiện tại (Lưu kết quả dịch vào đây)</label>
                        <div className={`relative ${cBorder2} ${cInputBg}`}>
                          <select 
                            value={currentProjectId}
                            onChange={(e) => setCurrentProjectId(e.target.value)}
                            className="w-full p-2.5 text-xs font-bold bg-transparent outline-none appearance-none cursor-pointer pr-8"
                          >
                            {projects.map(proj => {
                              const count = history.filter(item => (item.projectId || "default") === proj.id).length;
                              return (
                                <option key={proj.id} value={proj.id} className={isDarkMode ? "bg-[#22221F]" : ""}>
                                  📁 {proj.name} ({count} bản dịch)
                                </option>
                              );
                            })}
                          </select>
                          <ChevronRight size={14} className="absolute right-3 top-1/2 -translate-y-1/2 rotate-90 pointer-events-none" />
                        </div>
                      </div>
                      
                      {currentProjectId !== "default" ? (
                        <div className={`flex flex-col gap-2 bg-black/5 dark:bg-white/5 p-2.5 border ${cBorder} rounded-sm text-[10px] leading-tight`}>
                          <div className="flex items-start justify-between animate-fadeIn">
                            <div className="flex-1 min-w-0 pr-2">
                              <span className="font-bold text-[8px] opacity-40 uppercase block">Đang hoạt động:</span>
                              <span className="font-black text-xs truncate block">{projects.find(p => p.id === currentProjectId)?.name}</span>
                              {projects.find(p => p.id === currentProjectId)?.description && (
                                <span className="opacity-65 text-[9px] italic mt-0.5 block truncate">
                                  {projects.find(p => p.id === currentProjectId)?.description}
                                </span>
                              )}
                            </div>
                            <button 
                              onClick={(e) => deleteProject(currentProjectId, e)}
                              className="bg-red-500/15 text-red-500 hover:bg-red-500 hover:text-white px-2 py-1 rounded-sm border border-red-500/20 active:scale-95 transition-all text-[9px] font-black uppercase shrink-0"
                              title="Xóa dự án này"
                            >
                              Xóa
                            </button>
                          </div>
                          <button
                            onClick={() => exportProjectTxt(currentProjectId)}
                            className="w-full mt-1 py-1.5 px-3 bg-blue-600 hover:bg-blue-500 text-white border border-blue-500/10 rounded-sm font-black text-[9.5px] uppercase tracking-wider flex items-center justify-center gap-1.5 transition-all active:scale-95 shadow-sm"
                          >
                            <Download size={11} /> Tải kịch bản dự án này
                          </button>
                        </div>
                      ) : (
                        <div className={`flex flex-col gap-2 bg-black/5 dark:bg-white/5 p-2.5 border ${cBorder} rounded-sm text-[10px] leading-tight`}>
                          <div className="flex items-start justify-between">
                            <div className="flex-1 min-w-0 pr-2">
                              <span className="font-bold text-[8px] opacity-40 uppercase block">Đang hoạt động:</span>
                              <span className="font-black text-xs block text-blue-500">Dự án Mặc định</span>
                              <span className="opacity-65 text-[9px] italic mt-0.5 block">Nơi lưu trữ chung khi chưa phân loại</span>
                            </div>
                          </div>
                          <button
                            onClick={() => exportProjectTxt("default")}
                            className="w-full mt-1 py-1.5 px-3 bg-blue-600 hover:bg-blue-500 text-white border border-blue-500/10 rounded-sm font-black text-[9.5px] uppercase tracking-wider flex items-center justify-center gap-1.5 transition-all active:scale-95 shadow-sm"
                          >
                            <Download size={11} /> Tải kịch bản dự án mặc định
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>

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
                  <div className="space-y-2">
                    <label className={`flex items-center justify-center gap-2 border-2 border-dashed ${cBorder} rounded-sm p-2.5 hover:bg-blue-500/5 cursor-pointer transition-all active:scale-98 text-blue-500 hover:text-blue-600`}>
                      <Upload size={14} />
                      <span className="text-[10px] font-black uppercase tracking-wider">Nạp từ file Prompt (.txt, .md)</span>
                      <input 
                        type="file" 
                        accept=".txt,.md" 
                        className="hidden" 
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) {
                            const reader = new FileReader();
                            reader.onload = (evt) => {
                              const value = evt.target?.result;
                              if (typeof value === "string") {
                                setUserPrompt(value);
                              }
                            };
                            reader.readAsText(file);
                          }
                        }}
                      />
                    </label>
                  </div>
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

              {/* Filter by project */}
              <div className="px-4 pt-4 shrink-0">
                <label className="text-[9px] font-black uppercase opacity-60 block mb-1">🔍 Bộ lọc Dự án Manga</label>
                <div className="flex gap-2">
                  <div className={`relative flex-1 ${cBorder2} ${cInputBg}`}>
                    <select 
                      value={filterProjectId}
                      onChange={(e) => setFilterProjectId(e.target.value)}
                      className="w-full p-2.5 text-xs font-bold bg-transparent outline-none appearance-none cursor-pointer pr-8 focus:ring-1 focus:ring-blue-500"
                    >
                      <option value="all" className={isDarkMode ? "bg-[#22221F]" : ""}>📚 Tất cả Dự án ({history.length})</option>
                      {projects.map(proj => {
                        const count = history.filter(item => (item.projectId || "default") === proj.id).length;
                        return (
                          <option key={proj.id} value={proj.id} className={isDarkMode ? "bg-[#22221F]" : ""}>
                            📁 {proj.name} ({count})
                          </option>
                        );
                      })}
                    </select>
                    <ChevronRight size={14} className="absolute right-3 top-1/2 -translate-y-1/2 rotate-90 pointer-events-none" />
                  </div>
                  {filterProjectId !== "all" ? (
                    <button
                      onClick={() => exportProjectTxt(filterProjectId)}
                      className={`px-3 border-2 ${cBorder} rounded-sm ${cBtnHover} text-blue-500 hover:bg-blue-600 hover:text-white transition-all flex items-center justify-center`}
                      title="Tải kịch bản của dự án đang chọn (.txt)"
                    >
                      <Download size={14} />
                    </button>
                  ) : history.length > 0 ? (
                    <button
                      onClick={() => {
                        let allContent = `========================================================\n`;
                        allContent += `   TỔNG HỢP TOÀN BỘ KỊCH BẢN DỊCH TRONG LỊCH SỬ\n`;
                        allContent += `========================================================\n`;
                        allContent += `⏱ Xuất bởi: MioManga | Thời gian: ${new Date().toLocaleString("vi-VN")}\n`;
                        allContent += `🎯 Ngôn ngữ: ${targetLanguage}\n`;
                        allContent += `📄 Quy mô: ${history.length} trang truyện\n`;
                        allContent += `========================================================\n\n`;

                        history.forEach((item, index) => {
                          const itemProj = projects.find(p => p.id === (item.projectId || "default")) || { name: "Mặc định" };
                          allContent += `--------------------------------------------------------\n`;
                          allContent += `Trang ${index + 1} | Dự án: ${itemProj.name} | Bối cảnh: ${item.scene_context || "Không rõ."}\n`;
                          allContent += `--------------------------------------------------------\n\n`;
                          item.bubbles.forEach(b => {
                            allContent += `[TRANG ${index + 1} - Ô THOẠI #${b.bubble_id}]\n`;
                            allContent += `Gốc: ${b.original_text}\n`;
                            allContent += `Dịch: ${b.translated_text}\n\n`;
                          });
                        });
                        
                        downloadAsTxt("MioManga_TongHopLichSuScripts.txt", allContent);
                      }}
                      className={`px-3 border-2 ${cBorder} rounded-sm ${cBtnHover} text-blue-500 hover:bg-blue-600 hover:text-white transition-all flex items-center justify-center`}
                      title="Tải toàn bộ kịch bản lịch sử (.txt)"
                    >
                      <Download size={14} />
                    </button>
                  ) : null}
                </div>
              </div>

              <div className="flex-1 overflow-y-auto p-4 space-y-3">
                {filteredHistory.length > 0 ? filteredHistory.map((item) => {
                  const itemProjId = item.projectId || "default";
                  const itemProject = projects.find(p => p.id === itemProjId) || { name: "Dự án Mặc định" };
                  return (
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
                      <div className="flex justify-between items-start mb-1.5">
                        <span className="text-[9px] font-mono opacity-50">
                          {new Date(item.timestamp).toLocaleString("vi-VN")}
                        </span>
                        <button 
                          onClick={(e) => deleteHistoryItem(item.id, e)}
                          className="text-red-500 opacity-70 md:opacity-0 md:group-hover:opacity-100 transition-all p-1 hover:text-red-600 hover:scale-110 active:scale-95 shrink-0"
                          title="Xóa trang này khỏi lịch sử"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                      
                      <div className="flex items-center gap-1 mb-2">
                        <span className="inline-flex items-center text-[7.5px] font-black uppercase px-2 py-0.5 rounded-sm bg-blue-500/10 text-blue-500 border border-blue-500/15">
                          📁 {itemProject.name}
                        </span>
                      </div>

                      <p className="text-xs font-bold truncate uppercase">{item.scene_context || "Truyện không tên"}</p>
                      <div className="mt-1 text-[9px] opacity-40 font-bold italic">
                        {item.total_bubbles} ô thoại được dịch
                      </div>
                    </div>
                  );
                }) : (
                  <div className={`h-full flex flex-col items-center justify-center p-8 opacity-30 ${cText}`}>
                    <History size={36} strokeWidth={1} />
                    <p className="mt-3 text-xs font-bold uppercase tracking-widest text-center">Không tìm thấy bản dịch nào</p>
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

          <label 
            className={`p-2 border-2 ${cBorder} ${cBtnHover} cursor-pointer transition-all flex items-center justify-center`}
            title="Nhập kịch bản (.txt) đã tải"
          >
            <BookOpen size={18} className="text-blue-500" />
            <input 
              type="file" 
              accept=".txt" 
              className="hidden" 
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) {
                  const reader = new FileReader();
                  reader.onload = (evt) => {
                    const content = evt.target?.result;
                    if (typeof content === "string") {
                      const parsed = parseMioScript(content);
                      setScriptDialog({ isOpen: true, parsed });
                      setScriptViewPageIdx(0);
                    }
                  };
                  reader.readAsText(file);
                }
                // Reset input value to allow uploading the same file again
                e.target.value = "";
              }}
            />
          </label>

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
                    <div className="space-y-1.5">
                      <div className="flex justify-between items-center">
                        <span className="text-[9px] font-black uppercase text-blue-500">Bản dịch (Sửa trực tiếp):</span>
                        <button 
                          onClick={() => copyToClipboard(editingText)}
                          className="text-[9.5px] font-black text-blue-500 hover:underline flex items-center gap-1 active:scale-95 transition-all relative"
                          title="Sao chép"
                        >
                          {copyStatus ? <span className="text-[8px] font-black absolute -top-8 right-0 bg-blue-600 text-white p-1 whitespace-nowrap">{copyStatus}</span> : null}
                          <Scan size={12} /> Sao chép
                        </button>
                      </div>
                      <textarea
                        value={editingText}
                        onChange={(e) => setEditingText(e.target.value)}
                        className={`w-full text-xs font-black p-2 border-2 border-dashed border-blue-500 bg-transparent resize-none h-16 outline-none focus:bg-blue-50/5 transition-colors leading-normal ${cText}`}
                        placeholder="Cập nhật bản dịch mới tại đây..."
                      />

                      {/* Individual Bubble Font Size Scaling Control */}
                      <div className="space-y-1 mt-1 border-t border-dashed border-gray-500/20 pt-2 pb-1">
                        <div className="flex justify-between text-[9px] font-black uppercase">
                          <span className="opacity-60 font-black">Cỡ chữ ô thoại này:</span>
                          <span className="text-emerald-500 font-black">{editingFontSizeScaleCustom}%</span>
                        </div>
                        <input 
                          type="range"
                          min="50"
                          max="200"
                          step="5"
                          value={editingFontSizeScaleCustom}
                          onChange={(e) => setEditingFontSizeScaleCustom(parseInt(e.target.value, 10))}
                          className="w-full h-1 bg-gray-300 dark:bg-gray-700 rounded appearance-none cursor-pointer accent-emerald-600"
                        />
                      </div>

                      {/* Individual Bubble Padding/Covering Offset Control */}
                      <div className="space-y-1 mt-1 border-t border-dashed border-gray-500/20 pt-2 pb-1">
                        <div className="flex justify-between text-[9px] font-black uppercase">
                          <span className="opacity-60 font-black">Cỡ che phủ (Bọc viền) ô này:</span>
                          <span className={editingOffsetCustom >= 0 ? "text-emerald-500 font-black" : "text-rose-500 font-black"}>
                            {editingOffsetCustom > 0 ? `+${editingOffsetCustom}` : editingOffsetCustom}px
                          </span>
                        </div>
                        <input 
                          type="range"
                          min="-15"
                          max="25"
                          step="1"
                          value={editingOffsetCustom}
                          onChange={(e) => setEditingOffsetCustom(parseInt(e.target.value, 10))}
                          className="w-full h-1 bg-gray-300 dark:bg-gray-700 rounded appearance-none cursor-pointer accent-emerald-600"
                        />
                        <div className="flex justify-between text-[7px] font-mono font-bold opacity-40">
                          <span>-15px (Nhỏ)</span>
                          <span>0px (Chuẩn)</span>
                          <span>25px (Rộng)</span>
                        </div>
                      </div>

                      {currentResult && (
                        editingText !== selectedBubble.translated_text || 
                        editingFontSizeScaleCustom !== (selectedBubble.custom_font_size || 100) ||
                        editingOffsetCustom !== (selectedBubble.custom_offset !== undefined ? selectedBubble.custom_offset : exportBubbleOffset)
                      ) && (
                        <motion.button
                          initial={{ opacity: 0, y: 5 }}
                          animate={{ opacity: 1, y: 0 }}
                          onClick={() => updateBubbleTranslation(currentResult.id, selectedBubble.bubble_id, editingText, editingFontSizeScaleCustom, editingOffsetCustom)}
                          className="w-full py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-sm text-[10px] font-black uppercase shadow-md active:scale-95 transition-all flex items-center justify-center gap-1.5"
                        >
                          <Check size={11} /> Lưu chỉnh sửa
                        </motion.button>
                      )}
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
                  <div className="flex flex-col gap-1 w-full mb-1">
                    <div className="flex justify-between items-center text-[9px] font-black uppercase">
                      <span className="text-blue-500 animate-pulse">
                        {isProcessingAll ? `Dịch hàng loạt: ${processedCount}/${images.length} trang` : "Đang thực thi dịch thuật..."}
                      </span>
                      <button
                        type="button"
                        onClick={cancelProcessing}
                        className="text-[9px] font-black text-rose-500 hover:text-rose-400 bg-rose-500/10 px-1.5 py-0.5 rounded border border-rose-500/20 active:scale-95 transition-all text-center uppercase cursor-pointer"
                        title="Dừng tiến trình dịch ngay lập tức"
                      >
                        Dừng dịch
                      </button>
                    </div>
                    <div className={`h-1.5 w-full overflow-hidden rounded-full ${isDarkMode ? "bg-[#E4E3E0]/10" : "bg-[#141414]/10"}`}>
                      <motion.div 
                        className="h-full bg-blue-600"
                        initial={{ width: 0 }}
                        animate={{ width: `${progress}%` }}
                      />
                    </div>
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
            <div className="flex items-center gap-2">
              {currentResult && (
                <div className="flex items-center gap-1.5">
                  <button 
                    onClick={() => exportSinglePageTxt(currentResult, activeIndex + 1)}
                    className="bg-blue-600 hover:bg-blue-500 text-white text-[9px] font-black uppercase px-2.5 py-1 rounded-sm flex items-center gap-1 active:scale-95 transition-all"
                    title="Tải kịch bản trang này (.txt)"
                  >
                    <Download size={10} /> kịch bản
                  </button>
                  <button 
                    onClick={() => setExportSettingsOpen(true)}
                    disabled={isExportingImage}
                    className="bg-emerald-600 hover:bg-emerald-500 text-white text-[9px] font-black uppercase px-2.5 py-1 rounded-sm flex items-center gap-1 active:scale-95 transition-all disabled:opacity-50"
                    title="Cấu hình và tải ảnh manga đã dịch (.png)"
                  >
                    {isExportingImage ? <Loader2 size={10} className="animate-spin" /> : <ImageIcon size={10} />}
                    <span>{isExportingImage ? "Đang tải..." : "ảnh dịch"}</span>
                  </button>
                </div>
              )}
              {currentResult && <div className="text-[10px] font-mono font-bold shrink-0">{currentResult.total_bubbles} Ô THOẠI</div>}
            </div>
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

      {/* Script Viewer Modal Overlay */}
      <AnimatePresence>
        {scriptDialog.isOpen && scriptDialog.parsed && (
          <>
            <motion.div 
              initial={{ opacity: 0 }} 
              animate={{ opacity: 1 }} 
              exit={{ opacity: 0 }}
              onClick={() => setScriptDialog(prev => ({ ...prev, isOpen: false }))}
              className="fixed inset-0 bg-black/80 backdrop-blur-md z-[150] flex items-center justify-center p-3 md:p-6"
            >
              <motion.div 
                initial={{ scale: 0.95, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.95, opacity: 0 }}
                onClick={(e) => e.stopPropagation()}
                className={`w-full max-w-5xl h-[85vh] ${cCardBg} border-4 ${cBorder} shadow-[12px_12px_0px_#000] dark:shadow-[12px_12px_0px_rgba(228,227,224,0.15)] flex flex-col overflow-hidden relative`}
              >
                {/* Modal Header */}
                <div className="p-4 border-b-2 border-dashed flex justify-between items-center bg-[#141414] text-white shrink-0">
                  <div className="flex items-center gap-2">
                    <FileText size={18} className="text-blue-400" />
                    <div>
                      <h2 className="text-xs md:text-sm font-black uppercase tracking-tight">Trình đọc Kịch bản Dịch MioManga</h2>
                      <p className="text-[9px] opacity-60 normal-case font-bold">{scriptDialog.parsed.title || "Tệp kịch bản"}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {/* Choose another file inside modal uploader */}
                    <label 
                      className="px-2.5 py-1 bg-blue-600 hover:bg-blue-500 text-white rounded-sm text-[9px] font-black uppercase tracking-tighter cursor-pointer flex items-center gap-1 active:scale-95 transition-all"
                      title="Nạp một tệp kịch bản khác (.txt)"
                    >
                      <Upload size={10} /> Đổi Tệp
                      <input 
                        type="file" 
                        accept=".txt" 
                        className="hidden" 
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) {
                            const reader = new FileReader();
                            reader.onload = (evt) => {
                              const content = evt.target?.result;
                              if (typeof content === "string") {
                                const parsed = parseMioScript(content);
                                setScriptDialog({ isOpen: true, parsed });
                                setScriptViewPageIdx(0);
                              }
                            };
                            reader.readAsText(file);
                          }
                          e.target.value = "";
                        }}
                      />
                    </label>
                    <button 
                      onClick={() => setScriptDialog(prev => ({ ...prev, isOpen: false }))}
                      className="hover:scale-110 transition-transform text-white"
                    >
                      <X size={20} />
                    </button>
                  </div>
                </div>

                {/* Main panel layout: Sidebar with pages, Main content area with dialogue lines */}
                <div className="flex-1 flex flex-col md:flex-row min-h-0 overflow-hidden">
                  
                  {/* Sidebar: Chapters/Pages */}
                  <aside className={`w-full md:w-56 shrink-0 border-b md:border-b-0 md:${cBorderR} ${cBorderB} flex flex-col min-h-0 h-[25%] md:h-full overflow-hidden`}>
                    <div className="p-2 border-b-2 border-dashed select-none bg-black/5 dark:bg-white/5 flex justify-between items-center text-[9px] font-black uppercase tracking-zero shrink-0">
                      <span>📄 Phân đoạn trang ({scriptDialog.parsed.pages.length})</span>
                    </div>
                    <div className="flex-1 overflow-y-auto divide-y divide-black/10 dark:divide-white/10">
                      {scriptDialog.parsed.pages.map((page, pIdx) => (
                        <button
                          key={pIdx}
                          onClick={() => setScriptViewPageIdx(pIdx)}
                          className={`w-full text-left p-2.5 md:p-3 transition-all flex flex-col gap-1.5 focus:outline-none ${
                            scriptViewPageIdx === pIdx 
                              ? `bg-blue-600 text-white border-l-4 border-blue-400 pl-2` 
                              : `hover:bg-black/5 dark:hover:bg-white/5 ${cText}`
                          }`}
                        >
                          <div className="flex justify-between items-center w-full">
                            <span className="text-[10px] font-black uppercase tracking-wider">{page.pageNumber || `Phần ${pIdx + 1}`}</span>
                            <span className={`text-[8px] font-mono font-bold px-1 rounded ${scriptViewPageIdx === pIdx ? 'bg-white/20 text-white' : 'bg-black/10 dark:bg-white/10 opacity-70'}`}>
                              {page.bubbles.length} thoại
                            </span>
                          </div>
                          {page.context && (
                            <p className={`text-[8.5px] leading-tight truncate w-full ${scriptViewPageIdx === pIdx ? 'text-white/80' : 'opacity-60'}`}>
                              {page.context}
                            </p>
                          )}
                        </button>
                      ))}
                    </div>
                  </aside>

                  {/* Main dialogues container */}
                  <div className="flex-1 flex flex-col min-h-0 overflow-hidden bg-black/[0.02] dark:bg-white/[0.01]">
                    {scriptDialog.parsed.pages[scriptViewPageIdx] ? (
                      <>
                        {/* Page header metadata */}
                        <div className={`p-4 border-b-2 ${cBorder} ${isDarkMode ? "bg-blue-950/20" : "bg-blue-50/50"} shrink-0 flex flex-col gap-1.5`}>
                          <div className="flex justify-between items-center">
                            <span className="text-[10px] font-black uppercase text-blue-500 tracking-wider">📜 Nội dung kịch bản {scriptDialog.parsed.pages[scriptViewPageIdx].pageNumber}</span>
                            {scriptDialog.parsed.targetLang && (
                              <span className="text-[8px] font-mono uppercase bg-blue-500/10 text-blue-500 border border-blue-500/20 px-1.5 py-0.5 rounded-sm font-black">
                                Ngôn ngữ đích: {scriptDialog.parsed.targetLang}
                              </span>
                            )}
                          </div>
                          <p className="text-xs font-black italic select-none leading-tight py-1 opacity-90">
                            Bối cảnh phân đoạn: "{scriptDialog.parsed.pages[scriptViewPageIdx].context || "Không ghi chép."}"
                          </p>
                        </div>

                        {/* Dialogue dialog items */}
                        <div className="flex-1 overflow-y-auto p-4 space-y-4">
                          {scriptDialog.parsed.pages[scriptViewPageIdx].bubbles.map((b, bIdx) => (
                            <div 
                              key={b.id || bIdx}
                              className={`p-4 border-2 ${cBorder} ${cCardBg} grid grid-cols-1 md:grid-cols-2 gap-4 shadow-sm relative hover:border-blue-500/50 transition-colors`}
                            >
                              {/* Left cell: JPN/ENG Origin */}
                              <div className="space-y-1.5">
                                <div className="flex justify-between items-center select-none">
                                  <span className="text-[9px] font-black uppercase text-red-500 bg-red-500/15 border border-red-500/20 px-1.5 py-0.5 rounded-sm">
                                    🔴 HOẠT ẢNH GỐC #{b.id}
                                  </span>
                                  {b.confidence && (
                                    <span className="text-[8px] font-mono opacity-50 font-bold">Điểm: {b.confidence}</span>
                                  )}
                                </div>
                                <div className={`p-2.5 rounded-sm font-mono text-[10px] min-h-[46px] leading-relaxed break-words whitespace-pre-wrap ${isDarkMode ? 'bg-black/30' : 'bg-black/5 grayscale'}`}>
                                  {b.original || <span className="opacity-30 italic">Thiếu lời thoại gốc</span>}
                                </div>
                              </div>

                              {/* Right cell: Translation */}
                              <div className="space-y-1.5">
                                <div className="flex justify-between items-center select-none">
                                  <span className="text-[9px] font-black uppercase text-emerald-500 bg-emerald-500/15 border border-emerald-500/20 px-1.5 py-0.5 rounded-sm font-black">
                                    🟢 BẢN DỊCH CHIA THOẠI
                                  </span>
                                  <button
                                    onClick={() => copyToClipboard(b.translated || "")}
                                    className="p-1 text-blue-500 hover:bg-blue-500/10 transition-colors uppercase font-black text-[9px] flex items-center gap-1 border border-blue-500/20 rounded-sm"
                                  >
                                    <Scan size={10} /> Sao Chép
                                  </button>
                                </div>
                                <div className={`p-2.5 rounded-sm text-xs md:text-sm font-black min-h-[46px] leading-snug break-words border-2 border-dashed border-emerald-500/30 ${isDarkMode ? 'bg-[#1e2a1e]' : 'bg-emerald-50/[0.3]'}`}>
                                  {b.translated || <span className="opacity-30 italic">Chưa dịch thoại</span>}
                                </div>
                              </div>
                              
                              {b.location && (
                                <span className="col-span-1 md:col-span-2 text-[8px] font-mono opacity-30 italic block text-right">
                                  Tọa độ: {b.location}
                                </span>
                              )}
                            </div>
                          ))}
                        </div>
                      </>
                    ) : (
                      <div className="flex-1 flex flex-col items-center justify-center p-12 opacity-30 space-y-3">
                        <FileText size={64} strokeWidth={1} />
                        <div className="text-center font-black">
                          <p className="text-xs uppercase tracking-wide">Trống Rỗng</p>
                          <p className="text-[10px] italic mt-1 font-medium">Vui lòng chọn hoặc nạp một phân đoạn khác</p>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Modal Footer / Navigation status */}
                <div className="p-3 bg-black text-white flex justify-between items-center text-[9px] font-black uppercase tracking-wider shrink-0 select-none">
                  <div className="flex items-center gap-1.5">
                    <Check size={12} className="text-emerald-400" />
                    <span>Nạp Kịch bản thành công</span>
                  </div>
                  <div>
                    <span>MioManga v2.0 • Script Reader Mode</span>
                  </div>
                </div>
              </motion.div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Custom Confirmation Modal */}
      <AnimatePresence>
        {confirmDialog.isOpen && (
          <>
            <motion.div 
              initial={{ opacity: 0 }} 
              animate={{ opacity: 1 }} 
              exit={{ opacity: 0 }}
              onClick={() => setConfirmDialog(prev => ({ ...prev, isOpen: false }))}
              className="fixed inset-0 bg-black/60 backdrop-blur-md z-[200] flex items-center justify-center p-4"
            >
              <motion.div 
                initial={{ scale: 0.95, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.95, opacity: 0 }}
                onClick={(e) => e.stopPropagation()}
                className={`w-full max-w-sm ${cCardBg} border-4 ${cBorder} p-6 shadow-[8px_8px_0px_#000] dark:shadow-[8px_8px_0px_rgba(228,227,224,0.15)] space-y-4`}
              >
                <div className="flex items-center gap-3 text-red-500 font-bold border-b-2 border-red-500/20 pb-3">
                  <AlertTriangle size={24} />
                  <span className="text-xs font-black tracking-widest uppercase">{confirmDialog.title}</span>
                </div>
                <p className="text-xs font-medium leading-relaxed opacity-90 select-none">
                  {confirmDialog.message}
                </p>
                <div className="flex gap-3 justify-end pt-2 font-black transition-all">
                  <button 
                    onClick={() => setConfirmDialog(prev => ({ ...prev, isOpen: false }))}
                    className={`px-4 py-2 border-2 ${cBorder} text-[10px] font-black uppercase active:scale-95 transition-all ${cBtnHover}`}
                  >
                    Hủy bỏ
                  </button>
                  <button 
                    onClick={confirmDialog.onConfirm}
                    className="px-4 py-2 bg-red-500 text-white text-[10px] font-black uppercase active:scale-95 hover:bg-red-600 transition-all border-2 border-transparent"
                  >
                    Xác nhận
                  </button>
                </div>
              </motion.div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
