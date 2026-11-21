import { useLayoutEffect, useRef, type InputHTMLAttributes } from "react";

type Props = Omit<InputHTMLAttributes<HTMLInputElement>, "value" | "defaultValue" | "onChange" | "type"> & {
  value: string;
  onSearch: (value: string) => void;
};

/** Keep native typing and IME selection intact while the router commits search history. */
export default function DawonSearchInput({ value, onSearch, ...props }: Props) {
  const field = useRef<HTMLInputElement>(null);
  const composing = useRef(false);
  const sent = useRef<string[]>([]);

  useLayoutEffect(() => {
    const acknowledged = sent.current.lastIndexOf(value);
    if (acknowledged >= 0) {
      sent.current.splice(0, acknowledged + 1);
    } else {
      // A reset or browser navigation can supply a value the input never sent.
      sent.current = [];
      if (field.current && field.current.value !== value) field.current.value = value;
    }
  }, [value]);

  function publish(text: string) {
    if (text === (sent.current.at(-1) ?? value)) return;
    sent.current.push(text);
    onSearch(text);
  }

  return <input {...props} type="search" ref={field} defaultValue={value}
    onCompositionStart={() => { composing.current = true; }}
    onCompositionEnd={event => { composing.current = false; publish(event.currentTarget.value); }}
    onChange={event => { if (!composing.current) publish(event.currentTarget.value); }}
  />;
}
