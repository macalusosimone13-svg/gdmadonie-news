import React, { useState } from "react";
import { Link } from "react-router-dom";
import { loginWithPassword, loginWithGoogle } from "@/lib/supabaseAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { LogIn, Mail, Lock, Loader2 } from "lucide-react";
import AuthLayout from "@/components/AuthLayout";
import GoogleIcon from "@/components/GoogleIcon";
import { safeReturnTo } from "@/lib/authReturnTo";

// Il login con Google richiede di configurare le credenziali OAuth su Google
// Cloud Console e collegarle a Supabase Auth. Se non è ancora fatto, imposta
// questo a false per nascondere il pulsante ed evitare un errore poco chiaro.
const GOOGLE_LOGIN_ENABLED = true;

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const returnTo = safeReturnTo();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await loginWithPassword(email, password);
      window.location.href = returnTo;
    } catch (err) {
      setError(err.message || "Email o password non validi");
    } finally {
      setLoading(false);
    }
  };

  const handleGoogle = () => {
    loginWithGoogle(window.location.origin + returnTo);
  };

  return (
    <AuthLayout
      icon={LogIn}
      title="Bentornato"
      subtitle="Accedi al tuo account"
      footer={
      <>
          Non hai un account?{" "}
          <Link
          to={"/register" + (returnTo !== "/" ? "?returnTo=" + encodeURIComponent(returnTo) : "")}
          className="font-medium hover:underline text-[#ff7124]">
          
            Creane uno
          </Link>
        </>
      }>
      
      {GOOGLE_LOGIN_ENABLED && <>
      <Button
        variant="outline"
        className="w-full h-12 text-sm font-medium mb-6"
        onClick={handleGoogle}>
        
        <GoogleIcon className="w-5 h-5 mr-2" />
        Continua con Google
      </Button>

      <div className="relative mb-6">
        <div className="absolute inset-0 flex items-center">
          <div className="w-full border-t border-border" />
        </div>
        <div className="relative flex justify-center text-xs uppercase">
          <span className="bg-card px-3 text-muted-foreground">oppure</span>
        </div>
      </div>
      </>}

      {error &&
      <div className="mb-4 p-3 rounded-lg bg-destructive/10 text-destructive text-sm">
          {error}
        </div>
      }

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
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label htmlFor="password">Password</Label>
            <Link to="/forgot-password" className="text-xs hover:underline text-[#ff7124]">
              Password dimenticata?
            </Link>
          </div>
          <div className="relative">
            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" aria-hidden="true" />
            <Input
              id="password"
              type="password"
              autoComplete="current-password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="pl-10 h-12"
              required />
            
          </div>
        </div>
        <Button type="submit" className="w-full h-12 font-medium bg-[#ff7124]" disabled={loading}>
          {loading ?
          <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Accesso in corso...
            </> :

          "Accedi"
          }
        </Button>
      </form>
    </AuthLayout>);

}
