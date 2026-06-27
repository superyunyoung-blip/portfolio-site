"use client";

import { useState } from "react";

export function ContactForm() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [status, setStatus] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function submitContact(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);
    setStatus("");

    const response = await fetch("/api/contact", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, email, message }),
    });

    setIsSubmitting(false);

    if (!response.ok) {
      const data = await response.json();
      setStatus(data.error ?? "문의 전송에 실패했습니다.");
      return;
    }

    setName("");
    setEmail("");
    setMessage("");
    setStatus("문의가 저장되었습니다. 관리자 페이지에서 확인할 수 있습니다.");
  }

  return (
    <form
      onSubmit={submitContact}
      className="mt-6 grid w-full min-w-0 gap-3 rounded-2xl bg-[#fffdf7] p-4 shadow-sm ring-1 ring-pink-100 sm:p-6"
    >
      <input
        value={name}
        onChange={(event) => setName(event.target.value)}
        placeholder="이름"
        className="w-full min-w-0 rounded-xl border border-[#f5c6d6] bg-white/80 px-4 py-3 outline-none focus:border-[#b8a2ff]"
      />
      <input
        value={email}
        onChange={(event) => setEmail(event.target.value)}
        placeholder="이메일"
        type="email"
        className="w-full min-w-0 rounded-xl border border-[#f5c6d6] bg-white/80 px-4 py-3 outline-none focus:border-[#b8a2ff]"
      />
      <textarea
        value={message}
        onChange={(event) => setMessage(event.target.value)}
        placeholder="문의 내용을 적어주세요"
        rows={5}
        className="w-full min-w-0 rounded-xl border border-[#f5c6d6] bg-white/80 px-4 py-3 outline-none focus:border-[#b8a2ff]"
      />
      <button
        disabled={isSubmitting}
        className="w-full rounded-xl bg-[#b8a2ff] px-4 py-3 font-semibold text-white disabled:opacity-60 sm:w-auto"
      >
        {isSubmitting ? "보내는 중..." : "문의 보내기"}
      </button>
      {status ? <p className="text-sm text-[#6f5a7d]">{status}</p> : null}
    </form>
  );
}
