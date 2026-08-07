import type { ReactNode } from "react";

// El <html>/<body> vive en app/[locale]/layout.tsx y en app/qr/layout.tsx, porque
// el atributo `lang` depende del locale activo. Este layout raíz solo deja pasar.
export default function RootLayout({ children }: { children: ReactNode }) {
  return children;
}
