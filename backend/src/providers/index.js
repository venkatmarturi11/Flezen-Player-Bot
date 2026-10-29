import { config } from '../config.js';
import { FlezenProvider } from './flezen/FlezenProvider.js';

/**
 * Provider registry. To add a service, create a provider module that extends
 * BaseProvider and add it here (and its hostnames to ALLOWED_HOSTS).
 */
export function createProviders(cfg = config, overrides = {}) {
  return [
    new FlezenProvider({
      allowedHosts: cfg.allowedHosts,
      apiKey: cfg.flezenApiKey,
      fz: cfg.flezenFz,
      rt: cfg.flezenRt,
      ...overrides.flezen,
    }),
  ];
}

export function findProvider(providers, url) {
  return providers.find((p) => p.canHandle(url)) || null;
}
