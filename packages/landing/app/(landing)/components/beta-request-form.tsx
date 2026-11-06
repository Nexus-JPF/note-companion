'use client';

import { Button } from "@/components/ui/button";
import { Mail, Send, CheckCircle } from "lucide-react";
import { useState, useTransition } from "react";
import { submitBetaRequest } from "../actions";

interface BetaRequestFormProps {
  className?: string;
  formId?: string;
  source?: string;
  buttonLabel?: string;
  helperText?: string;
  successTitle?: string;
  successText?: string;
}

export function BetaRequestForm({ 
  className = "", 
  formId = "form-" + Math.random().toString(36).substring(2, 9),
  source,
  buttonLabel = "Get Access Now",
  helperText = "Access instructions will be sent to your email immediately.",
  successTitle = "Thanks for joining!",
  successText = "You now have beta access! Check your email for login instructions to start using Note Companion Mobile.",
}: BetaRequestFormProps) {
  const [isPending, startTransition] = useTransition();
  const [isSuccess, setIsSuccess] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [email, setEmail] = useState("");

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    
    if (!email) {
      setErrorMessage("Please enter your email address");
      return;
    }
    
    setErrorMessage(null);
    
    startTransition(async () => {
      try {
        const result = await submitBetaRequest(email, source);
        
        if (result.success) {
          setIsSuccess(true);
        } else {
          setErrorMessage(result.message || "Something went wrong. Please try again.");
        }
      } catch (error) {
        console.error("Error:", error);
        setErrorMessage("An unexpected error occurred. Please try again later.");
      }
    });
  };

  return (
    <div className={`${className} beta-request-form-container`}>
      {!isSuccess ? (
        <div className="form-container">
          <form 
            id={formId}
            className="flex flex-col sm:flex-row gap-2 w-full max-w-md mx-auto"
            onSubmit={(e) => { void handleSubmit(e); }}
          >
            <div className="relative flex-1">
              <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground/70" />
              <input 
                type="email" 
                name="email" 
                placeholder="Your email address" 
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                disabled={isPending}
                className="w-full py-2 px-10 rounded-lg border border-border focus:outline-none focus:ring-2 focus:ring-primary/40 bg-background"
              />
            </div>
            <Button 
              type="submit" 
              disabled={isPending}
            >
              {isPending ? "Requesting..." : buttonLabel}
              <Send className="ml-2 h-4 w-4" />
            </Button>
          </form>
          {errorMessage && (
            <p className="text-red-500 text-xs mt-2 text-center">{errorMessage}</p>
          )}
          <p className="text-xs text-muted-foreground mt-2 text-center">
            {helperText}
          </p>
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center py-4">
          <div className="bg-green-50 text-green-800 rounded-full p-2 mb-3">
            <CheckCircle className="h-6 w-6" />
          </div>
          <h4 className="text-lg font-medium mb-1">{successTitle}</h4>
          <p className="text-muted-foreground text-sm text-center max-w-md">
            {successText}
          </p>
        </div>
      )}
    </div>
  );
} 