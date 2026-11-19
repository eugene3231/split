export interface InFlightLimiter {
  tryAcquire(deviceKey: string): (() => void) | null;
}

export function createInFlightLimiter(maxTotal: number): InFlightLimiter {
  const devices = new Set<string>();
  return {
    tryAcquire(deviceKey) {
      if (devices.has(deviceKey) || devices.size >= maxTotal) return null;
      devices.add(deviceKey);
      return () => {
        devices.delete(deviceKey);
      };
    },
  };
}
