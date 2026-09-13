"use client";

import { useEffect } from "react";
import { useAuth } from "@clerk/nextjs";
import { setAuthToken } from "@/lib/services";

export default function ClerkTokenSync() {
  const { isLoaded, isSignedIn, getToken } = useAuth();

  useEffect(() => {
    if (!isLoaded || !isSignedIn) {
      setAuthToken(null);
      return;
    }
    getToken().then((token) => setAuthToken(token));
  }, [isLoaded, isSignedIn, getToken]);

  return null;
}
