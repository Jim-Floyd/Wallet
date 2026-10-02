'use client';

import { useLayoutEffect, useRef, useState } from 'react';
import { Input } from '@/components/ui/input';

// "1 500 000,5" kabi yozuvni toza songa ("1500000.5") aylantiradi: vergul ham kasr ajratgich, ortiqcha belgilar tashlanadi
function normalize(input: string, decimals: number) {
  const s = input.replace(/,/g, '.').replace(/[^\d.]/g, '');
  const dot = s.indexOf('.');
  const intPart = (dot === -1 ? s : s.slice(0, dot)).replace(/^0+(?=\d)/, '');
  if (dot === -1 || decimals === 0) return intPart;
  const frac = s.slice(dot + 1).replace(/\./g, '').slice(0, decimals);
  return `${intPart || '0'}.${frac}`;
}

// Butun qismini 3 xonadan bo'sh joy bilan ajratadi
function format(raw: string) {
  const [intPart, frac] = raw.split('.');
  const grouped = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  return frac === undefined ? grouped : `${grouped}.${frac}`;
}

type Props = Omit<React.ComponentProps<'input'>, 'type' | 'value' | 'defaultValue' | 'onChange' | 'name'> & {
  name: string;
  decimals?: number;
  defaultValue?: number | string | null;
  onValueChange?: (value: number) => void;
};

// Summa maydoni: ekranda "1 500 000" ko'rinishida, formaga esa yashirin input orqali toza son ("1500000") yuboriladi
export function AmountInput({ name, decimals = 2, defaultValue, onValueChange, ...props }: Props) {
  const [raw, setRaw] = useState(() =>
    defaultValue == null || defaultValue === '' ? '' : normalize(String(defaultValue), decimals),
  );
  const input = useRef<HTMLInputElement | null>(null);
  const caret = useRef<number | null>(null);

  // Bo'sh joylar qo'shilganda kursor oxiriga sakrab ketmasin
  useLayoutEffect(() => {
    if (caret.current != null && input.current) {
      input.current.setSelectionRange(caret.current, caret.current);
      caret.current = null;
    }
  });

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const el = e.target;
    input.current = el;
    const pos = el.selectionStart ?? el.value.length;
    const charsBefore = el.value.slice(0, pos).replace(/[^\d.,]/g, '').length;

    const next = normalize(el.value, decimals);
    const formatted = format(next);
    let i = 0;
    for (let seen = 0; i < formatted.length && seen < charsBefore; i++) {
      if (formatted[i] !== ' ') seen++;
    }
    caret.current = i;
    setRaw(next);
    onValueChange?.(Number(next) || 0);
  }

  return (
    <>
      <Input
        {...props}
        type="text"
        inputMode="decimal"
        autoComplete="off"
        value={format(raw)}
        onChange={handleChange}
      />
      <input type="hidden" name={name} value={raw} />
    </>
  );
}
