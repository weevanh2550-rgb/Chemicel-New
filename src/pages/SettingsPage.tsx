import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ChevronLeft,
  ChevronRight,
  Plus,
  X,
  Lock,
  ImagePlus,
  RotateCcw,
  Move,
  Check,
  ZoomIn,
  ZoomOut,
  Trash2,
  Power,
  Upload,
  Image as ImageIcon,
  KeyRound,
  Sparkles,
  Keyboard,
} from 'lucide-react';
import { useBoiler, playSuccessDingSound } from '../context/BoilerContext';
import { PERMISSION_DEFINITIONS, parsePreviewImages, serializePreviewImages } from '../types/boiler';
import { isTouchscreenDevice } from '../utils/device';
import appLogo from '../assets/images/boiler_press_chem_logo_1791513593157.jpg';

const CROP_WIDTH = 960;
const CROP_HEIGHT = 360;

export const SettingsPage: React.FC = () => {
  const navigate = useNavigate();
  const {
    settings,
    boilers,
    chemicals,
    adminUnlocked,
    loginAdmin,
    logoutAdmin,
    changeAdminPin,
    saveAppSettings,
    togglePermission,
    manageBoiler,
    manageChemical,
    showToast,
  } = useBoiler();

  const [pinModalOpen, setPinModalOpen] = useState(false);
  const [adminPanelOpen, setAdminPanelOpen] = useState(false);
  const [pinInput, setPinInput] = useState('');
  const pinInputRef = useRef('');
  const pinBusyRef = useRef(false);
  const [pinErrorShake, setPinErrorShake] = useState(false);
  const [pinVerifyingState, setPinVerifyingState] = useState<'IDLE' | 'CHECKING' | 'SUCCESS'>('IDLE');

  const [isTouchDevice, setIsTouchDevice] = useState<boolean>(false);

  useEffect(() => {
    setIsTouchDevice(isTouchscreenDevice());
  }, []);

  const updatePinValue = (val: string) => {
    pinInputRef.current = val;
    setPinInput(val);
  };

  // PIN Change Flow inside Keypad Modal (just like reference app)
  const [pinChangeMode, setPinChangeMode] = useState(false);
  const [pinChangeStage, setPinChangeStage] = useState<'CURRENT' | 'NEW' | 'CONFIRM'>('CURRENT');
  const [tempOldPin, setTempOldPin] = useState('');
  const [tempNewPin, setTempNewPin] = useState('');

  // Admin Edit States
  const [siteName, setSiteName] = useState(settings.site_name);
  const [appVersion, setAppVersion] = useState(settings.app_version);
  const [previewImages, setPreviewImages] = useState<string[]>(() =>
    parsePreviewImages(settings.preview_image_url)
  );
  const [selectedSlideIdx, setSelectedSlideIdx] = useState<number>(0);
  const [editingSlideIdx, setEditingSlideIdx] = useState<number | null>(null);
  const [adminDragOffsetX, setAdminDragOffsetX] = useState<number>(0);
  const [isAdminDraggingSlide, setIsAdminDraggingSlide] = useState<boolean>(false);
  const adminSwipeStartRef = useRef<{ active: boolean; startX: number }>({
    active: false,
    startX: 0,
  });
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Facebook-style Preview Reposition / Crop States
  const [isAdjustingPreview, setIsAdjustingPreview] = useState(false);
  const [cropSourceImg, setCropSourceImg] = useState<HTMLImageElement | null>(null);
  const [cropOffset, setCropOffset] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [cropZoom, setCropZoom] = useState<number>(1);
  const cropCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const dragStateRef = useRef<{
    active: boolean;
    startX: number;
    startY: number;
    origX: number;
    origY: number;
  }>({ active: false, startX: 0, startY: 0, origX: 0, origY: 0 });

  const [newBoilerName, setNewBoilerName] = useState('');
  const [editingBoilerId, setEditingBoilerId] = useState<string | null>(null);
  const [editingBoilerName, setEditingBoilerName] = useState('');

  const [newChemName, setNewChemName] = useState('');
  const [newChemDivisor, setNewChemDivisor] = useState('');
  const [editingChemId, setEditingChemId] = useState<string | null>(null);
  const [editingChemName, setEditingChemName] = useState('');
  const [editingChemDivisor, setEditingChemDivisor] = useState('');

  const clampCropOffset = useCallback(
    (img: HTMLImageElement, offset: { x: number; y: number }, zoom: number) => {
      const baseScale = Math.max(CROP_WIDTH / img.width, CROP_HEIGHT / img.height);
      const scale = baseScale * zoom;
      const drawW = img.width * scale;
      const drawH = img.height * scale;
      const maxOffsetX = Math.max(0, (drawW - CROP_WIDTH) / 2);
      const maxOffsetY = Math.max(0, (drawH - CROP_HEIGHT) / 2);
      return {
        x: Math.max(-maxOffsetX, Math.min(maxOffsetX, offset.x)),
        y: Math.max(-maxOffsetY, Math.min(maxOffsetY, offset.y)),
      };
    },
    []
  );

  const drawCropCanvas = useCallback(() => {
    const canvas = cropCanvasRef.current;
    const img = cropSourceImg;
    if (!canvas || !img) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const baseScale = Math.max(CROP_WIDTH / img.width, CROP_HEIGHT / img.height);
    const scale = baseScale * cropZoom;
    const drawW = img.width * scale;
    const drawH = img.height * scale;
    const clamped = clampCropOffset(img, cropOffset, cropZoom);
    const dx = (CROP_WIDTH - drawW) / 2 + clamped.x;
    const dy = (CROP_HEIGHT - drawH) / 2 + clamped.y;

    ctx.clearRect(0, 0, CROP_WIDTH, CROP_HEIGHT);
    ctx.drawImage(img, dx, dy, drawW, drawH);
  }, [cropSourceImg, cropOffset, cropZoom, clampCropOffset]);

  useEffect(() => {
    if (isAdjustingPreview && cropSourceImg) {
      drawCropCanvas();
    }
  }, [isAdjustingPreview, cropSourceImg, drawCropCanvas]);

  useEffect(() => {
    setPreviewImages(parsePreviewImages(settings.preview_image_url));
  }, [settings.preview_image_url]);

  useEffect(() => {
    if (settings.app_version) setAppVersion(settings.app_version);
    if (settings.site_name) setSiteName(settings.site_name);
  }, [settings.app_version, settings.site_name]);

  const adminBannerSlides = previewImages;
  const adminSlideCount = adminBannerSlides.length;
  const safeSelectedSlideIdx = adminSlideCount > 0 ? selectedSlideIdx % adminSlideCount : 0;

  useEffect(() => {
    if (!adminPanelOpen || isAdjustingPreview || adminSlideCount <= 1 || isAdminDraggingSlide) return;
    const timer = window.setInterval(() => {
      setSelectedSlideIdx((prev) => (prev + 1) % adminSlideCount);
    }, 4500);
    return () => window.clearInterval(timer);
  }, [adminPanelOpen, isAdjustingPreview, adminSlideCount, isAdminDraggingSlide, safeSelectedSlideIdx]);

  const handleAdminBannerPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (adminSlideCount <= 1) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    adminSwipeStartRef.current = { active: true, startX: e.clientX };
    setIsAdminDraggingSlide(true);
    setAdminDragOffsetX(0);
  };

  const handleAdminBannerPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!adminSwipeStartRef.current.active || adminSlideCount <= 1) return;
    setAdminDragOffsetX(e.clientX - adminSwipeStartRef.current.startX);
  };

  const handleAdminBannerPointerEnd = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!adminSwipeStartRef.current.active) return;
    adminSwipeStartRef.current.active = false;
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {
      // Ignore
    }
    const delta = adminDragOffsetX;
    setAdminDragOffsetX(0);
    setIsAdminDraggingSlide(false);
    if (adminSlideCount > 1) {
      if (delta < -35) {
        setSelectedSlideIdx((prev) => (prev + 1) % adminSlideCount);
      } else if (delta > 35) {
        setSelectedSlideIdx((prev) => (prev - 1 + adminSlideCount) % adminSlideCount);
      }
    }
  };

  const triggerPinShake = () => {
    setPinErrorShake(true);
    setTimeout(() => {
      setPinErrorShake(false);
      updatePinValue('');
      pinBusyRef.current = false;
    }, 350);
  };

  const handleOpenAdmin = () => {
    if (adminUnlocked) {
      setSiteName(settings.site_name);
      setAppVersion(settings.app_version);
      setPreviewImages(parsePreviewImages(settings.preview_image_url));
      setSelectedSlideIdx(0);
      setEditingSlideIdx(null);
      setIsAdjustingPreview(false);
      setCropSourceImg(null);
      setAdminPanelOpen(true);
    } else {
      setPinChangeMode(false);
      pinBusyRef.current = false;
      updatePinValue('');
      setPinModalOpen(true);
    }
  };

  const handleOpenAddPreviewFile = () => {
    setEditingSlideIdx(null);
    fileInputRef.current?.click();
  };

  const handleOpenReplacePreviewFile = (idx: number) => {
    setEditingSlideIdx(idx);
    fileInputRef.current?.click();
  };

  const handleUploadPreviewFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      showToast('ไฟล์ไม่ถูกต้อง', 'กรุณาเลือกไฟล์รูปภาพจากคลังรูปเท่านั้น', 'error');
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        setCropSourceImg(img);
        setCropZoom(1);
        setCropOffset({ x: 0, y: 0 });
        setIsAdjustingPreview(true);
      };
      img.src = String(reader.result || '');
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const handleCropPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!cropSourceImg) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    dragStateRef.current = {
      active: true,
      startX: e.clientX,
      startY: e.clientY,
      origX: cropOffset.x,
      origY: cropOffset.y,
    };
  };

  const handleCropPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!dragStateRef.current.active || !cropSourceImg) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const ratioX = rect.width > 0 ? CROP_WIDTH / rect.width : 1;
    const ratioY = rect.height > 0 ? CROP_HEIGHT / rect.height : 1;
    const dx = (e.clientX - dragStateRef.current.startX) * ratioX;
    const dy = (e.clientY - dragStateRef.current.startY) * ratioY;
    const nextClamped = clampCropOffset(
      cropSourceImg,
      {
        x: dragStateRef.current.origX + dx,
        y: dragStateRef.current.origY + dy,
      },
      cropZoom
    );
    setCropOffset(nextClamped);
  };

  const handleCropPointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (dragStateRef.current.active) {
      dragStateRef.current.active = false;
      try {
        e.currentTarget.releasePointerCapture(e.pointerId);
      } catch {
        // Ignore
      }
    }
  };

  const handleChangeCropZoom = (nextZoom: number) => {
    const clampedZoom = Math.max(1, Math.min(3, nextZoom));
    setCropZoom(clampedZoom);
    if (cropSourceImg) {
      setCropOffset((prev) => clampCropOffset(cropSourceImg, prev, clampedZoom));
    }
  };

  const handleConfirmCropPreview = async () => {
    const canvas = cropCanvasRef.current;
    if (!canvas || !cropSourceImg) return;
    drawCropCanvas();
    const compressedDataUrl = canvas.toDataURL('image/jpeg', 0.84);
    let nextImages: string[];
    let nextSelected = 0;
    if (editingSlideIdx !== null && editingSlideIdx >= 0 && editingSlideIdx < previewImages.length) {
      nextImages = previewImages.map((img, i) => (i === editingSlideIdx ? compressedDataUrl : img));
      nextSelected = editingSlideIdx;
    } else {
      nextImages = [...previewImages, compressedDataUrl];
      nextSelected = nextImages.length - 1;
    }
    setPreviewImages(nextImages);
    setSelectedSlideIdx(nextSelected);
    setEditingSlideIdx(null);
    setIsAdjustingPreview(false);
    setCropSourceImg(null);
    await saveAppSettings({ preview_image_url: serializePreviewImages(nextImages) });
  };

  const handleDeletePreviewSlide = async (idxToRemove: number) => {
    if (previewImages.length <= 1) {
      showToast('ไม่สามารถลบได้', 'ต้องมีภาพพรีวิวเหลือไว้อย่างน้อย 1 รูปเสมอ', 'info');
      return;
    }
    const nextImages = previewImages.filter((_, i) => i !== idxToRemove);
    setPreviewImages(nextImages);
    setSelectedSlideIdx((prev) => Math.max(0, Math.min(prev, Math.max(0, nextImages.length - 1))));
    await saveAppSettings({ preview_image_url: serializePreviewImages(nextImages) });
  };

  const handleCancelCropPreview = () => {
    setEditingSlideIdx(null);
    setIsAdjustingPreview(false);
    setCropSourceImg(null);
    setCropOffset({ x: 0, y: 0 });
    setCropZoom(1);
  };

  const handleToggleAppEnabled = async () => {
    if (!adminUnlocked) {
      showToast('ต้องใส่รหัส PIN', 'กรุณาใส่รหัสผ่านแอดมินเพื่อเปิดหรือปิดระบบ', 'info');
      handleOpenAdmin();
      return;
    }
    const nextState = settings.app_enabled === false;
    showToast(
      nextState ? 'เปิดระบบสำเร็จ' : 'ปิดระบบสำเร็จ',
      nextState
        ? 'เปิดให้ทุกคนเข้าใช้งานระบบได้ตามปกติแล้ว'
        : 'ปิดปรับปรุงระบบชั่วคราวแล้ว (ระบบจะล็อกหน้าทำงานชั่วคราว)',
      'success'
    );
    const ok = await saveAppSettings({ app_enabled: nextState }, { suppressToast: true, silent: true });
    if (!ok) {
      showToast('เกิดข้อผิดพลาด', 'ไม่สามารถบันทึกสถานะระบบได้ กรุณาลองใหม่อีกครั้ง', 'error');
    }
  };

  const handleStartChangePinOnKeypad = () => {
    setPinChangeMode(true);
    setPinChangeStage('CURRENT');
    setTempOldPin('');
    setTempNewPin('');
    pinBusyRef.current = false;
    updatePinValue('');
    setPinModalOpen(true);
  };

  const handleKeypadPress = async (key: string) => {
    if (pinBusyRef.current) return;

    if (key === 'CLEAR') {
      updatePinValue('');
      return;
    }
    if (key === 'BACK') {
      updatePinValue(pinInputRef.current.slice(0, -1));
      return;
    }
    if (/^\d$/.test(key) && pinInputRef.current.length < 4) {
      const next = pinInputRef.current + key;
      updatePinValue(next);

      if (next.length === 4) {
        pinBusyRef.current = true;
        if (pinChangeMode) {
          if (pinChangeStage === 'CURRENT') {
            setPinVerifyingState('CHECKING');
            const verify = await loginAdmin(next);
            if (!verify.ok) {
              setPinVerifyingState('IDLE');
              triggerPinShake();
              return;
            }
            setPinVerifyingState('SUCCESS');
            playSuccessDingSound();
            setTimeout(() => {
              setPinVerifyingState('IDLE');
              setTempOldPin(next);
              setPinChangeStage('NEW');
              updatePinValue('');
              pinBusyRef.current = false;
            }, 450);
            return;
          }
          if (pinChangeStage === 'NEW') {
            setTempNewPin(next);
            setPinChangeStage('CONFIRM');
            updatePinValue('');
            pinBusyRef.current = false;
            return;
          }
          if (pinChangeStage === 'CONFIRM') {
            if (next !== tempNewPin) {
              showToast('รหัสไม่ตรงกัน', 'กรุณาตั้งรหัสใหม่ 4 หลักอีกครั้ง', 'error');
              setPinChangeStage('NEW');
              triggerPinShake();
              return;
            }
            setPinVerifyingState('CHECKING');
            const res = await changeAdminPin(tempOldPin, next);
            if (res.ok) {
              setPinVerifyingState('SUCCESS');
              playSuccessDingSound();
              setTimeout(() => {
                setPinVerifyingState('IDLE');
                setPinChangeMode(false);
                setPinModalOpen(false);
                updatePinValue('');
                pinBusyRef.current = false;
              }, 500);
            } else {
              setPinVerifyingState('IDLE');
              triggerPinShake();
            }
            return;
          }
        } else {
          setPinVerifyingState('CHECKING');
          const res = await loginAdmin(next);
          if (res.ok) {
            setPinVerifyingState('SUCCESS');
            playSuccessDingSound();
            setTimeout(() => {
              setPinVerifyingState('IDLE');
              setPinModalOpen(false);
              updatePinValue('');
              pinBusyRef.current = false;
              setSiteName(settings.site_name);
              setAppVersion(settings.app_version);
              setPreviewImages(parsePreviewImages(settings.preview_image_url));
              setSelectedSlideIdx(0);
              setAdminPanelOpen(true);
            }, 350);
          } else {
            setPinVerifyingState('IDLE');
            triggerPinShake();
          }
        }
      }
    }
  };

  // Physical keyboard listener for Desktop Computers
  useEffect(() => {
    if (!pinModalOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // If typing in another normal text input, don't hijack
      if (
        e.target instanceof HTMLInputElement &&
        e.target.id !== 'desktopPinInput'
      ) {
        return;
      }
      if (e.target instanceof HTMLTextAreaElement) return;

      if (/^\d$/.test(e.key)) {
        e.preventDefault();
        handleKeypadPress(e.key);
      } else if (e.key === 'Backspace') {
        e.preventDefault();
        handleKeypadPress('BACK');
      } else if (e.key === 'Escape') {
        e.preventDefault();
        setPinModalOpen(false);
        updatePinValue('');
      } else if (e.key === 'Delete') {
        e.preventDefault();
        handleKeypadPress('CLEAR');
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [pinModalOpen, pinChangeMode, pinChangeStage, tempNewPin, tempOldPin]);

  const handleAddBoiler = async () => {
    if (!newBoilerName.trim()) return;
    const ok = await manageBoiler({ action: 'add', name: newBoilerName.trim() });
    if (ok) setNewBoilerName('');
  };

  const handleSaveBoilerRename = async (id: string) => {
    if (!editingBoilerName.trim()) return;
    const ok = await manageBoiler({ id, name: editingBoilerName.trim(), action: 'rename' });
    if (ok) {
      setEditingBoilerId(null);
      setEditingBoilerName('');
    }
  };

  const handleAddChemical = async () => {
    const div = parseFloat(newChemDivisor);
    if (!newChemName.trim() || !Number.isFinite(div) || div <= 0) {
      showToast('ข้อมูลไม่ถูกต้อง', 'กรุณาระบุชื่อสารเคมีและตัวหารที่ถูกต้อง', 'error');
      return;
    }
    const ok = await manageChemical({
      action: 'add',
      name: newChemName.trim(),
      divisor: div,
      unit: 'L',
    });
    if (ok) {
      setNewChemName('');
      setNewChemDivisor('');
    }
  };

  const handleSaveChemUpdate = async (id: string) => {
    const div = parseFloat(editingChemDivisor);
    if (!editingChemName.trim() || !Number.isFinite(div) || div <= 0) {
      showToast('ข้อมูลไม่ถูกต้อง', 'กรุณาระบุชื่อและตัวหารให้ถูกต้อง', 'error');
      return;
    }
    const ok = await manageChemical({
      id,
      name: editingChemName.trim(),
      divisor: div,
      action: 'update',
    });
    if (ok) {
      setEditingChemId(null);
      setEditingChemName('');
      setEditingChemDivisor('');
    }
  };

  const pinHintText = pinChangeMode
    ? pinChangeStage === 'CURRENT'
      ? 'ใส่รหัส Admin เดิม 4 หลัก'
      : pinChangeStage === 'NEW'
      ? 'ตั้งรหัสใหม่ 4 หลัก'
      : 'ยืนยันรหัสใหม่ 4 หลัก'
    : 'กรุณาใส่รหัส Admin 4 หลัก';

  return (
    <div className="h-[calc(100dvh-8rem)] max-h-[calc(100dvh-8rem)] flex flex-col justify-between overflow-hidden touch-none select-none overscroll-none pb-2">
      {/* Subpage Header */}
      <div className="flex items-center gap-3 pt-1 shrink-0">
        <button
          type="button"
          onClick={() => navigate('/')}
          aria-label="กลับหน้าหลัก"
          className="w-10 h-10 rounded-2xl bg-white border border-sky-100/90 text-sky-700 hover:bg-sky-50/70 hover:border-sky-300 active:bg-sky-100 active:border-sky-400 active:scale-95 flex items-center justify-center text-xl font-bold shadow-2xs transition-all cursor-pointer"
        >
          <ChevronLeft className="w-5 h-5" />
        </button>
        <div>
          <span className="block text-[9px] font-black tracking-[2px] text-sky-600 uppercase">
            SETTINGS
          </span>
          <h2 className="text-lg font-extrabold text-slate-900 -mt-0.5">การตั้งค่า</h2>
        </div>
      </div>

      {/* Admin Profile Row Card */}
      <button
        type="button"
        onClick={handleOpenAdmin}
        className="w-full shrink-0 rounded-3xl bg-white border border-sky-100/90 hover:border-sky-300 hover:bg-sky-50/40 active:border-sky-400 active:bg-sky-100/60 active:ring-2 active:ring-sky-200/80 active:scale-[0.99] p-4 shadow-2xs flex items-center gap-3.5 text-left transition-all duration-150 cursor-pointer"
      >
        <img
          src={appLogo}
          alt="ผู้ดูแลระบบ"
          referrerPolicy="no-referrer"
          className="w-12 h-12 rounded-2xl object-cover border border-sky-100/90 shrink-0"
        />
        <div className="min-w-0 flex-1">
          <div className="font-extrabold text-sm text-slate-900">ผู้ดูแลระบบ</div>
          <div className="text-[11px] text-slate-400 truncate mt-0.5">
            กดเพื่อเข้าสู่ฟังก์ชันผู้ดูแลระบบ • ต้องใส่รหัส PIN
          </div>
        </div>
        <ChevronRight className="w-5 h-5 text-sky-500 shrink-0" />
      </button>

      {/* General & App Info Section */}
      <div className="space-y-2 pt-1 shrink-0">
        <div className="text-[11px] font-bold text-slate-400 px-1">ทั่วไป • ข้อมูลแอป</div>

        <div className="rounded-3xl bg-white border border-sky-100/90 hover:border-sky-200 active:border-sky-300 active:bg-sky-50/30 p-4 shadow-2xs flex items-center gap-3.5 transition-all">
          <img
            src={appLogo}
            alt="โลโก้ระบบสารเคมี"
            referrerPolicy="no-referrer"
            className="w-14 h-14 rounded-2xl object-cover border border-sky-100/90 shrink-0"
          />
          <div>
            <strong className="text-sm font-extrabold text-slate-900 block">
              {settings.site_name || 'Boiler Chemical'}
            </strong>
            <p className="text-xs text-slate-500 mt-0.5">
              ระบบจัดการและคำนวณสารเคมี
            </p>
            <span className="inline-block mt-1 text-[11px] font-bold text-sky-600 bg-sky-50 px-2.5 py-0.5 rounded-lg border border-sky-100">
              เวอร์ชัน <b>{settings.app_version || '3.0.0'}</b>
            </span>
          </div>
        </div>

        <div className="rounded-3xl bg-white border border-sky-100/90 hover:border-sky-200 active:border-sky-300 active:bg-sky-50/30 p-4 shadow-2xs divide-y divide-sky-50 text-xs transition-all">
          <div className="flex items-center justify-between py-2.5 first:pt-0">
            <span className="text-slate-500">สร้างเมื่อ</span>
            <b className="text-slate-800">7 ตุลาคม 2026</b>
          </div>
          <div className="flex items-center justify-between py-2.5">
            <span className="text-slate-500">ผู้พัฒนา</span>
            <b className="text-slate-800">{settings.developer_name}</b>
          </div>
          <div className="flex items-center justify-between py-2.5 last:pb-0">
            <span className="text-slate-500">ประเภทระบบ</span>
            <b className="text-slate-800">Boiler Chemical Management</b>
          </div>
        </div>
      </div>

      {/* Full-Screen Admin Settings Panel */}
      {adminPanelOpen && adminUnlocked && (
        <div className="fixed inset-0 z-40 bg-white flex flex-col overflow-hidden animate-in fade-in duration-150">
          {/* Sticky Full-Screen Top Header Bar */}
          <div className="sticky top-0 z-20 bg-white/95 backdrop-blur-md border-b border-sky-100 px-4 py-3.5 flex items-center justify-between shadow-2xs">
            <div>
              <h3 className="text-base font-extrabold text-sky-800 flex items-center gap-2">
                <span>ตั้งค่าระบบ (Admin)</span>
                <span className="text-[10px] font-bold text-sky-600 bg-sky-50 px-2 py-0.5 rounded-full border border-sky-100">
                  v{settings.app_version}
                </span>
              </h3>
              <p className="text-[11px] text-slate-400">
                แผงควบคุมระบบสำหรับผู้ดูแลระบบ
              </p>
            </div>
            <button
              type="button"
              onClick={() => {
                setAdminPanelOpen(false);
                logoutAdmin();
              }}
              aria-label="ปิดหน้าต่างตั้งค่า"
              className="w-9 h-9 rounded-full bg-slate-100 hover:bg-rose-100 hover:text-rose-600 flex items-center justify-center text-slate-500 font-bold transition-colors cursor-pointer shadow-2xs active:scale-95"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Full-Screen Scrollable Content Area */}
          <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-5 max-w-2xl w-full mx-auto pb-24">
            {/* 0. สวิตช์เปิด-ปิดระบบแอป (Maintenance Mode) */}
            <div className="p-3.5 rounded-2xl bg-sky-50/60 border border-sky-100/90 flex items-center justify-between gap-3">
              <div className="min-w-0 flex-1">
                <div className="text-xs font-black text-slate-900 flex items-center gap-2 flex-wrap">
                  <span>สถานะการเปิดใช้งานแอป</span>
                  <span
                    className={`text-[10px] px-2 py-0.5 rounded-full font-extrabold ${
                      settings.app_enabled !== false
                        ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                        : 'bg-amber-100 text-amber-900 border border-amber-200'
                    }`}
                  >
                    {settings.app_enabled !== false ? 'เปิดใช้งานปกติ' : 'ปิดปรับปรุงชั่วคราว'}
                  </span>
                </div>
                <div className="text-[10px] text-slate-500 mt-1 leading-snug">
                  {settings.app_enabled !== false
                    ? 'สับสวิตช์ปิดเพื่อล็อกไม่ให้ผู้ใช้อื่นเข้าใช้งานระหว่างที่คุณกำลังอัปเดตระบบ'
                    : 'ล็อกหน้าทำงานอยู่ (จะขึ้นกล่อง "ปิดปรับปรุงชั่วคราว จะเปิดให้ใช้งานในเร็วๆ นี้")'}
                </div>
              </div>
              <button
                type="button"
                onClick={handleToggleAppEnabled}
                aria-label={settings.app_enabled !== false ? 'ปิดการใช้งานแอป' : 'เปิดการใช้งานแอป'}
                className={`w-12 h-7 rounded-full p-0.5 transition-colors cursor-pointer shrink-0 border shadow-2xs ${
                  settings.app_enabled !== false
                    ? 'bg-emerald-500 border-emerald-600'
                    : 'bg-slate-300 border-slate-400'
                }`}
              >
                <span
                  className={`block w-5.5 h-5.5 rounded-full bg-white shadow-xs transition-transform ${
                    settings.app_enabled !== false ? 'translate-x-5' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>

            {/* 1. เปลี่ยนรหัสผ่านผู้ดูแลระบบ (Admin PIN) — ย้ายมาอยู่ตำแหน่งนี้แทนชื่อแอป/เลขเวอร์ชัน */}
            <div className="p-3.5 rounded-2xl bg-sky-50/60 border border-sky-100/90 flex items-center justify-between gap-3 shadow-2xs">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-10 h-10 rounded-2xl bg-sky-100/80 border border-sky-200/60 flex items-center justify-center text-sky-700 shrink-0">
                  <KeyRound className="w-5 h-5" />
                </div>
                <div className="min-w-0">
                  <div className="text-xs font-black text-slate-900">
                    รหัสผ่านผู้ดูแลระบบ (Admin PIN)
                  </div>
                  <div className="text-[10px] text-slate-500 mt-0.5">
                    เปลี่ยนรหัสความปลอดภัย 4 หลักสำหรับเข้าจัดการระบบ
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={handleStartChangePinOnKeypad}
                className="px-3.5 py-2.5 rounded-xl bg-sky-600 hover:bg-sky-700 active:bg-sky-800 active:scale-95 text-white text-xs font-extrabold cursor-pointer transition-all shadow-xs shrink-0"
              >
                เปลี่ยนรหัส PIN
              </button>
            </div>

            {/* 1.5 เปลี่ยนภาพพรีวิวหน้าหลัก (Preview Banner — รองรับหลายรูปและสไลด์อัตโนมัติ) */}
            <div className="space-y-2.5">
              <div>
                <label className="block text-xs font-extrabold text-slate-800">
                  ภาพพรีวิวหน้าหลัก (Preview Banner)
                </label>
                <span className="block text-[10px] text-slate-400">
                  เพิ่มได้หลายรูป • สไลด์อัตโนมัติทุก 4-5 วินาที หรือใช้นิ้วปัดเลื่อนเองได้ (ต้องมีอย่างน้อย 1 รูป)
                </span>
              </div>

              {isAdjustingPreview && cropSourceImg ? (
                <div className="space-y-2.5 rounded-2xl border border-sky-200 bg-sky-50/40 p-2.5">
                  <div
                    onPointerDown={handleCropPointerDown}
                    onPointerMove={handleCropPointerMove}
                    onPointerUp={handleCropPointerUp}
                    onPointerCancel={handleCropPointerUp}
                    className="w-full h-36 rounded-2xl overflow-hidden border-2 border-sky-500 bg-slate-900 relative shadow-sm select-none touch-none cursor-grab active:cursor-grabbing"
                  >
                    <canvas
                      ref={cropCanvasRef}
                      width={CROP_WIDTH}
                      height={CROP_HEIGHT}
                      className="w-full h-full object-cover block pointer-events-none"
                    />
                    <div className="absolute top-2.5 right-2.5 bg-slate-950/80 text-white text-[10px] font-bold px-2.5 py-1 rounded-full flex items-center gap-1.5 backdrop-blur-xs border border-white/15 pointer-events-none shadow-sm">
                      <Move className="w-3 h-3 text-sky-400" />
                      <span>กดค้างแล้วลากเพื่อเลื่อนหามุมที่ต้องการ</span>
                    </div>
                  </div>

                  {/* Zoom Slider for Fine-Tuning Angle & Framing */}
                  <div className="flex items-center gap-2 px-1">
                    <button
                      type="button"
                      onClick={() => handleChangeCropZoom(cropZoom - 0.15)}
                      aria-label="ซูมออก"
                      className="w-7 h-7 rounded-lg bg-white border border-sky-200 text-slate-600 hover:text-sky-700 hover:bg-sky-50 flex items-center justify-center shrink-0 cursor-pointer"
                    >
                      <ZoomOut className="w-3.5 h-3.5" />
                    </button>
                    <input
                      type="range"
                      min="1"
                      max="3"
                      step="0.02"
                      value={cropZoom}
                      onChange={(e) => handleChangeCropZoom(parseFloat(e.target.value))}
                      aria-label="ซูมปรับขนาดภาพพรีวิว"
                      className="flex-1 accent-sky-600 h-1.5 bg-sky-200 rounded-lg cursor-pointer"
                    />
                    <button
                      type="button"
                      onClick={() => handleChangeCropZoom(cropZoom + 0.15)}
                      aria-label="ซูมเข้า"
                      className="w-7 h-7 rounded-lg bg-white border border-sky-200 text-slate-600 hover:text-sky-700 hover:bg-sky-50 flex items-center justify-center shrink-0 cursor-pointer"
                    >
                      <ZoomIn className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  {/* Cancel & Confirm Buttons */}
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={handleCancelCropPreview}
                      className="flex-1 py-2 px-3 rounded-xl bg-white hover:bg-slate-100 border border-slate-200 text-slate-600 text-xs font-extrabold flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      <X className="w-3.5 h-3.5" />
                      <span>ยกเลิก</span>
                    </button>
                    <button
                      type="button"
                      onClick={handleConfirmCropPreview}
                      className="flex-1 py-2 px-3 rounded-xl bg-sky-600 hover:bg-sky-700 text-white text-xs font-extrabold flex items-center justify-center gap-1.5 shadow-xs cursor-pointer"
                    >
                      <Check className="w-4 h-4" />
                      <span>ยืนยัน</span>
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  {/* Main Carousel Preview Box */}
                  {adminSlideCount === 0 ? (
                    <div className="w-full h-36 rounded-2xl border-2 border-dashed border-sky-200 bg-sky-50/50 flex flex-col items-center justify-center text-center p-4">
                      <ImageIcon className="w-8 h-8 text-sky-400 mb-1" />
                      <p className="text-xs font-bold text-slate-700">ยังไม่มีภาพพรีวิว</p>
                      <p className="text-[10px] text-slate-400 mt-0.5">กดปุ่ม "+ เพิ่มรูปภาพ" ด้านล่างเพื่ออัปโหลดรูปภาพของคุณ</p>
                    </div>
                  ) : (
                    <div
                      onPointerDown={handleAdminBannerPointerDown}
                      onPointerMove={handleAdminBannerPointerMove}
                      onPointerUp={handleAdminBannerPointerEnd}
                      onPointerCancel={handleAdminBannerPointerEnd}
                      className={`w-full h-36 rounded-2xl overflow-hidden border border-sky-200 bg-slate-900 relative shadow-2xs select-none touch-pan-y ${
                        adminSlideCount > 1 ? 'cursor-grab active:cursor-grabbing' : ''
                      }`}
                    >
                      <div
                        className={`flex w-full h-full ${
                          isAdminDraggingSlide ? '' : 'transition-transform duration-500 ease-out'
                        }`}
                        style={{
                          transform: `translate3d(calc(-${safeSelectedSlideIdx * 100}% + ${adminDragOffsetX}px), 0, 0)`,
                        }}
                      >
                        {adminBannerSlides.map((imgSrc, idx) => (
                          <div key={idx} className="w-full h-full shrink-0">
                            <img
                              src={imgSrc}
                              alt={`ตัวอย่างภาพพรีวิว ${idx + 1}`}
                              referrerPolicy="no-referrer"
                              draggable={false}
                              className="w-full h-full object-cover object-center pointer-events-none select-none"
                            />
                          </div>
                        ))}
                      </div>

                    {adminSlideCount > 1 && (
                      <div className="absolute bottom-2 inset-x-0 flex items-center justify-center gap-1.5 z-10">
                        {adminBannerSlides.map((_, idx) => (
                          <button
                            key={idx}
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedSlideIdx(idx);
                            }}
                            className={`h-1.5 rounded-full transition-all cursor-pointer ${
                              idx === safeSelectedSlideIdx
                                ? 'w-5 bg-white shadow-xs'
                                : 'w-1.5 bg-white/55 hover:bg-white/80'
                            }`}
                          />
                        ))}
                      </div>
                    )}
                  </div>
                )}

                  {/* Selectable Thumbnail Strip with single inline "+ เพิ่มรูป" button */}
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between px-0.5">
                      <span className="text-[11px] font-bold text-slate-600">
                        {previewImages.length > 0
                          ? `รูปพรีวิวทั้งหมด (${previewImages.length} รูป) • แตะเพื่อเลือกดูหรือแก้ไข`
                          : 'รูปพรีวิว • กด + เพิ่มรูปเพื่อใส่ภาพสไลด์'}
                      </span>
                      {previewImages.length > 0 && (
                        <button
                          type="button"
                          onClick={() => handleOpenReplacePreviewFile(safeSelectedSlideIdx)}
                          className="text-[10px] font-bold text-sky-600 hover:text-sky-700 bg-sky-50 hover:bg-sky-100 px-2 py-0.5 rounded-lg border border-sky-200 cursor-pointer"
                        >
                          เปลี่ยนรูปที่ {safeSelectedSlideIdx + 1}
                        </button>
                      )}
                    </div>
                    <div className="flex items-center gap-2 overflow-x-auto pb-1 pt-0.5">
                      {previewImages.map((imgSrc, idx) => {
                        const isSelected = idx === safeSelectedSlideIdx;
                        return (
                          <div
                            key={idx}
                            onClick={() => setSelectedSlideIdx(idx)}
                            className={`relative w-20 h-12 rounded-xl overflow-hidden shrink-0 border-2 transition-all cursor-pointer ${
                              isSelected
                                ? 'border-sky-600 ring-2 ring-sky-200 scale-[1.02]'
                                : 'border-slate-200 opacity-75 hover:opacity-100'
                            }`}
                          >
                            <img
                              src={imgSrc}
                              alt={`รูปที่ ${idx + 1}`}
                              className="w-full h-full object-cover"
                            />
                            <span className="absolute bottom-0.5 left-1 bg-slate-950/75 text-white text-[9px] font-extrabold px-1.5 py-0.2 rounded-md">
                              #{idx + 1}
                            </span>
                            {previewImages.length > 1 && (
                              <button
                                type="button"
                                aria-label={`ลบรูปที่ ${idx + 1}`}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleDeletePreviewSlide(idx);
                                }}
                                className="absolute top-0.5 right-0.5 w-4 h-4 rounded-full bg-rose-600/90 hover:bg-rose-700 text-white flex items-center justify-center shadow-xs cursor-pointer"
                              >
                                <Trash2 className="w-2.5 h-2.5" />
                              </button>
                            )}
                          </div>
                        );
                      })}

                      <button
                        type="button"
                        onClick={handleOpenAddPreviewFile}
                        className="w-20 h-12 rounded-xl border-2 border-dashed border-sky-300 bg-sky-50/50 hover:bg-sky-100/70 text-sky-600 flex flex-col items-center justify-center shrink-0 text-[10px] font-extrabold cursor-pointer transition-colors"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>เพิ่มรูป</span>
                      </button>
                    </div>
                  </div>
                </>
              )}

              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleUploadPreviewFile}
                className="hidden"
              />
            </div>

            {/* 2. Permission Center */}
            <div className="space-y-2">
              <label className="block text-xs font-extrabold text-slate-800">
                Permission Center (เปิด-ปิดสิทธิ์การใช้งาน)
              </label>
              <div className="space-y-1.5">
                {PERMISSION_DEFINITIONS.map((perm) => {
                  const isOn = settings.permissions[perm.key] !== false;
                  return (
                    <div
                      key={perm.key}
                      className="flex items-center justify-between p-2.5 rounded-2xl bg-sky-50/50 border border-sky-100"
                    >
                      <div>
                        <div className="text-xs font-bold text-slate-800">{perm.label}</div>
                        <div className="text-[10px] text-slate-400">{perm.description}</div>
                      </div>
                      <button
                        type="button"
                        onClick={() => togglePermission(perm.key, perm.label)}
                        className={`w-11 h-6 rounded-full p-0.5 transition-colors cursor-pointer ${
                          isOn ? 'bg-sky-600' : 'bg-slate-300'
                        }`}
                      >
                        <span
                          className={`block w-5 h-5 rounded-full bg-white transition-transform ${
                            isOn ? 'translate-x-5' : 'translate-x-0'
                          }`}
                        />
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* 3. จัดการ Boiler */}
            <div className="space-y-2">
              <label className="block text-xs font-extrabold text-slate-800">
                จัดการรายการ Boiler
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={newBoilerName}
                  onChange={(e) => setNewBoilerName(e.target.value)}
                  placeholder="ชื่อ Boiler ใหม่..."
                  className="flex-1 rounded-xl border border-sky-200 px-3 py-2 text-xs font-bold"
                />
                <button
                  type="button"
                  onClick={handleAddBoiler}
                  className="px-3 py-2 rounded-xl bg-sky-600 hover:bg-sky-700 text-white text-xs font-bold flex items-center gap-1 cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>เพิ่ม</span>
                </button>
              </div>
              <div className="space-y-1.5">
                {boilers.map((b) => {
                  const isEditing = editingBoilerId === b.id;
                  return (
                    <div
                      key={b.id}
                      className="flex items-center justify-between p-2 rounded-xl border border-sky-200 bg-white text-xs shadow-2xs"
                    >
                      {isEditing ? (
                        <div className="flex items-center gap-1.5 flex-1">
                          <input
                            type="text"
                            value={editingBoilerName}
                            onChange={(e) => setEditingBoilerName(e.target.value)}
                            className="flex-1 rounded-lg border border-sky-300 px-2 py-1 text-xs font-bold"
                          />
                          <button
                            type="button"
                            onClick={() => handleSaveBoilerRename(b.id)}
                            className="px-2 py-1 rounded-lg bg-sky-600 text-white text-[10px] font-bold"
                          >
                            บันทึก
                          </button>
                          <button
                            type="button"
                            onClick={() => setEditingBoilerId(null)}
                            className="px-2 py-1 rounded-lg bg-slate-100 text-slate-600 text-[10px] font-bold"
                          >
                            ยกเลิก
                          </button>
                        </div>
                      ) : (
                        <>
                          <span className="font-bold text-slate-700">{b.name}</span>
                          <div className="flex gap-1">
                            <button
                              type="button"
                              onClick={() => {
                                setEditingBoilerId(b.id);
                                setEditingBoilerName(b.name);
                              }}
                              className="text-[10px] font-bold text-sky-600 bg-sky-50 hover:bg-sky-100 px-2 py-1 rounded-lg"
                            >
                              แก้
                            </button>
                            <button
                              type="button"
                              onClick={() => manageBoiler({ id: b.id, action: 'delete' })}
                              className="text-[10px] font-bold text-rose-500 bg-rose-50 hover:bg-rose-100 px-2 py-1 rounded-lg"
                            >
                              ปิด
                            </button>
                          </div>
                        </>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* 4. จัดการสารเคมี */}
            <div className="space-y-2">
              <label className="block text-xs font-extrabold text-slate-800">
                จัดการสารเคมีและตัวหาร
              </label>
              <div className="grid grid-cols-12 gap-2">
                <input
                  type="text"
                  value={newChemName}
                  onChange={(e) => setNewChemName(e.target.value)}
                  placeholder="ชื่อสารเคมี"
                  className="col-span-6 rounded-xl border border-sky-200 px-3 py-2 text-xs font-bold"
                />
                <input
                  type="number"
                  step="any"
                  value={newChemDivisor}
                  onChange={(e) => setNewChemDivisor(e.target.value)}
                  placeholder="ตัวหาร"
                  className="col-span-3 rounded-xl border border-sky-200 px-2.5 py-2 text-xs font-bold"
                />
                <button
                  type="button"
                  onClick={handleAddChemical}
                  className="col-span-3 rounded-xl bg-sky-600 hover:bg-sky-700 text-white text-xs font-bold cursor-pointer"
                >
                  + เพิ่ม
                </button>
              </div>
              <div className="space-y-1.5">
                {chemicals.map((c) => {
                  const isEditing = editingChemId === c.id;
                  return (
                    <div
                      key={c.id}
                      className="flex items-center justify-between p-2 rounded-xl border border-sky-200 bg-white text-xs shadow-2xs"
                    >
                      {isEditing ? (
                        <div className="flex items-center gap-1.5 flex-1">
                          <input
                            type="text"
                            value={editingChemName}
                            onChange={(e) => setEditingChemName(e.target.value)}
                            className="flex-1 rounded-lg border border-sky-300 px-2 py-1 text-xs font-bold"
                          />
                          <input
                            type="number"
                            step="any"
                            value={editingChemDivisor}
                            onChange={(e) => setEditingChemDivisor(e.target.value)}
                            className="w-16 rounded-lg border border-sky-300 px-2 py-1 text-xs font-bold"
                          />
                          <button
                            type="button"
                            onClick={() => handleSaveChemUpdate(c.id)}
                            className="px-2 py-1 rounded-lg bg-sky-600 text-white text-[10px] font-bold"
                          >
                            บันทึก
                          </button>
                          <button
                            type="button"
                            onClick={() => setEditingChemId(null)}
                            className="px-2 py-1 rounded-lg bg-slate-100 text-slate-600 text-[10px] font-bold"
                          >
                            ยกเลิก
                          </button>
                        </div>
                      ) : (
                        <>
                          <div>
                            <span className="font-bold text-slate-700">{c.name}</span>
                            <span className="ml-1.5 text-[10px] font-bold text-sky-600 bg-sky-50 px-1.5 py-0.5 rounded-md">
                              ÷ {c.divisor}
                            </span>
                          </div>
                          <div className="flex gap-1">
                            <button
                              type="button"
                              onClick={() => {
                                setEditingChemId(c.id);
                                setEditingChemName(c.name);
                                setEditingChemDivisor(String(c.divisor));
                              }}
                              className="text-[10px] font-bold text-sky-600 bg-sky-50 hover:bg-sky-100 px-2 py-1 rounded-lg"
                            >
                              แก้
                            </button>
                            <button
                              type="button"
                              onClick={() => manageChemical({ id: c.id, action: 'delete' })}
                              className="text-[10px] font-bold text-rose-500 bg-rose-50 hover:bg-rose-100 px-2 py-1 rounded-lg"
                            >
                              ปิด
                            </button>
                          </div>
                        </>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

          </div>
        </div>
      )}

      {/* 4-Digit Admin PIN Lock Modal (No default PIN hints shown) */}
      {pinModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-sky-950/50 backdrop-blur-xs p-4">
          <div className="bg-white rounded-3xl p-5 max-w-xs w-full shadow-2xl border border-sky-100 relative overflow-hidden">
            {/* Compact Verification Popup Box — Small and clean like the previous loading card */}
            {pinVerifyingState !== 'IDLE' && (
              <div className="absolute inset-0 z-30 flex items-center justify-center bg-slate-900/20 backdrop-blur-[2px] p-4 animate-in fade-in duration-100 select-none">
                <div className="bg-white rounded-3xl border border-sky-100 shadow-xl px-5 py-4 flex flex-col items-center gap-2.5 max-w-[210px] w-full text-center">
                  {pinVerifyingState === 'CHECKING' ? (
                    <>
                      <div className="relative w-10 h-10 flex items-center justify-center">
                        <div className="w-10 h-10 rounded-full border-3 border-sky-100 border-t-sky-600 animate-spin" />
                        <Lock className="w-4 h-4 text-sky-600 absolute" />
                      </div>
                      <p className="text-xs font-bold text-slate-700">กำลังตรวจสอบ...</p>
                    </>
                  ) : (
                    <>
                      <div className="w-10 h-10 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-600 flex items-center justify-center shadow-2xs">
                        <Check className="w-5 h-5 stroke-[3]" />
                      </div>
                      <p className="text-xs font-bold text-emerald-700">ตรวจสอบสำเร็จ</p>
                    </>
                  )}
                </div>
              </div>
            )}

            <button
              type="button"
              onClick={() => {
                pinBusyRef.current = false;
                updatePinValue('');
                setPinModalOpen(false);
                setPinChangeMode(false);
              }}
              aria-label="ออกจากหน้ารหัส"
              className="absolute top-3.5 right-3.5 w-8 h-8 rounded-full bg-slate-100 text-slate-500 hover:bg-rose-100 hover:text-rose-600 flex items-center justify-center"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="text-center mb-4">
              <div className="w-11 h-11 mx-auto mb-2 rounded-full bg-sky-50 text-sky-600 flex items-center justify-center">
                <Lock className="w-5 h-5" />
              </div>
              <h3 className="text-base font-extrabold text-sky-700">
                {pinChangeMode ? 'เปลี่ยนรหัสผู้ดูแลระบบ' : 'เข้าสู่การตั้งค่าระบบ'}
              </h3>
              <p className="text-xs text-slate-500 font-semibold mt-0.5">สำหรับผู้ดูแลระบบ</p>
            </div>

            {/* PIN Input Area: On touch devices show dots and virtual keypad; on computers show direct keyboard input */}
            {isTouchDevice ? (
              <>
                {/* PIN Dots (เฉพาะบนมือถือ/แท็บเล็ต) */}
                <div
                  className={`flex justify-center items-center gap-3 my-3 transition-transform ${
                    pinErrorShake ? 'translate-x-1.5 text-rose-500' : ''
                  }`}
                >
                  {[0, 1, 2, 3].map((i) => (
                    <span
                      key={i}
                      className={`w-3.5 h-3.5 rounded-full transition-all ${
                        pinErrorShake
                          ? 'bg-rose-500 scale-110'
                          : pinInput.length > i
                          ? 'bg-sky-600 scale-110'
                          : 'bg-slate-200'
                      }`}
                    />
                  ))}
                </div>

                <p className="text-[11px] text-slate-400 font-semibold text-center mb-3">
                  {pinHintText}
                </p>

                {/* Numeric Keypad บนหน้าจอ */}
                <div className="grid grid-cols-3 gap-2.5 max-w-[240px] mx-auto select-none touch-manipulation">
                  {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((digit) => (
                    <button
                      key={digit}
                      type="button"
                      onClick={() => handleKeypadPress(digit)}
                      className="h-11 rounded-2xl bg-sky-50/70 hover:bg-sky-100 active:bg-sky-200 active:scale-95 border border-sky-100 text-sm font-extrabold text-slate-800 cursor-pointer touch-manipulation select-none transition-transform duration-75"
                    >
                      {digit}
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={() => handleKeypadPress('CLEAR')}
                    className="h-11 rounded-2xl bg-slate-100 hover:bg-slate-200 active:bg-slate-300 active:scale-95 text-[11px] font-bold text-slate-600 cursor-pointer touch-manipulation select-none transition-transform duration-75"
                  >
                    ล้าง
                  </button>
                  <button
                    type="button"
                    onClick={() => handleKeypadPress('0')}
                    className="h-11 rounded-2xl bg-sky-50/70 hover:bg-sky-100 active:bg-sky-200 active:scale-95 border border-sky-100 text-sm font-extrabold text-slate-800 cursor-pointer touch-manipulation select-none transition-transform duration-75"
                  >
                    0
                  </button>
                  <button
                    type="button"
                    onClick={() => handleKeypadPress('BACK')}
                    className="h-11 rounded-2xl bg-rose-50 hover:bg-rose-100 active:bg-rose-200 active:scale-95 text-[11px] font-bold text-rose-600 cursor-pointer touch-manipulation select-none transition-transform duration-75"
                  >
                    ลบ
                  </button>
                </div>
              </>
            ) : (
              <div className="text-center py-2 space-y-3">
                <p className="text-[11px] text-slate-400 font-semibold text-center mb-1">
                  {pinHintText}
                </p>
                <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-sky-50 border border-sky-200/80 text-sky-800 text-[11px] font-extrabold">
                  <Keyboard className="w-4 h-4 text-sky-600" />
                  <span>พิมพ์รหัสผ่านผ่านแป้นพิมพ์คอมพิวเตอร์ (Keyboard)</span>
                </div>
                <input
                  id="desktopPinInput"
                  type="password"
                  maxLength={4}
                  autoFocus
                  value={pinInput}
                  onChange={(e) => {
                    const clean = e.target.value.replace(/\D/g, '').slice(0, 4);
                    updatePinValue(clean);
                    if (clean.length === 4) {
                      handleKeypadPress(clean[3]);
                    }
                  }}
                  placeholder="••••"
                  className="w-36 mx-auto block text-center font-mono text-2xl tracking-[0.5em] py-2 px-3 rounded-2xl border-2 border-sky-300 focus:border-sky-500 focus:ring-4 focus:ring-sky-100 outline-none bg-sky-50/50 text-slate-800 shadow-inner"
                />
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
