import type { Key } from 'react';
import 'react';

declare module 'react' {
  interface Attributes {
    key?: Key | null;
  }

  namespace JSX {
    interface IntrinsicAttributes {
      key?: Key | null;
    }
  }
}
