import type { Key } from 'react';

declare module 'react' {
  interface Attributes {
    key?: Key | null;
  }
}

declare global {
  namespace JSX {
    interface IntrinsicAttributes {
      key?: Key | null;
    }
  }
}

export {};
