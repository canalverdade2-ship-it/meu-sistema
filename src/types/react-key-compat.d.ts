import 'react';
import type { Key } from 'react';

declare module 'react' {
  interface Attributes {
    key?: Key | null;
  }
}

export {};
