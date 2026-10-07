'use client';

import React, { useRef, useState, useEffect, useCallback } from "react";
import { transliterateText, isIndianLang } from "../utils/transliterate";

interface TransliterateInputProps {
  name: string;
  value: string;
  onChange: (e: React.ChangeEvent<any>) => void;
  outputLanguage: string;
  placeholder?: string;
  className?: string;
  type?: "input" | "textarea";
  rows?: number;
  required?: boolean;
  uppercase?: boolean;
}

export default function TransliterateInput({
  name,
  value,
  onChange,
  outputLanguage,
  placeholder,
  className = "",
  type = "input",
  rows = 2,
  required = false,
  uppercase = false,
}: TransliterateInputProps) {
  const [localValue, setLocalValue] = useState(value || "");
  const [isTyping, setIsTyping] = useState(false);
  const debounceTimer = useRef<NodeJS.Timeout | null>(null);
  const prefetchCache = useRef<Map<string, string>>(new Map());
  const lastRawValueRef = useRef<string>("");

  // Parent value sync
  useEffect(() => {
    if (value !== localValue && !isTyping) {
      setLocalValue(value || "");
      lastRawValueRef.current = value || "";
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  const shouldTransliterate = isIndianLang(outputLanguage);

  const commitValue = useCallback(
    (finalValue: string) => {
      onChange({
        target: { name, value: finalValue },
      } as any);
    },
    [name, onChange]
  );

  const prefetchWord = useCallback(
    async (word: string) => {
      if (!word || !/[a-zA-Z]/.test(word)) return;
      const cacheKey = `${outputLanguage}:${word.toLowerCase()}`;
      if (prefetchCache.current.has(cacheKey)) return;
      try {
        const result = await transliterateText(word, outputLanguage);
        if (result && result !== word) {
          prefetchCache.current.set(cacheKey, result);
        }
      } catch (e) {}
    },
    [outputLanguage]
  );

  // ✅ NEW: Convert a SINGLE specific word (not just last one)
  const convertWordAt = useCallback(
    async (fullText: string, wordIndex: number): Promise<string> => {
      const words = fullText.split(/(\s+)/);
      const word = words[wordIndex];
      if (!word || !/[a-zA-Z]/.test(word)) return fullText;

      const cacheKey = `${outputLanguage}:${word.toLowerCase()}`;
      let transliterated = prefetchCache.current.get(cacheKey);
      if (!transliterated) {
        transliterated = await transliterateText(word, outputLanguage);
      }

      if (transliterated && transliterated !== word) {
        words[wordIndex] = transliterated;
        return words.join("");
      }
      return fullText;
    },
    [outputLanguage]
  );

  const handleLocalChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    const raw = e.target.value;
    const prevRaw = lastRawValueRef.current;
    lastRawValueRef.current = raw;

    setLocalValue(raw);
    setIsTyping(true);
    commitValue(raw);

    if (debounceTimer.current) clearTimeout(debounceTimer.current);

    if (!shouldTransliterate || !raw.trim()) {
      setIsTyping(false);
      return;
    }

    // ✅ Detect if user just typed a SPACE (word boundary)
    const userTypedSpace =
      raw.length > prevRaw.length &&
      /\s$/.test(raw) &&
      !/\s$/.test(prevRaw);

    if (userTypedSpace) {
      // ✅ IMMEDIATE: Convert the word just before the space
      // Find the word that ends at raw.length - 1 (before the trailing space)
      const trimmed = raw.trimEnd();
      const words = trimmed.split(/(\s+)/);
      // Last non-space word is at index words.length - 1
      const lastWordIndex = words.length - 1;

      // Preserve trailing space
      const trailingSpaces = raw.slice(trimmed.length);
      const lastWord = words[lastWordIndex];

      if (lastWord && /[a-zA-Z]/.test(lastWord)) {
        // Fire async conversion
        (async () => {
          const cacheKey = `${outputLanguage}:${lastWord.toLowerCase()}`;
          let transliterated = prefetchCache.current.get(cacheKey);
          if (!transliterated) {
            transliterated = await transliterateText(lastWord, outputLanguage);
          }

          if (transliterated && transliterated !== lastWord) {
            words[lastWordIndex] = transliterated;
            const newValue = words.join("") + trailingSpaces;
            setLocalValue(newValue);
            lastRawValueRef.current = newValue;
            commitValue(newValue);
          }
          setIsTyping(false);
        })();
        return; // ⏹ Skip debounce for this keystroke
      }
    }

    // Pre-fetch current last word
    const currentWords = raw.split(/\s+/);
    const currentLastWord = currentWords[currentWords.length - 1];
    if (currentLastWord && /[a-zA-Z]/.test(currentLastWord)) {
      prefetchWord(currentLastWord);
    }

    // ✅ DEBOUNCE: Convert last word after user pauses
    debounceTimer.current = setTimeout(async () => {
      const words = raw.split(/(\s+)/);
      const lastWordIndex = words.length - 1;
      const lastWord = words[lastWordIndex];

      if (!lastWord || !/[a-zA-Z]/.test(lastWord)) {
        setIsTyping(false);
        return;
      }

      const cacheKey = `${outputLanguage}:${lastWord.toLowerCase()}`;
      let transliterated = prefetchCache.current.get(cacheKey);
      if (!transliterated) {
        transliterated = await transliterateText(lastWord, outputLanguage);
      }

      if (transliterated && transliterated !== lastWord) {
        words[lastWordIndex] = transliterated;
        const newValue = words.join("");
        setLocalValue(newValue);
        lastRawValueRef.current = newValue;
        commitValue(newValue);
      }

      setIsTyping(false);
    }, 300);
  };

  const handleBlur = async () => {
    if (debounceTimer.current) clearTimeout(debounceTimer.current);

    if (shouldTransliterate && localValue && /[a-zA-Z]/.test(localValue)) {
      setIsTyping(true);

      // ✅ Blur pe SAARE English words convert karo (jaise Google Input Tools)
      const words = localValue.split(/(\s+)/);
      let changed = false;

      for (let i = 0; i < words.length; i++) {
        const w = words[i];
        if (w && /[a-zA-Z]/.test(w)) {
          const cacheKey = `${outputLanguage}:${w.toLowerCase()}`;
          let transliterated = prefetchCache.current.get(cacheKey);
          if (!transliterated) {
            transliterated = await transliterateText(w, outputLanguage);
          }
          if (transliterated && transliterated !== w) {
            words[i] = transliterated;
            changed = true;
          }
        }
      }

      if (changed) {
        const newValue = words.join("");
        setLocalValue(newValue);
        lastRawValueRef.current = newValue;
        commitValue(newValue);
      }
      setIsTyping(false);
    }
  };

  const sharedProps = {
    name,
    value: localValue ?? "",
    onChange: handleLocalChange,
    onBlur: handleBlur,
    placeholder,
    required,
    className: `${className} ${uppercase ? "uppercase" : ""} ${
      isTyping ? "opacity-80" : ""
    }`,
  };

  return type === "textarea" ? (
    <textarea {...sharedProps} rows={rows} />
  ) : (
    <input type="text" {...sharedProps} />
  );
}