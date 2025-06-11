export interface AppInfo {
  name: string;
  version: string;
  build: string;
  description: string;
  author: string;
  repository: string;
  license: string;
  buildDate: string;
  features: string[];
  technologies: {
    name: string;
    version: string;
    description: string;
  }[];
}

export const appInfo: AppInfo = {
  name: 'GraphLinq Terminal',
  version: '1.0.0',
  build: 'Beta',
  description: 'A modern SSH terminal with integrated artificial intelligence for advanced system administration.',
  author: 'GraphLinq Team',
  repository: 'https://github.com/graphlinq/orion-terminal',
  license: 'MIT',
  buildDate: '2024-12-19',
  features: [],
  technologies: []
}; 