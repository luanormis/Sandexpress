"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";

interface UseVendorAuthReturn {
  isLoading: boolean;
  error: string | null;
  login: (document_login: string, password: string) => Promise<void>;
  logout: () => void;
  vendorId: string | null;
  isAuthenticated: boolean;
}

export function useVendorAuth(): UseVendorAuthReturn {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  const vendorId = typeof window !== "undefined" 
    ? sessionStorage.getItem("vendor_id") 
    : null;
  
  const isAuthenticated = !!vendorId;

  const login = useCallback(
    async (document_login: string, password: string) => {
      setIsLoading(true);
      setError(null);

      try {
        const response = await fetch("/api/auth/vendor", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ document_login, password }),
        });

        const result = await response.json();

        if (!response.ok) {
          throw new Error(result.error || "Falha no login");
        }

        sessionStorage.setItem("vendor_id", result.vendor_id);
        sessionStorage.setItem("vendor_token", result.token);
        sessionStorage.setItem("vendor_name", result.vendor_name);

        if (result.must_change_password) {
          router.push("/vendor/change-password");
        } else {
          router.push("/vendor/dashboard");
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : "Erro ao conectar";
        setError(message);
      } finally {
        setIsLoading(false);
      }
    },
    [router]
  );

  const logout = useCallback(() => {
    sessionStorage.removeItem("vendor_id");
    sessionStorage.removeItem("vendor_token");
    sessionStorage.removeItem("vendor_name");
    router.push("/vendor/login");
  }, [router]);

  return {
    isLoading,
    error,
    login,
    logout,
    vendorId,
    isAuthenticated,
  };
}

