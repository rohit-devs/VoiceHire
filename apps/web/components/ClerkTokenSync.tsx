"use client";

import { useEffect } from "react";
import { useAuth } from "@clerk/nextjs";
import { setAuthToken, setAuthTokenProvider } from "@/lib/services";

export default function ClerkTokenSync() {
  const { isLoaded, isSignedIn, getToken } = useAuth();

  useEffect(() => {
    if (!isLoaded) {
      return;
    }
    if (!isSignedIn) {
      setAuthToken(null);
      setAuthTokenProvider(null);
      return;
    }
    let active = true;
    const provider = async () => {
      const token = await getToken();
      if (active) setAuthToken(token);
      return token;
    };
    setAuthTokenProvider(provider);
    void provider();
    return () => {
      active = false;
      setAuthTokenProvider(null);
      setAuthToken(null);
    };
  }, [isLoaded, isSignedIn, getToken]);

  return null;
}
