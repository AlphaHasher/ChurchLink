import { mergeConfig, type UserConfig } from 'vite';

const parseAllowedHosts = () => {
  const raw = process.env.VITE_ALLOWED_HOSTS;
  if (!raw) return [] as string[];
  return raw
    .split(',')
    .map((host) => host.trim())
    .filter(Boolean);
};

export default (config: UserConfig) => {
  const allowedHosts = parseAllowedHosts();

  return mergeConfig(config, {
    resolve: {
      alias: {
        '@': '/src',
      },
    },
    server: {
      allowedHosts,
    },
  });
};
