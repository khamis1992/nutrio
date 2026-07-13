import type { PropsWithChildren } from "react";
import { Route } from "react-router-dom";

export function IonicProvider({ children }: PropsWithChildren) {
  return <>{children}</>;
}

export function IonReactRouter({ children }: PropsWithChildren) {
  return <>{children}</>;
}

export function IonRouterOutlet({ children }: PropsWithChildren) {
  return <>{children}</>;
}

export { Route };
