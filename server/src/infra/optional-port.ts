export class UnconfiguredPort {
  constructor(readonly portName: string) {}
}

export function isConfigured<T>(port: T | UnconfiguredPort | null | undefined): port is T {
  if (!port) {
    return false;
  }
  return !(port instanceof UnconfiguredPort);
}
