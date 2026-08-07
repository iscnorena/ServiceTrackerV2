import { createNavigation } from "next-intl/navigation";
import { routing } from "./routing";

// Wrappers de Link/router que conservan el locale activo automáticamente.
export const { Link, redirect, usePathname, useRouter, getPathname } =
  createNavigation(routing);
