import React from "react";

export default function AuthLayout({ title, subtitle, footer, children }) {
  return (
    <div className="min-h-screen flex items-center justify-center px-4" style={{ backgroundColor: "#0F1B3A" }}>
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="mn-auth-logo">GD MADONIE<span>NEWS</span></div>
          <h1 className="text-3xl font-bold tracking-tight text-white">{title}</h1>
          {subtitle && <p className="text-white/70 mt-2">{subtitle}</p>}
        </div>
        <div className="mn-auth-card bg-card rounded-3xl shadow-xl border border-border p-8">
          {children}
        </div>
        {footer &&
        <p className="text-center text-sm text-white/70 mt-6">{footer}</p>
        }
      </div>
    </div>);
}
