"use client";

import { WifiOff, Wifi } from "lucide-react";
import { useNetworkState } from "@uidotdev/usehooks";

export function NetworkStatusBanner() {
  const networkState = useNetworkState();

  // Check if connection is slow (less than 1 Mbps downlink)
  const isSlowConnection =
    networkState.online && networkState.downlink && networkState.downlink < 1;

  if (networkState.online && !isSlowConnection) {
    return null;
  }

  const isOffline = !networkState.online;
  const message = isOffline
    ? "No internet connection. Please check your network and try again."
    : "Slow internet connection detected. Uploads may take longer.";

  const Icon = isOffline ? WifiOff : Wifi;

  return (
    <div className="fixed top-0 left-0 right-0 z-50 px-4 sm:px-0">
      <div className="bg-red-600 text-white p-4 flex items-center gap-3">
        <Icon className="h-4 w-4 flex-shrink-0" />
        <span className="text-sm font-medium">{message}</span>
      </div>
    </div>
  );
}
