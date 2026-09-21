import React, { useState } from "react";
import { Link } from "react-router-dom";
import { resetPasswordRequest } from "@/lib/supabaseAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Mail, ArrowLeft, Loader2 } from "lucide-react";
import AuthLayout from "@/components/AuthLayout";

export default function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await resetPasswordRequest(email, window.location.origin + '/reset-password');
    } catch {
    } finally {setLoading(false);
      setSent(true);
    }
  };

  return (
    <AuthLayout
      icon={Mail}
      title="Password dimenticata"
      subtitle="Ti mandiamo un link per reimpostarla"
      footer={
      <Link to="/login" className="font-medium hover:underline text-[#2F5BD8]">
          <ArrowLeft className="w-3 h-3 inline mr-1" />Torna all'accesso
        </Link>
      }>
      
      {sent ?
      <p className="text-sm text-foreground text-center">
          Se esiste un account con questa email, riceverai a breve un link per reimpostare la password.
        </p> :

      <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" aria-hidden="true" />
              <Input
              id="email"
              type="email"
              autoComplete="email"
              autoFocus
              placeholder="tu@esempio.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="pl-10 h-12"
              required />
            
            </div>
          </div>
          <Button type="submit" className="w-full h-12 font-medium bg-[#2F5BD8]" disabled={loading}>
            {loading ?
          <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Invio in corso...
              </> :

          "Invia il link"
          }
          </Button>
        </form>
      }
    </AuthLayout>);

}
