export const logger = {
  error: (message: string, ...details: unknown[]) => {
    console.error(message, ...details);
  },
  info: (message: string, ...details: unknown[]) => {
    console.error(message, ...details);
  },
};
