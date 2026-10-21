"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function JoinByPin({ large }: { large?: boolean }) {
  const [pin, setPin] = useState("");
  const router = useRouter();
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (pin.length === 6) router.push(`/play/${pin}`);
      }}
      className="flex w-full max-w-sm gap-2"
    >
      <input
        className={`input text-center font-mono tracking-[0.3em] ${large ? "py-3 text-2xl" : "text-lg"}`}
        placeholder="GAME PIN"
        inputMode="numeric"
        value={pin}
        onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 6))}
        aria-label="Game PIN"
      />
      <button className="btn-primary px-6" disabled={pin.length !== 6}>Join</button>
    </form>
  );
}
