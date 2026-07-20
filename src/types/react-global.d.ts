import type {
  ElementType as ReactElementType,
  ReactNode as ReactNodeType,
} from 'react';

declare global {
  namespace React {
    type ElementType = ReactElementType;
    type ReactNode = ReactNodeType;
    type Key = string | number | bigint;

    interface Attributes {
      key?: Key | null;
    }

    namespace JSX {
      interface IntrinsicAttributes extends Attributes {}
    }
  }

  namespace JSX {
    interface IntrinsicAttributes extends React.Attributes {}
  }
}

export {};
