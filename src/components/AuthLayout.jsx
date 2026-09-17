import React from "react";

const LOGO_URL = "https://pub-1b641aacf1b949cfadd9ca8ab453df1b.r2.dev/legacy/2026-09-16/f1422048-c330-4a0a-8892-0a85294ff01b.png";

export default function AuthLayout({ title, subtitle, footer, children }) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-10">
          <img
            src={LOGO_URL}
            alt="GD Madonie"
            className="w-20 h-20 mx-auto mb-4 rounded-2xl object-contain bg-card border border-border p-2"
          />
          <h1 className="text-3xl font-bold tracking-tight text-foreground">{title}</h1>
          {subtitle && <p className="text-muted-foreground mt-2">{subtitle}</p>}
        </div>
        <div className="bg-card rounded-2xl shadow-sm border border-border p-8">
          {children}
        </div>
        {footer &&
        <p className="text-center text-sm text-muted-foreground mt-6">{footer}</p>
        }
      </div>
    </div>);
}
