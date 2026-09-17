import React, { useState } from "react";
import { Link } from "react-router-dom";
import { registerWithPassword, verifySignupCode, resendSignupCode, loginWithGoogle } from "@/lib/supabaseAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { UserPlus, Mail, Lock, Loader2 } from "lucide-react";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import AuthLayout from "@/components/AuthLayout";
import GoogleIcon from "@/components/GoogleIcon";
import { toast } from "@/components/ui/use-toast";
import { safeReturnTo } from "@/lib/authReturnTo";

const GOOGLE_LOGIN_ENABLED = true;

export default function Register() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showOtp, setShowOtp] = useState(false);
  const [otpCode, setOtpCode] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    if (password !== confirmPassword) {
      setError("Le password non coincidono");
      return;
    }
    setLoading(true);
    try {
      await registerWithPassword(email, password);
      setShowOtp(true);
    } catch (err) {
      setError(err.message || "Registrazione non riuscita");
    } finally {
      setLoading(false);
    }
  };

  const handleVerify = async () => {
    setError("");
    setLoading(true);
    try {
      await verifySignupCode(email, otpCode);
      window.location.href = safeReturnTo();
    } catch (err) {
      setError(err.message || "Codice non valido");
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    setError("");
    try {
      await resendSignupCode(email);
      toast({
        title: "Codice inviato",
        description: "Controlla la tua email per il nuovo codice."
      });
    } catch (err) {
      setError(err.message || "Invio del codice non riuscito");
    }
  };

  const handleGoogle = () => {
    loginWithGoogle(window.location.origin + safeReturnTo());
  };

  if (showOtp) {
    return (
      <AuthLayout
        icon={Mail}
        title="Verifica la tua email"
        subtitle={`Ti abbiamo inviato un codice a ${email}`}>
        
        {error &&
        <div className="mb-4 p-3 rounded-lg bg-destructive/10 text-destructive text-sm">
            {error}
          </div>
        }
        <div className="flex justify-center mb-6">
          <InputOTP
            maxLength={6}
            value={otpCode}
            onChange={setOtpCode}
            autoFocus
            autoComplete="one-time-code">
            
            <InputOTPGroup>
              <InputOTPSlot index={0} />
              <InputOTPSlot index={1} />
              <InputOTPSlot index={2} />
              <InputOTPSlot index={3} />
              <InputOTPSlot index={4} />
              <InputOTPSlot index={5} />
            </InputOTPGroup>
          </InputOTP>
        </div>
        <Button
          className="w-full h-12 font-medium"
          onClick={handleVerify}
          disabled={loading || otpCode.length < 6}>
          
          {loading ?
          <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Verifica in corso...
            </> :

          "Verifica"
          }
        </Button>
        <p className="text-center text-sm text-muted-foreground mt-4">
          Non hai ricevuto il codice?{" "}
          <button onClick={handleResend} className="text-primary font-medium hover:underline">
            Invia di nuovo
          </button>
        </p>
      </AuthLayout>);

  }

  return (
    <AuthLayout
      icon={UserPlus}
      title="Benvenuti su GD Madonie"
      subtitle="Crea il tuo account per iniziare"
      footer={
      <>
          Hai già un account?{" "}
          <Link
          to={"/login" + (safeReturnTo() !== "/" ? "?returnTo=" + encodeURIComponent(safeReturnTo()) : "")}
          className="font-medium hover:underline text-[#ff7124]">
          
            Accedi
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
          <Label htmlFor="password">Password</Label>
          <div className="relative">
            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" aria-hidden="true" />
            <Input
              id="password"
              type="password"
              autoComplete="new-password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="pl-10 h-12"
              required />
            
          </div>
        </div>
        <div className="space-y-2">
          <Label htmlFor="confirm">Conferma password</Label>
          <div className="relative">
            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" aria-hidden="true" />
            <Input
              id="confirm"
              type="password"
              autoComplete="new-password"
              placeholder="••••••••"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="pl-10 h-12"
              required />
            
          </div>
        </div>
        <Button type="submit" className="w-full h-12 font-medium bg-[#ff7124]" disabled={loading}>
          {loading ?
          <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Creazione account...
            </> :

          "Crea account"
          }
        </Button>
      </form>
    </AuthLayout>);

}
