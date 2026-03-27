import { useState, useRef, KeyboardEvent } from 'react';
import { iconGoals, iconDoc16, iconBarChart, iconPhoto, iconCamera, iconUpload, iconMicrophone, iconVoice, iconSend, iconSendActive } from '../assets';
import { ActionChip } from '../types';

const CHIP_ICONS: Record<string, string> = {
  'Create performance goals': iconGoals,
  'Analyze doc(s)': iconDoc16,
  'Visualize data': iconBarChart,
};

interface ChatInputProps {
  onSend: (message: string) => void;
  placeholder?: string;
  quickChips?: string[];
  actionChips?: ActionChip[];
  onChipClick?: (chip: ActionChip) => void;
}

function ToolBtn({ children, onClick, gradient }: {
  children: React.ReactNode;
  onClick?: () => void;
  gradient?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      className={`w-11 h-11 flex items-center justify-center rounded-full transition-all shrink-0 cursor-pointer ${
        gradient
          ? 'hover:shadow-[0_2px_15px_rgba(1,44,197,0.3)]'
          : 'hover:bg-bg-hover'
      }`}
      style={gradient ? {
        backgroundImage: 'linear-gradient(183.55deg, #7652B9 16.2%, #B46470 49%, #CA9D8C 109.3%)',
      } : undefined}
    >
      {children}
    </button>
  );
}

/** Exact pixel dimensions from Figma for each toolbar icon within its 24×24 container */
const ICON_DIMS: Record<string, { w: number; h: number; ox?: number; oy?: number }> = {
  Photo:      { w: 18,     h: 17.45 },
  Camera:     { w: 20.4,   h: 17,   ox: 0.2, oy: -0.5 },
  Upload:     { w: 15.43,  h: 19.64 },
  Microphone: { w: 14.45,  h: 22.91 },
  Voice:      { w: 22.5,   h: 18 },
  Send:       { w: 20.257, h: 24,   ox: 0.13 },
};

function IconImg({ src, alt, noTheme }: { src: string; alt: string; noTheme?: boolean }) {
  const dim = ICON_DIMS[alt];
  if (dim) {
    const cx = 12 + (dim.ox || 0);
    const cy = 12 + (dim.oy || 0);
    return (
      <div className="overflow-clip relative shrink-0" style={{ width: 24, height: 24 }}>
        <div
          className="absolute"
          style={{ width: dim.w, height: dim.h, left: cx, top: cy, transform: 'translate(-50%,-50%)' }}
        >
          <img alt={alt} className={`absolute block max-w-none w-full h-full ${noTheme ? '' : 'icon-theme'}`} src={src} />
        </div>
      </div>
    );
  }
  // Fallback for unknown icons
  return (
    <div className="overflow-clip relative shrink-0 flex items-center justify-center" style={{ width: 24, height: 24 }}>
      <img src={src} alt={alt} className={`block ${noTheme ? '' : 'icon-theme'}`} />
    </div>
  );
}

export default function ChatInput({ onSend, placeholder = 'Message WorkPal', quickChips, actionChips, onChipClick }: ChatInputProps) {
  const [value, setValue] = useState('');
  const [focused, setFocused] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleSend = () => {
    if (!value.trim()) return;
    onSend(value.trim());
    setValue('');
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleInput = () => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = Math.min(textareaRef.current.scrollHeight, 120) + 'px';
    }
  };

  const canSend = value.trim().length > 0;
  const isMultiline = textareaRef.current ? textareaRef.current.scrollHeight > 44 : false;
  const isActive = focused || canSend;

  return (
    <div className="w-full flex flex-col gap-4">
      {/* Quick chips */}
      {quickChips && quickChips.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {quickChips.map(chip => (
            <button
              key={chip}
              onClick={() => onSend(chip)}
              className="chip-gradient-hover flex items-center gap-1 px-3 py-1 rounded-full border border-stroke-outline text-base leading-[22px] text-text-primary transition-colors cursor-pointer"
            >
              {CHIP_ICONS[chip] && (
                <div className="relative overflow-hidden w-4 h-4 shrink-0 flex items-center justify-center">
                  <img src={CHIP_ICONS[chip]} alt="" className="max-w-full max-h-full object-contain opacity-70 icon-theme" />
                </div>
              )}
              {chip}
            </button>
          ))}
        </div>
      )}

      {/* Action chips from last AI message */}
      {actionChips && actionChips.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {actionChips.map(chip => (
            <button
              key={chip.action}
              onClick={() => onChipClick?.(chip)}
              className="chip-gradient-hover px-3 py-1 rounded-full border border-stroke-outline text-base leading-[22px] text-text-primary transition-colors cursor-pointer"
            >
              {chip.label}
            </button>
          ))}
        </div>
      )}

      {/* Text field — follows Figma component library states */}
      <div
        className={`px-4 py-4 flex items-center transition-all ${
          isActive
            ? (isMultiline ? 'rounded-lg' : 'rounded-full')
            : 'rounded-full input-gradient-hover'
        }`}
        style={
          isActive
            ? {
                border: '2px solid transparent',
                background: 'linear-gradient(var(--color-bg-page), var(--color-bg-page)) padding-box, linear-gradient(74deg, #7652B9 0%, #B46470 52%, #CA9D8C 100%) border-box',
              }
            : { border: '2px solid transparent', background: 'var(--color-bg-message)' }
        }
      >
        <textarea
          ref={textareaRef}
          value={value}
          onChange={e => { setValue(e.target.value); handleInput(); }}
          onKeyDown={handleKeyDown}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          placeholder={placeholder}
          rows={1}
          className="w-full bg-transparent resize-none outline-none text-text-primary placeholder-text-tertiary"
          style={{
            fontFamily: 'Inter, system-ui, sans-serif',
            fontSize: 16,
            lineHeight: '22px',
            letterSpacing: '0px',
          }}
        />
      </div>

      {/* Toolbar — separate row */}
      <div className="flex items-center justify-between">
        {/* Left tools — @, Photo, Camera, Upload */}
        <div className="flex items-center gap-4">
          {/* @ mention */}
          <ToolBtn>
            <span
              className="text-[23px] leading-7 font-medium text-text-primary tracking-[1.74px] select-none"
              style={{ fontFamily: 'SF Pro, system-ui, sans-serif' }}
            >
              @
            </span>
          </ToolBtn>
          <ToolBtn>
            <IconImg src={iconPhoto} alt="Photo" />
          </ToolBtn>
          <ToolBtn>
            <IconImg src={iconCamera} alt="Camera" />
          </ToolBtn>
          <ToolBtn>
            <IconImg src={iconUpload} alt="Upload" />
          </ToolBtn>
        </div>

        {/* Right tools — Microphone, Voice, Send */}
        <div className="flex items-center gap-4">
          <ToolBtn>
            <IconImg src={iconMicrophone} alt="Microphone" />
          </ToolBtn>
          {focused || canSend ? (
            <ToolBtn
              onClick={canSend ? handleSend : undefined}
              gradient={canSend}
            >
              {canSend ? (
                <IconImg src={iconSendActive} alt="Send" noTheme />
              ) : (
                <IconImg src={iconSend} alt="Send" />
              )}
            </ToolBtn>
          ) : (
            <ToolBtn>
              <IconImg src={iconVoice} alt="Voice" />
            </ToolBtn>
          )}
        </div>
      </div>
    </div>
  );
}
