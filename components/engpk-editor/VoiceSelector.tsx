'use client';

/**
 * VoiceSelector - Dropdown to select AI teacher's TTS voice
 *
 * Shows available Doubao TTS 2.0 voices with gender labels.
 * Selection is persisted to localStorage.
 */

import { useState } from 'react';
import {
  DOUBAO_VOICES,
  getTeacherVoice,
  setTeacherVoice,
} from '@/lib/engpk/audio/voice-config';

export function VoiceSelector() {
  const [selected, setSelected] = useState(getTeacherVoice);

  function handleChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const voiceId = e.target.value;
    setSelected(voiceId);
    setTeacherVoice(voiceId);
  }

  return (
    <div className="flex items-center gap-2">
      <label className="text-xs text-muted-foreground whitespace-nowrap">
        AI 老师声音:
      </label>
      <select
        value={selected}
        onChange={handleChange}
        className="rounded-md border border-input bg-background px-2 py-1 text-xs outline-none focus:ring-2 focus:ring-ring"
      >
        {DOUBAO_VOICES.filter((v) => v.language === 'zh-CN').map((voice) => (
          <option key={voice.id} value={voice.id}>
            {voice.name} ({voice.gender === 'female' ? '女' : '男'})
          </option>
        ))}
      </select>
    </div>
  );
}
