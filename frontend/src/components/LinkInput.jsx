import { useState } from 'react';

export const PLACEHOLDER = 'Paste a Flezen video or supported link...';

export default function LinkInput({ value, onChange, onSubmit, disabled }) {
  const [pasteNote, setPasteNote] = useState('');
  const canPaste = typeof navigator !== 'undefined' && !!navigator.clipboard?.readText;

  async function paste() {
    setPasteNote('');
    try {
      const text = await navigator.clipboard.readText();
      onChange(text.trim());
    } catch {
      // Permission denied or blocked by the webview: tell the user how to proceed.
      setPasteNote('Clipboard access was blocked. Long-press the field and choose Paste.');
    }
  }

  return (
    <div className="field">
      <div className="input-row">
        <input
          className="input"
          type="url"
          inputMode="url"
          autoComplete="off"
          autoCapitalize="off"
          spellCheck={false}
          placeholder={PLACEHOLDER}
          aria-label="Flezen link"
          value={value}
          disabled={disabled}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && onSubmit()}
        />
        {canPaste && (
          <button type="button" className="btn-paste" onClick={paste} disabled={disabled}>
            Paste
          </button>
        )}
      </div>
      {pasteNote && <p className="note" role="status">{pasteNote}</p>}
    </div>
  );
}
